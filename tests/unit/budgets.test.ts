import { expect, it, describe } from 'vitest';
import { FIELDS, LIMITS } from '../../src/contracts/limits';
import { inspectJson, PAYLOAD_BUDGET } from '../../src/validation/json-safety';
import { lexicalPreflight } from '../../src/validation/lexical';
import { validateDocument } from '../../src/validation/codec';
import {
  configSchemas,
  documentSchema,
  nameSchema,
  pathSchema,
  viewportSchema,
} from '../../src/validation/schemas';
import { graphWith, emptyDocument, link } from '../fixtures/graphs';
import { sampleId } from '../../src/application/sample';
import { canonicalJson, utf8Bytes } from '../../src/domain/json/canonical';

const nested = (depth: number): unknown => {
  let value: unknown = 0;
  for (let i = 0; i < depth; i++) value = { a: value };
  return value;
};
const manyValues = (count: number): unknown => {
  // root + chunk containers + leaves = count; every array remains below its cap.
  const chunks = Math.ceil((count - 1) / (LIMITS.MAX_ARRAY_LENGTH + 1));
  let leaves = count - 1 - chunks;
  return Array.from({ length: chunks }, () => {
    const size = Math.min(leaves, LIMITS.MAX_ARRAY_LENGTH);
    leaves -= size;
    return Array.from({ length: size }, () => 0);
  });
};
const sizedValue = (bytes: number): string[] => {
  const full = LIMITS.MAX_STRING_BYTES;
  const count = Math.ceil((bytes - 1) / (full + 3));
  let remaining = bytes - 1 - count * 3;
  return Array.from({ length: count }, () => {
    const size = Math.min(remaining, full);
    remaining -= size;
    return 'x'.repeat(size);
  });
};
describe('inclusive Stage 1 resource boundaries', () => {
  it('given document bytes at cap and cap+1, then lexical preflight accepts only the cap', () => {
    const base = JSON.stringify(emptyDocument());
    const text = base + ' '.repeat(LIMITS.MAX_DOCUMENT_BYTES - utf8Bytes(base));
    expect(lexicalPreflight(text).ok).toBe(true);
    expect(lexicalPreflight(text + ' ').ok).toBe(false);
    expect(validateDocument({ ...emptyDocument(), description: 'x' }).ok).toBe(false);
  });
  it('given BOM raw bytes and nested oversized payloads, then decoding and payload errors preserve resource taxonomy', async () => {
    const { decodeDocument } = await import('../../src/validation/codec');
    const base = JSON.stringify(emptyDocument());
    const capped = base + ' '.repeat(LIMITS.MAX_DOCUMENT_BYTES - utf8Bytes(base));
    const bom = decodeDocument('\ufeff' + capped);
    expect(bom.ok ? '' : bom.error.code).toBe('RESOURCE_LIMIT');
    const document = graphWith(1, 'manualTrigger');
    const payload = { data: sizedValue(LIMITS.MAX_PAYLOAD_BYTES) };
    const result = validateDocument({
      ...document,
      nodes: document.nodes.map((node) => ({ ...node, config: { payload } })),
    });
    expect(result.ok ? '' : result.error.code).toBe('RESOURCE_LIMIT');
  });
  it('given exact payload canonical bytes at cap and cap+1, then the payload boundary is enforced', () => {
    for (const offset of [0, 1]) {
      const value = sizedValue(LIMITS.MAX_PAYLOAD_BYTES + offset);
      expect(utf8Bytes(canonicalJson(value))).toBe(LIMITS.MAX_PAYLOAD_BYTES + offset);
      expect(inspectJson(value, PAYLOAD_BUDGET).ok).toBe(offset === 0);
    }
  });
  it('given document bytes at cap with bounded strings/values, then object inspection enforces its canonical byte ceiling', () => {
    for (const offset of [0, 1]) {
      const value = sizedValue(LIMITS.MAX_DOCUMENT_BYTES + offset);
      expect(utf8Bytes(canonicalJson(value))).toBe(LIMITS.MAX_DOCUMENT_BYTES + offset);
      expect(inspectJson(value).ok).toBe(offset === 0);
    }
  });
  it.each([
    [LIMITS.MAX_DOCUMENT_DEPTH, false],
    [LIMITS.MAX_VALUE_DEPTH, true],
  ] as const)('given depth cap %i, then root depth zero is counted', (depth, payload) => {
    expect(inspectJson(nested(depth), payload ? PAYLOAD_BUDGET : undefined).ok).toBe(true);
    expect(inspectJson(nested(depth + 1), payload ? PAYLOAD_BUDGET : undefined).ok).toBe(false);
  });
  it.each([
    [LIMITS.MAX_DOCUMENT_VALUES, false],
    [LIMITS.MAX_PAYLOAD_VALUES, true],
  ] as const)('given value-count cap %i, then container values count too', (count, payload) => {
    expect(inspectJson(manyValues(count), payload ? PAYLOAD_BUDGET : undefined).ok).toBe(true);
    expect(inspectJson(manyValues(count + 1), payload ? PAYLOAD_BUDGET : undefined).ok).toBe(false);
  });
  it('given string UTF-8 cap and scalar key cap, then Unicode is counted correctly', () => {
    expect(inspectJson('é'.repeat(LIMITS.MAX_STRING_BYTES / 2)).ok).toBe(true);
    expect(inspectJson('é'.repeat(LIMITS.MAX_STRING_BYTES / 2) + 'a').ok).toBe(false);
    expect(inspectJson({ ['😀'.repeat(LIMITS.MAX_KEY_CODEPOINTS)]: 0 }).ok).toBe(true);
    expect(inspectJson({ ['😀'.repeat(LIMITS.MAX_KEY_CODEPOINTS + 1)]: 0 }).ok).toBe(false);
  });
  it('given array, path, and pick-list caps, then cap+1 is rejected', () => {
    expect(inspectJson(Array(LIMITS.MAX_ARRAY_LENGTH).fill(0)).ok).toBe(true);
    expect(inspectJson(Array(LIMITS.MAX_ARRAY_LENGTH + 1).fill(0)).ok).toBe(false);
    expect(pathSchema.safeParse(Array(LIMITS.MAX_PATH_SEGMENTS).fill('a')).success).toBe(true);
    expect(pathSchema.safeParse(Array(LIMITS.MAX_PATH_SEGMENTS + 1).fill('a')).success).toBe(false);
    expect(pathSchema.safeParse([]).success).toBe(false);
    const paths = Array.from({ length: LIMITS.MAX_PICK_PATHS }, (_, i) => [`p${i}`]);
    expect(configSchemas.pickFields.safeParse({ paths, missing: 'omit' }).success).toBe(true);
    expect(
      configSchemas.pickFields.safeParse({ paths: [...paths, ['extra']], missing: 'omit' }).success,
    ).toBe(false);
  });
  it('given node/edge envelope caps, then shape accepts inclusive caps and structure still rejects illegal connections', () => {
    expect(validateDocument(graphWith(LIMITS.MAX_NODES)).ok).toBe(true);
    expect(validateDocument(graphWith(LIMITS.MAX_NODES + 1)).ok).toBe(false);
    const edges = Array.from({ length: LIMITS.MAX_EDGES }, (_, i) =>
      link(sampleId(2), sampleId(3), 1000 + i),
    );
    expect(documentSchema.safeParse({ ...graphWith(2), edges }).success).toBe(true);
    expect(
      documentSchema.safeParse({
        ...graphWith(2),
        edges: [...edges, link(sampleId(2), sampleId(3), 2000)],
      }).success,
    ).toBe(false);
    expect(validateDocument({ ...graphWith(2), edges }).ok).toBe(false);
  });
  it('given coordinates/zoom/name/description/note limits, then field-specific caps remain strict', () => {
    expect(
      viewportSchema.safeParse({
        x: -FIELDS.COORDINATE,
        y: FIELDS.COORDINATE,
        zoom: FIELDS.MIN_ZOOM,
      }).success,
    ).toBe(true);
    expect(viewportSchema.safeParse({ x: FIELDS.COORDINATE + 1, y: 0, zoom: 1 }).success).toBe(
      false,
    );
    expect(viewportSchema.safeParse({ x: -FIELDS.COORDINATE - 1, y: 0, zoom: 1 }).success).toBe(
      false,
    );
    for (const zoom of [FIELDS.MIN_ZOOM - 0.01, FIELDS.MAX_ZOOM + 0.01, Infinity])
      expect(viewportSchema.safeParse({ x: 0, y: 0, zoom }).success).toBe(false);
    expect(viewportSchema.safeParse({ x: 0, y: 0, zoom: FIELDS.MAX_ZOOM }).success).toBe(true);
    expect(nameSchema.safeParse('😀'.repeat(FIELDS.NAME)).success).toBe(true);
    expect(nameSchema.safeParse('😀'.repeat(FIELDS.NAME + 1)).success).toBe(false);
    for (const field of ['description', 'note'] as const) {
      const cap = field === 'description' ? FIELDS.DESCRIPTION : FIELDS.NOTE;
      for (const offset of [0, 1]) {
        const value = 'x'.repeat(cap + offset);
        const accepted =
          field === 'note'
            ? configSchemas.note.safeParse({ text: value }).success
            : validateDocument({
                ...emptyDocument(),
                metadata: { ...emptyDocument().metadata, description: value },
              }).ok;
        expect(accepted).toBe(offset === 0);
      }
    }
  });
});
