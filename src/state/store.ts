import { createStore } from 'zustand/vanilla';
import type { AppError, Readiness, Result } from '../contracts/errors';
import type { DocumentSession } from '../contracts/session';
import { idleRuntime, type RuntimeView } from '../contracts/execution';
import type { Position, Viewport, WorkflowDocument } from '../contracts/workflow';
import { appendHistory, editable, emptyHistory, type HistoryState } from '../domain/graph/history';
import { extractSubgraph, groupOffset } from '../domain/graph/subgraph';
import { decodeSubgraph, validateSubgraph } from '../validation/subgraph';
import type { GraphIndexes } from '../domain/graph/indexes';
import { buildIndexes } from '../domain/graph/indexes';
import { readiness } from '../domain/graph/invariants';
import { reduceCommand, type CommandPorts, type CommandChange } from '../domain/graph/commands';
import { validateCommand } from '../validation/commands';
import { failure } from '../contracts/errors';

export type Theme = 'system' | 'dark' | 'light';
export interface AppState {
  readonly bootReady: boolean;
  readonly history: HistoryState;
  readonly save: {
    readonly status: 'clean' | 'dirty' | 'saving' | 'saved' | 'error' | 'conflict' | 'memory-only';
    readonly error: AppError | null;
  };
  readonly message: string;
  readonly dragOverlay: ReadonlyMap<string, Position>;
  readonly draft: { readonly dirty: boolean; readonly apply: (() => boolean) | null };
  readonly draftEpoch: number;
  readonly pendingAction: (() => void) | null;
  readonly modal:
    'workflows' | 'connection' | 'commands' | 'help' | 'copy' | 'paste' | 'rename' | 'clear' | null;
  readonly edgeEditing: string | null;
  readonly menu: {
    readonly x: number;
    readonly y: number;
    readonly entityId: string | null;
  } | null;
  readonly minimap: boolean;
  readonly leftWidth: number;
  readonly rightWidth: number;
  readonly executionHeight: number;
  readonly executionExpanded: boolean;
  readonly pasteCount: number;
  readonly canvasPoint: Position | null;
  readonly session: DocumentSession;
  readonly indexes: GraphIndexes;
  readonly diagnostics: Readiness;
  readonly selection: ReadonlySet<string>;
  readonly viewportOverlay: Viewport | null;
  readonly theme: Theme;
  readonly grid: boolean;
  readonly view: 'canvas' | 'list';
  readonly runtime: RuntimeView;
  readonly dispatch: (expectedSessionId: string, intent: unknown) => Result<CommandChange>;
  readonly transaction: (sessionId: string, intents: readonly unknown[]) => Result<CommandChange>;
  readonly select: (nodeId: string | null) => void;
  readonly setSelection: (ids: readonly string[]) => void;
  readonly request: (action: () => void) => void;
  readonly resolveDraft: (decision: 'apply' | 'discard' | 'stay') => void;
  readonly setDraft: (dirty: boolean, apply: (() => boolean) | null) => void;
  readonly undo: (sessionId: string) => Result<CommandChange>;
  readonly redo: (sessionId: string) => Result<CommandChange>;
  readonly openDocument: (
    document: unknown,
    sessionId: string,
    revision: number | null,
  ) => Result<WorkflowDocument>;
  readonly acknowledgeSave: (sessionId: string, revision: number, storageRevision: number) => void;
  readonly setSave: (status: AppState['save']['status'], error?: AppError) => void;
  readonly announce: (message: string) => void;
  readonly overlayDrag: (positions: ReadonlyMap<string, Position>) => void;
  readonly commitDrag: (sessionId: string) => Result<CommandChange>;
  readonly showModal: (modal: AppState['modal'], edgeId?: string) => void;
  readonly showMenu: (menu: AppState['menu']) => void;
  readonly toggleMinimap: () => void;
  readonly resizePanel: (panel: 'left' | 'right', delta: number) => void;
  readonly copySelection: () => Result<string>;
  readonly paste: (text: string, center: Position) => Result<CommandChange>;
  readonly overlayViewport: (viewport: Viewport | null) => void;
  readonly setTheme: (theme: Theme) => void;
  readonly toggleGrid: () => void;
  readonly setView: (view: 'canvas' | 'list') => void;
}
export function createAppStore(
  initialDocument: WorkflowDocument,
  sessionId: string,
  ports: CommandPorts,
) {
  const checked = ports.validate(initialDocument);
  if (!checked.ok) throw new Error('Invalid initial canonical document');
  const document = checked.value;
  const indexes = buildIndexes(document);
  return createStore<AppState>((set, get) => {
    function publish(change: CommandChange, history: HistoryState) {
      const current = get();
      const nextIndexes = change.topology
        ? buildIndexes(change.document)
        : {
            ...current.indexes,
            nodeById: new Map(change.document.nodes.map((node) => [node.id, node])),
          };
      set({
        session: {
          ...current.session,
          document: change.document,
          documentRevision: current.session.documentRevision + 1,
          semanticRevision: current.session.semanticRevision + Number(change.semantic),
          topologyRevision: current.session.topologyRevision + Number(change.topology),
        },
        indexes: nextIndexes,
        diagnostics:
          change.semantic || change.topology
            ? readiness(change.document, nextIndexes)
            : current.diagnostics,
        selection: new Set(
          [...current.selection].filter(
            (id) =>
              change.document.nodes.some((n) => n.id === id) ||
              change.document.edges.some((e) => e.id === id),
          ),
        ),
        history,
        save:
          current.save.status === 'memory-only'
            ? current.save
            : {
                status: current.save.status === 'conflict' ? 'conflict' : 'dirty',
                error: current.save.error,
              },
        runtime: change.semantic ? idleRuntime() : current.runtime,
      });
    }
    function restore(sessionId: string, direction: 'undo' | 'redo'): Result<CommandChange> {
      const current = get();
      if (current.session.sessionId !== sessionId) return failure('STALE_SESSION', 'execution');
      const stack = current.history[direction],
        entry = stack.at(-1);
      if (!entry)
        return {
          ok: true,
          value: {
            document: current.session.document,
            changed: false,
            semantic: false,
            topology: false,
            history: false,
          },
        };
      const content = direction === 'undo' ? entry.before : entry.after;
      const old = current.session.document;
      const now = ports.now();
      const checked = ports.validate({
        ...old,
        nodes: content.nodes,
        edges: content.edges,
        metadata: {
          ...old.metadata,
          title: content.title,
          description: content.description,
          updatedAt: now > old.metadata.updatedAt ? now : old.metadata.updatedAt,
        },
      });
      if (!checked.ok) return checked;
      const change: CommandChange = {
        document: checked.value,
        changed: true,
        semantic: entry.semantic,
        topology: entry.topology,
        history: false,
      };
      const opposite = direction === 'undo' ? 'redo' : 'undo';
      publish(change, {
        ...current.history,
        [direction]: stack.slice(0, -1),
        [opposite]: [...current.history[opposite], entry],
      });
      return { ok: true, value: change };
    }
    return {
      bootReady: false,
      history: emptyHistory,
      save: { status: 'dirty', error: null },
      message: '',
      dragOverlay: new Map(),
      draft: { dirty: false, apply: null },
      draftEpoch: 0,
      pendingAction: null,
      modal: null,
      edgeEditing: null,
      menu: null,
      minimap: true,
      leftWidth: 240,
      rightWidth: 320,
      executionHeight: 280,
      executionExpanded: false,
      pasteCount: 0,
      canvasPoint: null,
      session: {
        sessionId,
        document,
        documentRevision: 0,
        semanticRevision: 0,
        topologyRevision: 0,
        baseStorageRevision: null,
        savedDocumentRevision: null,
      },
      indexes,
      diagnostics: readiness(document, indexes),
      selection: new Set(),
      viewportOverlay: null,
      theme: 'dark',
      grid: true,
      view: 'canvas',
      runtime: idleRuntime(),
      dispatch(expectedSessionId, intent) {
        const current = get();
        if (expectedSessionId !== current.session.sessionId)
          return failure('STALE_SESSION', 'execution');
        const command = validateCommand(intent);
        if (!command.ok) return command;
        const result = reduceCommand(current.session.document, command.value, ports);
        if (!result.ok || !result.value.changed) return result;
        const change = result.value;
        const history = change.history
          ? appendHistory(current.history, {
              before: editable(current.session.document),
              after: editable(change.document),
              semantic: change.semantic,
              topology: change.topology,
            })
          : current.history;
        publish(change, history);
        if (
          ['CreateNode', 'DuplicateNode', 'DuplicateSelection', 'PasteSubgraph'].includes(
            command.value.type,
          )
        )
          set({
            selection: new Set(
              change.document.nodes
                .filter((n) => !current.indexes.nodeById.has(n.id))
                .map((n) => n.id),
            ),
          });
        if (history.truncated)
          set({ message: 'History limit reached. Oldest undo transactions were removed.' });
        return result;
      },
      transaction(sessionId, intents) {
        const current = get();
        if (current.session.sessionId !== sessionId) return failure('STALE_SESSION', 'execution');
        let document = current.session.document,
          semantic = false,
          topology = false,
          history = false;
        for (const intent of intents) {
          const parsed = validateCommand(intent);
          if (!parsed.ok) return parsed;
          const result = reduceCommand(document, parsed.value, ports);
          if (!result.ok) return result;
          document = result.value.document;
          semantic ||= result.value.semantic;
          topology ||= result.value.topology;
          history ||= result.value.history;
        }
        const changed =
          JSON.stringify(editable(document)) !==
            JSON.stringify(editable(current.session.document)) ||
          JSON.stringify(document.viewport) !== JSON.stringify(current.session.document.viewport);
        if (!changed)
          return {
            ok: true,
            value: {
              document: current.session.document,
              changed: false,
              semantic: false,
              topology: false,
              history: false,
            },
          };
        const change: CommandChange = { document, changed, semantic, topology, history };
        if (changed)
          publish(
            change,
            history
              ? appendHistory(current.history, {
                  before: editable(current.session.document),
                  after: editable(document),
                  semantic,
                  topology,
                })
              : current.history,
          );
        return { ok: true, value: change };
      },
      undo(sessionId) {
        try {
          return restore(sessionId, 'undo');
        } catch {
          return failure('INTERNAL_FAILURE', 'internal');
        }
      },
      redo(sessionId) {
        try {
          return restore(sessionId, 'redo');
        } catch {
          return failure('INTERNAL_FAILURE', 'internal');
        }
      },
      openDocument(input, sessionId, revision) {
        const valid = ports.validate(input);
        if (!valid.ok) return valid;
        const indexes = buildIndexes(valid.value);
        set({
          session: {
            sessionId,
            document: valid.value,
            documentRevision: 0,
            semanticRevision: 0,
            topologyRevision: 0,
            baseStorageRevision: revision,
            savedDocumentRevision: revision === null ? null : 0,
          },
          indexes,
          diagnostics: readiness(valid.value, indexes),
          selection: new Set(),
          viewportOverlay: null,
          dragOverlay: new Map(),
          history: emptyHistory,
          draft: { dirty: false, apply: null },
          pendingAction: null,
          message: '',
          menu: null,
          edgeEditing: null,
          pasteCount: 0,
          canvasPoint: null,
          runtime: idleRuntime(),
          save: { status: revision === null ? 'dirty' : 'clean', error: null },
        });
        return valid;
      },
      acknowledgeSave(sessionId, revision, storageRevision) {
        const current = get();
        if (current.session.sessionId !== sessionId) return;
        set({
          session: {
            ...current.session,
            baseStorageRevision: storageRevision,
            savedDocumentRevision: revision,
          },
          save:
            current.save.status === 'memory-only'
              ? current.save
              : {
                  status: revision === current.session.documentRevision ? 'saved' : 'dirty',
                  error: null,
                },
        });
      },
      setSave(status, error) {
        set({ save: { status, error: error ?? null } });
      },
      announce(message) {
        set({ message });
      },
      request(action) {
        if (get().draft.dirty) set({ pendingAction: action });
        else action();
      },
      setDraft(dirty, apply) {
        set({ draft: { dirty, apply } });
      },
      resolveDraft(decision) {
        const current = get();
        if (decision === 'stay') {
          set({ pendingAction: null });
          return;
        }
        if (decision === 'apply' && !current.draft.apply?.()) return;
        set({
          draft: { dirty: false, apply: null },
          pendingAction: null,
          draftEpoch: current.draftEpoch + Number(decision === 'discard'),
        });
        current.pendingAction?.();
      },
      setSelection(ids) {
        const current = get();
        const allowed = ids.filter(
          (id) => current.indexes.nodeById.has(id) || current.indexes.edgeById.has(id),
        );
        if (
          allowed.length === current.selection.size &&
          allowed.every((id) => current.selection.has(id))
        )
          return;
        current.request(() => set({ selection: new Set(allowed) }));
      },
      overlayDrag(positions) {
        set({ dragOverlay: positions });
      },
      commitDrag(sessionId) {
        const moves = [...get().dragOverlay].map(([nodeId, position]) => ({ nodeId, position }));
        const result = moves.length
          ? get().dispatch(sessionId, { type: 'MoveNodes', moves })
          : {
              ok: true as const,
              value: {
                document: get().session.document,
                changed: false,
                semantic: false,
                topology: false,
                history: false,
              },
            };
        set({ dragOverlay: new Map() });
        return result;
      },
      showModal(modal, edgeId) {
        get().request(() => set({ modal, edgeEditing: edgeId ?? null, menu: null }));
      },
      showMenu(menu) {
        set({ menu });
      },
      toggleMinimap() {
        set((s) => ({ minimap: !s.minimap }));
      },
      resizePanel(panel, delta) {
        set((s) =>
          panel === 'left'
            ? { leftWidth: Math.max(240, Math.min(420, s.leftWidth + delta)) }
            : { rightWidth: Math.max(240, Math.min(420, s.rightWidth + delta)) },
        );
      },
      copySelection() {
        const current = get();
        const fragment = extractSubgraph(
          current.session.document,
          [...current.selection].filter((id) => current.indexes.nodeById.has(id)),
        );
        if (!fragment.ok) return fragment;
        const valid = validateSubgraph(fragment.value);
        if (!valid.ok) return valid;
        const text = JSON.stringify(valid.value);
        return { ok: true, value: text };
      },
      paste(text, center) {
        const fragment = decodeSubgraph(text);
        if (!fragment.ok) return fragment;
        const current = get();
        const offset = groupOffset(fragment.value, {
          x: center.x + current.pasteCount * 32,
          y: center.y + current.pasteCount * 32,
        });
        const result = current.dispatch(current.session.sessionId, {
          type: 'PasteSubgraph',
          fragment: fragment.value,
          offset,
        });
        if (result.ok && result.value.changed) set({ pasteCount: current.pasteCount + 1 });
        return result;
      },
      select(nodeId) {
        const current = get();
        if (
          (nodeId === null && current.selection.size === 0) ||
          (nodeId !== null && current.selection.size === 1 && current.selection.has(nodeId))
        )
          return;
        if (nodeId === null || current.session.document.nodes.some((node) => node.id === nodeId))
          get().setSelection(nodeId === null ? [] : [nodeId]);
      },
      overlayViewport(viewport) {
        const previous = get().viewportOverlay;
        if (
          previous === viewport ||
          (previous &&
            viewport &&
            previous.x === viewport.x &&
            previous.y === viewport.y &&
            previous.zoom === viewport.zoom)
        )
          return;
        set({ viewportOverlay: viewport });
      },
      setTheme(theme) {
        set({ theme });
      },
      toggleGrid() {
        set((state) => ({ grid: !state.grid }));
      },
      setView(view) {
        set({ view });
      },
    };
  });
}
export type AppStore = ReturnType<typeof createAppStore>;
export type DispatchFailure = AppError;
