import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { buildIndexes } from '../../src/domain/graph/indexes';
import {
  dependencies,
  extractSelection,
  hasCycle,
  reachable,
  topologicalOrder,
} from '../../src/domain/graph/algorithms';
import {
  validateConnection,
  validateStructure,
  readiness,
} from '../../src/domain/graph/invariants';
import { validateDocument, decodeDocument, encodeDocument } from '../../src/validation/codec';
import { createSample, sampleId } from '../../src/application/sample';
import { emptyDocument, graphWith, link, representativeGraph } from '../fixtures/graphs';
import type { WorkflowDocument, WorkflowEdge } from '../../src/contracts/workflow';
import { LIMITS } from '../../src/contracts/limits';
import { inspectJson, PAYLOAD_BUDGET } from '../../src/validation/json-safety';

describe('structural invariants and graph algorithms', () => {
  it('given colliding identities across document/nodes/edges, then all identity classes are checked', () => {
    const base = createSample();
    const first = base.nodes[0];
    if (!first) throw new Error('Missing fixture');
    for (const document of [
      { ...base, id: first.id },
      { ...base, nodes: [...base.nodes, first] },
      { ...base, edges: base.edges.map((edge, i) => (i === 0 ? { ...edge, id: first.id } : edge)) },
      { ...base, edges: [...base.edges, base.edges[0]] },
    ])
      expect(validateDocument(document).ok).toBe(false);
  });
  it.each([
    ['self', 2, 2, 'out', 'in', 'GRAPH_CYCLE'],
    ['dangling', 2, 999, 'out', 'in', 'DANGLING_REFERENCE'],
    ['invalid handle', 2, 3, 'true', 'in', 'INVALID_PORT'],
    ['Note', 8, 3, 'out', 'in', 'INVALID_PORT'],
    ['trigger target', 3, 2, 'out', 'in', 'INVALID_PORT'],
    ['Output source', 6, 3, 'out', 'in', 'INVALID_PORT'],
    ['occupied input', 4, 3, 'out', 'in', 'INPUT_OCCUPIED'],
    ['duplicate', 2, 3, 'out', 'in', 'DUPLICATE_EDGE'],
  ] as const)(
    'given %s candidate, then it rejects with a structured reason',
    (_name, source, target, port, targetPort, code) => {
      const edge: WorkflowEdge = {
        id: sampleId(90),
        source: { nodeId: sampleId(source), port },
        target: { nodeId: sampleId(target), port: targetPort },
      };
      const result = validateConnection(createSample(), edge);
      expect(result.ok ? 'success' : result.error.code).toBe(code);
    },
  );
  it('given disconnected cycle and long-chain back edge, then iterative checks reject both', () => {
    const base = graphWith(300);
    const chain = base.nodes.slice(1).map((node, i) => link(sampleId(i + 2), node.id, 1000 + i));
    const cyclic: WorkflowDocument = {
      ...base,
      edges: [...chain, link(sampleId(301), sampleId(2), 2000)],
    };
    expect(hasCycle(buildIndexes(cyclic))).toBe(true);
    expect(topologicalOrder(buildIndexes(cyclic)).ok).toBe(false);
    expect(validateDocument(cyclic).ok).toBe(false);
    const disconnected = {
      ...graphWith(4),
      edges: [link(sampleId(4), sampleId(5), 100), link(sampleId(5), sampleId(4), 101)],
    };
    expect(
      validateStructure(disconnected).issues.some((issue) => issue.code === 'GRAPH_CYCLE'),
    ).toBe(true);
  });
  it('given reconnect, then the old edge alone is excluded and cycle/references still checked', () => {
    const base = createSample();
    const edge = base.edges[0];
    if (!edge) throw new Error('Missing fixture');
    expect(validateConnection(base, edge, edge.id).ok).toBe(true);
    const cycle = { ...edge, source: { nodeId: sampleId(4), port: 'out' as const } };
    expect(validateConnection(base, cycle, edge.id).ok).toBe(false);
    expect(validateConnection(base, edge, sampleId(999)).ok).toBe(false);
  });
  it('given sample graph, then reachability/dependencies exclude Notes and selection keeps internal edges', () => {
    const document = createSample();
    const indexes = buildIndexes(document);
    expect([...reachable(indexes, [sampleId(2)])].sort()).toEqual([2, 3, 4, 5, 6, 7].map(sampleId));
    expect(dependencies(indexes, sampleId(6))).toEqual([2, 3, 4, 5].map(sampleId));
    const extracted = extractSelection(document, new Set([sampleId(2), sampleId(3), sampleId(8)]));
    expect(extracted.nodes.map((node) => node.id)).toEqual([2, 3, 8].map(sampleId));
    expect(extracted.edges).toEqual([document.edges[0]]);
    expect(topologicalOrder(indexes)).toEqual({
      ok: true,
      value: [2, 3, 4, 5, 6, 7].map(sampleId),
    });
  });
  it('given incomplete editable documents, then readiness failures never become structural failures', () => {
    expect(validateDocument(emptyDocument()).ok).toBe(true);
    expect(readiness(emptyDocument()).ready).toBe(false);
    const base = createSample();
    const draft = {
      ...base,
      nodes: base.nodes.map((node) =>
        node.type === 'setField' ? { ...node, config: null } : node,
      ),
    };
    expect(validateDocument(draft).ok).toBe(true);
    expect(readiness(draft).ready).toBe(false);
    const unreachable = {
      ...base,
      nodes: [...base.nodes, { ...graphWith(1).nodes[0], id: sampleId(90) }],
    };
    const checked = validateDocument(unreachable);
    expect(checked.ok).toBe(true);
    if (checked.ok) {
      const result = readiness(checked.value);
      expect(result.ready).toBe(true);
      expect(
        result.issues.some(
          (issue) => issue.code === 'UNCONFIGURED' && issue.severity === 'warning',
        ),
      ).toBe(true);
    }
    for (const count of [20, 100, 300] as const) {
      const generated = representativeGraph(count);
      expect(generated.nodes).toHaveLength(count);
      expect(validateDocument(generated).ok).toBe(true);
      expect(readiness(generated).ready).toBe(true);
    }
  });
  it('given more than 100 issues, then diagnostics retain total and cap details', () => {
    const base = graphWith(300);
    const document = { ...base, nodes: [...base.nodes, ...base.nodes] };
    const result = validateStructure(document);
    expect(result.issues).toHaveLength(LIMITS.MAX_VALIDATION_ISSUES);
    expect(result.total).toBe(300);
    expect(result.truncated).toBe(true);
    const ready = readiness(base);
    expect(ready.total).toBeGreaterThan(100);
    expect(ready.issues).toHaveLength(100);
    expect(ready.truncated).toBe(true);
    for (const count of [100, 101]) {
      const one = graphWith(1);
      const repeated = {
        ...one,
        nodes: [...one.nodes, ...Array.from({ length: count }, () => one.nodes[0])],
      };
      const decoded = validateDocument(repeated);
      expect(decoded.ok).toBe(false);
      if (!decoded.ok) {
        expect(decoded.error.issues).toHaveLength(Math.min(count, LIMITS.MAX_VALIDATION_ISSUES));
        expect(decoded.diagnostics).toEqual({
          total: count,
          truncated: count > LIMITS.MAX_VALIDATION_ISSUES,
        });
      }
    }
  });
  it('given 500 seeded generated DAGs, then topology precedence and permutation determinism hold', () => {
    fc.assert(
      fc.property(fc.array(fc.nat(50), { minLength: 1, maxLength: 50 }), (parents) => {
        const base = graphWith(parents.length);
        const edges = parents.flatMap((parent, i) =>
          i === 0 || parent % 4 === 0
            ? []
            : [link(sampleId(2 + (parent % i)), sampleId(2 + i), 1000 + i)],
        );
        const document = { ...base, edges };
        const sorted = topologicalOrder(buildIndexes(document));
        expect(sorted.ok).toBe(true);
        if (!sorted.ok) return;
        for (const edge of edges)
          expect(sorted.value.indexOf(edge.source.nodeId)).toBeLessThan(
            sorted.value.indexOf(edge.target.nodeId),
          );
        expect(
          topologicalOrder(
            buildIndexes({
              ...document,
              nodes: [...base.nodes].reverse(),
              edges: [...edges].reverse(),
            }),
          ),
        ).toEqual(sorted);
        expect(validateDocument(document).ok).toBe(true);
      }),
      { seed: 42615, numRuns: 500 },
    );
  });
  it('given 500 seeded JSON payloads, then encode/decode/encode preserves canonical bytes', () => {
    fc.assert(
      fc.property(
        fc.jsonValue({ maxDepth: 4 }).filter((value) => inspectJson(value, PAYLOAD_BUDGET).ok),
        (value) => {
          const base = createSample();
          const candidate = {
            ...base,
            nodes: base.nodes.map((node) =>
              node.type === 'manualTrigger'
                ? { ...node, config: { payload: { synthetic: value } } }
                : node,
            ),
          };
          const encoded = encodeDocument(candidate);
          expect(encoded.ok).toBe(true);
          if (!encoded.ok) return;
          const decoded = decodeDocument(encoded.value);
          expect(decoded.ok).toBe(true);
          if (decoded.ok) expect(encodeDocument(decoded.value)).toEqual(encoded);
        },
      ),
      { seed: 42615, numRuns: 500 },
    );
  });
});
