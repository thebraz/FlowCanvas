import { describe, it, expect } from 'vitest';
import { makeStore } from '../fixtures/store';
import { sampleId } from '../../src/application/sample';
import { decodeSubgraph } from '../../src/validation/subgraph';
import { LIMITS } from '../../src/contracts/limits';
describe('Stage 2 hostile clipboard boundary', () => {
  it('given malformed, duplicate-key, forbidden-key, oversized or unsupported fragments, then graph and history remain exactly unchanged', () => {
    const store = makeStore();
    const values = [
      '{',
      '{"x":1,"x":2}',
      '{"x":1,"\\u0078":2}',
      '{"data":[{"constructor":{}}]}',
      ' '.repeat(LIMITS.MAX_CLIPBOARD_BYTES + 1),
      JSON.stringify({ format: 'flowcanvas-subgraph', version: 2, nodes: [], edges: [] }),
    ];
    for (const text of values) {
      const before = store.getState();
      expect(before.paste(text, { x: 0, y: 0 }).ok).toBe(false);
      expect(store.getState()).toBe(before);
    }
  });
  it('given copied script-like text, then the format retains literal text and only selected internal connections', () => {
    const store = makeStore(),
      s = store.getState();
    s.dispatch(s.session.sessionId, {
      type: 'ChangeNodeConfig',
      nodeId: sampleId(8),
      config: { text: '<script>synthetic text only</script>' },
    });
    s.setSelection([sampleId(8)]);
    const copied = s.copySelection();
    if (!copied.ok) throw new Error('Copy failed');
    const decoded = decodeSubgraph(copied.value);
    expect(decoded.ok && decoded.value.edges).toEqual([]);
    expect(decoded.ok && decoded.value.nodes[0]?.config).toEqual({
      text: '<script>synthetic text only</script>',
    });
  });
});
