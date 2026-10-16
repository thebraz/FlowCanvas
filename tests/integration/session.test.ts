import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createSample, sampleId } from '../../src/application/sample';
import { validateDocument, validateDocumentShape } from '../../src/validation/codec';
import { createProjection } from '../../src/adapters/react-flow/projection';
import { validateStructure } from '../../src/domain/graph/invariants';
import { canonicalDocument } from '../../src/domain/json/canonical';
import { reduceCommand, defaultNode } from '../../src/domain/graph/commands';

import { makeStore } from '../fixtures/store';
import { createAppStore } from '../../src/state/store';
import { graphWith } from '../fixtures/graphs';
describe('atomic commands and single authority', () => {
  it('given an invalid initial graph, then the session cannot open it', () => {
    expect(() =>
      createAppStore({ ...graphWith(1), id: sampleId(2) }, sampleId(80), {
        id: () => sampleId(100),
        now: () => '2026-10-15T13:00:00.000Z',
        validate: validateDocument,
        validateShape: validateDocumentShape,
      }),
    ).toThrow('Invalid initial canonical document');
  });
  it('given create/delete/reconnect primitives, then stable identities and cleanup are committed atomically', () => {
    const store = makeStore();
    const state = store.getState();
    const session = state.session.sessionId;
    expect(
      state.dispatch(session, { type: 'CreateNode', nodeType: 'output', position: { x: 0, y: 0 } })
        .ok,
    ).toBe(true);
    expect(
      state.dispatch(session, {
        type: 'CreateEdge',
        source: { nodeId: sampleId(2), port: 'out' },
        target: { nodeId: sampleId(100), port: 'in' },
      }).ok,
    ).toBe(true);
    const created = store
      .getState()
      .session.document.edges.find((edge) => edge.target.nodeId === sampleId(100));
    expect(created?.id).toBe(sampleId(101));
    expect(state.dispatch(session, { type: 'DeleteEdge', edgeId: sampleId(101) }).ok).toBe(true);
    expect(
      state.dispatch(session, {
        type: 'ReconnectEdge',
        edgeId: sampleId(23),
        source: { nodeId: sampleId(5), port: 'false' },
        target: { nodeId: sampleId(100), port: 'in' },
      }).ok,
    ).toBe(true);
    expect(
      store.getState().session.document.edges.find((edge) => edge.id === sampleId(23))?.target
        .nodeId,
    ).toBe(sampleId(100));
    expect(state.dispatch(session, { type: 'DeleteNode', nodeId: sampleId(100) }).ok).toBe(true);
    expect(store.getState().session.document.edges.some((edge) => edge.id === sampleId(23))).toBe(
      false,
    );
    const before = store.getState();
    expect(
      state.dispatch(session, {
        type: 'MoveNodes',
        moves: [
          { nodeId: sampleId(2), position: { x: 1, y: 1 } },
          { nodeId: sampleId(2), position: { x: 2, y: 2 } },
        ],
      }).ok,
    ).toBe(false);
    expect(store.getState()).toBe(before);
  });
  it('given stale intents and invalid configs, then every store slice remains unchanged', () => {
    const store = makeStore();
    const before = store.getState();
    const wrongConfig = before.dispatch(before.session.sessionId, {
      type: 'ChangeNodeConfig',
      nodeId: sampleId(3),
      config: { name: 'Wrong type' },
    });
    expect(wrongConfig.ok ? '' : wrongConfig.error.code).toBe('CONFIG_INVALID');
    expect(wrongConfig.ok ? '' : wrongConfig.error.category).toBe('config');
    expect(store.getState()).toBe(before);
    for (const [session, command] of [
      [sampleId(81), { type: 'DeleteNode', nodeId: sampleId(2) }],
      [
        sampleId(80),
        { type: 'ChangeNodeConfig', nodeId: sampleId(3), config: { name: 'Wrong type' } },
      ],
      [
        sampleId(80),
        {
          type: 'MoveNodes',
          moves: [
            { nodeId: sampleId(2), position: { x: 5, y: 0 } },
            { nodeId: sampleId(999), position: { x: 0, y: 0 } },
          ],
        },
      ],
      [
        sampleId(80),
        {
          type: 'CreateEdge',
          source: { nodeId: sampleId(4), port: 'out' },
          target: { nodeId: sampleId(3), port: 'in' },
        },
      ],
      [sampleId(80), { type: 'Unknown' }],
    ] as const) {
      const result = store.getState().dispatch(session, command);
      expect(result.ok).toBe(false);
      expect(store.getState()).toBe(before);
    }
  });
  it('given presentation/semantic/topology/viewport operations, then explicit revisions and caches reflect their owners', () => {
    const store = makeStore();
    const state = store.getState();
    const session = state.session.sessionId;
    const beforeNode = state.session.document.nodes[0];
    const outgoing = state.indexes.outgoing;
    expect(
      state.dispatch(session, { type: 'RenameNode', nodeId: sampleId(3), label: 'Reviewed' }).ok,
    ).toBe(true);
    expect(store.getState().session).toMatchObject({
      documentRevision: 1,
      semanticRevision: 0,
      topologyRevision: 0,
    });
    expect(store.getState().session.document.nodes[0]).toBe(beforeNode);
    expect(store.getState().indexes.outgoing).toBe(outgoing);
    expect(store.getState().indexes.nodeById.get(sampleId(3))?.label).toBe('Reviewed');
    expect(
      state.dispatch(session, {
        type: 'ChangeNodeConfig',
        nodeId: sampleId(3),
        config: { path: ['reviewed'], value: false },
      }).ok,
    ).toBe(true);
    expect(store.getState().session).toMatchObject({
      documentRevision: 2,
      semanticRevision: 1,
      topologyRevision: 0,
    });
    const settled = state.dispatch(session, {
      type: 'SetViewport',
      viewport: { x: 1, y: 2, zoom: 1 },
    });
    expect(settled.ok && settled.value.history).toBe(false);
    state.select(sampleId(2));
    state.overlayViewport({ x: 99, y: 99, zoom: 1 });
    expect(store.getState().session.document.viewport).toEqual({ x: 1, y: 2, zoom: 1 });
    expect(state.dispatch(session, { type: 'DeleteNode', nodeId: sampleId(2) }).ok).toBe(true);
    expect(store.getState().selection.size).toBe(0);
    expect(store.getState().session).toMatchObject({
      documentRevision: 4,
      semanticRevision: 2,
      topologyRevision: 1,
    });
    expect(
      store.getState().session.document.edges.some((edge) => edge.source.nodeId === sampleId(2)),
    ).toBe(false);
  });
  it('given repeated Apply, then no-op preserves all identities and timestamps', () => {
    const store = makeStore();
    const before = store.getState();
    const result = before.dispatch(before.session.sessionId, {
      type: 'ChangeNodeConfig',
      nodeId: sampleId(3),
      config: { path: ['reviewed'], value: true },
    });
    expect(result.ok && result.value.changed).toBe(false);
    expect(store.getState()).toBe(before);
  });
  it('given failed ID/clock providers and invalid allocations, then candidates never publish', () => {
    const document = createSample();
    for (const id of [
      () => {
        throw new Error('Injected provider fault');
      },
      () => sampleId(2),
    ]) {
      const result = reduceCommand(
        document,
        { type: 'CreateNode', nodeType: 'note', position: { x: 0, y: 0 } },
        { id, now: () => '', validate: validateDocument, validateShape: validateDocumentShape },
      );
      expect(result.ok).toBe(false);
      expect(document).toEqual(createSample());
    }
    for (const type of [
      'manualTrigger',
      'setField',
      'pickFields',
      'condition',
      'output',
      'note',
    ] as const)
      expect(
        validateDocument({
          ...document,
          nodes: [...document.nodes, defaultNode(type, sampleId(99), { x: 0, y: 0 })],
        }).ok,
      ).toBe(true);
  });
  it('given reconnect failure, then the original edge and canonical bytes survive', () => {
    const store = makeStore();
    const before = store.getState();
    const encoded = canonicalDocument(before.session.document);
    expect(
      before.dispatch(before.session.sessionId, {
        type: 'ReconnectEdge',
        edgeId: sampleId(20),
        source: { nodeId: sampleId(4), port: 'out' },
        target: { nodeId: sampleId(3), port: 'in' },
      }).ok,
    ).toBe(false);
    expect(store.getState()).toBe(before);
    expect(canonicalDocument(store.getState().session.document)).toBe(encoded);
    expect(
      before.dispatch(before.session.sessionId, {
        type: 'ReconnectEdge',
        edgeId: sampleId(20),
        source: { nodeId: sampleId(2), port: 'out' },
        target: { nodeId: sampleId(3), port: 'in' },
      }),
    ).toMatchObject({ ok: true, value: { changed: false } });
  });
  it('given projection and unrelated UI changes, then views reuse unchanged entities without becoming graph authority', () => {
    const store = makeStore();
    const project = createProjection();
    const before = store.getState();
    const first = project(before.session.document, before.selection);
    before.setTheme('light');
    before.toggleGrid();
    const second = project(store.getState().session.document, store.getState().selection);
    expect(second.nodes[0]).toBe(first.nodes[0]);
    expect(second.edges[0]).toBe(first.edges[0]);
    before.select(sampleId(3));
    const third = project(store.getState().session.document, store.getState().selection);
    expect(third.nodes[0]).toBe(first.nodes[0]);
    expect(third.nodes[1]).not.toBe(first.nodes[1]);
    expect(store.getState().session).toBe(before.session);
    expect(JSON.stringify(before.session.document)).not.toContain('selected');
  });
  it('given 100 seeded sequences of 100 commands, then success preserves invariants and failure preserves state', () => {
    fc.assert(
      fc.property(fc.array(fc.nat(999), { minLength: 100, maxLength: 100 }), (operations) => {
        const store = makeStore();
        for (const operation of operations) {
          const before = store.getState();
          const nodeId = sampleId(2 + (operation % 7));
          const intent =
            operation % 5 === 0
              ? { type: 'DeleteNode', nodeId: sampleId(999) }
              : operation % 5 === 1
                ? {
                    type: 'MoveNodes',
                    moves: [{ nodeId, position: { x: operation, y: operation % 100 } }],
                  }
                : operation % 5 === 2
                  ? { type: 'RenameNode', nodeId, label: `Synthetic ${operation}` }
                  : operation % 5 === 3
                    ? { type: 'SetViewport', viewport: { x: operation, y: 0, zoom: 1 } }
                    : {
                        type: 'ChangeNodeConfig',
                        nodeId: sampleId(3),
                        config: { path: ['reviewed'], value: operation % 2 === 0 },
                      };
          const result = before.dispatch(before.session.sessionId, intent);
          if (!result.ok || !result.value.changed) expect(store.getState()).toBe(before);
          expect(validateStructure(store.getState().session.document).total).toBe(0);
          expect(validateDocument(store.getState().session.document).ok).toBe(true);
        }
      }),
      { seed: 42615, numRuns: 100 },
    );
  }, 120_000);
});
