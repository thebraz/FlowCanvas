import { it, expect } from 'vitest';
import { makeEnvelope, verifyEnvelope } from '../../src/adapters/persistence/indexeddb';
import { createSample } from '../../src/application/sample';
it('given a verified envelope, then checksum, byte count and strict shape independently detect corruption', async () => {
  const made = await makeEnvelope(createSample(), 1);
  expect(made.ok).toBe(true);
  if (!made.ok) throw new Error('Envelope failed');
  expect((await verifyEnvelope(made.value)).ok).toBe(true);
  for (const input of [
    { ...made.value, canonicalBytes: made.value.canonicalBytes + 1 },
    { ...made.value, sha256: '0'.repeat(64) },
    { ...made.value, envelopeVersion: 2 },
    { ...made.value, unknown: true },
    { ...made.value, document: { ...made.value.document, unknown: true } },
  ])
    expect((await verifyEnvelope(input)).ok).toBe(false);
});
it('given hostile stored accessors and cycles, then hydration never invokes a getter or repairs the record', async () => {
  let invoked = false;
  const value = Object.defineProperty({}, 'document', {
    enumerable: true,
    get() {
      invoked = true;
      return createSample();
    },
  });
  expect((await verifyEnvelope(value)).ok).toBe(false);
  expect(invoked).toBe(false);
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  expect((await verifyEnvelope(cyclic)).ok).toBe(false);
});
