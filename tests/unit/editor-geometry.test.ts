import { describe, it, expect } from 'vitest';
import { createSample, sampleId } from '../../src/application/sample';
import {
  alignedMoves,
  extractSubgraph,
  remapSubgraph,
  groupOffset,
} from '../../src/domain/graph/subgraph';
describe('canonical selection geometry and identities', () => {
  const source = createSample(),
    trigger = source.nodes.find((n) => n.type === 'manualTrigger'),
    note = source.nodes.find((n) => n.type === 'note');
  if (!trigger || !note) throw new Error('Fixture missing');
  const nodes = [
    { ...trigger, position: { x: 0, y: 0 } },
    { ...note, position: { x: 100, y: 20 } },
  ];
  for (const [mode, positions] of [
    [
      'left',
      [
        { x: 0, y: 0 },
        { x: 0, y: 20 },
      ],
    ],
    [
      'right',
      [
        { x: 100, y: 0 },
        { x: 100, y: 20 },
      ],
    ],
    [
      'top',
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
    ],
    [
      'bottom',
      [
        { x: 0, y: 84 },
        { x: 100, y: 20 },
      ],
    ],
    [
      'horizontal',
      [
        { x: 50, y: 0 },
        { x: 50, y: 20 },
      ],
    ],
    [
      'vertical',
      [
        { x: 0, y: 42 },
        { x: 100, y: 10 },
      ],
    ],
  ] as const)
    it(`given different canonical heights, then ${mode} alignment uses fixed rectangles`, () => {
      expect(alignedMoves(nodes, mode).map((m) => m.position)).toEqual(positions);
    });
  it('given unsorted generated IDs, then remapping preserves relative identity order and internal endpoints', () => {
    const fragment = extractSubgraph(source, [sampleId(3), sampleId(2)]);
    if (!fragment.ok) throw new Error('Fixture failed');
    const ids = [sampleId(205), sampleId(201), sampleId(250)];
    const mapped = remapSubgraph(
      fragment.value,
      new Set([source.id]),
      () => ids.shift() ?? sampleId(999),
      { x: 32, y: 32 },
    );
    expect(mapped.ok).toBe(true);
    if (!mapped.ok) throw new Error('Remap failed');
    expect(mapped.value.nodes.map((n) => n.id)).toEqual([sampleId(201), sampleId(205)]);
    expect(mapped.value.edges[0]?.source.nodeId).toBe(sampleId(201));
    expect(mapped.value.edges[0]?.target.nodeId).toBe(sampleId(205));
    expect(mapped.value.nodes[0]?.position).toEqual({ x: 32, y: 32 });
  });
  it('given group placement near either boundary, then clamping translates every node by one common offset', () => {
    const fragment = extractSubgraph(
      { ...source, nodes, edges: [] },
      nodes.map((n) => n.id),
    );
    if (!fragment.ok) throw new Error('Fixture failed');
    for (const center of [
      { x: 100000, y: 100000 },
      { x: -100000, y: -100000 },
    ]) {
      const offset = groupOffset(fragment.value, center);
      for (const n of nodes) {
        expect(Math.abs(n.position.x + offset.x)).toBeLessThanOrEqual(100000);
        expect(Math.abs(n.position.y + offset.y)).toBeLessThanOrEqual(100000);
      }
    }
    expect(extractSubgraph(source, []).ok).toBe(false);
    expect(extractSubgraph(source, [sampleId(2), sampleId(2)]).ok).toBe(false);
  });
});
