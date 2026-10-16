import { failure, type AppError, type Result } from '../contracts/errors';
import { LIMITS } from '../contracts/limits';
import { idleRuntime, isActiveRun, type RunTimings } from '../contracts/execution';
import type { RunIdentity } from '../contracts/session';
import type { HostBody, HostMessage, WorkerMessage } from '../contracts/worker';
import type { AppStore } from '../state/store';
import { compile } from '../engine/compile';
import { RunLedger } from '../engine/ledger';
import { parseHostMessage, parseWorkerMessage } from '../validation/worker';
import { createExecutionWorker, type WorkerTransport } from '../adapters/worker/factory';

export interface RunPorts {
  readonly now: () => number;
  readonly id: () => string;
  readonly worker: () => WorkerTransport;
}
// Bounded transport/UI scheduling policies; docs/EXECUTION_MODEL.md and decision D-21.
const MAX_PENDING_CONTROL_REQUESTS = 32;
const HOST_WATCHDOG_INTERVAL_MS = 25;
const UI_EVENT_BATCH_MS = 16;
export class RunCoordinator {
  private discardedStaleMessages = 0;
  get staleMessagesDiscarded(): number {
    return this.discardedStaleMessages;
  }
  private worker: WorkerTransport | null = null;
  private ledger: RunLedger | null = null;
  private outgoing = 0;
  private requests = new Map<string, HostBody['kind']>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private grace: ReturnType<typeof setTimeout> | null = null;
  private paint: ReturnType<typeof setTimeout> | null = null;
  private startedAt = 0;
  private pausedAt: number | null = null;
  private pausedMs = 0;
  private operationAt: number | null = null;
  private cancelRequested = false;
  private mode: 'validate' | 'run' | 'step' = 'run';
  private disposed = false;
  private readonly unsubscribe: () => void;
  constructor(
    private readonly store: AppStore,
    private readonly ports: RunPorts = {
      now: () => performance.now(),
      id: () => crypto.randomUUID(),
      worker: createExecutionWorker,
    },
  ) {
    this.unsubscribe = store.subscribe((state) => {
      const identity = this.ledger?.identity;
      if (
        identity &&
        (identity.sessionId !== state.session.sessionId ||
          identity.semanticRevision !== state.session.semanticRevision)
      )
        this.invalidate();
    });
  }
  validate(): Result<true> {
    return this.start('validate');
  }
  run(): Result<true> {
    if (this.ledger?.view.status === 'ready' && this.mode === 'validate') {
      this.mode = 'run';
      return this.send({ kind: 'begin', requestId: this.ports.id(), mode: 'run' });
    }
    return this.start('run');
  }
  step(): Result<true> {
    if (this.ledger?.view.status === 'paused')
      return this.send({ kind: 'step', requestId: this.ports.id() });
    if (!this.ledger || !isActiveRun(this.ledger.view.status)) return this.start('step');
    if (this.ledger.view.status === 'ready' && this.mode === 'validate') {
      this.mode = 'step';
      return this.send({ kind: 'begin', requestId: this.ports.id(), mode: 'pauseBeforeFirst' });
    }
    return failure('INVALID_TRANSITION', 'execution');
  }
  pause(): Result<true> {
    if (this.ledger?.view.status !== 'running' || this.cancelRequested)
      return failure('INVALID_TRANSITION', 'execution');
    this.store.setState({ runtime: { ...this.store.getState().runtime, pausePending: true } });
    return this.send({ kind: 'pause', requestId: this.ports.id() });
  }
  resume(): Result<true> {
    if (this.ledger?.view.status !== 'paused' || this.cancelRequested)
      return failure('INVALID_TRANSITION', 'execution');
    return this.send({ kind: 'resume', requestId: this.ports.id() });
  }
  stop(): Result<true> {
    if (!this.ledger || !isActiveRun(this.ledger.view.status) || this.cancelRequested)
      return { ok: true, value: true };
    this.cancelRequested = true;
    this.store.setState({ runtime: { ...this.store.getState().runtime, cancelPending: true } });
    const sent = this.send({ kind: 'cancel', requestId: this.ports.id() });
    if (!sent.ok) return sent;
    this.grace = setTimeout(() => this.force('cancelled'), LIMITS.CANCEL_GRACE_MS);
    return { ok: true, value: true };
  }
  reset(): Result<true> {
    if (this.ledger && isActiveRun(this.ledger.view.status))
      return failure('INVALID_TRANSITION', 'execution');
    this.invalidate();
    return { ok: true, value: true };
  }
  private start(mode: 'validate' | 'run' | 'step'): Result<true> {
    if (this.disposed || (this.ledger && isActiveRun(this.ledger.view.status)))
      return failure('INVALID_TRANSITION', 'execution');
    this.release();
    this.ledger = null;
    this.store.setState({ runtime: idleRuntime() });
    const session = this.store.getState().session;
    this.startedAt = this.ports.now();
    this.pausedAt = null;
    this.pausedMs = 0;
    this.cancelRequested = false;
    this.mode = mode;
    const identity: RunIdentity = {
      protocolVersion: 1,
      sessionId: session.sessionId,
      semanticRevision: session.semanticRevision,
      runId: this.ports.id(),
    };
    const checked = compile(session.document);
    this.ledger = new RunLedger(identity, checked.ok ? checked.value : null);
    this.store.setState({ runtime: this.ledger.view });
    if (!checked.ok) {
      this.force('failed', checked.error);
      return { ok: false, error: checked.error };
    }
    try {
      this.worker = this.ports.worker();
      this.worker.onmessage = (event) => this.receive(event.data);
      this.worker.onerror = (event) => {
        event.preventDefault();
        this.force('failed', failure('WORKER_FAILED', 'execution').error);
      };
      this.worker.onmessageerror = () =>
        this.force('failed', failure('WORKER_PROTOCOL', 'execution').error);
      this.timer = setInterval(() => this.checkDeadlines(), HOST_WATCHDOG_INTERVAL_MS);
      return this.send({
        kind: 'start',
        requestId: this.ports.id(),
        document: checked.value.document,
      });
    } catch {
      this.force('failed', failure('WORKER_FAILED', 'execution').error);
      return failure('WORKER_FAILED', 'execution');
    }
  }
  private send(body: HostBody): Result<true> {
    if (!this.worker || !this.ledger) return failure('INVALID_TRANSITION', 'execution');
    if (this.requests.size >= MAX_PENDING_CONTROL_REQUESTS && body.kind !== 'cancel')
      return failure('INVALID_TRANSITION', 'execution');
    const message: HostMessage = { ...this.ledger.identity, sequence: ++this.outgoing, ...body };
    const checked = parseHostMessage(message);
    if (!checked.ok) {
      this.force('failed', checked.error);
      return checked;
    }
    this.requests.set(body.requestId, body.kind);
    try {
      this.worker.postMessage(message);
      return { ok: true, value: true };
    } catch {
      this.force('failed', failure('WORKER_FAILED', 'execution').error);
      return failure('WORKER_FAILED', 'execution');
    }
  }
  private timings(): RunTimings {
    const now = this.ports.now(),
      wallMs = Math.max(0, now - this.startedAt);
    const pausedMs = this.pausedMs + (this.pausedAt === null ? 0 : now - this.pausedAt);
    const activeMs = Math.max(0, wallMs - pausedMs);
    return {
      compileMs: Math.min(activeMs, this.ledger?.compileMs ?? 0),
      activeMs,
      pausedMs,
      wallMs,
    };
  }
  checkDeadlines(): boolean {
    if (!this.ledger || !isActiveRun(this.ledger.view.status)) return false;
    const timings = this.timings();
    if (
      this.operationAt !== null &&
      this.ports.now() - this.operationAt > LIMITS.MAX_OPERATION_MS
    ) {
      this.force(
        'failed',
        failure('OPERATION_TIMEOUT', 'timeout', {
          limitName: 'MAX_OPERATION_MS',
          actualCount: this.ports.now() - this.operationAt,
        }).error,
      );
      return true;
    }
    if (timings.wallMs > LIMITS.MAX_RUN_WALL_MS || timings.activeMs > LIMITS.MAX_ACTIVE_RUN_MS) {
      this.force(
        'failed',
        failure('RUN_TIMEOUT', 'timeout', {
          limitName:
            timings.wallMs > LIMITS.MAX_RUN_WALL_MS ? 'MAX_RUN_WALL_MS' : 'MAX_ACTIVE_RUN_MS',
          actualCount: timings.wallMs > LIMITS.MAX_RUN_WALL_MS ? timings.wallMs : timings.activeMs,
        }).error,
      );
      return true;
    }
    return false;
  }
  private receive(input: unknown) {
    if (!this.worker || !this.ledger || !isActiveRun(this.ledger.view.status)) return;
    // Descriptor reads discard old identity tuples before parsing hostile current traffic.
    if (input !== null && typeof input === 'object') {
      for (const key of ['sessionId', 'semanticRevision', 'runId'] as const) {
        const descriptor = Object.getOwnPropertyDescriptor(input, key);
        if (
          descriptor &&
          Object.hasOwn(descriptor, 'value') &&
          descriptor.value !== this.ledger.identity[key]
        ) {
          this.discardedStaleMessages++;
          return;
        }
      }
    }
    if (this.checkDeadlines()) return;
    const parsed = parseWorkerMessage(input);
    if (!parsed.ok) {
      this.force('failed', parsed.error);
      return;
    }
    const message = parsed.value;
    if (message.kind === 'control-ack') {
      if (!this.requests.has(message.requestId)) {
        this.force('failed', failure('WORKER_PROTOCOL', 'execution').error);
        return;
      }
      this.requests.delete(message.requestId);
    }
    const previous = this.ledger.view.status;
    const accepted = this.ledger.accept(message, this.ports.now() - this.startedAt);
    if (!accepted.ok) {
      this.force('failed', accepted.error);
      return;
    }
    if (previous === 'paused' && this.ledger.view.status !== 'paused' && this.pausedAt !== null) {
      this.pausedMs += this.ports.now() - this.pausedAt;
      this.pausedAt = null;
    }
    if (previous !== 'paused' && this.ledger.view.status === 'paused')
      this.pausedAt = this.ports.now();
    if (message.kind === 'node-start') this.operationAt = this.ports.now();
    if (message.kind === 'node-complete' || message.kind === 'node-fail') this.operationAt = null;
    if (message.kind === 'terminal') {
      this.ledger.view = {
        ...this.ledger.view,
        result: {
          ...message.result,
          timings: this.timings(),
          counts: { ...message.result.counts, eventsEvicted: this.ledger.view.eventsEvicted },
        },
      };
      this.flush();
      this.release();
      return;
    }
    this.schedulePaint();
    if (message.kind === 'state' && message.status === 'ready' && this.mode !== 'validate')
      this.send({
        kind: 'begin',
        requestId: this.ports.id(),
        mode: this.mode === 'step' ? 'pauseBeforeFirst' : 'run',
      });
    else if (message.kind === 'state' && message.status === 'paused' && this.mode === 'step') {
      this.mode = 'run';
      this.send({ kind: 'step', requestId: this.ports.id() });
    }
  }
  private schedulePaint() {
    if (this.paint === null)
      this.paint = setTimeout(() => {
        this.paint = null;
        this.flush();
      }, UI_EVENT_BATCH_MS);
  }
  private flush() {
    if (!this.ledger) return;
    const current = this.store.getState().runtime;
    this.store.setState({
      runtime: {
        ...this.ledger.view,
        pausePending: current.pausePending && this.ledger.view.status === 'running',
        cancelPending: this.cancelRequested && isActiveRun(this.ledger.view.status),
      },
    });
  }
  private force(status: 'failed' | 'cancelled', error?: AppError) {
    if (!this.ledger || !isActiveRun(this.ledger.view.status)) return;
    const message: WorkerMessage = {
      ...this.ledger.identity,
      sequence: this.ledger.sequence + 1,
      kind: 'terminal',
      result: this.ledger.makeResult(status, this.timings(), error),
    };
    const accepted = this.ledger.accept(message, this.ports.now() - this.startedAt);
    if (!accepted.ok) throw new Error('Host terminal contract violated');
    this.flush();
    this.release();
  }
  private release() {
    if (this.timer !== null) clearInterval(this.timer);
    if (this.grace !== null) clearTimeout(this.grace);
    if (this.paint !== null) clearTimeout(this.paint);
    this.timer = null;
    this.grace = null;
    this.paint = null;
    this.operationAt = null;
    if (this.worker) {
      this.worker.onmessage = null;
      this.worker.onerror = null;
      this.worker.onmessageerror = null;
      this.worker.terminate();
      this.worker = null;
    }
    this.requests.clear();
    this.outgoing = 0;
  }
  private invalidate() {
    this.release();
    this.ledger = null;
    this.store.setState({ runtime: idleRuntime() });
  }
  dispose() {
    this.disposed = true;
    this.unsubscribe();
    this.invalidate();
  }
  suspend() {
    this.invalidate();
  }
}
