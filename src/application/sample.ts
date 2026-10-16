import type { WorkflowDocument, WorkflowEdge, WorkflowNode } from '../contracts/workflow';
import { validateDocument } from '../validation/codec';

// Fixed synthetic identities and data; no runtime results are implied.
export const sampleId = (n: number): string =>
  `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
const node = { label: '', position: { x: 0, y: 0 } };
const nodes: readonly WorkflowNode[] = [
  {
    ...node,
    id: sampleId(2),
    type: 'manualTrigger',
    label: 'Manual Trigger',
    position: { x: 0, y: 0 },
    config: { payload: { customer: { tier: 'gold' }, reviewed: false } },
  },
  {
    ...node,
    id: sampleId(3),
    type: 'setField',
    label: 'Set Field',
    position: { x: 304, y: 0 },
    config: { path: ['reviewed'], value: true },
  },
  {
    ...node,
    id: sampleId(4),
    type: 'pickFields',
    label: 'Pick Fields',
    position: { x: 608, y: 0 },
    config: { paths: [['customer'], ['reviewed']], missing: 'error' },
  },
  {
    ...node,
    id: sampleId(5),
    type: 'condition',
    label: 'Condition',
    position: { x: 304, y: 192 },
    config: { path: ['customer', 'tier'], operator: 'eq', value: 'gold' },
  },
  {
    ...node,
    id: sampleId(6),
    type: 'output',
    label: 'Gold customers',
    position: { x: 608, y: 192 },
    config: { name: 'Gold customers' },
  },
  {
    ...node,
    id: sampleId(7),
    type: 'output',
    label: 'Other customers',
    position: { x: 608, y: 384 },
    config: { name: 'Other customers' },
  },
  {
    ...node,
    id: sampleId(8),
    type: 'note',
    label: 'About this sample',
    position: { x: 0, y: 192 },
    config: {
      text: 'Synthetic graph\nEdit nodes, connect branches, save locally and inspect real worker execution.',
    },
  },
];
const edge = (
  n: number,
  source: number,
  target: number,
  port: WorkflowEdge['source']['port'] = 'out',
): WorkflowEdge => ({
  id: sampleId(n),
  source: { nodeId: sampleId(source), port },
  target: { nodeId: sampleId(target), port: 'in' },
});
export const sampleDocument: WorkflowDocument = {
  schemaVersion: 1,
  id: sampleId(1),
  metadata: {
    title: 'Customer review',
    description: 'A synthetic branching workflow',
    createdAt: '2026-10-15T12:00:00.000Z',
    updatedAt: '2026-10-15T12:00:00.000Z',
  },
  nodes,
  edges: [
    edge(20, 2, 3),
    edge(21, 3, 4),
    edge(22, 4, 5),
    edge(23, 5, 6, 'true'),
    edge(24, 5, 7, 'false'),
  ],
  viewport: { x: 32, y: 32, zoom: 0.65 },
};
export function createSample(): WorkflowDocument {
  const result = validateDocument(sampleDocument);
  if (!result.ok) throw new Error('Invalid bundled synthetic graph');
  return result.value;
}
