import { failure, type Result } from '../contracts/errors';
import type { DocumentSession } from '../contracts/session';
import type { AppStore } from '../state/store';
import {
  openStorage,
  settingsSchema,
  type WorkflowStorage,
} from '../adapters/persistence/indexeddb';
import { copyDocument, newDocument } from './documents';
import { decodeDocument } from '../validation/codec';
import type { WorkflowDocument } from '../contracts/workflow';
export const AUTOSAVE_DELAY = 500,
  AUTOSAVE_MAX_WAIT = 2000; // PERSISTENCE.md
export class PersistenceCoordinator {
  storage: WorkflowStorage | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private firstDirty = 0;
  private inFlight: Promise<Result<true>> | null = null;
  private unsubscribe: (() => void) | null = null;
  private disposed = false;
  private halted = false;
  private settingsQueue: Promise<void> = Promise.resolve();
  constructor(
    readonly store: AppStore,
    private readonly id: () => string,
    private readonly now: () => string,
  ) {}
  async start(): Promise<void> {
    const opened = await openStorage(() => {
      this.halted = true;
      this.storage = null;
      this.store.getState().setSave('error', failure('STORAGE_UNAVAILABLE', 'persistence').error);
    });
    if (this.disposed) {
      if (opened.ok) opened.value.close();
      return;
    }
    if (!opened.ok) {
      this.store.setState({ bootReady: true });
      this.store.getState().setSave('error', opened.error);
      return;
    }
    this.storage = opened.value;
    const preferences = await this.storage.setting('preferences');
    if (this.disposed) return;
    if (preferences.ok && preferences.value !== null) {
      const checked = settingsSchema.safeParse(preferences.value);
      if (checked.success) this.store.setState(checked.data);
    } else if (!preferences.ok)
      this.store.getState().announce('Saved preferences could not be read.');
    // D-17: only remove the legacy key after the settings transaction completes.
    const state = this.store.getState();
    const migrated = await this.storage.putSetting('preferences', this.preferences());
    if (this.disposed) return;
    if (migrated.ok) {
      try {
        localStorage.removeItem('flowcanvas.theme.v1');
      } catch {
        state.announce('Legacy theme preference could not be removed.');
      }
    } else state.announce('Theme preference could not be saved.');
    const last = await this.storage.setting('lastOpenedWorkflowId');
    if (this.disposed) return;
    if (last.ok && typeof last.value === 'string') {
      const loaded = await this.storage.load(last.value);
      if (this.disposed) return;
      if (loaded.ok) {
        this.store
          .getState()
          .openDocument(loaded.value.document, this.id(), loaded.value.storageRevision);
      } else {
        state.setSave('error', loaded.error);
        state.showModal('workflows');
      }
    } else {
      if (!last.ok) state.announce('Last-opened workflow preference could not be read.');
      state.showModal('workflows');
    }
    if (this.disposed) return;
    this.watch();
    this.store.setState({ bootReady: true });
  }
  private watch() {
    this.unsubscribe?.();
    this.unsubscribe = this.store.subscribe((next, previous) => {
      if (
        next.session.document !== previous.session.document &&
        next.session.sessionId === previous.session.sessionId &&
        next.save.status !== 'memory-only' &&
        !this.halted
      )
        this.schedule();
      if (
        next.theme !== previous.theme ||
        next.grid !== previous.grid ||
        next.minimap !== previous.minimap ||
        next.leftWidth !== previous.leftWidth ||
        next.rightWidth !== previous.rightWidth ||
        next.executionHeight !== previous.executionHeight ||
        next.executionExpanded !== previous.executionExpanded
      ) {
        const prefs = this.preferences();
        this.settingsQueue = this.settingsQueue.then(async () => {
          if (this.disposed || !this.storage) return;
          const result = await this.storage.putSetting('preferences', prefs);
          if (!result.ok) this.store.getState().announce('Preferences could not be saved.');
        });
      }
    });
  }
  private preferences() {
    const s = this.store.getState();
    return {
      theme: s.theme,
      grid: s.grid,
      minimap: s.minimap,
      leftWidth: s.leftWidth,
      rightWidth: s.rightWidth,
      executionHeight: s.executionHeight,
      executionExpanded: s.executionExpanded,
    };
  }
  private schedule() {
    if (this.timer) clearTimeout(this.timer);
    if (!this.firstDirty) this.firstDirty = Date.now();
    this.timer = setTimeout(
      () => {
        this.timer = null;
        void this.flush();
      },
      Math.min(AUTOSAVE_DELAY, Math.max(0, AUTOSAVE_MAX_WAIT - (Date.now() - this.firstDirty))),
    );
  }
  async flush(retry = false): Promise<Result<true>> {
    if (this.disposed) return failure('STALE_SESSION', 'execution');
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.firstDirty = 0;
    if (this.inFlight) return this.inFlight;
    if (retry) this.halted = false;
    if (!this.storage && retry) {
      const opened = await openStorage(() => {
        this.storage = null;
        this.halted = true;
        this.store.getState().setSave('error', failure('STORAGE_UNAVAILABLE', 'persistence').error);
      });
      if (this.disposed) {
        if (opened.ok) opened.value.close();
        return failure('STALE_SESSION', 'execution');
      }
      if (!opened.ok) {
        this.store.getState().setSave('error', opened.error);
        return opened;
      }
      this.storage = opened.value;
      this.watch();
    }
    const current = this.store.getState();
    if (current.save.status === 'memory-only') return { ok: true, value: true };
    if (this.halted)
      return failure(
        current.save.status === 'conflict' ? 'PERSISTENCE_CONFLICT' : 'SAVE_FAILED',
        'persistence',
      );
    if (!this.storage) return failure('STORAGE_UNAVAILABLE', 'persistence');
    this.inFlight = this.drain();
    const result = await this.inFlight;
    this.inFlight = null;
    return result;
  }
  private async drain(): Promise<Result<true>> {
    while (!this.disposed) {
      const state = this.store.getState(),
        session: DocumentSession = state.session;
      if (state.save.status === 'memory-only') return { ok: true, value: true };
      if (session.savedDocumentRevision === session.documentRevision) {
        state.setSave('clean');
        return { ok: true, value: true };
      }
      state.setSave('saving');
      const result = await this.storage?.save(session.document, session.baseStorageRevision);
      if (this.disposed) return failure('SAVE_FAILED', 'persistence');
      if (!result?.ok) {
        const error = result?.error ?? failure('STORAGE_UNAVAILABLE', 'persistence').error;
        this.halted = true;
        if (this.store.getState().session.sessionId === session.sessionId)
          this.store
            .getState()
            .setSave(error.code === 'PERSISTENCE_CONFLICT' ? 'conflict' : 'error', error);
        return { ok: false, error };
      }
      this.store
        .getState()
        .acknowledgeSave(session.sessionId, session.documentRevision, result.value.storageRevision);
      if (session.baseStorageRevision === null) {
        const last = await this.storage?.putSetting('lastOpenedWorkflowId', session.document.id);
        if (last && !last.ok)
          this.store.getState().announce('Last-opened workflow could not be recorded.');
      }
      if (this.store.getState().session.sessionId !== session.sessionId)
        return { ok: true, value: true };
    }
    return failure('SAVE_FAILED', 'persistence');
  }
  async open(id: string, discard = false): Promise<Result<true>> {
    if (!this.storage) return failure('STORAGE_UNAVAILABLE', 'persistence');
    if (!discard) {
      const flushed = await this.flush();
      if (!flushed.ok) return flushed;
    }
    const captured = this.store.getState().session;
    const loaded = await this.storage.load(id);
    if (!loaded.ok) return loaded;
    if (this.disposed) return failure('STALE_SESSION', 'execution');
    if (this.store.getState().session !== captured) return failure('STALE_SESSION', 'execution');
    this.halted = false;
    this.store
      .getState()
      .openDocument(loaded.value.document, this.id(), loaded.value.storageRevision);
    const setting = await this.storage.putSetting('lastOpenedWorkflowId', id);
    if (!setting.ok) this.store.getState().announce('Last-opened workflow could not be recorded.');
    return { ok: true, value: true };
  }
  async create(title: string): Promise<Result<true>> {
    const flushed = await this.flush();
    if (!flushed.ok) return flushed;
    return this.createCopy(newDocument(this.id, this.now, title));
  }
  async createCopy(document: WorkflowDocument): Promise<Result<true>> {
    if (!this.storage) return failure('STORAGE_UNAVAILABLE', 'persistence');
    const captured = this.store.getState().session;
    const saved = await this.storage.save(document, null);
    if (!saved.ok) return saved;
    if (this.disposed) return failure('STALE_SESSION', 'execution');
    if (this.store.getState().session !== captured) return failure('STALE_SESSION', 'execution');
    this.halted = false;
    this.store
      .getState()
      .openDocument(saved.value.document, this.id(), saved.value.storageRevision);
    const setting = await this.storage.putSetting('lastOpenedWorkflowId', document.id);
    if (!setting.ok) this.store.getState().announce('Last-opened workflow could not be recorded.');
    return { ok: true, value: true };
  }
  async duplicate(document: WorkflowDocument, preserveUnsaved = false): Promise<Result<true>> {
    const captured = this.store.getState().session;
    if (!preserveUnsaved) {
      const saved = await this.flush();
      if (!saved.ok) return saved;
    } else if (this.inFlight) {
      await this.inFlight;
      const current = this.store.getState().session;
      if (current.sessionId !== captured.sessionId || current.document !== captured.document)
        return failure('STALE_SESSION', 'execution');
    }
    const copied = copyDocument(document, this.id, this.now);
    return copied.ok ? this.createCopy(copied.value) : copied;
  }
  async import(text: string): Promise<Result<true>> {
    const decoded = decodeDocument(text);
    if (!decoded.ok) return decoded;
    const copied = copyDocument(decoded.value, this.id, this.now, ' imported');
    if (!copied.ok) return copied;
    const flushed = await this.flush();
    if (!flushed.ok) return flushed;
    return this.createCopy(copied.value);
  }
  async remove(id: string, expected?: number | null): Promise<Result<true>> {
    if (this.disposed) return failure('STALE_SESSION', 'execution');
    if (!this.storage) return failure('STORAGE_UNAVAILABLE', 'persistence');
    const captured = this.store.getState().session;
    const pausedAutosave = id === captured.document.id && this.timer !== null;
    if (pausedAutosave && this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    try {
      if (this.inFlight) {
        const saved = await this.inFlight;
        if (!saved.ok) return saved;
      }
      const loaded = await this.storage.load(id);
      if (this.disposed) return failure('STALE_SESSION', 'execution');
      if (!loaded.ok) return loaded;
      if (expected !== undefined && expected !== loaded.value.storageRevision)
        return failure('PERSISTENCE_CONFLICT', 'persistence');
      const active = this.store.getState().session;
      if (
        id === active.document.id &&
        active.baseStorageRevision !== null &&
        loaded.value.storageRevision !== active.baseStorageRevision
      )
        return failure('PERSISTENCE_CONFLICT', 'persistence');
      const result = await this.storage.remove(id, loaded.value.storageRevision);
      if (
        result.ok &&
        !this.disposed &&
        this.store.getState().session === active &&
        id === active.document.id
      ) {
        this.store.getState().openDocument(newDocument(this.id, this.now), this.id(), null);
        this.store.getState().showModal('workflows');
      }
      return result;
    } finally {
      const current = this.store.getState();
      if (
        pausedAutosave &&
        !this.disposed &&
        !this.halted &&
        current.session.sessionId === captured.sessionId &&
        current.save.status !== 'memory-only' &&
        current.session.savedDocumentRevision !== current.session.documentRevision
      )
        this.schedule();
    }
  }
  memoryOnly() {
    this.halted = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.store.getState().setSave('memory-only');
  }
  dispose() {
    this.disposed = true;
    if (this.timer) clearTimeout(this.timer);
    this.unsubscribe?.();
    this.storage?.close();
  }
}
