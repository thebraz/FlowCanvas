import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { makeStore } from '../fixtures/store';
import { sampleId, createSample } from '../../src/application/sample';
import { editable, appendHistory, emptyHistory } from '../../src/domain/graph/history';
import { validateStructure } from '../../src/domain/graph/invariants';
import { canonicalDocument } from '../../src/domain/json/canonical';
import { copyDocument } from '../../src/application/documents';
import { decodeDocument, validateDocument } from '../../src/validation/codec';
import { decodeSubgraph } from '../../src/validation/subgraph';
import { LIMITS } from '../../src/contracts/limits';
import { extractSubgraph } from '../../src/domain/graph/subgraph';
describe('Stage 2 editor transactions', () => {
  it('given all new commands, then bulk transactions reverse with stable IDs and preserve settled viewport', () => {
    const store = makeStore(),
      s = store.getState(),
      session = s.session.sessionId,
      initial = editable(s.session.document);
    for (const intent of [
      { type: 'RenameWorkflow', title: 'Edited', description: 'Synthetic' },
      { type: 'ChangePresentation', nodeId: sampleId(8), presentation: { accent: 'amber' } },
      { type: 'DuplicateNode', nodeId: sampleId(8) },
      { type: 'DuplicateSelection', nodeIds: [sampleId(2), sampleId(3)] },
      { type: 'AlignNodes', nodeIds: [sampleId(2), sampleId(8)], mode: 'bottom' },
      { type: 'BulkDelete', nodeIds: [sampleId(3)], edgeIds: [sampleId(23)] },
    ]) {
      expect(s.dispatch(session, intent).ok).toBe(true);
      expect(validateStructure(store.getState().session.document).total).toBe(0);
    }
    s.setSelection([sampleId(2), sampleId(8)]);
    const copied = s.copySelection();
    expect(copied.ok).toBe(true);
    if (!copied.ok) throw new Error('Copy failed');
    expect(s.paste(copied.value, { x: 100, y: 100 }).ok).toBe(true);
    expect(s.dispatch(session, { type: 'ClearWorkflow' }).ok).toBe(true);
    expect(store.getState().session.document.nodes).toHaveLength(0);
    expect(
      s.dispatch(session, { type: 'SetViewport', viewport: { x: 77, y: 88, zoom: 1.5 } }).ok,
    ).toBe(true);
    const final = editable(store.getState().session.document),
      count = store.getState().history.undo.length;
    for (let i = 0; i < count; i++) {
      expect(s.undo(session).ok).toBe(true);
      expect(validateStructure(store.getState().session.document).total).toBe(0);
    }
    expect(editable(store.getState().session.document)).toEqual(initial);
    expect(store.getState().session.document.viewport).toEqual({ x: 77, y: 88, zoom: 1.5 });
    for (let i = 0; i < count; i++) expect(s.redo(session).ok).toBe(true);
    expect(editable(store.getState().session.document)).toEqual(final);
  });
  it('given failed/no-op operations after undo, then redo and all slices remain intact', () => {
    const store = makeStore(),
      s = store.getState(),
      session = s.session.sessionId;
    s.dispatch(session, { type: 'RenameNode', nodeId: sampleId(8), label: 'Changed' });
    s.undo(session);
    for (const intent of [
      { type: 'BulkDelete', nodeIds: [sampleId(8), sampleId(999)], edgeIds: [] },
      { type: 'AlignNodes', nodeIds: [sampleId(2), sampleId(2)], mode: 'left' },
      { type: 'DuplicateSelection', nodeIds: [sampleId(999)] },
      {
        type: 'RenameNode',
        nodeId: sampleId(8),
        label: store.getState().indexes.nodeById.get(sampleId(8))?.label,
      },
    ]) {
      const before = store.getState();
      const r = s.dispatch(session, intent);
      expect(!r.ok || !r.value.changed).toBe(true);
      expect(store.getState()).toBe(before);
    }
    s.dispatch(session, { type: 'RenameNode', nodeId: sampleId(8), label: 'New edit' });
    expect(store.getState().history.redo).toHaveLength(0);
  });
  it('given inspector transaction or drag cancellation, then there are no partial edits or overlay history', () => {
    const store = makeStore(),
      s = store.getState(),
      session = s.session.sessionId,
      before = store.getState();
    expect(
      s.transaction(session, [
        { type: 'RenameNode', nodeId: sampleId(3), label: 'Valid' },
        { type: 'ChangeNodeConfig', nodeId: sampleId(3), config: { name: 'Wrong' } },
      ]).ok,
    ).toBe(false);
    expect(store.getState()).toBe(before);
    s.overlayDrag(
      new Map([
        [sampleId(2), { x: 20, y: 20 }],
        [sampleId(3), { x: 40, y: 40 }],
      ]),
    );
    expect(store.getState().history.undo).toHaveLength(0);
    s.overlayDrag(new Map());
    expect(store.getState().session).toBe(before.session);
    s.overlayDrag(
      new Map([
        [sampleId(2), { x: 20, y: 20 }],
        [sampleId(3), { x: 40, y: 40 }],
      ]),
    );
    s.commitDrag(session);
    expect(store.getState().history.undo).toHaveLength(1);
    s.undo(session);
    expect(editable(store.getState().session.document)).toEqual(editable(before.session.document));
  });
  it('given import/copy, then IDs are fresh, relative ordering and canonical semantics are preserved', () => {
    const source = createSample();
    let next = 1000;
    const copy = copyDocument(
      source,
      () => sampleId(next++),
      () => source.metadata.updatedAt,
    );
    expect(copy.ok).toBe(true);
    if (!copy.ok) throw new Error('Copy failed');
    const original = [...source.nodes].sort((a, b) => a.id.localeCompare(b.id)),
      mapped = [...copy.value.nodes].sort((a, b) => a.id.localeCompare(b.id));
    expect(mapped.map((n) => n.label)).toEqual(original.map((n) => n.label));
    expect(mapped.every((n) => !source.nodes.some((old) => old.id === n.id))).toBe(true);
    expect(decodeDocument(canonicalDocument(copy.value))).toMatchObject({
      ok: true,
      value: copy.value,
    });
    const store = makeStore(),
      s = store.getState();
    s.setSelection([sampleId(2), sampleId(3)]);
    const fragment = s.copySelection();
    if (!fragment.ok) throw new Error('Copy failed');
    const decoded = decodeSubgraph(fragment.value);
    expect(decoded.ok && decoded.value.nodes.length).toBe(2);
    expect(decoded.ok && decoded.value.edges.length).toBe(1);
    const pasted = s.paste(fragment.value, { x: 0, y: 0 });
    expect(pasted.ok).toBe(true);
    const ids = [...store.getState().selection];
    s.undo(s.session.sessionId);
    s.redo(s.session.sessionId);
    expect(ids.every((id) => store.getState().indexes.nodeById.has(id))).toBe(true);
    expect(
      copyDocument(
        source,
        () => source.id,
        () => source.metadata.updatedAt,
      ).ok,
    ).toBe(false);
  });
  it('given hostile fragments, then rejection leaves graph, history and revisions unchanged', () => {
    const store = makeStore();
    for (const text of [
      '{}',
      '{"__proto__":{}}',
      '{"x":1,"x":2}',
      'x'.repeat(LIMITS.MAX_CLIPBOARD_BYTES + 1),
      JSON.stringify({ format: 'flowcanvas-subgraph', version: 2, nodes: [], edges: [] }),
    ]) {
      const before = store.getState();
      expect(before.paste(text, { x: 0, y: 0 }).ok).toBe(false);
      expect(store.getState()).toBe(before);
    }
  });
  it('given document switch and stale save acknowledgements, then history and save state stay session-scoped', () => {
    const store = makeStore(),
      s = store.getState(),
      old = s.session.sessionId;
    s.dispatch(old, { type: 'RenameWorkflow', title: 'Edited', description: '' });
    s.acknowledgeSave(old, 0, 1);
    expect(store.getState().save.status).toBe('dirty');
    const current = store.getState().session.document;
    s.openDocument(current, sampleId(700), 1);
    expect(store.getState().history.undo).toHaveLength(0);
    s.acknowledgeSave(old, 1, 99);
    expect(store.getState().session.baseStorageRevision).toBe(1);
    expect(s.undo(old).ok).toBe(false);
  });
  it('given bounded history, then oldest whole transactions are evicted, including a single oversized edit', () => {
    const base = editable(createSample());
    let history = emptyHistory;
    for (let i = 0; i < 105; i++)
      history = appendHistory(history, {
        before: { ...base, title: String(i) },
        after: { ...base, title: String(i + 1) },
        semantic: false,
        topology: false,
      });
    expect(history.undo).toHaveLength(100);
    expect(history.undo[0]?.before.title).toBe('5');
    const huge = { ...base, description: 'x'.repeat(LIMITS.MAX_HISTORY_BYTES) };
    history = appendHistory(history, {
      before: base,
      after: huge,
      semantic: false,
      topology: false,
    });
    expect(history.undo).toHaveLength(0);
    expect(history.truncated).toBe(true);
  });
  it('given 100 seeded mixed sequences of 100 edits, then every retained undo/redo restores exact content', () => {
    fc.assert(
      fc.property(fc.array(fc.nat(999), { minLength: 100, maxLength: 100 }), (operations) => {
        const store = makeStore(),
          s = store.getState(),
          session = s.session.sessionId,
          initial = editable(s.session.document);
        for (const value of operations) {
          const before = store.getState(),
            nodes = before.session.document.nodes;
          const node = nodes[value % Math.max(1, nodes.length)];
          if (value % 10 === 8 && node) {
            s.setSelection([node.id]);
            const copied = s.copySelection();
            if (!copied.ok) throw new Error('Generated copy failed');
            const beforePaste = store.getState();
            const pasted = s.paste(copied.value, { x: value, y: value % 50 });
            if (!pasted.ok || !pasted.value.changed) expect(store.getState()).toBe(beforePaste);
            expect(validateDocument(store.getState().session.document).ok).toBe(true);
            continue;
          }
          const fragment = extractSubgraph(
            before.session.document,
            nodes.slice(0, 2).map((n) => n.id),
          );
          const intent =
            value % 10 === 0
              ? { type: 'CreateNode', nodeType: 'note', position: { x: value, y: 0 } }
              : value % 10 === 1
                ? { type: 'DuplicateNode', nodeId: node?.id ?? sampleId(999) }
                : value % 10 === 2
                  ? { type: 'BulkDelete', nodeIds: node ? [node.id] : [], edgeIds: [] }
                  : value % 10 === 3
                    ? {
                        type: 'MoveNodes',
                        moves: [
                          {
                            nodeId: node?.id ?? sampleId(999),
                            position: { x: value, y: value % 40 },
                          },
                        ],
                      }
                    : value % 10 === 4
                      ? {
                          type: 'ChangeNodeConfig',
                          nodeId: node?.id ?? sampleId(999),
                          config: { text: `Note ${value}` },
                        }
                      : value % 10 === 5
                        ? { type: 'RenameWorkflow', title: `Workflow ${value}`, description: '' }
                        : value % 10 === 6
                          ? {
                              type: 'DeleteEdge',
                              edgeId: before.session.document.edges[0]?.id ?? sampleId(999),
                            }
                          : value % 10 === 9 && fragment.ok
                            ? {
                                type: 'AlignNodes',
                                nodeIds: fragment.value.nodes.map((n) => n.id),
                                mode: 'left',
                              }
                            : {
                                type: 'ReconnectEdge',
                                edgeId: sampleId(20),
                                source: { nodeId: sampleId(2), port: 'out' },
                                target: { nodeId: sampleId(3), port: 'in' },
                              };
          const result = s.dispatch(session, intent);
          if (!result.ok || !result.value.changed) expect(store.getState()).toBe(before);
          expect(validateDocument(store.getState().session.document).ok).toBe(true);
        }
        const final = editable(store.getState().session.document),
          count = store.getState().history.undo.length;
        for (let i = 0; i < count; i++) {
          expect(s.undo(session).ok).toBe(true);
          expect(validateStructure(store.getState().session.document).total).toBe(0);
        }
        expect(editable(store.getState().session.document)).toEqual(initial);
        for (let i = 0; i < count; i++) {
          expect(s.redo(session).ok).toBe(true);
          expect(validateStructure(store.getState().session.document).total).toBe(0);
        }
        expect(editable(store.getState().session.document)).toEqual(final);
      }),
      { seed: 42615, numRuns: 100 },
    );
  }, 240_000);
});
