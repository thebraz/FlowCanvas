import type { WorkflowDocument, WorkflowNode } from '../contracts/workflow';
import { createSample, sampleId } from './sample';
import { defaultNode } from '../domain/graph/commands';
import { canonicalDocument } from '../domain/json/canonical';
export const EXAMPLE_TITLES = [
  'Data transformation',
  'Conditional routing',
  'Multiple processing branches',
  'Invalid workflow validation',
] as const;
export function exampleDocument(title: (typeof EXAMPLE_TITLES)[number]): WorkflowDocument {
  const sample = createSample();
  const base = { ...sample, metadata: { ...sample.metadata, title } };
  if (title === 'Conditional routing') return base;
  if (title === 'Invalid workflow validation')
    return {
      ...base,
      nodes: sample.nodes.map((node) =>
        node.type === 'setField' ? { ...node, config: null } : node,
      ),
    };
  if (title === 'Data transformation')
    return {
      ...base,
      nodes: sample.nodes.filter((node) => [2, 3, 4, 6, 8].some((id) => node.id === sampleId(id))),
      edges: [
        ...sample.edges.slice(0, 2),
        {
          id: sampleId(22),
          source: { nodeId: sampleId(4), port: 'out' },
          target: { nodeId: sampleId(6), port: 'in' },
        },
      ],
    };
  const transform: WorkflowNode = {
    ...defaultNode('setField', sampleId(9), { x: 304, y: 384 }),
    type: 'setField',
    label: 'Second branch',
    config: { path: ['reviewed'], value: false },
  };
  return {
    ...base,
    nodes: [
      ...sample.nodes,
      transform,
      {
        ...defaultNode('output', sampleId(10), { x: 608, y: 576 }),
        type: 'output',
        label: 'Branch result',
        config: { name: 'Branch result' },
      },
    ],
    edges: [
      ...sample.edges,
      {
        id: sampleId(25),
        source: { nodeId: sampleId(2), port: 'out' },
        target: { nodeId: sampleId(9), port: 'in' },
      },
      {
        id: sampleId(26),
        source: { nodeId: sampleId(9), port: 'out' },
        target: { nodeId: sampleId(10), port: 'in' },
      },
    ],
  };
}
export function exampleJson(title: (typeof EXAMPLE_TITLES)[number]): string {
  return canonicalDocument(exampleDocument(title));
}
