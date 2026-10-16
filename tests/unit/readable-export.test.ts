import { it, expect, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { encodeReadableDocument } from '../../src/validation/readable-export';
import { decodeDocument, encodeDocument } from '../../src/validation/codec';
import { canonicalDocument, utf8Bytes } from '../../src/domain/json/canonical';
import { makeEnvelope } from '../../src/adapters/persistence/indexeddb';
import { createSample, sampleId } from '../../src/application/sample';
import { emptyDocument } from '../fixtures/graphs';
import { LIMITS } from '../../src/contracts/limits';
import type { JsonValue, WorkflowDocument } from '../../src/contracts/workflow';

function encoded(input: unknown): string {
  const result = encodeReadableDocument(input);
  if (!result.ok) throw new Error('Readable export failed');
  return result.value;
}
it('given an empty workflow, then readable export uses two spaces and LF with empty containers intact', () => {
  expect(encoded(emptyDocument())).toBe(`{
  "edges": [],
  "id": "00000000-0000-4000-8000-000000000001",
  "metadata": {
    "createdAt": "2026-10-15T12:00:00.000Z",
    "description": "",
    "title": "Synthetic workflow",
    "updatedAt": "2026-10-15T12:00:00.000Z"
  },
  "nodes": [],
  "schemaVersion": 1,
  "viewport": {
    "x": 0,
    "y": 0,
    "zoom": 1
  }
}`);
});

function complexDocument(): WorkflowDocument {
  const sample = createSample();
  return {
    ...sample,
    nodes: sample.nodes.map((node) =>
      node.type === 'manualTrigger'
        ? {
            ...node,
            config: {
              payload: {
                '2': 2,
                '10': 10,
                '😀': 'emoji',
                '\ue000': 'bmp',
                nested: [{}, [], [null, false, -0, 2.5, 'quote " \\ \\" },:[\n\t😀']],
              },
            },
          }
        : node.type === 'setField'
          ? { ...node, config: null }
          : node,
    ),
  };
}
it('given escaped strings, numeric/Unicode keys, nested arrays and null drafts, then formatting preserves all data and canonical token order', () => {
  const document = complexDocument(),
    before = canonicalDocument(document),
    text = encoded(document),
    decoded = decodeDocument(text);
  expect(decoded.ok).toBe(true);
  if (!decoded.ok) throw new Error('Readable import failed');
  expect(canonicalDocument(decoded.value)).toBe(before);
  expect(canonicalDocument(document)).toBe(before);
  expect(text.indexOf('"10": 10')).toBeLessThan(text.indexOf('"2": 2'));
  expect(text.indexOf('"\ue000": "bmp"')).toBeLessThan(text.indexOf('"😀": "emoji"'));
  expect(text).toContain('quote \\"');
  expect(text).toContain('\\n\\t😀');
  expect(text).not.toContain('\r');
  expect(text).not.toContain('\t');
});
it('given reordered source objects and graph arrays, then repeated readable exports are byte-identical', () => {
  const document = complexDocument();
  const reordered = {
    viewport: { zoom: document.viewport.zoom, y: document.viewport.y, x: document.viewport.x },
    schemaVersion: document.schemaVersion,
    nodes: [...document.nodes].reverse(),
    metadata: {
      updatedAt: document.metadata.updatedAt,
      title: document.metadata.title,
      description: document.metadata.description,
      createdAt: document.metadata.createdAt,
    },
    id: document.id,
    edges: [...document.edges].reverse(),
  };
  expect(encoded(reordered)).toBe(encoded(document));
  expect(encoded(document)).toBe(encoded(document));
});
it('given a readable export, then compact encoding and storage hashes/byte accounting remain unchanged', async () => {
  const document = complexDocument(),
    compact = encodeDocument(document),
    before = await makeEnvelope(document, 1);
  if (!compact.ok || !before.ok) throw new Error('Fixture encoding failed');
  const decoded = decodeDocument(encoded(document));
  if (!decoded.ok) throw new Error('Readable import failed');
  expect(encodeDocument(decoded.value)).toEqual(compact);
  expect(await makeEnvelope(document, 1)).toEqual(before);
  // Both JSON formats normalize -0 to 0; integrity fields stay byte-identical.
  expect(await makeEnvelope(decoded.value, 1)).toEqual({
    ...before,
    value: { ...before.value, document: decoded.value },
  });
  expect(before.value.sha256).toBe(
    createHash('sha256').update(compact.value, 'utf8').digest('hex'),
  );
  expect(before.value.canonicalBytes).toBe(utf8Bytes(compact.value));
  expect(compact.value).not.toContain('\n');
});
it('given hostile or invalid inputs, then readable export keeps canonical validation and never executes getters', () => {
  const getter = vi.fn(() => {
    throw new Error('Getter executed');
  });
  const hostile = Object.defineProperty({}, 'schemaVersion', { enumerable: true, get: getter });
  for (const value of [
    hostile,
    {},
    { ...emptyDocument(), extra: true },
    { ...emptyDocument(), schemaVersion: 2 },
  ])
    expect(encodeReadableDocument(value)).toEqual(encodeDocument(value));
  expect(getter).not.toHaveBeenCalled();
});

function atReadableLimit(extra: number): WorkflowDocument {
  let nested: JsonValue = Array.from({ length: 8000 }, () => 0);
  for (let depth = 0; depth < 30; depth++) nested = { nested };
  const document: WorkflowDocument = {
    ...emptyDocument(),
    nodes: Array.from({ length: 8 }, (_, index) => ({
      id: sampleId(index + 2),
      type: 'manualTrigger',
      label: 'Trigger',
      position: { x: 0, y: 0 },
      config: { payload: { nested, padding: '' } },
    })),
  };
  const compact = encodeDocument(document);
  if (!compact.ok) throw new Error('Budget fixture invalid');
  const parsed: unknown = JSON.parse(compact.value);
  let remaining = LIMITS.MAX_DOCUMENT_BYTES - utf8Bytes(JSON.stringify(parsed, null, 2)) + extra;
  if (remaining < 0 || remaining > 8 * LIMITS.MAX_STRING_BYTES)
    throw new Error('Budget fixture cannot be padded');
  const nodes = document.nodes.map((node) => {
    const size = Math.min(remaining, LIMITS.MAX_STRING_BYTES);
    remaining -= size;
    return {
      ...node,
      type: 'manualTrigger' as const,
      config: { payload: { nested, padding: 'x'.repeat(size) } },
    };
  });
  expect(remaining).toBe(0);
  return { ...document, nodes };
}
it.each([0, 1])(
  'given readable size at the import cap + %i, then only importable output is returned and compact export remains available',
  (extra) => {
    const document = atReadableLimit(extra),
      result = encodeReadableDocument(document),
      compact = encodeDocument(document);
    expect(compact.ok).toBe(true);
    if (extra === 0) {
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Exact cap failed');
      expect(utf8Bytes(result.value)).toBe(LIMITS.MAX_DOCUMENT_BYTES);
      const decoded = decodeDocument(result.value);
      expect(decoded.ok).toBe(true);
      if (decoded.ok) expect(encodeDocument(decoded.value)).toEqual(compact);
    } else
      expect(result).toMatchObject({
        ok: false,
        error: { code: 'RESOURCE_LIMIT', context: { limitName: 'MAX_DOCUMENT_BYTES' } },
      });
  },
);
