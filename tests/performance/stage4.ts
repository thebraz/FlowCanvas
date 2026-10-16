import { LIMITS } from '../../src/contracts/limits';
import type { JsonObject, WorkflowDocument, WorkflowNode } from '../../src/contracts/workflow';
import { sampleId } from '../../src/application/sample';
import { canonicalDocument, utf8Bytes } from '../../src/domain/json/canonical';
import { decodeDocument, encodeDocument } from '../../src/validation/codec';

function stressDocument(): WorkflowDocument {
  const nodes: WorkflowNode[] = [];
  const edges: WorkflowDocument['edges'][number][] = [];
  const payload = {
    a: 'x'.repeat(60000),
    b: 'x'.repeat(60000),
    c: 'x'.repeat(60000),
    d: 'x'.repeat(60000),
  };
  for (let index = 0; index < 22; index++) {
    const source = sampleId(10 + index),
      target = sampleId(50 + index);
    nodes.push({
      id: source,
      type: 'manualTrigger',
      label: 'Stress trigger',
      position: { x: 0, y: index * 100 },
      config: { payload: index === 21 ? { a: '', b: '', c: '', d: '' } : payload },
    });
    nodes.push({
      id: target,
      type: 'output',
      label: 'Stress output',
      position: { x: 300, y: index * 100 },
      config: { name: 'Synthetic result' },
    });
    edges.push({
      id: sampleId(100 + index),
      source: { nodeId: source, port: 'out' },
      target: { nodeId: target, port: 'in' },
    });
  }
  const document: WorkflowDocument = {
    schemaVersion: 1,
    id: sampleId(1),
    metadata: {
      title: 'Max-size synthetic stress',
      description: '',
      createdAt: '2026-10-16T13:00:00.000Z',
      updatedAt: '2026-10-16T13:00:00.000Z',
    },
    nodes,
    edges,
    viewport: { x: 0, y: 0, zoom: 1 },
  };
  let remaining = LIMITS.MAX_DOCUMENT_BYTES - utf8Bytes(canonicalDocument(document));
  const tail: Record<string, string> = {};
  for (const key of ['a', 'b', 'c', 'd']) {
    const size = Math.min(60000, remaining);
    tail[key] = 'x'.repeat(size);
    remaining -= size;
  }
  if (remaining !== 0) throw new Error('Stress fixture does not fit its bounded final payload');
  return {
    ...document,
    nodes: nodes.map((node) =>
      node.id === sampleId(31) && node.type === 'manualTrigger'
        ? { ...node, config: { payload: tail satisfies JsonObject } }
        : node,
    ),
  };
}
async function measureStress() {
  const canonical = canonicalDocument(stressDocument()),
    bytes = new TextEncoder().encode(canonical);
  if (bytes.length !== LIMITS.MAX_DOCUMENT_BYTES) throw new Error('Stress byte identity mismatch');
  const checked = decodeDocument(bytes);
  if (!checked.ok) throw new Error(`Stress fixture rejected: ${checked.error.code}`);
  const samples: {
    operation: 'import' | 'export';
    duration: number;
    start: number;
    end: number;
    measured: boolean;
  }[] = [];
  for (let iteration = 0; iteration < 35; iteration++) {
    for (const operation of ['import', 'export'] as const) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      const start = performance.now();
      const result = operation === 'import' ? decodeDocument(bytes) : encodeDocument(checked.value);
      const end = performance.now();
      if (!result.ok) throw new Error(`Stress operation rejected: ${result.error.code}`);
      samples.push({ operation, duration: end - start, start, end, measured: iteration >= 5 });
    }
  }
  await new Promise<void>((resolve) => setTimeout(resolve, 50));
  return {
    canonical,
    samples,
    nodes: checked.value.nodes.length,
    edges: checked.value.edges.length,
  };
}
declare global {
  interface Window {
    flowcanvasStress: typeof measureStress;
  }
}
window.flowcanvasStress = measureStress;
