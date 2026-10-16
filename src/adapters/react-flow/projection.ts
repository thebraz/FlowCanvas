import { Position as FlowPosition, type Node, type Edge, type NodeHandle } from '@xyflow/react';
import { GEOMETRY } from '../../contracts/limits';
import type {
  Position,
  WorkflowDocument,
  WorkflowEdge,
  WorkflowNode,
} from '../../contracts/workflow';
import { NODE_REGISTRY } from '../../contracts/workflow';
export type FlowNode = Node<{ readonly node: WorkflowNode }, 'workflow'>;
function handles(node: WorkflowNode): NodeHandle[] {
  const registry = NODE_REGISTRY[node.type],
    height = node.type === 'note' ? GEOMETRY.NOTE_HEIGHT : GEOMETRY.HEIGHT;
  return [
    ...registry.inputs.map((p) => ({
      id: p.id,
      type: 'target' as const,
      position: FlowPosition.Left,
      x: -6,
      y: height / 2 - 6,
      width: 12,
      height: 12,
    })),
    ...registry.outputs.map((p, i) => ({
      id: p.id,
      type: 'source' as const,
      position: FlowPosition.Right,
      x: GEOMETRY.WIDTH - 6,
      y: height * (registry.outputs.length === 2 ? (i === 0 ? 0.38 : 0.74) : 0.5) - 6,
      width: 12,
      height: 12,
    })),
  ];
}
export function createProjection() {
  let previousNodes: FlowNode[] = [],
    previousEdges: Edge[] = [];
  let nodeCache = new Map<
    string,
    { readonly entity: WorkflowNode; readonly selected: boolean; readonly view: FlowNode }
  >();
  let edgeCache = new Map<string, { readonly entity: WorkflowEdge; readonly view: Edge }>();
  return (
    document: WorkflowDocument,
    selection: ReadonlySet<string>,
    overlay: ReadonlyMap<string, Position> = new Map(),
  ) => {
    const nextNodes: typeof nodeCache = new Map();
    const nextEdges: typeof edgeCache = new Map();
    const nodes = document.nodes.map((node) => {
      const selected = selection.has(node.id);
      const cached = nodeCache.get(node.id);
      const view: FlowNode =
        cached?.entity === node && cached.selected === selected
          ? cached.view
          : {
              id: node.id,
              type: 'workflow',
              position: { ...node.position },
              data: { node },
              selected,
              width: GEOMETRY.WIDTH,
              height: node.type === 'note' ? GEOMETRY.NOTE_HEIGHT : GEOMETRY.HEIGHT,
              handles: handles(node),
              draggable: true,
              connectable: true,
              deletable: false,
              ariaLabel: `${node.label}, ${NODE_REGISTRY[node.type].title}, ${node.config === null ? 'Needs configuration' : node.type === 'note' ? 'Annotation' : 'Configured'}`,
            };
      nextNodes.set(node.id, { entity: node, selected, view });
      const position = overlay.get(node.id);
      return position ? { ...view, position } : view;
    });
    const edges = document.edges.map((edge) => {
      const cached = edgeCache.get(edge.id);
      const view: Edge =
        cached?.entity === edge
          ? cached.view
          : {
              id: edge.id,
              source: edge.source.nodeId,
              sourceHandle: edge.source.port,
              target: edge.target.nodeId,
              targetHandle: edge.target.port,
              type: 'runtime',
              data: { port: edge.source.port },
              interactionWidth: 12,
              focusable: true,
              deletable: false,
              ...(edge.source.port === 'out'
                ? {}
                : { label: edge.source.port === 'true' ? 'True' : 'False' }),
              markerEnd: {
                type: 'arrowclosed',
                width: 16,
                height: 16,
                color: 'var(--control-border)',
              },
              style: { stroke: 'var(--control-border)', strokeWidth: 2 },
              ariaLabel: `Connection ${edge.source.port} to ${edge.target.port}`,
            };
      nextEdges.set(edge.id, { entity: edge, view });
      return selection.has(edge.id) ? { ...view, selected: true } : view;
    });
    nodeCache = nextNodes;
    edgeCache = nextEdges;
    const stableNodes =
      nodes.length === previousNodes.length && nodes.every((node, i) => node === previousNodes[i])
        ? previousNodes
        : nodes;
    const stableEdges =
      edges.length === previousEdges.length && edges.every((edge, i) => edge === previousEdges[i])
        ? previousEdges
        : edges;
    previousNodes = stableNodes;
    previousEdges = stableEdges;
    return { nodes: stableNodes, edges: stableEdges };
  };
}
