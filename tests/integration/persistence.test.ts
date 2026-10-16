import 'fake-indexeddb/auto';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import {
  openStorage,
  makeEnvelope,
  WorkflowStorage,
} from '../../src/adapters/persistence/indexeddb';
import { PersistenceCoordinator } from '../../src/application/persistence';
import { makeStore } from '../fixtures/store';
import { createSample, sampleId } from '../../src/application/sample';
import { failure } from '../../src/contracts/errors';
import { LIMITS } from '../../src/contracts/limits';
const connections: WorkflowStorage[] = [],
  coordinators: PersistenceCoordinator[] = [];
async function storage() {
  const opened = await openStorage(() => {});
  if (!opened.ok) throw new Error('Test storage failed');
  connections.push(opened.value);
  return opened.value;
}
async function putRaw(storeName: string, key: string, value: unknown) {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('flowcanvas', 1);
    request.onsuccess = () => {
      const db = request.result,
        tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(value, key);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onabort = () => reject(new Error('Fixture failed'));
    };
  });
}
async function coordinator() {
  const store = makeStore();
  let id = 5000;
  const value = new PersistenceCoordinator(
    store,
    () => sampleId(id++),
    () => createSample().metadata.updatedAt,
  );
  coordinators.push(value);
  await value.start();
  return value;
}
beforeEach(async () => {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('flowcanvas');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Fixture reset failed'));
  });
  vi.stubGlobal('localStorage', { getItem: () => null, removeItem: () => {}, setItem: () => {} });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  for (const c of coordinators.splice(0)) c.dispose();
  for (const c of connections.splice(0)) c.close();
});
describe('native adapter with synthetic IndexedDB fault injection', () => {
  it('given a valid envelope under the wrong workflow key, then autosave preserves the corrupt record and verified backup', async () => {
    const db = await storage(),
      doc = createSample();
    expect((await db.save(doc, null)).ok).toBe(true);
    expect((await db.save({ ...doc, metadata: { ...doc.metadata, title: 'Second' } }, 1)).ok).toBe(
      true,
    );
    const backup = await db.load(doc.id, true);
    const misplaced = await makeEnvelope({ ...doc, id: sampleId(999) }, 2);
    if (!misplaced.ok) throw new Error('Synthetic envelope failed');
    await putRaw('documents', doc.id, misplaced.value);
    expect(await db.load(doc.id)).toMatchObject({ ok: false, error: { code: 'STORAGE_CORRUPT' } });
    expect(
      await db.save({ ...doc, metadata: { ...doc.metadata, title: 'Unsaved' } }, 2),
    ).toMatchObject({ ok: false, error: { code: 'STORAGE_CORRUPT' } });
    expect(await db.raw(doc.id)).toEqual({ ok: true, value: misplaced.value });
    expect(await db.load(doc.id, true)).toEqual(backup);
  });
  it('given a closed storage connection, then every public read/write fails safely without leaking native errors', async () => {
    const db = await storage(),
      doc = createSample();
    await db.save(doc, null);
    db.close();
    for (const result of await Promise.all([
      db.raw(doc.id),
      db.load(doc.id),
      db.list(),
      db.setting('preferences'),
      db.putSetting('lastOpenedWorkflowId', doc.id),
      db.save(doc, null),
      db.save(doc, 1),
      db.remove(doc.id, 1),
    ])) {
      expect(result).toMatchObject({ ok: false, error: { code: 'SAVE_FAILED' } });
      expect(JSON.stringify(result)).not.toContain('InvalidStateError');
    }
  });
  it('given concurrent same-base writes, then one wins and the verified old envelope becomes the only backup', async () => {
    const db = await storage(),
      doc = createSample();
    expect((await db.save(doc, null)).ok).toBe(true);
    const writes = await Promise.all(
      ['A', 'B'].map((title) => db.save({ ...doc, metadata: { ...doc.metadata, title } }, 1)),
    );
    expect(writes.filter((r) => r.ok)).toHaveLength(1);
    expect(writes.filter((r) => !r.ok && r.error.code === 'PERSISTENCE_CONFLICT')).toHaveLength(1);
    expect(await db.load(doc.id, true)).toMatchObject({
      ok: true,
      value: { storageRevision: 1, document: doc },
    });
    expect(await db.load(doc.id)).toMatchObject({ ok: true, value: { storageRevision: 2 } });
  });
  it('given quota in a put callback, then the entire document/backup transaction aborts with the correct error', async () => {
    const db = await storage(),
      doc = createSample();
    await db.save(doc, null);
    const prior = await db.load(doc.id);
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore) {
      throw new DOMException('Synthetic quota', 'QuotaExceededError');
    });
    const result = await db.save({ ...doc, metadata: { ...doc.metadata, title: 'Unsaved' } }, 1);
    expect(result).toMatchObject({ ok: false, error: { code: 'STORAGE_QUOTA' } });
    vi.restoreAllMocks();
    expect(await db.load(doc.id)).toEqual(prior);
    expect((await db.load(doc.id, true)).ok).toBe(false);
  });
  it('given a deleted record or stale delete revision, then neither updates nor deletion silently replace newer data', async () => {
    const db = await storage(),
      doc = createSample();
    await db.save(doc, null);
    expect((await db.remove(doc.id, 2)).ok).toBe(false);
    expect((await db.remove(doc.id, 1)).ok).toBe(true);
    expect(await db.save(doc, 1)).toMatchObject({
      ok: false,
      error: { code: 'PERSISTENCE_CONFLICT' },
    });
    expect((await db.load(doc.id)).ok).toBe(false);
  });
  it('given corruption, then loading and saving fail without replacing the backup, while metadata listing stays bounded', async () => {
    const db = await storage(),
      doc = createSample();
    await db.save(doc, null);
    await db.save({ ...doc, metadata: { ...doc.metadata, title: 'Second' } }, 1);
    const backup = await db.load(doc.id, true),
      raw = await db.raw(doc.id);
    if (!raw.ok) throw new Error('Fixture read failed');
    await putRaw('documents', doc.id, {
      envelopeVersion: 1,
      storageRevision: 2,
      canonicalBytes: 1,
      sha256: '0'.repeat(64),
      document: doc,
    });
    expect((await db.load(doc.id)).ok).toBe(false);
    expect((await db.save(doc, 2)).ok).toBe(false);
    expect(await db.load(doc.id, true)).toEqual(backup);
    expect(await db.list()).toMatchObject({ ok: true, value: [{ title: doc.metadata.title }] });
    await putRaw('documents', doc.id, { broken: true });
    expect(await db.list()).toMatchObject({
      ok: true,
      value: [{ error: { code: 'STORAGE_CORRUPT' } }],
    });
  });
  it('given reordered envelope keys, then canonical identity rather than property insertion order controls CAS', async () => {
    const db = await storage(),
      doc = createSample(),
      created = await db.save(doc, null);
    if (!created.ok) throw new Error('Fixture failed');
    const e = created.value;
    await putRaw('documents', doc.id, {
      document: e.document,
      sha256: e.sha256,
      canonicalBytes: e.canonicalBytes,
      storageRevision: e.storageRevision,
      envelopeVersion: 1,
    });
    expect(
      (await db.save({ ...doc, metadata: { ...doc.metadata, title: 'Accepted' } }, 1)).ok,
    ).toBe(true);
  });
  it('given strict settings and last-opened deletion, then invalid preferences fail and atomic deletion clears the matching setting', async () => {
    const db = await storage(),
      doc = createSample();
    expect((await db.setting('preferences')).ok).toBe(true);
    expect((await db.putSetting('preferences', { theme: 'other' })).ok).toBe(false);
    await db.putSetting('preferences', {
      theme: 'light',
      grid: false,
      minimap: true,
      leftWidth: 240,
      rightWidth: 320,
    });
    expect(await db.setting('preferences')).toMatchObject({
      ok: true,
      value: { executionHeight: 280, executionExpanded: false },
    });
    expect(
      (
        await db.putSetting('preferences', {
          theme: 'light',
          grid: false,
          minimap: true,
          leftWidth: 240,
          rightWidth: 320,
          executionHeight: 179,
          executionExpanded: false,
        })
      ).ok,
    ).toBe(false);
    await db.save(doc, null);
    await db.putSetting('lastOpenedWorkflowId', doc.id);
    await db.remove(doc.id, 1);
    expect(await db.setting('lastOpenedWorkflowId')).toEqual({ ok: true, value: null });
    await putRaw('settings', 'preferences', { invalid: true });
    expect((await db.setting('preferences')).ok).toBe(false);
    db.close();
    expect((await db.raw(doc.id)).ok).toBe(false);
  });
  it('given 100 records, then a creation transaction refuses record 101 and preserves the library', async () => {
    const db = await storage();
    for (let i = 0; i < LIMITS.MAX_STORED_DOCUMENTS; i++)
      await putRaw('documents', sampleId(10000 + i), { invalid: true });
    expect(await db.save(createSample(), null)).toMatchObject({
      ok: false,
      error: { code: 'RESOURCE_LIMIT', context: { limitName: 'MAX_STORED_DOCUMENTS' } },
    });
    const list = await db.list();
    expect(list.ok && list.value.length).toBe(100);
  });
  it('given invalid serialization or impossible storage revision, then no envelope is produced', async () => {
    expect((await makeEnvelope({}, 1)).ok).toBe(false);
    expect((await makeEnvelope(createSample(), Number.MAX_SAFE_INTEGER + 1)).ok).toBe(false);
    const digest = vi
      .spyOn(crypto.subtle, 'digest')
      .mockRejectedValue(new Error('Synthetic crypto failure'));
    expect((await makeEnvelope(createSample(), 1)).ok).toBe(false);
    digest.mockRestore();
  });
});
describe('ordered coordinator', () => {
  it('given another workflow is deleted or deletion fails, then the active dirty workflow still autosaves', async () => {
    const c = await coordinator();
    await c.create('Other workflow');
    const other = c.store.getState().session.document.id;
    await c.create('Active workflow');
    const db = c.storage;
    if (!db) throw new Error('Storage missing');
    for (const deletion of [other, sampleId(99999), c.store.getState().session.document.id]) {
      const s = c.store.getState();
      const title =
        deletion === other ? 'Autosave after other deletion' : 'Autosave after failed deletion';
      expect(
        s.dispatch(s.session.sessionId, { type: 'RenameWorkflow', title, description: '' }).ok,
      ).toBe(true);
      await c.remove(deletion, deletion === s.session.document.id ? 0 : undefined);
      await vi.waitFor(
        async () => {
          expect(await db.load(s.session.document.id)).toMatchObject({
            ok: true,
            value: { document: { metadata: { title } } },
          });
        },
        { timeout: 2000 },
      );
    }
  });
  it('given edits during a Save-as-New wait, then a stale captured copy cannot replace the latest active content', async () => {
    const c = await coordinator(),
      db = c.storage;
    if (!db) throw new Error('Storage missing');
    const original = db.save.bind(db);
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.spyOn(db, 'save').mockImplementation(async (document, expected) => {
      await gate;
      return original(document, expected);
    });
    const saving = c.flush(),
      captured = c.store.getState().session;
    const copying = c.duplicate(captured.document, true);
    const s = c.store.getState();
    expect(
      s.dispatch(s.session.sessionId, {
        type: 'RenameWorkflow',
        title: 'Latest must remain',
        description: '',
      }).ok,
    ).toBe(true);
    release();
    await saving;
    expect(await copying).toMatchObject({ ok: false, error: { code: 'STALE_SESSION' } });
    expect(c.store.getState().session.sessionId).toBe(captured.sessionId);
    expect(c.store.getState().session.document.metadata.title).toBe('Latest must remain');
  });
  it('given corrupt last-opened preferences, then startup retains current content and exposes recovery instead of silently ignoring the failure', async () => {
    const db = await storage();
    await putRaw('settings', 'lastOpenedWorkflowId', 'invalid-uuid');
    const c = await coordinator();
    expect(c.store.getState().modal).toBe('workflows');
    expect(c.store.getState().message).toContain('could not be read');
    expect(c.store.getState().session.document).toEqual(createSample());
    expect((await db.setting('lastOpenedWorkflowId')).ok).toBe(false);
  });
  it('given a corrupt last-opened document, then startup exposes the storage error and preserves its raw record', async () => {
    const db = await storage(),
      doc = createSample();
    await putRaw('documents', doc.id, { broken: true });
    await db.putSetting('lastOpenedWorkflowId', doc.id);
    const c = await coordinator();
    expect(c.store.getState().save).toMatchObject({
      status: 'error',
      error: { code: 'STORAGE_CORRUPT' },
    });
    expect(c.store.getState().modal).toBe('workflows');
    expect(await db.raw(doc.id)).toEqual({ ok: true, value: { broken: true } });
  });
  it('given concurrent storage changes and an old delete intent, then coordinator deletion preserves the newer saved workflow', async () => {
    const c = await coordinator();
    await c.create('Retain me');
    const state = c.store.getState(),
      doc = state.session.document,
      db = c.storage;
    if (!db) throw new Error('Storage missing');
    expect(
      (await db.save({ ...doc, metadata: { ...doc.metadata, title: 'Other tab newest' } }, 1)).ok,
    ).toBe(true);
    expect(await c.remove(doc.id, 1)).toMatchObject({
      ok: false,
      error: { code: 'PERSISTENCE_CONFLICT' },
    });
    expect(await c.remove(doc.id)).toMatchObject({
      ok: false,
      error: { code: 'PERSISTENCE_CONFLICT' },
    });
    expect(c.store.getState().session).toBe(state.session);
    expect(await db.load(doc.id)).toMatchObject({
      ok: true,
      value: { document: { metadata: { title: 'Other tab newest' } } },
    });
  });
  it('given an edit while creation awaits storage, then the stale result never replaces the active edited document', async () => {
    const c = await coordinator(),
      db = c.storage;
    if (!db) throw new Error('Storage missing');
    const original = db.save.bind(db);
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.spyOn(db, 'save').mockImplementation(async (document, expected) => {
      await gate;
      return original(document, expected);
    });
    const newDocument = { ...createSample(), id: sampleId(9000) };
    const pending = c.createCopy(newDocument),
      s = c.store.getState();
    s.dispatch(s.session.sessionId, {
      type: 'RenameWorkflow',
      title: 'Latest active',
      description: '',
    });
    release();
    expect(await pending).toMatchObject({ ok: false, error: { code: 'STALE_SESSION' } });
    expect(c.store.getState().session.document.metadata.title).toBe('Latest active');
    expect((await db.load(newDocument.id)).ok).toBe(true);
    expect((await c.open(sampleId(99999), true)).ok).toBe(false);
    expect(c.store.getState().session.document.metadata.title).toBe('Latest active');
  });
  it('given disposal during an immutable save, then no acknowledgement or subsequent operation publishes into the disposed session', async () => {
    const c = await coordinator(),
      db = c.storage;
    if (!db) throw new Error('Storage missing');
    const original = db.save.bind(db);
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.spyOn(db, 'save').mockImplementation(async (document, expected) => {
      await gate;
      return original(document, expected);
    });
    const pending = c.flush(),
      before = c.store.getState().session;
    c.dispose();
    release();
    expect((await pending).ok).toBe(false);
    expect(await c.flush(true)).toMatchObject({ ok: false, error: { code: 'STALE_SESSION' } });
    expect(await c.remove(before.document.id)).toMatchObject({
      ok: false,
      error: { code: 'STALE_SESSION' },
    });
    expect(c.store.getState().session).toBe(before);
  });
  it('given a load completing after a newer edit, then the stale open cannot replace content or change last-opened settings', async () => {
    const c = await coordinator();
    await c.create('A');
    const a = c.store.getState().session.document.id;
    await c.create('B');
    const db = c.storage;
    if (!db) throw new Error('Storage missing');
    const original = db.load.bind(db);
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.spyOn(db, 'load').mockImplementation(async (id, backup) => {
      await gate;
      return original(id, backup);
    });
    const pending = c.open(a, true),
      s = c.store.getState();
    s.dispatch(s.session.sessionId, { type: 'RenameWorkflow', title: 'B newest', description: '' });
    release();
    expect(await pending).toMatchObject({ ok: false, error: { code: 'STALE_SESSION' } });
    expect(c.store.getState().session.document.metadata.title).toBe('B newest');
    expect(await db.setting('lastOpenedWorkflowId')).toEqual({
      ok: true,
      value: s.session.document.id,
    });
  });
  it('given a failed preferences migration, then the legacy key is retained and the error is visible', async () => {
    const remove = vi.fn();
    vi.stubGlobal('localStorage', { removeItem: remove });
    const spy = vi
      .spyOn(WorkflowStorage.prototype, 'putSetting')
      .mockResolvedValue(failure('SAVE_FAILED', 'persistence'));
    const c = await coordinator();
    expect(remove).not.toHaveBeenCalled();
    expect(c.store.getState().message).toContain('could not be saved');
    spy.mockRestore();
  });
  it('given unavailable storage, then retry reconnects explicitly and saves the retained document', async () => {
    const open = vi.spyOn(indexedDB, 'open').mockImplementation(() => {
      throw new DOMException('Denied', 'SecurityError');
    });
    const c = await coordinator();
    expect(c.store.getState().save.status).toBe('error');
    expect((await c.flush()).ok).toBe(false);
    expect((await c.createCopy(createSample())).ok).toBe(false);
    expect((await c.remove(createSample().id)).ok).toBe(false);
    open.mockRestore();
    expect((await c.flush(true)).ok).toBe(true);
    expect(c.store.getState().session.baseStorageRevision).toBe(1);
  });
  it('given a settings write failure after a verified creation, then the document opens safely with a visible last-opened warning', async () => {
    const c = await coordinator(),
      db = c.storage;
    if (!db) throw new Error('Storage missing');
    vi.spyOn(db, 'putSetting').mockResolvedValue(failure('SAVE_FAILED', 'persistence'));
    expect((await c.create('Stored despite preference error')).ok).toBe(true);
    expect(c.store.getState().session.document.metadata.title).toBe(
      'Stored despite preference error',
    );
    expect(c.store.getState().message).toContain('Last-opened workflow');
  });
  it('given disposal while settings hydration is pending, then no later session or subscription is published', async () => {
    const store = makeStore(),
      c = new PersistenceCoordinator(
        store,
        () => sampleId(7000),
        () => createSample().metadata.updatedAt,
      );
    coordinators.push(c);
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.spyOn(WorkflowStorage.prototype, 'setting').mockImplementation(async () => {
      await gate;
      return { ok: true, value: null };
    });
    const pending = c.start();
    await new Promise((resolve) => setTimeout(resolve, 5));
    const before = store.getState().session;
    c.dispose();
    release();
    await pending;
    expect(store.getState().session).toBe(before);
  });
  it('given an edit while save is pending, then only captured and latest revisions are written in acknowledgement order', async () => {
    const c = await coordinator(),
      db = c.storage;
    if (!db) throw new Error('Storage missing');
    const original = db.save.bind(db),
      calls: (number | null)[] = [];
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.spyOn(db, 'save').mockImplementation(async (doc, expected) => {
      calls.push(expected);
      if (calls.length === 1) await gate;
      return original(doc, expected);
    });
    const s = c.store.getState();
    s.dispatch(s.session.sessionId, { type: 'RenameWorkflow', title: 'Captured', description: '' });
    const pending = c.flush();
    s.dispatch(s.session.sessionId, { type: 'RenameWorkflow', title: 'Latest', description: '' });
    release();
    expect((await pending).ok).toBe(true);
    expect(calls).toEqual([null, 1]);
    expect(await db.load(s.session.document.id)).toMatchObject({
      ok: true,
      value: { storageRevision: 2, document: { metadata: { title: 'Latest' } } },
    });
    expect(c.store.getState().session.savedDocumentRevision).toBe(
      c.store.getState().session.documentRevision,
    );
  });
  it('given save failure, then switching is blocked, newest memory is retained, and retry or memory-only remain explicit', async () => {
    const c = await coordinator(),
      db = c.storage;
    if (!db) throw new Error('Storage missing');
    const mock = vi.spyOn(db, 'save').mockResolvedValue(failure('STORAGE_QUOTA', 'persistence'));
    const s = c.store.getState();
    s.dispatch(s.session.sessionId, { type: 'RenameWorkflow', title: 'Retained', description: '' });
    expect((await c.flush()).ok).toBe(false);
    expect((await c.open(sampleId(123))).ok).toBe(false);
    expect(c.store.getState().session.document.metadata.title).toBe('Retained');
    mock.mockRestore();
    expect((await c.flush(true)).ok).toBe(true);
    c.memoryOnly();
    expect((await c.flush()).ok).toBe(true);
    expect(c.store.getState().save.status).toBe('memory-only');
  });
  it('given switching, importing, duplication and deletion, then sessions isolate history and storage identities', async () => {
    const c = await coordinator();
    expect((await c.create('A')).ok).toBe(true);
    const a = c.store.getState().session.document;
    expect((await c.create('B')).ok).toBe(true);
    expect((await c.open(a.id)).ok).toBe(true);
    const old = c.store.getState();
    old.dispatch(old.session.sessionId, {
      type: 'CreateNode',
      nodeType: 'note',
      position: { x: 0, y: 0 },
    });
    expect((await c.duplicate(c.store.getState().session.document)).ok).toBe(true);
    expect(c.store.getState().history.undo).toHaveLength(0);
    const copy = c.store.getState().session.document;
    expect(copy.id).not.toBe(a.id);
    expect((await c.import('{broken')).ok).toBe(false);
    expect(c.store.getState().session.document).toBe(copy);
    expect((await c.import(JSON.stringify(a))).ok).toBe(true);
    const imported = c.store.getState().session.document;
    expect((await c.remove(imported.id, c.store.getState().session.baseStorageRevision)).ok).toBe(
      true,
    );
    expect(c.store.getState().session.document.nodes).toHaveLength(0);
    expect(c.store.getState().modal).toBe('workflows');
  });
  it('given memory-only choice during a captured write, then the acknowledgement never changes the visible mode to Saved', async () => {
    const c = await coordinator(),
      db = c.storage;
    if (!db) throw new Error('Storage missing');
    const original = db.save.bind(db);
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.spyOn(db, 'save').mockImplementation(async (doc, rev) => {
      await gate;
      return original(doc, rev);
    });
    const pending = c.flush();
    c.memoryOnly();
    release();
    await pending;
    expect(c.store.getState().save.status).toBe('memory-only');
  });
  it('given last-opened recovery, then preferences and verified content load before a fresh session is published', async () => {
    const first = await coordinator();
    await first.create('Recovered');
    first.store.getState().setTheme('light');
    first.store.setState({ executionHeight: 320, executionExpanded: true });
    await new Promise((resolve) => setTimeout(resolve, 20));
    first.dispose();
    const second = await coordinator();
    expect(second.store.getState().session.document.metadata.title).toBe('Recovered');
    expect(second.store.getState().theme).toBe('light');
    expect(second.store.getState().executionHeight).toBe(320);
    expect(second.store.getState().executionExpanded).toBe(true);
    expect(second.store.getState().history.undo).toHaveLength(0);
  });
});
