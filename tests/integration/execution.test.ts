import { afterEach, describe, expect, it, vi } from 'vitest';
import { RunCoordinator } from '../../src/application/execution';
import type { WorkerTransport } from '../../src/adapters/worker/factory';
import { createAppStore } from '../../src/state/store';
import { validateDocument, validateDocumentShape } from '../../src/validation/codec';
import { compile } from '../../src/engine/compile';
import { ExecutionEngine } from '../../src/engine/scheduler';
import { parseHostMessage, parseWorkerMessage } from '../../src/validation/worker';
import { LIMITS } from '../../src/contracts/limits';
import { canonicalDocument } from '../../src/domain/json/canonical';
import type { HostMessage, WorkerBody, WorkerMessage } from '../../src/contracts/worker';
import { sampleId } from '../../src/application/sample';
import { node, simpleGraph, settle } from '../fixtures/execution';
import { link } from '../fixtures/graphs';

class TestTransport implements WorkerTransport {
  onmessage: WorkerTransport['onmessage'] = null;
  onerror: WorkerTransport['onerror'] = null;
  onmessageerror: WorkerTransport['onmessageerror'] = null;
  terminated = false;
  engine: ExecutionEngine | null = null;
  sent: HostMessage[] = [];
  constructor(private readonly loopback = true) {}
  postMessage(input: unknown) {
    const checked = parseHostMessage(input);
    if (!checked.ok) throw new Error('Fixture protocol');
    const message = checked.value;
    this.sent.push(message);
    if (!this.loopback) return;
    queueMicrotask(() => {
      if (message.kind === 'start') {
        const plan = compile(message.document);
        if (!plan.ok) throw new Error('Fixture document');
        this.engine = new ExecutionEngine(
          {
            protocolVersion: 1,
            sessionId: message.sessionId,
            semanticRevision: message.semanticRevision,
            runId: message.runId,
          },
          plan.value,
          {
            now: () => performance.now(),
            yieldControl: () => Promise.resolve(),
            publish: (output) => this.deliver(output),
          },
        );
        this.engine.acknowledge(message.requestId, 'accepted');
        this.engine.ready(0);
      } else this.engine?.control(message);
    });
  }
  deliver(message: unknown) {
    this.onmessage?.({ data: message } as MessageEvent<unknown>);
  }
  terminate() {
    this.terminated = true;
  }
}
const owned: RunCoordinator[] = [];
afterEach(() => {
  for (const c of owned) c.dispose();
  owned.length = 0;
  vi.useRealTimers();
});
function setup(loopback = true) {
  let id = 10000,
    now = 0;
  const store = createAppStore(simpleGraph(), sampleId(9000), {
    id: () => sampleId(++id),
    now: () => new Date().toISOString(),
    validate: validateDocument,
    validateShape: validateDocumentShape,
  });
  const workers: TestTransport[] = [];
  const coordinator = new RunCoordinator(store, {
    id: () => sampleId(++id),
    now: () => now,
    worker: () => {
      const w = new TestTransport(loopback);
      workers.push(w);
      return w;
    },
  });
  owned.push(coordinator);
  return {
    store,
    workers,
    coordinator,
    tick: (value: number) => {
      now = value;
    },
  };
}
describe('host coordinator isolation, lifecycle and watchdogs', () => {
  it('keeps Run blocked and invokes zero operations when warnings hide a later reachable draft', () => {
    const s = setup();
    const graph = {
      ...simpleGraph(),
      nodes: [
        ...Array.from({ length: 101 }, (_, index) => node('setField', index + 10)),
        node('manualTrigger', 2),
        node('setField', 3),
        node('output', 4),
      ],
      edges: [link(sampleId(2), sampleId(3), 1000), link(sampleId(3), sampleId(4), 1001)],
    };
    expect(s.store.getState().openDocument(graph, sampleId(9900), null).ok).toBe(true);
    const diagnostics = s.store.getState().diagnostics;
    expect(diagnostics.ready).toBe(false);
    expect(diagnostics.issues).toHaveLength(LIMITS.MAX_VALIDATION_ISSUES);
    expect(diagnostics.truncated).toBe(true);
    expect(diagnostics.issues.some((issue) => issue.severity === 'error')).toBe(true);
    expect(s.coordinator.run()).toMatchObject({ ok: false, error: { code: 'CONFIG_INVALID' } });
    expect(s.workers).toHaveLength(0);
    expect(s.store.getState().runtime.result).toMatchObject({
      status: 'failed',
      counts: { operations: 0 },
    });
  });
  it('preserves a completed result already in transit when Stop arrives after engine completion', async () => {
    const s = setup();
    s.coordinator.run();
    const w = s.workers[0];
    if (!w) throw new Error('fixture transport');
    let terminal: WorkerMessage | null = null;
    const deliver = w.deliver.bind(w);
    w.deliver = (message) => {
      const parsed = parseWorkerMessage(message);
      if (parsed.ok && parsed.value.kind === 'terminal') {
        terminal = parsed.value;
        return;
      }
      deliver(message);
    };
    await settle(() => terminal !== null);
    expect(s.coordinator.stop().ok).toBe(true);
    deliver(terminal);
    expect(s.store.getState().runtime.result).toMatchObject({
      status: 'completed',
      partial: false,
    });
    expect(w.terminated).toBe(true);
  });
  it('cancels within grace when an unresponsive worker has saturated the ordinary control queue', async () => {
    vi.useFakeTimers();
    const s = setup(false);
    s.coordinator.run();
    const w = s.workers[0],
      id = s.store.getState().runtime.identity;
    w?.deliver({
      ...id,
      sequence: 1,
      kind: 'ready',
      order: [sampleId(2), sampleId(3)],
      compileMs: 0,
    });
    w?.deliver({ ...id, sequence: 2, kind: 'state', status: 'ready' });
    w?.deliver({ ...id, sequence: 3, kind: 'state', status: 'running' });
    w?.deliver({ ...id, sequence: 4, kind: 'node-start', nodeId: sampleId(2) });
    for (let index = 0; index < 40; index++) s.coordinator.pause();
    expect(s.coordinator.stop().ok).toBe(true);
    expect(w?.sent.at(-1)?.kind).toBe('cancel');
    s.tick(LIMITS.CANCEL_GRACE_MS);
    await vi.advanceTimersByTimeAsync(LIMITS.CANCEL_GRACE_MS);
    expect(s.store.getState().runtime.status).toBe('cancelled');
    expect(w?.terminated).toBe(true);
  });
  it('runs through validated transport and releases the worker while preserving exact canonical bytes', async () => {
    const s = setup(),
      before = canonicalDocument(s.store.getState().session.document);
    expect(s.coordinator.run().ok).toBe(true);
    await settle(() => s.store.getState().runtime.status === 'completed');
    expect(s.workers[0]?.terminated).toBe(true);
    expect(canonicalDocument(s.store.getState().session.document)).toBe(before);
    expect(s.store.getState().runtime.result?.outputs).toHaveLength(1);
    expect(s.store.getState().session.documentRevision).toBe(0);
    expect(s.coordinator.reset().ok).toBe(true);
    expect(s.store.getState().runtime.payloads.size).toBe(0);
  });
  it('validates into ready without executing and starts Run only on an explicit action', async () => {
    const s = setup();
    s.coordinator.validate();
    await settle(() => s.workers[0]?.engine?.ledger.view.status === 'ready');
    s.tick(10);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(s.store.getState().runtime.status).toBe('ready');
    expect(s.workers[0]?.engine?.ledger.operations).toBe(0);
    s.coordinator.run();
    await settle(() => s.store.getState().runtime.status === 'completed');
  });
  it('supports idle Step, pause/resume/stop/reset without overlapping runs', async () => {
    const s = setup();
    s.coordinator.step();
    expect(s.coordinator.run()).toMatchObject({ ok: false, error: { code: 'INVALID_TRANSITION' } });
    await settle(
      () =>
        s.workers[0]?.engine?.ledger.view.status === 'paused' &&
        s.workers[0]?.engine?.ledger.operations === 1,
    );
    expect(s.coordinator.reset().ok).toBe(false);
    expect(s.coordinator.pause().ok).toBe(false);
    s.coordinator.resume();
    await settle(() => s.store.getState().runtime.status === 'completed');
    s.coordinator.stop();
    expect(s.store.getState().runtime.status).toBe('completed');
    s.coordinator.reset();
    s.coordinator.step();
    await settle(
      () =>
        s.workers[1]?.engine?.ledger.view.status === 'paused' &&
        s.workers[1]?.engine?.ledger.operations === 1,
    );
    s.coordinator.stop();
    await settle(() => s.store.getState().runtime.status === 'cancelled');
    expect(s.workers.every((w) => w.terminated)).toBe(true);
  });
  it('clears runtime after semantic edits/undo/switch and ignores traffic from the prior run', async () => {
    const s = setup();
    s.coordinator.run();
    await settle(() => s.store.getState().runtime.status === 'completed');
    const firstIdentity = s.store.getState().runtime.identity;
    const session = s.store.getState().session.sessionId;
    s.store
      .getState()
      .dispatch(session, { type: 'RenameNode', nodeId: sampleId(2), label: 'Presentation edit' });
    expect(s.store.getState().runtime.status).toBe('completed');
    s.store.getState().dispatch(session, {
      type: 'ChangeNodeConfig',
      nodeId: sampleId(2),
      config: { payload: { a: 2 } },
    });
    expect(s.store.getState().runtime.status).toBe('idle');
    s.coordinator.run();
    const second = s.workers[1];
    expect(second).toBeDefined();
    second?.deliver({ ...firstIdentity, sequence: 999, kind: 'state', status: 'completed' });
    expect(s.coordinator.staleMessagesDiscarded).toBe(1);
    await settle(() => s.store.getState().runtime.status === 'completed');
    expect(s.store.getState().runtime.result?.semanticRevision).toBe(1);
    s.store.getState().undo(session);
    expect(s.store.getState().runtime.status).toBe('idle');
    s.coordinator.step();
    await settle(() => s.workers[2]?.engine?.ledger.view.status === 'paused');
    s.store.getState().openDocument(simpleGraph(), sampleId(12000), null);
    expect(s.store.getState().runtime.status).toBe('idle');
    expect(s.workers[2]?.terminated).toBe(true);
  });
  it('fails malformed current traffic, replay/gaps, unknown acknowledgements and crashes without affecting documents', () => {
    for (const fault of ['shape', 'gap', 'ack', 'crash', 'clone']) {
      const s = setup(false);
      s.coordinator.run();
      const w = s.workers[0],
        identity = s.store.getState().runtime.identity;
      if (fault === 'crash') w?.onerror?.({ preventDefault: () => {} } as ErrorEvent);
      else if (fault === 'clone') w?.onmessageerror?.({} as MessageEvent<unknown>);
      else
        w?.deliver({
          ...identity,
          sequence: fault === 'gap' ? 2 : 1,
          kind: fault === 'ack' ? 'control-ack' : 'state',
          ...(fault === 'ack'
            ? { requestId: sampleId(12001), outcome: 'accepted' }
            : { status: fault === 'shape' ? 'bogus' : 'running' }),
        });
      expect(s.store.getState().runtime.status).toBe('failed');
      expect(w?.terminated).toBe(true);
      expect(s.store.getState().session.documentRevision).toBe(0);
    }
  });
  it('forces foreground cancellation after 100ms without a cooperative worker acknowledgement', async () => {
    vi.useFakeTimers();
    const s = setup(false);
    s.coordinator.run();
    s.coordinator.stop();
    s.tick(LIMITS.CANCEL_GRACE_MS);
    await vi.advanceTimersByTimeAsync(LIMITS.CANCEL_GRACE_MS);
    expect(s.store.getState().runtime.status).toBe('cancelled');
    expect(s.workers[0]?.terminated).toBe(true);
    expect(s.coordinator.stop().ok).toBe(true);
    expect(s.store.getState().runtime.result?.timings.wallMs).toBe(LIMITS.CANCEL_GRACE_MS);
  });
  it('uses independent host active/wall/per-operation deadlines before accepting results or visibility continuation', () => {
    const active = setup(false);
    active.coordinator.run();
    active.tick(LIMITS.MAX_ACTIVE_RUN_MS);
    expect(active.coordinator.checkDeadlines()).toBe(false);
    active.tick(LIMITS.MAX_ACTIVE_RUN_MS + 1);
    expect(active.coordinator.checkDeadlines()).toBe(true);
    expect(active.store.getState().runtime.error?.code).toBe('RUN_TIMEOUT');
    const paused = setup(false);
    paused.coordinator.run();
    const w = paused.workers[0],
      identity = paused.store.getState().runtime.identity;
    if (!identity) throw new Error('fixture');
    const send = (body: WorkerBody, sequence: number) =>
      w?.deliver({ ...identity, ...body, sequence });
    w?.deliver({
      ...identity,
      sequence: 1,
      kind: 'ready',
      order: [sampleId(2), sampleId(3)],
      compileMs: 0,
    });
    send({ kind: 'state', status: 'ready' }, 2);
    send({ kind: 'state', status: 'running' }, 3);
    send({ kind: 'state', status: 'paused' }, 4);
    paused.tick(LIMITS.MAX_RUN_WALL_MS);
    expect(paused.coordinator.checkDeadlines()).toBe(false);
    paused.tick(LIMITS.MAX_RUN_WALL_MS + 1);
    expect(paused.coordinator.checkDeadlines()).toBe(true);
    expect(paused.store.getState().runtime.error?.context.limitName).toBe('MAX_RUN_WALL_MS');
    const op = setup(false);
    op.coordinator.run();
    const ow = op.workers[0],
      oid = op.store.getState().runtime.identity;
    ow?.deliver({
      ...oid,
      sequence: 1,
      kind: 'ready',
      order: [sampleId(2), sampleId(3)],
      compileMs: 0,
    });
    ow?.deliver({ ...oid, sequence: 2, kind: 'state', status: 'ready' });
    ow?.deliver({ ...oid, sequence: 3, kind: 'state', status: 'running' });
    ow?.deliver({ ...oid, sequence: 4, kind: 'node-start', nodeId: sampleId(2) });
    op.tick(LIMITS.MAX_OPERATION_MS);
    expect(op.coordinator.checkDeadlines()).toBe(false);
    op.tick(LIMITS.MAX_OPERATION_MS + 1);
    expect(op.coordinator.checkDeadlines()).toBe(true);
    expect(op.store.getState().runtime.error?.code).toBe('OPERATION_TIMEOUT');
  });
  it('recovers from worker creation failure and invalid graphs with zero operations', () => {
    const s = setup();
    s.coordinator.dispose();
    const broken = new RunCoordinator(s.store, {
      id: () => sampleId(15000),
      now: () => 0,
      worker: () => {
        throw new Error('synthetic');
      },
    });
    owned.push(broken);
    expect(broken.run()).toMatchObject({ ok: false, error: { code: 'WORKER_FAILED' } });
    expect(s.store.getState().runtime.result?.counts.operations).toBe(0);
    s.store.getState().openDocument({ ...simpleGraph(), edges: [] }, sampleId(14000), null);
    expect(broken.run()).toMatchObject({ ok: false, error: { code: 'CONFIG_INVALID' } });
    expect(s.store.getState().runtime.status).toBe('failed');
  });
  it('does not rebind a payload ID or expose staged data before completion', async () => {
    const s = setup(false);
    s.coordinator.run();
    const w = s.workers[0],
      id = s.store.getState().runtime.identity;
    for (const m of [
      { kind: 'ready', order: [sampleId(2), sampleId(3)], compileMs: 0 },
      { kind: 'state', status: 'ready' },
      { kind: 'state', status: 'running' },
      { kind: 'node-start', nodeId: sampleId(2) },
      { kind: 'payload-record', nodeId: sampleId(2), payloadId: 'p1', value: { a: 1 } },
    ].entries())
      w?.deliver({ ...id, sequence: m[0] + 1, ...m[1] });
    await new Promise((r) => setTimeout(r, 20));
    expect(s.store.getState().runtime.payloads.size).toBe(0);
    w?.deliver({
      ...id,
      sequence: 6,
      kind: 'payload-record',
      nodeId: sampleId(2),
      payloadId: 'p1',
      value: { a: 2 },
    });
    expect(s.store.getState().runtime.status).toBe('failed');
    expect(s.store.getState().runtime.payloads.size).toBe(0);
  });
});
