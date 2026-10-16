import { it, expect } from 'vitest';
import fc from 'fast-check';
import { compareCodePoints, utf8Bytes, canonicalJson } from '../../src/domain/json/canonical';
import { validScalarString } from '../../src/domain/json/path';

it('given arbitrary UTF-16, then byte counts and scalar rejection match independent Unicode references', () => {
  const text = fc
    .array(fc.integer({ min: 0, max: 0xffff }), { maxLength: 100 })
    .map((units) => String.fromCharCode(...units));
  fc.assert(
    fc.property(text, (value) => {
      const expected = Array.from(value).every((scalar) => {
        const point = scalar.codePointAt(0) ?? 0;
        return point < 0xd800 || point > 0xdfff;
      });
      expect(validScalarString(value)).toBe(expected);
      expect(utf8Bytes(value)).toBe(new TextEncoder().encode(value).byteLength);
    }),
    { seed: 42615, numRuns: 500 },
  );
  for (const value of [
    '',
    'ascii'.repeat(13000),
    '\u007f\u0080\u07ff\u0800',
    '😀',
    '\ud800',
    '\udfff',
    '\ud800a',
    '\udc00\ud800',
  ]) {
    expect(utf8Bytes(value)).toBe(new TextEncoder().encode(value).byteLength);
  }
  expect(validScalarString('😀')).toBe(true);
  expect(validScalarString('\ud800')).toBe(false);
  expect(validScalarString('\udc00\ud800')).toBe(false);
});

it('given 500 seeded Unicode pairs, then allocation-free ordering preserves every code-point and prefix result', () => {
  const text = fc
    .array(
      fc.oneof(fc.integer({ min: 0, max: 0xd7ff }), fc.integer({ min: 0xe000, max: 0x10ffff })),
      { maxLength: 40 },
    )
    .map((points) => String.fromCodePoint(...points));
  fc.assert(
    fc.property(text, text, (a, b) => {
      const left = Array.from(a, (c) => c.codePointAt(0) ?? 0),
        right = Array.from(b, (c) => c.codePointAt(0) ?? 0);
      let expected = left.length - right.length;
      for (let i = 0; i < Math.min(left.length, right.length); i++)
        if (left[i] !== right[i]) {
          expected = (left[i] ?? 0) - (right[i] ?? 0);
          break;
        }
      expect(compareCodePoints(a, b)).toBe(expected);
      expect(compareCodePoints(a, a + b)).toBe(0 - right.length);
      expect(utf8Bytes(a)).toBe(new TextEncoder().encode(a).length);
    }),
    { seed: 42615, numRuns: 500 },
  );
  expect(canonicalJson({ '😀': 1, '\uE000': 2, a: 3 })).toBe('{"a":3,"\uE000":2,"😀":1}');
});
