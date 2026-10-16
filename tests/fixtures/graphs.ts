import type {
  WorkflowDocument,
  WorkflowNode,
  WorkflowEdge,
  SourcePort,
} from '../../src/contracts/workflow';
import { sampleId } from '../../src/application/sample';
import { defaultNode } from '../../src/domain/graph/commands';

export function emptyDocument(): WorkflowDocument {
  return {
    schemaVersion: 1,
    id: sampleId(1),
    metadata: {
      title: 'Synthetic workflow',
      description: '',
      createdAt: '2026-10-15T12:00:00.000Z',
      updatedAt: '2026-10-15T12:00:00.000Z',
    },
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}
export function graphWith(
  count: number,
  type: WorkflowNode['type'] = 'setField',
): WorkflowDocument {
  return {
    ...emptyDocument(),
    nodes: Array.from({ length: count }, (_, i) =>
      defaultNode(type, sampleId(i + 2), { x: i * 16, y: 0 }),
    ),
  };
}
export function link(
  source: string,
  target: string,
  n: number,
  port: SourcePort = 'out',
): WorkflowEdge {
  return {
    id: sampleId(n),
    source: { nodeId: source, port },
    target: { nodeId: target, port: 'in' },
  };
}
// PERFORMANCE_SPEC.md: seed=42615, exactly N nodes, ~10% Notes,
// one trigger, typed transforms, exclusive branches, fixed positions, ~1 KiB payload.
export function representativeGraph(count: 20 | 100 | 300): WorkflowDocument {
  let seed = 42615;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed;
  };
  const nodes: WorkflowNode[] = [];
  const edges: WorkflowEdge[] = [];
  const executableCount = count - Math.floor(count / 10);
  const add = (type: WorkflowNode['type']): WorkflowNode => {
    const index = nodes.length;
    let node = defaultNode(type, sampleId(index + 2), {
      x: (index % 10) * 272,
      y: Math.floor(index / 10) * 192,
    });
    switch (node.type) {
      case 'manualTrigger':
        node = {
          ...node,
          config: {
            payload: { customer: { tier: 'gold' }, reviewed: false, padding: 'x'.repeat(950) },
          },
        };
        break;
      case 'setField':
        node = { ...node, config: { path: ['reviewed'], value: true } };
        break;
      case 'pickFields':
        node = {
          ...node,
          config: { paths: [['customer'], ['reviewed'], ['padding']], missing: 'error' },
        };
        break;
      case 'condition':
        node = { ...node, config: { path: ['customer', 'tier'], operator: 'eq', value: 'gold' } };
        break;
      case 'note':
        node = { ...node, config: { text: 'Synthetic benchmark annotation' } };
        break;
      case 'output':
        break;
    }
    nodes.push(node);
    return node;
  };
  let parent = add('manualTrigger');
  let port: SourcePort = 'out';
  while (nodes.length < executableCount) {
    const remaining = executableCount - nodes.length;
    const choice = random() % 3;
    const type =
      remaining === 1
        ? 'output'
        : choice === 2 && remaining >= 3
          ? 'condition'
          : choice === 1
            ? 'pickFields'
            : 'setField';
    const child = add(type);
    edges.push(link(parent.id, child.id, 1_000 + edges.length, port));
    parent = child;
    port = 'out';
    if (type === 'condition') {
      const branch = add('output');
      edges.push(link(child.id, branch.id, 1_000 + edges.length, 'false'));
      port = 'true';
    }
  }
  while (nodes.length < count) add('note');
  return { ...emptyDocument(), nodes, edges };
}
