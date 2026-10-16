import type { Result } from '../contracts/errors';
import { FIELDS } from '../contracts/limits';
import type { WorkflowDocument } from '../contracts/workflow';
import { entityIds, remapSubgraph } from '../domain/graph/subgraph';
import { validateDocument } from '../validation/codec';
export function newDocument(
  id: () => string,
  now: () => string,
  title = 'Untitled workflow',
): WorkflowDocument {
  const time = now();
  return {
    schemaVersion: 1,
    id: id(),
    metadata: { title, description: '', createdAt: time, updatedAt: time },
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}
export function copyDocument(
  document: WorkflowDocument,
  id: () => string,
  now: () => string,
  suffix = ' copy',
): Result<WorkflowDocument> {
  const workflowId = id();
  const excluded = new Set([...entityIds(document), workflowId]);
  const mapped = remapSubgraph(
    { format: 'flowcanvas-subgraph', version: 1, nodes: document.nodes, edges: document.edges },
    excluded,
    id,
    { x: 0, y: 0 },
  );
  if (!mapped.ok) return mapped;
  const time = now();
  return validateDocument({
    ...document,
    id: workflowId,
    nodes: mapped.value.nodes,
    edges: mapped.value.edges,
    metadata: {
      ...document.metadata,
      title:
        Array.from(document.metadata.title)
          .slice(0, FIELDS.NAME - Array.from(suffix).length)
          .join('') + suffix,
      createdAt: time,
      updatedAt: time,
    },
  });
}
