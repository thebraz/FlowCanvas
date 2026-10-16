import { describe, expect, it } from 'vitest';
import { createSample, sampleId } from '../../src/application/sample';
import { validateDocument, decodeDocument, encodeDocument } from '../../src/validation/codec';
import { inspectJson } from '../../src/validation/json-safety';
import { emptyDocument, graphWith } from '../fixtures/graphs';
import { configSchemas, nodeSchema } from '../../src/validation/schemas';
import { canonicalJson } from '../../src/domain/json/canonical';
import { readPath, MISSING } from '../../src/domain/json/path';

describe('strict canonical schema', () => {
  it('given empty and synthetic workflows, when validated, then both are editable and immutable', () => {
    expect(validateDocument(emptyDocument()).ok).toBe(true);
    const sample = createSample();
    expect(Object.isFrozen(sample.nodes[0]?.config)).toBe(true);
    expect(sample.nodes).toHaveLength(7);
    expect(sample.edges).toHaveLength(5);
  });
  it.each([
    { ...emptyDocument(), schemaVersion: 2 },
    { ...emptyDocument(), schemaVersion: '1' },
    { ...emptyDocument(), extra: 'not permitted' },
    { ...emptyDocument(), selection: [] },
    { ...emptyDocument(), viewport: { x: 0, y: 0, zoom: 1, selected: true } },
    { ...emptyDocument(), id: sampleId(1).toUpperCase().replace('00000000', 'AAAAAAAA') },
    { ...emptyDocument(), metadata: { ...emptyDocument().metadata, title: ' untrimmed' } },
    {
      ...emptyDocument(),
      metadata: { ...emptyDocument().metadata, updatedAt: '2026-10-14T12:00:00.000Z' },
    },
    {
      ...emptyDocument(),
      metadata: { ...emptyDocument().metadata, createdAt: '2026-02-30T12:00:00.000Z' },
    },
  ])('given unsupported shape %j, when validated, then it rejects without repair', (value) => {
    expect(validateDocument(value).ok).toBe(false);
  });
  it('given transform drafts and partial configs, when validated, then only explicit null or complete config succeeds', () => {
    expect(validateDocument(graphWith(3)).ok).toBe(true);
    for (const type of ['setField', 'pickFields', 'condition'] as const) {
      expect(nodeSchema.safeParse({ ...graphWith(1, type).nodes[0], config: {} }).success).toBe(
        false,
      );
    }
    expect(
      configSchemas.condition.safeParse({ path: ['x'], operator: 'exists', value: 1 }).success,
    ).toBe(false);
    expect(
      configSchemas.condition.safeParse({ path: ['x'], operator: 'gt', value: '3' }).success,
    ).toBe(false);
    expect(
      configSchemas.condition.safeParse({ path: ['x'], operator: 'contains', value: '' }).success,
    ).toBe(true);
    expect(
      configSchemas.condition.safeParse({ path: ['x'], operator: 'eq', value: '\u0000' }).success,
    ).toBe(true);
    expect(
      configSchemas.pickFields.safeParse({ paths: [['a'], ['a', 'b']], missing: 'omit' }).success,
    ).toBe(false);
    expect(
      configSchemas.pickFields.safeParse({ paths: [['a.b'], ['a', 'b']], missing: 'error' })
        .success,
    ).toBe(true);
  });
  it.each(['__proto__', 'constructor', 'prototype'])(
    'given nested forbidden key %s, then the entire boundary rejects',
    (key) => {
      const value: unknown = JSON.parse(`{"safe":[{"${key}":1}]}`);
      expect(inspectJson(value).ok).toBe(false);
      expect(configSchemas.setField.safeParse({ path: [key], value: 1 }).success).toBe(false);
    },
  );
  it('given duplicate escaped keys or malformed UTF-8/JSON, then decoding fails explicitly', () => {
    const result = decodeDocument('{"nodes":[],"n\\u006fdes":[]}');
    expect(result.ok ? '' : result.error.code).toBe('IMPORT_DUPLICATE_KEY');
    for (const text of [
      '',
      '{}x',
      '{"a":1,}',
      '[1',
      '{"a":"\\uD800"}',
      '{"a":undefined}',
      'true false',
    ])
      expect(decodeDocument(text).ok).toBe(false);
    expect(decodeDocument(new Uint8Array([0xff])).ok).toBe(false);
    expect(decodeDocument('\ufeff' + JSON.stringify(emptyDocument())).ok).toBe(true);
    expect(
      decodeDocument(new TextEncoder().encode('\ufeff' + JSON.stringify(emptyDocument()))).ok,
    ).toBe(true);
  });
  it('given accessors/exotic values, then inspection never executes getters and rejects unsafe JSON', () => {
    let reads = 0;
    const getter = Object.defineProperty({}, 'x', {
      enumerable: true,
      get: () => {
        reads++;
        return 1;
      },
    });
    const hidden = Object.defineProperty({}, 'x', { enumerable: false, value: 1 });
    const sparse = Array(2);
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    for (const value of [
      getter,
      hidden,
      sparse,
      cycle,
      new Date(),
      new Map(),
      new Set(),
      Object.create({ inherited: 1 }),
      { x: undefined },
      { x: 1n },
      { x: Symbol() },
      { x: () => 1 },
      { x: NaN },
      { x: Infinity },
      { x: '\udfff' },
      { [Symbol('x')]: 1 },
    ])
      expect(inspectJson(value).ok).toBe(false);
    expect(reads).toBe(0);
    const proxy = Proxy.revocable({}, {});
    proxy.revoke();
    expect(inspectJson(proxy.proxy).ok).toBe(false);
    expect(inspectJson(Object.assign(Object.create(null) as object, { x: 1 })).ok).toBe(true);
    expect(Object.hasOwn(Object.prototype, 'polluted')).toBe(false);
  });
  it('given canonical data with integer-like and astral keys, then key order and negative zero are deterministic', () => {
    expect(canonicalJson({ '2': 2, '10': 10, z: -0, '\ue000': 1, '😀': 2 })).toBe(
      '{"10":10,"2":2,"z":0,"":1,"😀":2}',
    );
    const encoded = encodeDocument(createSample());
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;
    const decoded = decodeDocument(encoded.value);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(encodeDocument(decoded.value)).toEqual(encoded);
    expect(encodeDocument({ ...emptyDocument(), nodes: [undefined] }).ok).toBe(false);
  });
  it('given literal paths, then missing differs from null and wrong intermediate type', () => {
    expect(readPath({ 'a.b': null }, ['a.b'])).toEqual({ ok: true, value: null });
    expect(readPath({}, ['a', 'b'])).toEqual({ ok: true, value: MISSING });
    for (const value of [null, 3, [], false])
      expect(readPath({ a: value }, ['a', 'b']).ok).toBe(false);
    expect(readPath({ a: {} }, ['a', 'constructor']).ok).toBe(false);
  });
});
