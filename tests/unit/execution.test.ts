import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { compile } from '../../src/engine/compile';
import { executeNode, evaluateCondition } from '../../src/engine/nodes';
import { allowedTransition, RunLedger } from '../../src/engine/ledger';
import { LIMITS } from '../../src/contracts/limits';
import { failure } from '../../src/contracts/errors';
import type { ConditionConfig, JsonObject, WorkflowNode } from '../../src/contracts/workflow';
import { sampleId } from '../../src/application/sample';
import { freezeJson } from '../../src/validation/json-safety';
import { emptyDocument, link, representativeGraph } from '../fixtures/graphs';
import { execute, harness, identity, node, settle, simpleGraph } from '../fixtures/execution';

describe('independent compilation and node semantics', () => {
  it('rejects a reachable draft even after warnings fill the retained diagnostic budget', () => {
    const graph = {
      ...emptyDocument(),
      nodes: [
        ...Array.from({ length: 101 }, (_, index) => node('setField', index + 10)),
        node('manualTrigger', 2),
        node('setField', 3),
        node('output', 4),
      ],
      edges: [link(sampleId(2), sampleId(3), 1000), link(sampleId(3), sampleId(4), 1001)],
    };
    expect(compile(graph)).toMatchObject({
      ok: false,
      error: { code: 'CONFIG_INVALID', context: { nodeId: sampleId(3) } },
    });
  });
  it('rejects missing triggers, output, reachable drafts and structural cycles before invoking anything', () => {
    for (const document of [
      emptyDocument(),
      { ...simpleGraph(), edges: [] },
      { ...simpleGraph(), nodes: [node('note', 2)] },
      {
        ...simpleGraph(),
        nodes: [node('manualTrigger', 2), node('setField', 3), node('output', 4)],
        edges: [link(sampleId(2), sampleId(3), 1000), link(sampleId(3), sampleId(4), 1001)],
      },
    ])
      expect(compile(document).ok).toBe(false);
    expect(
      compile({
        ...simpleGraph(),
        nodes: [node('manualTrigger', 2), node('setField', 3), node('setField', 4)],
        edges: [link(sampleId(3), sampleId(4), 1000), link(sampleId(4), sampleId(3), 1001)],
      }),
    ).toMatchObject({ ok: false, error: { code: 'GRAPH_CYCLE' } });
    expect(compile(simpleGraph(), () => true).ok).toBe(false);
  });
  it('compiles static order with Notes excluded and unreachable null drafts retained as skips', async () => {
    const graph = {
      ...simpleGraph(),
      nodes: [...simpleGraph().nodes, node('note', 4), node('setField', 5)],
    };
    const h = await execute(graph);
    expect([...h.engine.ledger.view.records.keys()]).toEqual([
      sampleId(2),
      sampleId(3),
      sampleId(5),
    ]);
    expect(h.engine.ledger.view.records.get(sampleId(5))).toMatchObject({
      disposition: 'skipped',
      skipReason: 'unreachable',
    });
  });
  it('sets literal nested paths immutably, creates missing objects and preserves present null leaves', async () => {
    const input = freezeJson({ user: { name: 'Ana' }, array: [1, 2], x: null });
    const transform: WorkflowNode = {
      ...node('setField', 3),
      type: 'setField',
      config: { path: ['user', 'tier'], value: 'gold' },
    };
    const result = await executeNode(transform, input, { identity, cancelled: () => false });
    expect(result).toMatchObject({
      ok: true,
      value: { emitted: { out: { user: { name: 'Ana', tier: 'gold' }, array: [1, 2], x: null } } },
    });
    expect(input).toEqual({ user: { name: 'Ana' }, array: [1, 2], x: null });
    expect(
      await executeNode(
        { ...transform, config: { path: ['a.b'], value: null } },
        {},
        { identity, cancelled: () => false },
      ),
    ).toMatchObject({ ok: true, value: { emitted: { out: { 'a.b': null } } } });
    expect(
      await executeNode(
        { ...transform, config: { path: ['a', 'b'], value: null } },
        {},
        { identity, cancelled: () => false },
      ),
    ).toMatchObject({ ok: true, value: { emitted: { out: { a: { b: null } } } } });
    for (const a of [null, 3, []])
      expect(
        await executeNode(
          { ...transform, config: { path: ['a', 'b'], value: 1 } },
          { a },
          { identity, cancelled: () => false },
        ),
      ).toMatchObject({ ok: false, error: { code: 'PATH_TYPE' } });
  });
  it('picks nested shapes in segment order with exact missing and path-type behavior', async () => {
    const pick: WorkflowNode = {
      ...node('pickFields', 3),
      type: 'pickFields',
      config: { paths: [['user', 'name'], ['count'], ['null']], missing: 'omit' },
    };
    expect(
      await executeNode(
        pick,
        freezeJson({ user: { name: 'Ana', tier: 'gold' }, count: 2, null: null }),
        { identity, cancelled: () => false },
      ),
    ).toMatchObject({
      ok: true,
      value: { emitted: { out: { user: { name: 'Ana' }, count: 2, null: null } } },
    });
    expect(await executeNode(pick, {}, { identity, cancelled: () => false })).toMatchObject({
      ok: true,
      value: { emitted: { out: {} } },
    });
    expect(
      await executeNode(
        { ...pick, config: { paths: [['user', 'name']], missing: 'error' } },
        {},
        { identity, cancelled: () => false },
      ),
    ).toMatchObject({ ok: false, error: { code: 'MISSING_FIELD' } });
    expect(
      await executeNode(pick, { user: null }, { identity, cancelled: () => false }),
    ).toMatchObject({ ok: false, error: { code: 'PATH_TYPE' } });
  });
  const conditions: readonly [ConditionConfig, JsonObject, boolean | string][] = [
    [{ path: ['x'], operator: 'exists' }, { x: null }, true],
    [{ path: ['x'], operator: 'notExists' }, {}, true],
    [{ path: ['x'], operator: 'eq', value: 18 }, { x: '18' }, false],
    [{ path: ['x'], operator: 'neq', value: 18 }, { x: '18' }, true],
    [{ path: ['x'], operator: 'eq', value: null }, { x: null }, true],
    [{ path: ['x'], operator: 'eq', value: null }, { x: {} }, 'TYPE_MISMATCH'],
    [{ path: ['x'], operator: 'gt', value: 18 }, { x: 19 }, true],
    [{ path: ['x'], operator: 'gte', value: 18 }, { x: 18 }, true],
    [{ path: ['x'], operator: 'lt', value: 18 }, { x: 17 }, true],
    [{ path: ['x'], operator: 'lte', value: 18 }, { x: 18 }, true],
    [{ path: ['x'], operator: 'gte', value: 18 }, { x: '18' }, 'TYPE_MISMATCH'],
    [{ path: ['x'], operator: 'contains', value: 'A' }, { x: 'abc' }, false],
    [{ path: ['x'], operator: 'contains', value: '' }, { x: 'abc' }, true],
    [{ path: ['x'], operator: 'contains', value: 'a' }, { x: 1 }, 'TYPE_MISMATCH'],
    [{ path: ['x'], operator: 'eq', value: 1 }, {}, 'MISSING_FIELD'],
    [{ path: ['x', 'y'], operator: 'exists' }, { x: [] }, 'PATH_TYPE'],
    [{ path: ['x', 'y'], operator: 'exists' }, {}, false],
  ];
  it.each(conditions)('evaluates strict Condition %j against %j', (config, input, expected) => {
    expect(evaluateCondition(input, config)).toMatchObject(
      typeof expected === 'boolean'
        ? { ok: true, value: expected }
        : { ok: false, error: { code: expected } },
    );
  });
  it('fails unconfigured handlers, missing inputs and cancellation without substituted data', async () => {
    expect(
      await executeNode(
        { ...node('setField', 2), type: 'setField', config: null },
        {},
        { identity, cancelled: () => false },
      ),
    ).toMatchObject({ ok: false, error: { code: 'CONFIG_INVALID' } });
    expect(
      await executeNode(
        { ...node('output', 2), type: 'output', config: { name: 'Result' } },
        undefined,
        { identity, cancelled: () => false },
      ),
    ).toMatchObject({ ok: false, error: { code: 'NODE_FAILED' } });
    expect(
      await executeNode(
        { ...node('manualTrigger', 2), type: 'manualTrigger', config: { payload: {} } },
        undefined,
        { identity, cancelled: () => true },
      ),
    ).toMatchObject({ ok: false });
  });
});

describe('activation, isolation and deterministic scheduling', () => {
  it.each([true, false])('routes only the selected Condition branch (%s)', async (route) => {
    const graph = {
      ...simpleGraph({ flag: route }),
      nodes: [
        simpleGraph({ flag: route }).nodes[0]!,
        {
          ...node('condition', 3),
          type: 'condition' as const,
          config: { path: ['flag'], operator: 'eq' as const, value: true },
        },
        node('output', 4),
        node('output', 5),
        {
          ...node('setField', 6),
          type: 'setField' as const,
          config: { path: ['changed'], value: 1 },
        },
        node('output', 7),
      ],
      edges: [
        link(sampleId(2), sampleId(3), 1000),
        link(sampleId(3), sampleId(4), 1001, 'true'),
        link(sampleId(3), sampleId(5), 1002, 'false'),
        link(sampleId(3), sampleId(6), 1003, 'false'),
        link(sampleId(6), sampleId(7), 1004),
      ],
    };
    const h = await execute(graph);
    expect(h.engine.ledger.view.records.get(sampleId(route ? 5 : 4))).toMatchObject({
      disposition: 'skipped',
      skipReason: 'branch-not-selected',
    });
    if (route)
      expect(h.engine.ledger.view.records.get(sampleId(7))).toMatchObject({
        disposition: 'skipped',
        skipReason: 'upstream-skipped',
      });
    expect(h.engine.ledger.view.outputs.map((o) => o.nodeId)).toEqual(
      route ? [sampleId(4)] : [sampleId(5), sampleId(7)],
    );
  });
  it('fan-out and independent triggers share no mutable branch data and preserve duplicate result names', async () => {
    const graph = {
      ...simpleGraph({ a: 1 }),
      nodes: [
        ...simpleGraph({ a: 1 }).nodes,
        { ...node('setField', 4), type: 'setField' as const, config: { path: ['a'], value: 2 } },
        node('output', 5),
        {
          ...node('manualTrigger', 6),
          type: 'manualTrigger' as const,
          config: { payload: { b: 3 } },
        },
        node('output', 7),
      ],
      edges: [
        ...simpleGraph().edges,
        link(sampleId(2), sampleId(4), 1001),
        link(sampleId(4), sampleId(5), 1002),
        link(sampleId(6), sampleId(7), 1003),
      ],
    };
    const h = await execute(graph),
      view = h.engine.ledger.view;
    expect(view.outputs.map((o) => view.payloads.get(o.payloadId))).toEqual([
      { a: 1 },
      { a: 2 },
      { b: 3 },
    ]);
    expect(view.outputs.map((o) => o.sequenceIndex)).toEqual([0, 1, 2]);
    expect(graph.nodes[0]?.config).toEqual({ payload: { a: 1 } });
  });
  it('completes with explicit warning when routing activates no reachable Output', async () => {
    const graph = {
      ...simpleGraph({ a: 1 }),
      nodes: [
        simpleGraph({ a: 1 }).nodes[0]!,
        {
          ...node('condition', 3),
          type: 'condition' as const,
          config: { path: ['a'], operator: 'eq' as const, value: 2 },
        },
        node('output', 4),
      ],
      edges: [link(sampleId(2), sampleId(3), 1000), link(sampleId(3), sampleId(4), 1001, 'true')],
    };
    const h = await execute(graph);
    expect(h.engine.ledger.view.result).toMatchObject({
      status: 'completed',
      outputs: [],
      partial: false,
    });
    expect(h.messages.some((m) => m.kind === 'warning')).toBe(true);
  });
  it('preserves earlier outputs and marks downstream pending records skipped after a real path failure', async () => {
    const graph = {
      ...simpleGraph({ a: 1 }),
      nodes: [
        ...simpleGraph({ a: 1 }).nodes,
        {
          ...node('setField', 4),
          type: 'setField' as const,
          config: { path: ['a', 'b'], value: 2 },
        },
        node('output', 5),
      ],
      edges: [
        ...simpleGraph().edges,
        link(sampleId(2), sampleId(4), 1001),
        link(sampleId(4), sampleId(5), 1002),
      ],
    };
    const h = await execute(graph);
    expect(h.engine.ledger.view.result).toMatchObject({
      status: 'failed',
      partial: true,
      error: { code: 'PATH_TYPE' },
      outputs: [{ nodeId: sampleId(3) }],
    });
    expect(h.engine.ledger.view.records.get(sampleId(5))).toMatchObject({
      disposition: 'skipped',
      skipReason: 'run-failed',
    });
  });
  it('rejects handler promise rejection, malformed ports and output roots atomically', async () => {
    for (const handler of [
      () => Promise.reject(new Error('synthetic private text')),
      () => ({ ok: true as const, value: { emitted: { true: {} } } }),
      () => ({ ok: false as const, error: failure('NODE_FAILED', 'execution').error }),
    ]) {
      const h = await execute(simpleGraph(), handler);
      expect(h.engine.ledger.view.result?.status).toBe('failed');
      expect(h.engine.ledger.view.payloads.size).toBe(0);
    }
  });
  it('runs 500 seeded equivalent array permutations with identical semantic records and values', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            parent: fc.nat(50),
            kind: fc.integer({ min: 0, max: 4 }),
            value: fc.integer({ min: -10, max: 10 }),
          }),
          { minLength: 1, maxLength: 24 },
        ),
        fc.boolean(),
        async (recipe, reverse) => {
          const nodes: WorkflowNode[] = [
            { ...node('manualTrigger', 2), type: 'manualTrigger', config: { payload: { a: 1 } } },
          ];
          const edges = [];
          for (const [index, item] of recipe.entries()) {
            const parent = nodes[item.parent % nodes.length];
            if (!parent) throw new Error('Generator parent');
            const child: WorkflowNode =
              item.kind === 0
                ? {
                    ...node('manualTrigger', index + 3),
                    type: 'manualTrigger',
                    config: { payload: { a: item.value } },
                  }
                : item.kind === 1
                  ? {
                      ...node('condition', index + 3),
                      type: 'condition',
                      config: { path: ['a'], operator: 'gte', value: item.value },
                    }
                  : item.kind === 2
                    ? {
                        ...node('pickFields', index + 3),
                        type: 'pickFields',
                        config: { paths: [['a']], missing: 'error' },
                      }
                    : {
                        ...node('setField', index + 3),
                        type: 'setField',
                        config: { path: ['a'], value: item.value },
                      };
            nodes.push(child);
            if (child.type !== 'manualTrigger')
              edges.push(
                link(
                  parent.id,
                  child.id,
                  1000 + index,
                  parent.type === 'condition' ? (index % 2 ? 'true' : 'false') : 'out',
                ),
              );
          }
          const last = nodes.at(-1);
          if (!last) throw new Error('Generator end');
          nodes.push(node('output', 100), node('output', 101));
          edges.push(
            link(sampleId(2), sampleId(100), 2000),
            link(last.id, sampleId(101), 2001, last.type === 'condition' ? 'true' : 'out'),
          );
          const graph = { ...emptyDocument(), nodes, edges };
          const left = await execute(graph),
            right = await execute({
              ...graph,
              nodes: reverse ? [...graph.nodes].reverse() : graph.nodes,
              edges: [...graph.edges].reverse(),
            });
          const semantics = (h: typeof left) => ({
            records: [...h.engine.ledger.view.records.values()].map(({ durationMs, ...record }) => {
              void durationMs;
              return record;
            }),
            outputs: h.engine.ledger.view.outputs.map((o) => ({
              nodeId: o.nodeId,
              value: h.engine.ledger.view.payloads.get(o.payloadId),
            })),
          });
          expect(semantics(left)).toEqual(semantics(right));
        },
      ),
      { seed: 42615, numRuns: 500 },
    );
  }, 120000);
  it.each([20, 100, 300] as const)(
    'preserves full representative %s-node schedule under reversed serialization',
    async (count) => {
      const graph = representativeGraph(count),
        left = await execute(graph),
        right = await execute({
          ...graph,
          nodes: [...graph.nodes].reverse(),
          edges: [...graph.edges].reverse(),
        });
      expect(left.engine.ledger.view.outputs).toEqual(right.engine.ledger.view.outputs);
      expect([...left.engine.ledger.view.payloads.values()]).toEqual([
        ...right.engine.ledger.view.payloads.values(),
      ]);
      expect(left.engine.ledger.view.result?.status).toBe('completed');
    },
  );
});

describe('real scheduler controls and budgets', () => {
  it('accepts exactly 300 operations and rejects cap+1 before compilation', async () => {
    const nodes: WorkflowNode[] = [
      { ...node('manualTrigger', 2), type: 'manualTrigger', config: { payload: { a: 1 } } },
    ];
    for (let index = 3; index <= 300; index++)
      nodes.push({
        ...node('setField', index),
        type: 'setField',
        config: { path: ['a'], value: index },
      });
    nodes.push(node('output', 301));
    const edges = nodes
      .slice(1)
      .map((target, index) => link(nodes[index]?.id ?? '', target.id, 1000 + index));
    const graph = { ...emptyDocument(), nodes, edges };
    const h = await execute(graph);
    expect(h.engine.ledger.view.result).toMatchObject({
      status: 'completed',
      counts: { operations: 300 },
    });
    expect(compile({ ...graph, nodes: [...nodes, node('note', 302)] })).toMatchObject({
      ok: false,
      error: { code: 'RESOURCE_LIMIT', context: { limitName: 'MAX_NODES' } },
    });
  });
  it('steps over inactive records and completes when only skips remain', async () => {
    const graph = {
      ...simpleGraph(),
      nodes: [
        ...simpleGraph().nodes,
        ...Array.from({ length: 65 }, (_, index) => node('setField', index + 4)),
      ],
    };
    const h = harness(graph);
    h.begin('pauseBeforeFirst');
    await settle(() => h.engine.ledger.view.status === 'paused');
    h.engine.control({ kind: 'step', requestId: sampleId(9011) });
    await settle(() => h.engine.ledger.view.status === 'paused');
    h.engine.control({ kind: 'step', requestId: sampleId(9012) });
    await settle(() => h.engine.ledger.view.status === 'completed');
    expect(h.engine.ledger.view.result?.counts).toMatchObject({ operations: 2, skipped: 65 });
  });
  it('rejects output accessors without invoking them or publishing partial data', async () => {
    let touched = false;
    const emitted = { out: {} };
    Object.defineProperty(emitted, 'out', {
      enumerable: true,
      get() {
        touched = true;
        return {};
      },
    });
    const h = await execute(simpleGraph(), () => ({ ok: true, value: { emitted } }));
    expect(h.engine.ledger.view.result?.status).toBe('failed');
    expect(touched).toBe(false);
    expect(h.engine.ledger.view.payloads.size).toBe(0);
  });
  it('represents ready and pauses before the first invocation; each Step invokes exactly one activated node', async () => {
    const h = harness(simpleGraph());
    expect(h.engine.ledger.view.status).toBe('ready');
    h.begin('pauseBeforeFirst');
    await settle(() => h.engine.ledger.view.status === 'paused');
    expect(h.engine.ledger.operations).toBe(0);
    h.engine.control({ kind: 'step', requestId: sampleId(9011) });
    await settle(() => h.engine.ledger.view.status === 'paused');
    expect(h.engine.ledger.operations).toBe(1);
    h.engine.control({ kind: 'step', requestId: sampleId(9012) });
    await settle(() => h.engine.ledger.view.status === 'completed');
    expect(h.engine.ledger.operations).toBe(2);
  });
  it('pauses at a resolved boundary and resumes without changing the static schedule', async () => {
    const h = harness(simpleGraph(), {
      onMessage: (message, engine) => {
        if (message.kind === 'node-start' && message.nodeId === sampleId(2))
          engine.control({ kind: 'pause', requestId: sampleId(9012) });
      },
    });
    h.begin();
    await settle(() => h.engine.ledger.view.status === 'paused');
    expect(h.engine.ledger.operations).toBe(1);
    h.engine.control({ kind: 'resume', requestId: sampleId(9013) });
    await settle(() => h.engine.ledger.view.status === 'completed');
  });
  it('lets completion win over Pause at plan exhaustion and rejects duplicate invalid controls', async () => {
    const h = harness(simpleGraph(), {
      onMessage: (m, e) => {
        if (m.kind === 'node-complete' && m.nodeId === sampleId(3))
          e.control({ kind: 'pause', requestId: sampleId(9014) });
      },
    });
    h.engine.control({ kind: 'resume', requestId: sampleId(9010) });
    expect(h.messages.at(-1)).toMatchObject({ kind: 'control-ack', outcome: 'rejected' });
    h.begin();
    await settle(() => h.engine.ledger.view.status === 'completed');
    h.engine.control({ kind: 'cancel', requestId: sampleId(9015) });
    expect(h.engine.ledger.view.status).toBe('completed');
    expect(allowedTransition('paused', 'completed')).toBe(false);
    expect(allowedTransition('running', 'ready')).toBe(false);
    expect(allowedTransition('idle', 'running')).toBe(false);
  });
  it('cancels unresolved async handlers, preserves completed data, and accepts no late promise result', async () => {
    let resolve: ((value: ReturnType<typeof failure>) => void) | undefined;
    const h = harness(simpleGraph(), {
      handler: () =>
        new Promise((done) => {
          resolve = done;
        }),
    });
    h.begin();
    await settle(() => h.engine.ledger.operations === 1);
    h.engine.control({ kind: 'cancel', requestId: sampleId(9013) });
    expect(h.engine.ledger.view.result).toMatchObject({
      status: 'cancelled',
      partial: true,
      counts: { cancelled: 2 },
    });
    const length = h.messages.length;
    resolve?.(failure('NODE_FAILED', 'execution'));
    await Promise.resolve();
    expect(h.messages).toHaveLength(length);
  });
  it('enforces per-operation duration at cap+1 with a fake monotonic clock', async () => {
    let now = 0;
    const h = harness(simpleGraph(), {
      now: () => now,
      handler: () => {
        now = LIMITS.MAX_OPERATION_MS + 1;
        return { ok: true, value: { emitted: { out: {} } } };
      },
    });
    h.begin();
    await settle(() => h.engine.ledger.view.result !== null);
    expect(h.engine.ledger.view.result).toMatchObject({
      status: 'failed',
      error: { code: 'OPERATION_TIMEOUT' },
    });
  });
  it('enforces cumulative produced bytes even when Conditions forward a shared retained payload', async () => {
    const payload = {
      a: 'x'.repeat(65500),
      b: 'x'.repeat(65500),
      c: 'x'.repeat(65500),
      d: 'x'.repeat(65500),
    };
    const nodes: WorkflowNode[] = [
      { ...node('manualTrigger', 2), type: 'manualTrigger', config: { payload } },
    ];
    for (let i = 3; i < 74; i++)
      nodes.push({
        ...node('condition', i),
        type: 'condition',
        config: { path: ['a'], operator: 'exists' },
      });
    nodes.push(node('output', 74));
    const graph = {
      ...emptyDocument(),
      nodes,
      edges: nodes
        .slice(1)
        .map((n, i) => link(nodes[i]!.id, n.id, 1000 + i, i === 0 ? 'out' : 'true')),
    };
    const h = await execute(graph);
    expect(h.engine.ledger.view.result).toMatchObject({
      status: 'failed',
      error: { code: 'RESOURCE_LIMIT', context: { limitName: 'MAX_RUN_PAYLOAD_BYTES' } },
    });
    expect(h.engine.ledger.retainedBytes).toBeLessThan(LIMITS.MAX_PAYLOAD_BYTES);
    expect(h.engine.ledger.view.payloads.size).toBe(1);
  });
  it('rejects transformed output beyond the payload cap before activation', async () => {
    const graph = simpleGraph({ a: 'x'.repeat(65500), b: 'x'.repeat(65500), c: 'x'.repeat(65500) });
    const transform: WorkflowNode = {
      ...node('setField', 4),
      type: 'setField',
      config: { path: ['d'], value: ['x'.repeat(65500), 'extra'.repeat(100)] },
    };
    const h = await execute({
      ...graph,
      nodes: [graph.nodes[0]!, transform, graph.nodes[1]!],
      edges: [link(sampleId(2), sampleId(4), 1000), link(sampleId(4), sampleId(3), 1001)],
    });
    expect(h.engine.ledger.view.result).toMatchObject({
      status: 'failed',
      error: { code: 'RESOURCE_LIMIT' },
    });
    expect(h.engine.ledger.view.outputs).toEqual([]);
  });
  it('bounds diagnostic retention without discarding node records or outputs', () => {
    const compiled = compile(simpleGraph());
    if (!compiled.ok) throw new Error('fixture');
    const ledger = new RunLedger(identity, compiled.value);
    for (let i = 1; i <= LIMITS.MAX_DIAGNOSTIC_EVENTS + 1; i++)
      expect(
        ledger.accept(
          {
            ...identity,
            sequence: i,
            kind: 'control-ack',
            requestId: sampleId(9010),
            outcome: 'no-op',
          },
          i,
        ).ok,
      ).toBe(true);
    expect(ledger.view.events).toHaveLength(LIMITS.MAX_DIAGNOSTIC_EVENTS);
    expect(ledger.view.eventsEvicted).toBe(1);
    expect(ledger.view.records.size).toBe(2);
  });
});
