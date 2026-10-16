import type { ErrorCode } from './errors';
import type { RunIdentity, RunStatus } from './session';
import type { JsonObject, SourcePort, WorkflowDocument } from './workflow';
import type { RunResult, SkipReason } from './execution';

export type ControlKind = 'begin' | 'pause' | 'resume' | 'step' | 'cancel';
export type HostBody =
  | { readonly kind: 'start'; readonly requestId: string; readonly document: WorkflowDocument }
  | {
      readonly kind: 'begin';
      readonly requestId: string;
      readonly mode: 'run' | 'pauseBeforeFirst';
    }
  | { readonly kind: 'pause' | 'resume' | 'step' | 'cancel'; readonly requestId: string };
export type WorkerBody =
  | { readonly kind: 'ready'; readonly order: readonly string[]; readonly compileMs: number }
  | { readonly kind: 'state'; readonly status: RunStatus }
  | {
      readonly kind: 'control-ack';
      readonly requestId: string;
      readonly outcome: 'accepted' | 'no-op' | 'rejected';
      readonly code?: 'INVALID_TRANSITION';
    }
  | { readonly kind: 'node-start'; readonly nodeId: string; readonly inputPayloadId?: string }
  | {
      readonly kind: 'payload-record';
      readonly nodeId: string;
      readonly payloadId: string;
      readonly value: JsonObject;
    }
  | {
      readonly kind: 'node-complete';
      readonly nodeId: string;
      readonly outputPayloadIds: Readonly<Partial<Record<SourcePort, string>>>;
      readonly durationMs: number;
    }
  | { readonly kind: 'node-skip'; readonly nodeId: string; readonly reason: SkipReason }
  | {
      readonly kind: 'node-fail';
      readonly nodeId: string;
      readonly code: ErrorCode;
      readonly durationMs: number;
    }
  | { readonly kind: 'warning'; readonly code: 'NO_OUTPUT_ACTIVATED' }
  | { readonly kind: 'terminal'; readonly result: RunResult };
export type HostMessage = RunIdentity & HostBody & { readonly sequence: number };
export type WorkerMessage = RunIdentity & WorkerBody & { readonly sequence: number };
