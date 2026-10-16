import { failure, type Result } from '../../contracts/errors';
import type { WorkflowDocument } from '../../contracts/workflow';
import { compareAscii } from '../json/canonical';
import { type GraphIndexes, buildIndexes, portKey } from './indexes';

export function reachable(indexes: GraphIndexes, roots: readonly string[]): ReadonlySet<string> {
  const visited = new Set<string>();
  const stack = [...roots].sort(compareAscii).reverse();
  while (stack.length > 0) {
    const id = stack.pop();
    if (
      id === undefined ||
      visited.has(id) ||
      indexes.nodeById.get(id)?.type === 'note' ||
      !indexes.nodeById.has(id)
    )
      continue;
    visited.add(id);
    for (const edge of indexes.outgoing.get(id) ?? []) stack.push(edge.target.nodeId);
  }
  return visited;
}
export function dependencies(indexes: GraphIndexes, nodeId: string): readonly string[] {
  const ids = new Set<string>();
  let current = indexes.incoming.get(portKey(nodeId, 'in'))?.source.nodeId;
  while (current !== undefined && !ids.has(current)) {
    ids.add(current);
    current = indexes.incoming.get(portKey(current, 'in'))?.source.nodeId;
  }
  return [...ids].sort(compareAscii);
}

class IdHeap {
  private readonly values: string[] = [];
  get size(): number {
    return this.values.length;
  }
  push(value: string): void {
    this.values.push(value);
    let i = this.values.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      const parentValue = this.values[parent];
      if (parentValue === undefined || compareAscii(parentValue, value) <= 0) break;
      this.values[i] = parentValue;
      i = parent;
    }
    this.values[i] = value;
  }
  pop(): string | undefined {
    const first = this.values[0];
    const last = this.values.pop();
    if (this.values.length === 0 || last === undefined) return first;
    let i = 0;
    while (i * 2 + 1 < this.values.length) {
      let child = i * 2 + 1;
      const left = this.values[child];
      const right = this.values[child + 1];
      if (right !== undefined && left !== undefined && compareAscii(right, left) < 0) child++;
      const value = this.values[child];
      if (value === undefined || compareAscii(last, value) <= 0) break;
      this.values[i] = value;
      i = child;
    }
    this.values[i] = last;
    return first;
  }
}

export function topologicalOrder(indexes: GraphIndexes): Result<readonly string[]> {
  const indegrees = new Map(indexes.indegrees);
  const ready = new IdHeap();
  for (const [id, count] of indegrees) if (count === 0) ready.push(id);
  const order: string[] = [];
  while (ready.size > 0) {
    const id = ready.pop();
    if (id === undefined) break;
    order.push(id);
    for (const edge of indexes.outgoing.get(id) ?? []) {
      const count = indegrees.get(edge.target.nodeId);
      if (count === undefined) continue;
      indegrees.set(edge.target.nodeId, count - 1);
      if (count === 1) ready.push(edge.target.nodeId);
    }
  }
  return order.length === indegrees.size
    ? { ok: true, value: order }
    : failure('GRAPH_CYCLE', 'graph');
}
export function hasCycle(indexes: GraphIndexes): boolean {
  const indegrees = new Map(indexes.indegrees);
  const queue: string[] = [];
  for (const [id, count] of indegrees) if (count === 0) queue.push(id);
  let count = 0;
  for (let head = 0; head < queue.length; head++) {
    const id = queue[head];
    if (id === undefined) break;
    count++;
    for (const edge of indexes.outgoing.get(id) ?? []) {
      const degree = indegrees.get(edge.target.nodeId);
      if (degree === undefined) continue;
      indegrees.set(edge.target.nodeId, degree - 1);
      if (degree === 1) queue.push(edge.target.nodeId);
    }
  }
  return count !== indegrees.size;
}
export function extractSelection(document: WorkflowDocument, ids: ReadonlySet<string>) {
  const indexes = buildIndexes(document);
  const nodes = [...ids].sort(compareAscii).flatMap((id) => {
    const node = indexes.nodeById.get(id);
    return node === undefined ? [] : [node];
  });
  const edges = nodes
    .flatMap((node) =>
      (indexes.outgoing.get(node.id) ?? []).filter((edge) => ids.has(edge.target.nodeId)),
    )
    .sort((a, b) => compareAscii(a.id, b.id));
  return { nodes, edges };
}
