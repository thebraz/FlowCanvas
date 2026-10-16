import type { AppError, ErrorCode } from './errors';
import type { RunIdentity, RunStatus } from './session';
import type { JsonObject, SourcePort } from './workflow';

export type Disposition = 'pending' | 'running' | 'completed' | 'skipped' | 'failed' | 'cancelled';
export type SkipReason = 'unreachable' | 'branch-not-selected' | 'upstream-skipped' | 'run-failed';
export interface NodeRunRecord {
  readonly nodeId: string;
  readonly disposition: Disposition;
  readonly inputPayloadId?: string;
  readonly outputPayloadIds?: Readonly<Partial<Record<SourcePort, string>>>;
  readonly skipReason?: SkipReason;
  readonly errorCode?: ErrorCode;
  readonly durationMs?: number;
}
export interface FinalOutput {
  readonly nodeId: string;
  readonly name: string;
  readonly payloadId: string;
  readonly sequenceIndex: number;
}
export interface RunTimings {
  readonly compileMs: number;
  readonly activeMs: number;
  readonly pausedMs: number;
  readonly wallMs: number;
}
export interface RunResult {
  readonly runId: string;
  readonly sessionId: string;
  readonly semanticRevision: number;
  readonly status: 'completed' | 'failed' | 'cancelled';
  readonly nodeRecords: readonly NodeRunRecord[];
  readonly outputs: readonly FinalOutput[];
  readonly partial: boolean;
  readonly error?: AppError;
  readonly timings: RunTimings;
  readonly counts: {
    readonly operations: number;
    readonly completed: number;
    readonly skipped: number;
    readonly failed: number;
    readonly cancelled: number;
    readonly eventsEvicted: number;
  };
}
export interface TimelineEvent {
  readonly sequence: number;
  readonly atMs: number;
  readonly kind: string;
  readonly nodeId?: string;
  readonly status?: RunStatus;
  readonly code?: ErrorCode | 'NO_OUTPUT_ACTIVATED';
  readonly port?: SourcePort;
  readonly durationMs?: number;
  readonly requestId?: string;
}
export interface RuntimeView {
  readonly status: RunStatus;
  readonly identity: RunIdentity | null;
  readonly records: ReadonlyMap<string, NodeRunRecord>;
  readonly payloads: ReadonlyMap<string, JsonObject>;
  readonly outputs: readonly FinalOutput[];
  readonly events: readonly TimelineEvent[];
  readonly eventsEvicted: number;
  readonly result: RunResult | null;
  readonly error: AppError | null;
  readonly pausePending: boolean;
  readonly cancelPending: boolean;
}
export const idleRuntime = (): RuntimeView => ({
  status: 'idle',
  identity: null,
  records: new Map(),
  payloads: new Map(),
  outputs: [],
  events: [],
  eventsEvicted: 0,
  result: null,
  error: null,
  pausePending: false,
  cancelPending: false,
});
export const isActiveRun = (status: RunStatus): boolean =>
  ['validating', 'ready', 'running', 'paused'].includes(status);
