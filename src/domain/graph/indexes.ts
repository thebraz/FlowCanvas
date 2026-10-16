import type { WorkflowDocument, WorkflowEdge, WorkflowNode } from '../../contracts/workflow';
export interface GraphIndexes {
  readonly nodeById: ReadonlyMap<string, WorkflowNode>;
  readonly edgeById: ReadonlyMap<string, WorkflowEdge>;
  readonly outgoing: ReadonlyMap<string, readonly WorkflowEdge[]>;
  readonly outgoingByPort: ReadonlyMap<string, readonly WorkflowEdge[]>;
  readonly incoming: ReadonlyMap<string, WorkflowEdge>;
  readonly tuples: ReadonlySet<string>;
  readonly indegrees: ReadonlyMap<string, number>;
}
export const portKey = (nodeId: string, port: string): string => `${nodeId}:${port}`;
export const edgeTuple = (edge: WorkflowEdge): string =>
  `${portKey(edge.source.nodeId, edge.source.port)}>${portKey(edge.target.nodeId, edge.target.port)}`;
export function buildIndexes(document: WorkflowDocument): GraphIndexes {
  const nodeById = new Map(document.nodes.map((node) => [node.id, node]));
  const edgeById = new Map<string, WorkflowEdge>();
  const outgoing = new Map<string, WorkflowEdge[]>();
  const outgoingByPort = new Map<string, WorkflowEdge[]>();
  const incoming = new Map<string, WorkflowEdge>();
  const tuples = new Set<string>();
  const indegrees = new Map(
    document.nodes.filter((node) => node.type !== 'note').map((node) => [node.id, 0]),
  );
  for (const edge of document.edges) {
    edgeById.set(edge.id, edge);
    const edges = outgoing.get(edge.source.nodeId) ?? [];
    edges.push(edge);
    outgoing.set(edge.source.nodeId, edges);
    const key = portKey(edge.source.nodeId, edge.source.port);
    const byPort = outgoingByPort.get(key) ?? [];
    byPort.push(edge);
    outgoingByPort.set(key, byPort);
    incoming.set(portKey(edge.target.nodeId, edge.target.port), edge);
    tuples.add(edgeTuple(edge));
    if (indegrees.has(edge.target.nodeId))
      indegrees.set(edge.target.nodeId, (indegrees.get(edge.target.nodeId) ?? 0) + 1);
  }
  return { nodeById, edgeById, outgoing, outgoingByPort, incoming, tuples, indegrees };
}
