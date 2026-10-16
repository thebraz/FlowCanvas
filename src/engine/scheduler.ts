import { failure, type AppError, type Result } from '../contracts/errors';
import { LIMITS } from '../contracts/limits';
import type { RunIdentity } from '../contracts/session';
import type { HostBody, WorkerBody, WorkerMessage } from '../contracts/worker';
import type { JsonObject, SourcePort } from '../contracts/workflow';
import type { RunResult, RunTimings } from '../contracts/execution';
import { canonicalJson, utf8Bytes } from '../domain/json/canonical';
import { isJsonObject } from '../domain/json/path';
import { inspectJson, PAYLOAD_BUDGET } from '../validation/json-safety';
import type { ExecutionPlan } from './compile';
import { executeNode, type HandlerResult, type NodeHandler } from './nodes';
import { RunLedger } from './ledger';

export interface EnginePorts {
  readonly now: () => number;
  readonly yieldControl: () => Promise<void>;
  readonly publish: (message: WorkerMessage) => void;
  readonly handler?: NodeHandler; // Injected only by isolated test fixtures; production uses the closed registry.
}
export class ExecutionEngine {
  readonly ledger: RunLedger;
  private stopped = false;
  private pauseRequested = false;
  private stepping = false;
  private remainingStep = 0;
  private wake: (() => void) | null = null;
  private loopStarted = false;
  private pausedAt: number | null = null;
  private pausedMs = 0;
  private compileMs = 0;
  constructor(
    readonly identity: RunIdentity,
    readonly plan: ExecutionPlan | null,
    private readonly ports: EnginePorts,
    private readonly startedAt = ports.now(),
  ) {
    this.ledger = new RunLedger(identity, plan);
  }
  private emit(body: WorkerBody): Result<true> {
    if (this.stopped) return failure('INVALID_TRANSITION', 'execution');
    const message: WorkerMessage = {
      ...this.identity,
      sequence: this.ledger.sequence + 1,
      ...body,
    };
    const checked = this.ledger.accept(message, Math.max(0, this.ports.now() - this.startedAt));
    if (!checked.ok) return checked;
    this.ports.publish(message);
    return { ok: true, value: true };
  }
  private state(status: 'ready' | 'running' | 'paused') {
    const now = this.ports.now();
    if (this.pausedAt !== null) {
      this.pausedMs += now - this.pausedAt;
      this.pausedAt = null;
    }
    if (status === 'paused') this.pausedAt = now;
    const sent = this.emit({ kind: 'state', status });
    if (!sent.ok) this.finish('failed', sent.error);
  }
  ready(compileMs: number) {
    this.compileMs = compileMs;
    const sent = this.emit({ kind: 'ready', order: this.plan?.order ?? [], compileMs });
    if (!sent.ok) this.finish('failed', sent.error);
    else this.state('ready');
  }
  private timings(): RunTimings {
    const wallMs = Math.max(0, this.ports.now() - this.startedAt);
    const pausedMs =
      this.pausedMs + (this.pausedAt === null ? 0 : this.ports.now() - this.pausedAt);
    return {
      compileMs: this.compileMs,
      wallMs,
      pausedMs,
      activeMs: Math.max(0, wallMs - pausedMs),
    };
  }
  finish(status: RunResult['status'], error?: AppError) {
    if (this.stopped) return;
    const result = this.ledger.makeResult(status, this.timings(), error);
    const sent = this.emit({ kind: 'terminal', result });
    if (!sent.ok) throw new Error('Execution terminal contract violated');
    this.stopped = true;
    this.wake?.();
    this.wake = null;
  }
  acknowledge(requestId: string, outcome: 'accepted' | 'no-op' | 'rejected') {
    return this.emit({
      kind: 'control-ack',
      requestId,
      outcome,
      ...(outcome === 'rejected' ? { code: 'INVALID_TRANSITION' as const } : {}),
    });
  }
  control(body: Exclude<HostBody, { readonly kind: 'start' }>) {
    if (this.stopped) return;
    const status = this.ledger.view.status;
    if (body.kind === 'cancel') {
      this.acknowledge(body.requestId, 'accepted');
      this.finish('cancelled');
      return;
    }
    if (body.kind === 'begin' && status === 'ready' && !this.loopStarted) {
      this.acknowledge(body.requestId, 'accepted');
      this.loopStarted = true;
      this.state('running');
      if (body.mode === 'pauseBeforeFirst') this.state('paused');
      void this.loop().catch(() => {
        if (!this.stopped) this.finish('failed', failure('INTERNAL_FAILURE', 'internal').error);
      });
      return;
    }
    if (body.kind === 'pause' && status === 'running') {
      this.acknowledge(body.requestId, this.pauseRequested ? 'no-op' : 'accepted');
      this.pauseRequested = true;
      return;
    }
    if ((body.kind === 'resume' || body.kind === 'step') && status === 'paused') {
      this.acknowledge(body.requestId, 'accepted');
      this.pauseRequested = false;
      this.stepping = body.kind === 'step';
      this.remainingStep = Number(this.stepping);
      this.state('running');
      this.wake?.();
      this.wake = null;
      return;
    }
    this.acknowledge(body.requestId, 'rejected');
  }
  private async boundary() {
    await this.ports.yieldControl();
    if (this.stopped) return;
    if (this.ledger.view.status === 'paused')
      await new Promise<void>((resolve) => {
        this.wake = resolve;
      });
  }
  private validateResult(nodeId: string, result: HandlerResult): Result<HandlerResult> {
    const json = inspectJson(result, {
      depth: LIMITS.MAX_VALUE_DEPTH + 2,
      values: LIMITS.MAX_PAYLOAD_VALUES + 10,
      bytes: LIMITS.MAX_PAYLOAD_BYTES + 1024,
    });
    if (!json.ok) return json;
    if (
      !isJsonObject(json.value) ||
      Object.keys(json.value).some((key) => !['emitted', 'final'].includes(key)) ||
      !isJsonObject(json.value.emitted ?? null)
    )
      return failure('NODE_FAILED', 'execution');
    const node = this.plan?.indexes.nodeById.get(nodeId),
      ports = Object.keys(result.emitted);
    if (
      !node ||
      (node.type === 'output'
        ? ports.length !== 0 || result.final === undefined
        : result.final !== undefined ||
          (node.type === 'condition'
            ? ports.length !== 1 || !['true', 'false'].includes(ports[0] ?? '')
            : ports.length !== 1 || ports[0] !== 'out'))
    )
      return failure('NODE_FAILED', 'execution');
    for (const value of [
      ...Object.values(result.emitted),
      ...(result.final ? [result.final] : []),
    ]) {
      const checked = inspectJson(value, PAYLOAD_BUDGET);
      if (!checked.ok) return checked;
      if (!isJsonObject(checked.value)) return failure('NODE_FAILED', 'execution');
    }
    return { ok: true, value: result };
  }
  private async invoke(nodeId: string): Promise<void> {
    const node = this.plan?.indexes.nodeById.get(nodeId);
    if (!node || node.type === 'note') {
      this.finish('failed', failure('INTERNAL_FAILURE', 'internal').error);
      return;
    }
    const inputPayloadId = this.ledger.inputId(nodeId),
      input = inputPayloadId ? this.ledger.view.payloads.get(inputPayloadId) : undefined;
    const start = this.emit({
      kind: 'node-start',
      nodeId,
      ...(inputPayloadId ? { inputPayloadId } : {}),
    });
    if (!start.ok) {
      this.finish('failed', start.error);
      return;
    }
    const startedAt = this.ports.now();
    let outcome: Result<HandlerResult>;
    try {
      const handled = await (this.ports.handler ?? executeNode)(node, input, {
        identity: this.identity,
        cancelled: () => this.stopped,
      });
      outcome = handled.ok ? this.validateResult(nodeId, handled.value) : handled;
    } catch {
      outcome = failure('NODE_FAILED', 'execution');
    }
    if (this.stopped) return;
    const durationMs = Math.max(0, this.ports.now() - startedAt);
    if (durationMs > LIMITS.MAX_OPERATION_MS)
      outcome = failure('OPERATION_TIMEOUT', 'timeout', {
        limitName: 'MAX_OPERATION_MS',
        actualCount: durationMs,
      });
    if (outcome.ok)
      outcome = this.publishOutputs(nodeId, outcome.value, input, inputPayloadId, durationMs);
    if (!outcome.ok) {
      const error: AppError = {
        ...outcome.error,
        context: { ...outcome.error.context, nodeId, runId: this.identity.runId },
      };
      this.emit({ kind: 'node-fail', nodeId, code: error.code, durationMs });
      this.finish('failed', error);
    }
  }
  private publishOutputs(
    nodeId: string,
    result: HandlerResult,
    input: JsonObject | undefined,
    inputId: string | undefined,
    durationMs: number,
  ): Result<HandlerResult> {
    const outputPayloadIds: Partial<Record<SourcePort, string>> = {};
    for (const port of ['out', 'true', 'false'] as const) {
      const value = result.emitted[port];
      if (!value) continue;
      let payloadId = value === input ? inputId : undefined;
      if (!payloadId) {
        payloadId = `p${this.ledger.view.payloads.size + 1}`;
        const staged = this.emit({ kind: 'payload-record', nodeId, payloadId, value });
        if (!staged.ok) return staged;
      }
      outputPayloadIds[port] = payloadId;
    }
    const node = this.plan?.indexes.nodeById.get(nodeId);
    if (node?.type === 'output' && result.final !== input)
      return failure('NODE_FAILED', 'execution');
    const produced = Object.values(result.emitted).reduce(
      (sum, value) => sum + utf8Bytes(canonicalJson(value)),
      0,
    );
    if (this.ledger.producedBytes + produced > LIMITS.MAX_RUN_PAYLOAD_BYTES)
      return failure('RESOURCE_LIMIT', 'resource', {
        limitName: 'MAX_RUN_PAYLOAD_BYTES',
        actualCount: this.ledger.producedBytes + produced,
      });
    const sent = this.emit({ kind: 'node-complete', nodeId, outputPayloadIds, durationMs });
    return sent.ok ? { ok: true, value: result } : sent;
  }
  private async loop() {
    await this.boundary();
    let skips = 0;
    for (const nodeId of this.plan?.order ?? []) {
      if (this.stopped) return;
      const timings = this.timings();
      if (timings.activeMs > LIMITS.MAX_ACTIVE_RUN_MS || timings.wallMs > LIMITS.MAX_RUN_WALL_MS) {
        this.finish('failed', failure('RUN_TIMEOUT', 'timeout').error);
        return;
      }
      const reason = this.ledger.skipReason(nodeId);
      if (reason) {
        const skipped = this.emit({ kind: 'node-skip', nodeId, reason });
        if (!skipped.ok) {
          this.finish('failed', skipped.error);
          return;
        }
        if (++skips >= LIMITS.MAX_SKIPS_BETWEEN_YIELDS) {
          skips = 0;
          await this.boundary();
        }
        continue;
      }
      if (this.pauseRequested || (this.stepping && this.remainingStep === 0)) {
        this.pauseRequested = false;
        this.state('paused');
        await this.boundary();
      }
      if (this.stopped) return;
      await this.invoke(nodeId);
      this.remainingStep--;
      skips = 0;
      await this.boundary();
    }
    if (this.stopped) return;
    if (!this.ledger.view.outputs.length)
      this.emit({ kind: 'warning', code: 'NO_OUTPUT_ACTIVATED' });
    this.finish('completed');
  }
}
