import { useEffect } from 'react';
import { useStoreApi } from '../../state/context';
import { usePersistence } from '../workflows/context';
import { errorMessage } from '../../ui/messages';
import { copyClipboard, pasteClipboard } from './clipboard';
import { isActiveRun } from '../../contracts/execution';
export function editableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    !!target.closest(
      'input,textarea,select,[contenteditable="true"],[role="textbox"],dialog,[role="dialog"]',
    )
  );
}
export function useShortcuts() {
  const store = useStoreApi(),
    persistence = usePersistence();
  useEffect(() => {
    let moving = false;
    const finish = () => {
      if (moving) {
        store.getState().commitDrag(store.getState().session.sessionId);
        moving = false;
      }
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.isComposing || editableTarget(event.target)) return;
      const state = store.getState(),
        mod = event.ctrlKey || event.metaKey,
        key = event.key.toLowerCase();
      const graph =
        event.target instanceof Element && !!event.target.closest('.canvas-region,.graph-list');
      const run = (intent: unknown) =>
        state.request(() => {
          const s = store.getState(),
            r = s.dispatch(s.session.sessionId, intent);
          s.announce(r.ok ? 'Change applied.' : errorMessage(r.error));
        });
      if (key === 'f6') {
        event.preventDefault();
        const regions = [
          document.querySelector<HTMLElement>('.toolbar'),
          document.getElementById('palette-heading'),
          document.getElementById('editor'),
          document.getElementById('inspector-heading'),
          document.getElementById('execution-heading'),
        ].filter((r): r is HTMLElement => r !== null);
        const active = document.activeElement;
        const current = regions.findIndex(
          (r, i) =>
            r === active ||
            (i === 0
              ? r.contains(active)
              : i === 1
                ? r.closest('.left-rail')?.contains(active)
                : i === 2
                  ? r.contains(active)
                  : i === 3
                    ? r.closest('aside')?.contains(active)
                    : r.closest('.execution-panel')?.contains(active)),
        );
        regions[(current + (event.shiftKey ? -1 : 1) + regions.length) % regions.length]?.focus();
        return;
      }
      if (mod && key === 'k') {
        event.preventDefault();
        state.showModal('commands');
        return;
      }
      if (mod && key === 's') {
        event.preventDefault();
        if (persistence)
          void persistence.flush(true).then((r) => {
            if (!r.ok) store.getState().announce(errorMessage(r.error));
          });
        else state.announce('Storage is unavailable in this session.');
        return;
      }
      if (mod && key === 'z') {
        event.preventDefault();
        if (
          isActiveRun(state.runtime.status) &&
          state.history[event.shiftKey ? 'redo' : 'undo'].at(-1)?.semantic
        ) {
          state.announce('Stop execution before semantic history changes.');
          return;
        }
        state.request(() => {
          const s = store.getState(),
            r = event.shiftKey ? s.redo(s.session.sessionId) : s.undo(s.session.sessionId);
          if (!r.ok) s.announce(errorMessage(r.error));
        });
        return;
      }
      if (event.ctrlKey && key === 'y') {
        event.preventDefault();
        if (isActiveRun(state.runtime.status) && state.history.redo.at(-1)?.semantic) {
          state.announce('Stop execution before semantic history changes.');
          return;
        }
        state.request(() => state.redo(state.session.sessionId));
        return;
      }
      if (key === 'escape') {
        event.preventDefault();
        moving = false;
        state.overlayDrag(new Map());
        state.showMenu(null);
        state.setSelection([]);
        return;
      }
      if (!graph) return;
      if (
        isActiveRun(state.runtime.status) &&
        ((mod && ['v', 'd'].includes(key)) || ['delete', 'backspace'].includes(key))
      ) {
        event.preventDefault();
        state.announce('Stop execution before changing graph topology.');
        return;
      }
      const nodes = [...state.selection].filter((id) => state.indexes.nodeById.has(id)),
        edges = [...state.selection].filter((id) => state.indexes.edgeById.has(id));
      if (mod && key === 'a') {
        event.preventDefault();
        state.setSelection([...state.indexes.nodeById.keys(), ...state.indexes.edgeById.keys()]);
      } else if (mod && key === 'd') {
        event.preventDefault();
        run({ type: 'DuplicateSelection', nodeIds: nodes });
      } else if (mod && key === 'c') {
        event.preventDefault();
        state.request(() => copyClipboard(store));
      } else if (mod && key === 'v') {
        event.preventDefault();
        state.request(() => pasteClipboard(store));
      } else if (key === 'delete' || key === 'backspace') {
        event.preventDefault();
        run({ type: 'BulkDelete', nodeIds: nodes, edgeIds: edges });
      } else if ((event.shiftKey && key === 'f10') || key === 'contextmenu') {
        event.preventDefault();
        state.showMenu({ x: 0, y: 0, entityId: nodes[0] ?? edges[0] ?? null });
      } else if (
        ['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(key) &&
        event.target instanceof Element &&
        !!event.target.closest('[data-movement="true"]')
      ) {
        if (!nodes.length || state.draft.dirty) return;
        event.preventDefault();
        moving = true;
        const delta = event.shiftKey ? 16 : 1,
          positions = new Map(state.dragOverlay);
        for (const id of nodes) {
          const node = state.indexes.nodeById.get(id);
          if (!node) continue;
          const p = positions.get(id) ?? node.position;
          positions.set(id, {
            x: p.x + (key === 'arrowleft' ? -delta : key === 'arrowright' ? delta : 0),
            y: p.y + (key === 'arrowup' ? -delta : key === 'arrowdown' ? delta : 0),
          });
        }
        state.overlayDrag(positions);
      }
    };
    const keyup = (e: KeyboardEvent) => {
      if (e.key.startsWith('Arrow')) finish();
    };
    window.addEventListener('keydown', keydown);
    window.addEventListener('keyup', keyup);
    window.addEventListener('blur', finish);
    return () => {
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('keyup', keyup);
      window.removeEventListener('blur', finish);
      store.getState().overlayDrag(new Map());
    };
  }, [store, persistence]);
}
