import { failure, type AppError, type Result } from '../contracts/errors';
import { LIMITS } from '../contracts/limits';
import type { RunIdentity, RunStatus } from '../contracts/session';
import type { JsonObject } from '../contracts/workflow';
import {
  idleRuntime,
  type FinalOutput,
  type NodeRunRecord,
  type RunResult,
  type RunTimings,
  type RuntimeView,
  type SkipReason,
  type TimelineEvent,
} from '../contracts/execution';
import type { WorkerMessage } from '../contracts/worker';
import { canonicalJson, utf8Bytes } from '../domain/json/canonical';
import { isJsonObject } from '../domain/json/path';
import { portKey } from '../domain/graph/indexes';
import { freezeJson, inspectJson, PAYLOAD_BUDGET } from '../validation/json-safety';
import type { ExecutionPlan } from './compile';

const transitions: Readonly<Record<RunStatus, readonly RunStatus[]>> = {
  idle: ['validating'],
  validating: ['ready', 'failed', 'cancelled'],
  ready: ['running', 'failed', 'cancelled'],
  running: ['paused', 'completed', 'failed', 'cancelled'],
  paused: ['running', 'failed', 'cancelled'],
  completed: ['idle'],
  failed: ['idle'],
  cancelled: ['idle'],
};
export const allowedTransition = (from: RunStatus, to: RunStatus): boolean =>
  transitions[from].includes(to);
const protocol = () => failure('WORKER_PROTOCOL', 'execution');

// The host and pure scheduler share contract reduction, never mutable state.
export class RunLedger {
  view: RuntimeView;
  sequence = 0;
  operations = 0;
  producedBytes = 0;
  retainedBytes = 0;
  compileMs = 0;
  private cursor = 0;
  private readySeen = false;
  private warningSeen = false;
  private staged = new Map<string, JsonObject>();
  private eventBytes = 0;
  private eventSizes: number[] = [];
  constructor(
    readonly identity: RunIdentity,
    readonly plan: ExecutionPlan | null,
  ) {
    this.view = {
      ...idleRuntime(),
      status: 'validating',
      identity,
      records: new Map(
        (plan?.order ?? []).map((nodeId) => [nodeId, { nodeId, disposition: 'pending' }]),
      ),
    };
  }
  inputId(nodeId: string): string | undefined {
    const edge = this.plan?.indexes.incoming.get(portKey(nodeId, 'in'));
    return edge
      ? this.view.records.get(edge.source.nodeId)?.outputPayloadIds?.[edge.source.port]
      : undefined;
  }
  skipReason(nodeId: string): SkipReason | undefined {
    if (!this.plan?.reachable.has(nodeId)) return 'unreachable';
    if (this.plan.indexes.nodeById.get(nodeId)?.type === 'manualTrigger' || this.inputId(nodeId))
      return undefined;
    const edge = this.plan.indexes.incoming.get(portKey(nodeId, 'in'));
    const parent = edge ? this.view.records.get(edge.source.nodeId) : undefined;
    return edge &&
      parent?.disposition === 'completed' &&
      this.plan.indexes.nodeById.get(edge.source.nodeId)?.type === 'condition'
      ? 'branch-not-selected'
      : 'upstream-skipped';
  }
  private record(record: NodeRunRecord) {
    this.view = { ...this.view, records: new Map(this.view.records).set(record.nodeId, record) };
  }
  private append(message: WorkerMessage, atMs: number): Result<true> {
    if (message.kind === 'payload-record') return { ok: true, value: true };
    const event: TimelineEvent = {
      sequence: message.sequence,
      atMs,
      kind: message.kind,
      ...('nodeId' in message ? { nodeId: message.nodeId } : {}),
      ...(message.kind === 'state' ? { status: message.status } : {}),
      ...(message.kind === 'terminal'
        ? {
            status: message.result.status,
            ...(message.result.error ? { code: message.result.error.code } : {}),
          }
        : {}),
      ...('code' in message && message.code ? { code: message.code } : {}),
      ...('durationMs' in message ? { durationMs: message.durationMs } : {}),
      ...(message.kind === 'control-ack' ? { requestId: message.requestId } : {}),
      ...(message.kind === 'node-complete' && message.outputPayloadIds.true
        ? { port: 'true' as const }
        : {}),
      ...(message.kind === 'node-complete' && message.outputPayloadIds.false
        ? { port: 'false' as const }
        : {}),
    };
    const bytes = utf8Bytes(JSON.stringify(event));
    if (bytes > LIMITS.MAX_EVENT_BYTES) return protocol();
    const events = [...this.view.events, event];
    this.eventSizes.push(bytes);
    this.eventBytes += bytes;
    let evicted = this.view.eventsEvicted;
    while (
      events.length > LIMITS.MAX_DIAGNOSTIC_EVENTS ||
      this.eventBytes > LIMITS.MAX_DIAGNOSTIC_BYTES
    ) {
      events.shift();
      this.eventBytes -= this.eventSizes.shift() ?? 0;
      evicted++;
    }
    this.view = { ...this.view, events, eventsEvicted: evicted };
    return { ok: true, value: true };
  }
  private complete(
    message: Extract<WorkerMessage, { readonly kind: 'node-complete' }>,
  ): Result<true> {
    const node = this.plan?.indexes.nodeById.get(message.nodeId),
      old = this.view.records.get(message.nodeId);
    if (!node || old?.disposition !== 'running' || this.plan?.order[this.cursor] !== node.id)
      return protocol();
    const ports = Object.keys(message.outputPayloadIds);
    if (
      node.type === 'note' ||
      (node.type === 'output'
        ? ports.length !== 0
        : node.type === 'condition'
          ? ports.length !== 1 || !['true', 'false'].includes(ports[0] ?? '')
          : ports.length !== 1 || ports[0] !== 'out')
    )
      return protocol();
    let produced = 0;
    const used = new Set<string>();
    for (const id of Object.values(message.outputPayloadIds)) {
      const value = this.staged.get(id) ?? this.view.payloads.get(id);
      if (!value) return protocol();
      if (node.type === 'condition' && id !== old.inputPayloadId) return protocol();
      produced += utf8Bytes(canonicalJson(value));
      used.add(id);
    }
    if ([...this.staged.keys()].some((id) => !used.has(id))) return protocol();
    if (this.producedBytes + produced > LIMITS.MAX_RUN_PAYLOAD_BYTES)
      return failure('RESOURCE_LIMIT', 'resource', {
        limitName: 'MAX_RUN_PAYLOAD_BYTES',
        actualCount: this.producedBytes + produced,
      });
    const payloads = new Map(this.view.payloads);
    let retained = this.retainedBytes;
    for (const [id, value] of this.staged) {
      payloads.set(id, value);
      retained += utf8Bytes(canonicalJson(value));
    }
    if (retained > LIMITS.MAX_RUN_PAYLOAD_BYTES)
      return failure('RESOURCE_LIMIT', 'resource', {
        limitName: 'MAX_RUN_PAYLOAD_BYTES',
        actualCount: retained,
      });
    let outputs: readonly FinalOutput[] = this.view.outputs;
    if (node.type === 'output') {
      if (!old.inputPayloadId || !payloads.has(old.inputPayloadId)) return protocol();
      outputs = [
        ...outputs,
        {
          nodeId: node.id,
          name: node.config.name,
          payloadId: old.inputPayloadId,
          sequenceIndex: outputs.length,
        },
      ];
    }
    this.producedBytes += produced;
    this.retainedBytes = retained;
    this.staged.clear();
    this.cursor++;
    this.view = { ...this.view, payloads, outputs };
    this.record({
      ...old,
      disposition: 'completed',
      outputPayloadIds: message.outputPayloadIds,
      durationMs: message.durationMs,
    });
    return { ok: true, value: true };
  }
  makeResult(status: RunResult['status'], timings: RunTimings, error?: AppError): RunResult {
    const nodeRecords = [...this.view.records.values()].map((record): NodeRunRecord => {
      if (!['pending', 'running'].includes(record.disposition)) return record;
      if (status === 'cancelled') return { ...record, disposition: 'cancelled' };
      if (record.disposition === 'running' && error)
        return { ...record, disposition: 'failed', errorCode: error.code };
      return { ...record, disposition: 'skipped', skipReason: 'run-failed' };
    });
    return {
      runId: this.identity.runId,
      sessionId: this.identity.sessionId,
      semanticRevision: this.identity.semanticRevision,
      status,
      nodeRecords,
      outputs: this.view.outputs,
      partial: status !== 'completed',
      ...(error ? { error } : {}),
      timings,
      counts: {
        operations: this.operations,
        completed: nodeRecords.filter((r) => r.disposition === 'completed').length,
        skipped: nodeRecords.filter((r) => r.disposition === 'skipped').length,
        failed: nodeRecords.filter((r) => r.disposition === 'failed').length,
        cancelled: nodeRecords.filter((r) => r.disposition === 'cancelled').length,
        eventsEvicted: this.view.eventsEvicted,
      },
    };
  }
  private terminal(result: RunResult): Result<true> {
    const { status, timings, error } = result;
    if (error?.context.runId !== undefined && error.context.runId !== this.identity.runId)
      return protocol();
    if (this.plan && error) {
      const context = error.context;
      if (
        (context.workflowId !== undefined && context.workflowId !== this.plan.document.id) ||
        (context.nodeId !== undefined &&
          (!this.plan.indexes.nodeById.has(context.nodeId) ||
            this.plan.indexes.nodeById.get(context.nodeId)?.type === 'note')) ||
        (context.edgeId !== undefined && !this.plan.indexes.edgeById.has(context.edgeId))
      )
        return protocol();
    }
    if (
      !allowedTransition(this.view.status, status) ||
      (status === 'failed') !== (error !== undefined) ||
      result.runId !== this.identity.runId ||
      result.sessionId !== this.identity.sessionId ||
      result.semanticRevision !== this.identity.semanticRevision ||
      (status === 'completed' && (this.cursor !== this.plan?.order.length || !this.readySeen)) ||
      (status === 'completed' && !result.outputs.length && !this.warningSeen) ||
      Math.abs(timings.wallMs - timings.activeMs - timings.pausedMs) > 0.01 ||
      timings.compileMs > timings.activeMs + 0.01
    )
      return protocol();
    const expected = this.makeResult(status, timings, error);
    if (
      JSON.stringify(expected.nodeRecords) !== JSON.stringify(result.nodeRecords) ||
      JSON.stringify(expected.outputs) !== JSON.stringify(result.outputs) ||
      expected.partial !== result.partial ||
      JSON.stringify(expected.counts) !== JSON.stringify(result.counts)
    )
      return protocol();
    this.staged.clear();
    this.view = {
      ...this.view,
      status,
      records: new Map(result.nodeRecords.map((r) => [r.nodeId, r])),
      result,
      error: error ?? null,
      pausePending: false,
      cancelPending: false,
    };
    return { ok: true, value: true };
  }
  accept(message: WorkerMessage, atMs: number): Result<RuntimeView> {
    if (
      message.sequence !== this.sequence + 1 ||
      message.runId !== this.identity.runId ||
      message.sessionId !== this.identity.sessionId ||
      message.semanticRevision !== this.identity.semanticRevision
    )
      return protocol();
    let checked: Result<true> = { ok: true, value: true };
    const nodeId = 'nodeId' in message ? message.nodeId : undefined;
    const old = nodeId ? this.view.records.get(nodeId) : undefined;
    switch (message.kind) {
      case 'ready':
        if (
          this.view.status !== 'validating' ||
          this.readySeen ||
          JSON.stringify(message.order) !== JSON.stringify(this.plan?.order)
        )
          return protocol();
        this.readySeen = true;
        this.compileMs = message.compileMs;
        break;
      case 'state':
        if (
          !['ready', 'running', 'paused'].includes(message.status) ||
          !allowedTransition(this.view.status, message.status) ||
          (message.status === 'ready' && !this.readySeen) ||
          (message.status === 'paused' &&
            [...this.view.records.values()].some((r) => r.disposition === 'running'))
        )
          return protocol();
        this.view = { ...this.view, status: message.status, pausePending: false };
        break;
      case 'control-ack':
        break;
      case 'node-start':
        if (
          this.view.status !== 'running' ||
          old?.disposition !== 'pending' ||
          this.plan?.order[this.cursor] !== message.nodeId ||
          this.skipReason(message.nodeId) ||
          message.inputPayloadId !== this.inputId(message.nodeId)
        )
          return protocol();
        if (this.operations + 1 > LIMITS.MAX_RUN_STEPS)
          return failure('RESOURCE_LIMIT', 'resource', {
            limitName: 'MAX_RUN_STEPS',
            actualCount: this.operations + 1,
          });
        this.operations++;
        this.record({
          nodeId: message.nodeId,
          disposition: 'running',
          ...(message.inputPayloadId ? { inputPayloadId: message.inputPayloadId } : {}),
        });
        break;
      case 'payload-record': {
        if (
          this.view.status !== 'running' ||
          old?.disposition !== 'running' ||
          this.view.payloads.has(message.payloadId) ||
          this.staged.has(message.payloadId)
        )
          return protocol();
        const safe = inspectJson(message.value, PAYLOAD_BUDGET);
        if (!safe.ok) return safe;
        if (!isJsonObject(safe.value) || this.staged.size >= 1) return protocol();
        this.staged.set(message.payloadId, freezeJson(safe.value));
        break;
      }
      case 'node-complete':
        if (this.view.status !== 'running') return protocol();
        checked = this.complete(message);
        break;
      case 'node-skip':
        if (
          this.view.status !== 'running' ||
          old?.disposition !== 'pending' ||
          this.plan?.order[this.cursor] !== message.nodeId ||
          message.reason !== this.skipReason(message.nodeId)
        )
          return protocol();
        this.record({ nodeId: message.nodeId, disposition: 'skipped', skipReason: message.reason });
        this.cursor++;
        break;
      case 'node-fail':
        if (this.view.status !== 'running' || old?.disposition !== 'running') return protocol();
        this.staged.clear();
        this.record({
          ...old,
          disposition: 'failed',
          errorCode: message.code,
          durationMs: message.durationMs,
        });
        break;
      case 'warning':
        if (
          this.warningSeen ||
          this.view.status !== 'running' ||
          this.cursor !== this.plan?.order.length ||
          this.view.outputs.length
        )
          return protocol();
        this.warningSeen = true;
        break;
      case 'terminal':
        checked = this.terminal(message.result);
        break;
    }
    if (!checked.ok) return checked;
    this.sequence = message.sequence;
    const appended = this.append(message, atMs);
    return appended.ok ? { ok: true, value: this.view } : appended;
  }
}
