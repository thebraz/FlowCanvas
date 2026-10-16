import type { WorkflowDocument } from './workflow';
export interface DocumentSession {
  readonly sessionId: string;
  readonly document: WorkflowDocument;
  readonly documentRevision: number;
  readonly semanticRevision: number;
  readonly topologyRevision: number;
  readonly baseStorageRevision: number | null;
  readonly savedDocumentRevision: number | null;
}
// Runtime data is defined in execution.ts and never serialized with workflow content.
export type EditableContent = Pick<WorkflowDocument, 'nodes' | 'edges'> &
  Pick<WorkflowDocument['metadata'], 'title' | 'description'>;
export interface HistoryTransaction {
  readonly before: EditableContent;
  readonly after: EditableContent;
  readonly semantic: boolean;
  readonly topology: boolean;
}
export interface RunIdentity {
  readonly protocolVersion: 1;
  readonly sessionId: string;
  readonly semanticRevision: number;
  readonly runId: string;
}
export type RunStatus =
  'idle' | 'validating' | 'ready' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
