import { expect, it, vi } from 'vitest';
import { validateDocument, decodeDocument } from '../../src/validation/codec';
import { emptyDocument } from '../fixtures/graphs';
import { makeStore } from '../fixtures/store';
import { sampleId } from '../../src/application/sample';
it('given malformed synthetic private data, then errors and logs contain only safe codes/metadata', () => {
  const canary = 'synthetic-private-canary-42615';
  const log = vi.spyOn(console, 'log');
  const error = vi.spyOn(console, 'error');
  const warn = vi.spyOn(console, 'warn');
  try {
    const results = [
      validateDocument({
        ...emptyDocument(),
        metadata: { ...emptyDocument().metadata, title: ` ${canary}` },
      }),
      decodeDocument(`{"${canary}":1,"${canary}":2}`),
      decodeDocument(`{"bad":${canary}}`),
      validateDocument({ ...emptyDocument(), schemaVersion: 2 }),
    ];
    expect(results.every((result) => !result.ok)).toBe(true);
    expect(JSON.stringify(results)).not.toContain(canary);
    const store = makeStore();
    const before = store.getState();
    const failure = before.dispatch(before.session.sessionId, {
      type: 'ChangeNodeConfig',
      nodeId: sampleId(3),
      config: { payload: { [canary]: true } },
    });
    expect(failure.ok).toBe(false);
    expect(store.getState()).toBe(before);
    expect(JSON.stringify(failure)).not.toContain(canary);
    expect(log).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  } finally {
    log.mockRestore();
    error.mockRestore();
    warn.mockRestore();
  }
});
