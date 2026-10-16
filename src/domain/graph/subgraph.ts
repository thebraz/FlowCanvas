import type {
  Position,
  WorkflowDocument,
  WorkflowEdge,
  WorkflowNode,
} from '../../contracts/workflow';
import { failure, type Result } from '../../contracts/errors';
import { FIELDS, GEOMETRY } from '../../contracts/limits';

export interface Subgraph {
  readonly format: 'flowcanvas-subgraph';
  readonly version: 1;
  readonly nodes: readonly WorkflowNode[];
  readonly edges: readonly WorkflowEdge[];
}
export function extractSubgraph(
  document: WorkflowDocument,
  ids: readonly string[],
): Result<Subgraph> {
  const selected = new Set(ids);
  if (
    !selected.size ||
    selected.size !== ids.length ||
    ids.some((id) => !document.nodes.some((n) => n.id === id))
  )
    return failure('GRAPH_INVALID', 'graph');
  return {
    ok: true,
    value: {
      format: 'flowcanvas-subgraph',
      version: 1,
      nodes: document.nodes.filter((n) => selected.has(n.id)),
      edges: document.edges.filter(
        (e) => selected.has(e.source.nodeId) && selected.has(e.target.nodeId),
      ),
    },
  };
}
// GRAPH_COMMANDS: sorted fresh IDs preserve relative scheduling order.
export function remapSubgraph(
  fragment: Subgraph,
  excluded: ReadonlySet<string>,
  id: () => string,
  offset: Position,
): Result<Subgraph> {
  const used = new Set([
    ...excluded,
    ...fragment.nodes.map((n) => n.id),
    ...fragment.edges.map((e) => e.id),
  ]);
  const allocate = () => {
    const fresh = id();
    if (used.has(fresh)) throw new Error('Identity collision');
    used.add(fresh);
    return fresh;
  };
  try {
    const old = [...fragment.nodes].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const fresh = old.map(allocate).sort();
    const mapping = new Map(old.map((n, i) => [n.id, fresh[i] ?? '']));
    const nodes = old.map((n) => ({
      ...n,
      id: mapping.get(n.id) ?? '',
      position: { x: n.position.x + offset.x, y: n.position.y + offset.y },
    }));
    const edges = [...fragment.edges]
      .sort((a, b) => (a.id < b.id ? -1 : 1))
      .map((e) => ({
        ...e,
        id: allocate(),
        source: { ...e.source, nodeId: mapping.get(e.source.nodeId) ?? '' },
        target: { ...e.target, nodeId: mapping.get(e.target.nodeId) ?? '' },
      }));
    return { ok: true, value: { ...fragment, nodes, edges } };
  } catch {
    return failure('GRAPH_INVALID', 'graph');
  }
}
export function entityIds(document: WorkflowDocument): ReadonlySet<string> {
  return new Set([
    document.id,
    ...document.nodes.map((n) => n.id),
    ...document.edges.map((e) => e.id),
  ]);
}
export function groupOffset(fragment: Subgraph, center: Position): Position {
  const bounds = nodeBounds(fragment.nodes);
  const x = center.x - (bounds.left + bounds.right) / 2;
  const y = center.y - (bounds.top + bounds.bottom) / 2;
  return {
    x: Math.max(
      -FIELDS.COORDINATE - bounds.left,
      Math.min(x, FIELDS.COORDINATE - Math.max(...fragment.nodes.map((n) => n.position.x))),
    ),
    y: Math.max(
      -FIELDS.COORDINATE - bounds.top,
      Math.min(y, FIELDS.COORDINATE - Math.max(...fragment.nodes.map((n) => n.position.y))),
    ),
  };
}
export function nodeBounds(nodes: readonly WorkflowNode[]) {
  return {
    left: Math.min(...nodes.map((n) => n.position.x)),
    top: Math.min(...nodes.map((n) => n.position.y)),
    right: Math.max(...nodes.map((n) => n.position.x + GEOMETRY.WIDTH)),
    bottom: Math.max(
      ...nodes.map(
        (n) => n.position.y + (n.type === 'note' ? GEOMETRY.NOTE_HEIGHT : GEOMETRY.HEIGHT),
      ),
    ),
  };
}
export type AlignMode = 'left' | 'right' | 'top' | 'bottom' | 'horizontal' | 'vertical';
export function alignedMoves(nodes: readonly WorkflowNode[], mode: AlignMode) {
  const b = nodeBounds(nodes);
  return nodes.map((n) => ({
    nodeId: n.id,
    position: {
      x:
        mode === 'left'
          ? b.left
          : mode === 'right'
            ? b.right - GEOMETRY.WIDTH
            : mode === 'horizontal'
              ? (b.left + b.right - GEOMETRY.WIDTH) / 2
              : n.position.x,
      y:
        mode === 'top'
          ? b.top
          : mode === 'bottom'
            ? b.bottom - (n.type === 'note' ? GEOMETRY.NOTE_HEIGHT : GEOMETRY.HEIGHT)
            : mode === 'vertical'
              ? (b.top + b.bottom - (n.type === 'note' ? GEOMETRY.NOTE_HEIGHT : GEOMETRY.HEIGHT)) /
                2
              : n.position.y,
    },
  }));
}
