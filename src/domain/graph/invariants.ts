import { LIMITS } from '../../contracts/limits';
import {
  failure,
  type Diagnostic,
  type Diagnostics,
  type Readiness,
  type ErrorCode,
  type Result,
} from '../../contracts/errors';
import { NODE_REGISTRY, type WorkflowDocument, type WorkflowEdge } from '../../contracts/workflow';
import { hasCycle, reachable } from './algorithms';
import { buildIndexes, edgeTuple, portKey, type GraphIndexes } from './indexes';

function endpointCheck(indexes: GraphIndexes, edge: WorkflowEdge): Result<true> {
  const source = indexes.nodeById.get(edge.source.nodeId);
  const target = indexes.nodeById.get(edge.target.nodeId);
  if (!source || !target) return failure('DANGLING_REFERENCE', 'graph', { edgeId: edge.id });
  if (source.id === target.id) return failure('GRAPH_CYCLE', 'graph', { edgeId: edge.id });
  const sourcePort = NODE_REGISTRY[source.type].outputs.find(
    (port) => port.id === edge.source.port,
  );
  const targetPort = NODE_REGISTRY[target.type].inputs.find((port) => port.id === edge.target.port);
  if (!sourcePort || !targetPort || sourcePort.kind !== targetPort.kind)
    return failure('INVALID_PORT', 'graph', { edgeId: edge.id });
  return { ok: true, value: true };
}
export function validateConnection(
  document: WorkflowDocument,
  edge: WorkflowEdge,
  replacedEdgeId?: string,
): Result<true> {
  if (
    replacedEdgeId !== undefined &&
    !document.edges.some((existing) => existing.id === replacedEdgeId)
  )
    return failure('DANGLING_REFERENCE', 'graph');
  const indexes = buildIndexes(
    replacedEdgeId === undefined
      ? document
      : { ...document, edges: document.edges.filter((existing) => existing.id !== replacedEdgeId) },
  );
  const endpoint = endpointCheck(indexes, edge);
  if (!endpoint.ok) return endpoint;
  if (indexes.tuples.has(edgeTuple(edge)))
    return failure('DUPLICATE_EDGE', 'graph', { edgeId: edge.id });
  if (indexes.incoming.has(portKey(edge.target.nodeId, edge.target.port)))
    return failure('INPUT_OCCUPIED', 'graph', { edgeId: edge.id });
  if (reachable(indexes, [edge.target.nodeId]).has(edge.source.nodeId))
    return failure('GRAPH_CYCLE', 'graph', { edgeId: edge.id });
  return { ok: true, value: true };
}
export function validateStructure(
  document: WorkflowDocument,
): Diagnostics & { readonly issues: readonly (Diagnostic & { readonly code: ErrorCode })[] } {
  const issues: (Diagnostic & { readonly code: ErrorCode })[] = [];
  let total = 0;
  const add = (issue: Diagnostic & { readonly code: ErrorCode }) => {
    total++;
    if (issues.length < LIMITS.MAX_VALIDATION_ISSUES) issues.push(issue);
  };
  const identities = new Set([document.id]);
  for (const node of document.nodes) {
    if (identities.has(node.id)) add({ code: 'GRAPH_INVALID', severity: 'error', nodeId: node.id });
    identities.add(node.id);
  }
  for (const edge of document.edges) {
    if (identities.has(edge.id)) add({ code: 'GRAPH_INVALID', severity: 'error', edgeId: edge.id });
    identities.add(edge.id);
  }
  const indexes = buildIndexes(document);
  const incoming = new Set<string>();
  const tuples = new Set<string>();
  for (const edge of document.edges) {
    const result = endpointCheck(indexes, edge);
    if (!result.ok) add({ code: result.error.code, severity: 'error', edgeId: edge.id });
    const tuple = edgeTuple(edge);
    const target = portKey(edge.target.nodeId, edge.target.port);
    if (tuples.has(tuple)) add({ code: 'DUPLICATE_EDGE', severity: 'error', edgeId: edge.id });
    if (incoming.has(target)) add({ code: 'INPUT_OCCUPIED', severity: 'error', edgeId: edge.id });
    tuples.add(tuple);
    incoming.add(target);
  }
  if (hasCycle(indexes)) add({ code: 'GRAPH_CYCLE', severity: 'error' });
  return { issues, total, truncated: total > issues.length };
}
export function readiness(
  document: WorkflowDocument,
  indexes: GraphIndexes = buildIndexes(document),
): Readiness {
  const issues: Diagnostic[] = [];
  let total = 0;
  let errors = 0;
  const add = (issue: Diagnostic) => {
    total++;
    if (issue.severity === 'error') errors++;
    if (issues.length < LIMITS.MAX_VALIDATION_ISSUES) issues.push(issue);
    else if (issue.severity === 'error') {
      const warning = issues.findLastIndex((retained) => retained.severity === 'warning');
      if (warning >= 0) {
        issues.splice(warning, 1);
        issues.push(issue);
      }
    }
  };
  const roots = document.nodes
    .filter((node) => node.type === 'manualTrigger')
    .map((node) => node.id);
  const active = reachable(indexes, roots);
  if (roots.length === 0) add({ code: 'MISSING_TRIGGER', severity: 'error' });
  if (!document.nodes.some((node) => node.type === 'output' && active.has(node.id)))
    add({ code: 'MISSING_OUTPUT', severity: 'error' });
  for (const node of document.nodes) {
    if (node.type === 'note') continue;
    if (!active.has(node.id)) add({ code: 'UNREACHABLE', severity: 'warning', nodeId: node.id });
    if (node.config === null)
      add({
        code: 'UNCONFIGURED',
        severity: active.has(node.id) ? 'error' : 'warning',
        nodeId: node.id,
      });
  }
  // Reverse propagation identifies output-less branches in O(V + E).
  const leadsToOutput = new Set<string>();
  const queue = document.nodes.filter((node) => node.type === 'output').map((node) => node.id);
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    if (id === undefined || leadsToOutput.has(id)) continue;
    leadsToOutput.add(id);
    const parent = indexes.incoming.get(portKey(id, 'in'))?.source.nodeId;
    if (parent !== undefined) queue.push(parent);
  }
  for (const node of document.nodes)
    if (active.has(node.id)) {
      for (const port of NODE_REGISTRY[node.type].outputs) {
        const edges = indexes.outgoingByPort.get(portKey(node.id, port.id)) ?? [];
        if (edges.length === 0 || edges.some((edge) => !leadsToOutput.has(edge.target.nodeId)))
          add({ code: 'BRANCH_WITHOUT_OUTPUT', severity: 'warning', nodeId: node.id });
      }
    }
  return { issues, total, truncated: total > issues.length, ready: errors === 0 };
}
