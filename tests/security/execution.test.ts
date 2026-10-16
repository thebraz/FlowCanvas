import { expect, it } from 'vitest';
import { parseHostMessage, parseWorkerMessage } from '../../src/validation/worker';
import { compile } from '../../src/engine/compile';
import { RunLedger } from '../../src/engine/ledger';
import { LIMITS } from '../../src/contracts/limits';
import { identity, simpleGraph } from '../fixtures/execution';
import { sampleId } from '../../src/application/sample';
import { failure } from '../../src/contracts/errors';
it('rejects terminal error attribution to unknown nodes, edges, documents or another run', () => {
  const compiled = compile(simpleGraph());
  if (!compiled.ok) throw new Error('fixture');
  for (const context of [
    { nodeId: sampleId(9999) },
    { edgeId: sampleId(9999) },
    { workflowId: sampleId(9999) },
    { runId: sampleId(9999) },
  ]) {
    const ledger = new RunLedger(identity, compiled.value);
    ledger.accept(
      { ...identity, sequence: 1, kind: 'ready', order: compiled.value.order, compileMs: 0 },
      0,
    );
    ledger.accept({ ...identity, sequence: 2, kind: 'state', status: 'ready' }, 0);
    ledger.accept({ ...identity, sequence: 3, kind: 'state', status: 'running' }, 0);
    const result = ledger.makeResult(
      'failed',
      { compileMs: 0, activeMs: 0, pausedMs: 0, wallMs: 0 },
      failure('NODE_FAILED', 'execution', context).error,
    );
    expect(ledger.accept({ ...identity, sequence: 4, kind: 'terminal', result }, 0)).toMatchObject({
      ok: false,
      error: { code: 'WORKER_PROTOCOL' },
    });
  }
});
it('rejects extra fields, unsupported versions, injected actions, getters and unbounded envelopes', () => {
  const base = { ...identity, sequence: 1, kind: 'state', status: 'running' };
  for (const value of [
    { ...base, extra: 1 },
    { ...base, protocolVersion: 2 },
    { ...base, kind: 'eval', code: '1+1' },
    { ...base, sequence: 0 },
    { ...base, runId: 'invalid' },
    { ...base, status: 'completed', value: 'x'.repeat(LIMITS.MAX_WORKER_RESULT_BYTES + 1) },
  ])
    expect(parseWorkerMessage(value).ok).toBe(false);
  let touched = false;
  expect(
    parseWorkerMessage({
      ...base,
      get extra() {
        touched = true;
        return 1;
      },
    }).ok,
  ).toBe(false);
  expect(touched).toBe(false);
  expect(
    parseHostMessage({
      ...identity,
      sequence: 1,
      kind: 'begin',
      requestId: sampleId(9900),
      mode: 'script',
    }).ok,
  ).toBe(false);
  expect(
    parseHostMessage({
      ...identity,
      sequence: 1,
      kind: 'start',
      requestId: sampleId(9900),
      document: simpleGraph(),
      padding: 'x'.repeat(LIMITS.MAX_WORKER_START_BYTES + 1),
    }).ok,
  ).toBe(false);
});
it('rejects dangerous paths and recursive pollution keys without touching Object.prototype', () => {
  for (const path of [['__proto__'], ['constructor', 'x'], ['prototype'], []]) {
    const graph = simpleGraph();
    expect(
      compile({
        ...graph,
        nodes: [
          ...graph.nodes,
          {
            id: sampleId(4),
            type: 'setField',
            label: 'Unsafe',
            position: { x: 0, y: 0 },
            config: { path, value: 1 },
          },
        ],
      }).ok,
    ).toBe(false);
  }
  const poisoned: unknown = JSON.parse('{"nested":[{"__proto__":{"canary":1}}]}');
  expect(
    parseWorkerMessage({
      ...identity,
      sequence: 1,
      kind: 'payload-record',
      nodeId: sampleId(2),
      payloadId: 'p1',
      value: poisoned,
    }).ok,
  ).toBe(false);
  expect(Object.hasOwn(Object.prototype, 'canary')).toBe(false);
});
it('rejects unknown nodes/ports/replayed dispositions and unknown completion payloads', () => {
  const compiled = compile(simpleGraph());
  if (!compiled.ok) throw new Error('fixture');
  for (const bad of [
    { kind: 'node-start', nodeId: sampleId(9999) },
    { kind: 'node-complete', nodeId: sampleId(2), outputPayloadIds: { out: 'p1' }, durationMs: 0 },
    { kind: 'node-skip', nodeId: sampleId(2), reason: 'unreachable' },
  ]) {
    const ledger = new RunLedger(identity, compiled.value);
    expect(
      ledger.accept(
        { ...identity, sequence: 1, kind: 'ready', order: compiled.value.order, compileMs: 0 },
        0,
      ).ok,
    ).toBe(true);
    expect(ledger.accept({ ...identity, sequence: 2, kind: 'state', status: 'ready' }, 0).ok).toBe(
      true,
    );
    expect(
      ledger.accept({ ...identity, sequence: 3, kind: 'state', status: 'running' }, 0).ok,
    ).toBe(true);
    const parsed = parseWorkerMessage({ ...identity, sequence: 4, ...bad });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(ledger.accept(parsed.value, 0).ok).toBe(false);
  }
});
