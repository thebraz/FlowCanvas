import type { EditableContent, HistoryTransaction } from '../../contracts/session';
import type { WorkflowDocument } from '../../contracts/workflow';
import { LIMITS } from '../../contracts/limits';
import { utf8Bytes } from '../json/canonical';
export interface HistoryState {
  readonly undo: readonly HistoryTransaction[];
  readonly redo: readonly HistoryTransaction[];
  readonly truncated: boolean;
}
export const emptyHistory: HistoryState = { undo: [], redo: [], truncated: false };
export function editable(document: WorkflowDocument): EditableContent {
  return Object.freeze({
    title: document.metadata.title,
    description: document.metadata.description,
    nodes: document.nodes,
    edges: document.edges,
  });
}
const byteCache = new WeakMap<EditableContent, { readonly text: string; readonly bytes: number }>();
function retainedBytes(entries: readonly HistoryTransaction[]): number {
  const unique = new Map<string, number>();
  for (const entry of entries)
    for (const snapshot of [entry.before, entry.after]) {
      let cached = byteCache.get(snapshot);
      if (!cached) {
        const text = JSON.stringify(snapshot);
        cached = { text, bytes: utf8Bytes(text) };
        byteCache.set(snapshot, cached);
      }
      unique.set(cached.text, cached.bytes);
    }
  return [...unique.values()].reduce((sum, bytes) => sum + bytes, 0);
}
export function appendHistory(history: HistoryState, entry: HistoryTransaction): HistoryState {
  const undo = [...history.undo, entry];
  if (retainedBytes([entry]) > LIMITS.MAX_HISTORY_BYTES)
    return { undo: [], redo: [], truncated: true };
  let truncated = false;
  while (
    undo.length > LIMITS.MAX_HISTORY_TRANSACTIONS ||
    retainedBytes(undo) > LIMITS.MAX_HISTORY_BYTES
  ) {
    undo.shift();
    truncated = true;
  }
  return { undo, redo: [], truncated };
}
