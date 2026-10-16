import { useState, useEffect, useRef } from 'react';
import { editorPoint, nodePosition } from './placement';
import { useAppStore, useStoreApi } from '../../state/context';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/primitives';
import { NODE_REGISTRY, NODE_TYPES } from '../../contracts/workflow';
import { errorMessage } from '../../ui/messages';
import { ConnectionDialog } from './ConnectionDialog';
import { SelectionActions } from './SelectionActions';
import { WorkflowManager } from '../workflows/WorkflowManager';
import { ExecutionControls } from '../execution/Controls';
import { isActiveRun } from '../../contracts/execution';
function ClipboardDialog({ mode }: { readonly mode: 'copy' | 'paste' }) {
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const store = useStoreApi(),
    [text, setText] = useState(() =>
      mode === 'copy' ? store.getState().copySelection() : { ok: true as const, value: '' },
    ),
    [message, setMessage] = useState('');
  const value = text.ok ? text.value : '';
  return (
    <Modal
      title={mode === 'copy' ? 'Copy selection' : 'Paste selection'}
      onClose={() => store.getState().showModal(null)}
    >
      <p>Use the system clipboard, or copy/paste the JSON text below.</p>
      {!text.ok && <p role="alert">{errorMessage(text.error)}</p>}
      <label htmlFor="selection-json">Selection JSON</label>
      <textarea
        id="selection-json"
        rows={8}
        value={value}
        readOnly={mode === 'copy'}
        onChange={(e) => setText({ ok: true, value: e.target.value })}
      />
      <Button
        onClick={() => {
          if (!navigator.clipboard) {
            setMessage('Clipboard unavailable. Use the text field.');
            return;
          }
          const task =
            mode === 'copy' ? navigator.clipboard.writeText(value) : navigator.clipboard.readText();
          void task
            .then((result) => {
              if (!alive.current) return;
              if (typeof result === 'string') setText({ ok: true, value: result });
              else setMessage('Copied.');
            })
            .catch(() => {
              if (alive.current) setMessage('Clipboard permission denied. Use the text field.');
            });
        }}
      >
        Use system clipboard
      </Button>
      {mode === 'paste' && (
        <Button
          onClick={() => {
            const result = store.getState().paste(value, editorPoint(store));
            if (result.ok) store.getState().showModal(null);
            else setMessage(errorMessage(result.error));
          }}
        >
          Paste nodes
        </Button>
      )}
      {message && <p role="status">{message}</p>}
    </Modal>
  );
}
function CommandPalette() {
  const locked = useAppStore((s) => isActiveRun(s.runtime.status));
  const store = useStoreApi(),
    [search, setSearch] = useState('');
  const actions = [
    ...NODE_TYPES.map((type) => ({
      name: `Add ${NODE_REGISTRY[type].title}`,
      run: () => {
        const s = store.getState();
        s.dispatch(s.session.sessionId, {
          type: 'CreateNode',
          nodeType: type,
          position: nodePosition(store),
        });
        s.showModal(null);
      },
    })),
    ...(['workflows', 'connection', 'help', 'rename', 'clear'] as const).map((modal) => ({
      name:
        modal === 'workflows'
          ? 'Manage workflows'
          : modal === 'connection'
            ? 'Create connection'
            : modal === 'help'
              ? 'Keyboard shortcuts'
              : modal === 'rename'
                ? 'Rename workflow'
                : 'Clear workflow',
      run: () => store.getState().showModal(modal),
    })),
    ...(['dark', 'light', 'system'] as const).map((theme) => ({
      name: `Theme ${theme}`,
      run: () => {
        store.getState().setTheme(theme);
        store.getState().showModal(null);
      },
    })),
  ];
  return (
    <Modal title="Command palette" onClose={() => store.getState().showModal(null)}>
      <label>
        Search commands
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} />
      </label>
      <div className="command-actions">
        {actions
          .filter((a) => a.name.toLowerCase().includes(search.toLowerCase()))
          .map((a) => (
            <Button
              key={a.name}
              disabled={
                locked &&
                ((a.name.startsWith('Add ') && a.name !== 'Add Note') ||
                  ['Create connection', 'Clear workflow'].includes(a.name))
              }
              title={locked ? 'Stop execution before semantic changes' : undefined}
              onClick={a.run}
            >
              {a.name}
            </Button>
          ))}
      </div>
      {locked && <p>Stop execution before changing executable nodes or connections.</p>}
      <ExecutionControls
        actions={['validate', 'run', 'pause', 'resume', 'step', 'stop', 'reset']}
      />
      <SelectionActions />
    </Modal>
  );
}
function RenameDialog() {
  const store = useStoreApi(),
    document = useAppStore((s) => s.session.document),
    [title, setTitle] = useState(document.metadata.title),
    [description, setDescription] = useState(document.metadata.description),
    [error, setError] = useState('');
  return (
    <Modal title="Rename workflow" onClose={() => store.getState().showModal(null)}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const s = store.getState(),
            result = s.dispatch(s.session.sessionId, {
              type: 'RenameWorkflow',
              title: title.trim(),
              description,
            });
          if (result.ok) s.showModal(null);
          else setError(errorMessage(result.error));
        }}
      >
        <label>
          Workflow name
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label>
          Description
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        {error && <p role="alert">{error}</p>}
        <Button type="submit">Apply name</Button>
      </form>
    </Modal>
  );
}
export function Overlays() {
  const modal = useAppStore((s) => s.modal),
    pending = useAppStore((s) => s.pendingAction),
    resolve = useAppStore((s) => s.resolveDraft),
    menu = useAppStore((s) => s.menu),
    store = useStoreApi();
  return (
    <>
      {modal === 'workflows' && <WorkflowManager />}
      {modal === 'connection' && <ConnectionDialog />}
      {modal === 'commands' && <CommandPalette />}
      {modal === 'rename' && <RenameDialog />}
      {(modal === 'copy' || modal === 'paste') && <ClipboardDialog mode={modal} />}
      {modal === 'clear' && (
        <Modal
          title="Clear workflow?"
          onClose={() => store.getState().showModal(null)}
          initialCancel
        >
          <p>Remove all nodes and connections. Undo remains available.</p>
          <Button
            onClick={() => {
              const s = store.getState();
              s.dispatch(s.session.sessionId, { type: 'ClearWorkflow' });
              s.showModal(null);
            }}
          >
            Clear all nodes
          </Button>
        </Modal>
      )}
      {modal === 'help' && (
        <Modal title="Keyboard shortcuts" onClose={() => store.getState().showModal(null)}>
          <p>Use Ctrl on Windows/Linux and Cmd on macOS.</p>
          <dl>
            <dt>Ctrl/Cmd + Z / Shift + Z; Ctrl + Y</dt>
            <dd>Undo / redo</dd>
            <dt>Ctrl/Cmd + C / V / D / A</dt>
            <dd>Copy / paste / duplicate / select all in graph</dd>
            <dt>Ctrl/Cmd + S / K</dt>
            <dd>Save / command palette</dd>
            <dt>Delete / Backspace</dt>
            <dd>Delete selection</dd>
            <dt>Arrows / Shift + Arrows</dt>
            <dd>Move 1 / 16 pixels in movement mode, grouped until keyup</dd>
            <dt>Escape</dt>
            <dd>Close overlay, cancel gesture or clear selection</dd>
            <dt>Shift + F10 / Menu</dt>
            <dd>Context actions</dd>
            <dt>F6 / Shift + F6</dt>
            <dd>Cycle toolbar, palette, editor, properties</dd>
          </dl>
          <p>
            Text fields and dialogs keep native shortcuts. Grid snaps pointer placement to 16
            pixels; fields and keyboard movement bypass snapping. Browser zoom remains available.
          </p>
        </Modal>
      )}
      {menu && (
        <Modal title="Context actions" onClose={() => store.getState().showMenu(null)}>
          <SelectionActions />
          <Button
            onClick={() => {
              store.getState().showMenu(null);
              store
                .getState()
                .showModal(
                  'connection',
                  store.getState().indexes.edgeById.has(menu.entityId ?? '')
                    ? (menu.entityId ?? undefined)
                    : undefined,
                );
            }}
          >
            Manage connection
          </Button>
          <Button
            onClick={() => {
              store.getState().showMenu(null);
              store.getState().showModal('commands');
            }}
          >
            More commands
          </Button>
        </Modal>
      )}
      {pending && (
        <Modal title="Unsaved inspector edits" onClose={() => resolve('stay')} initialCancel>
          <p>Apply valid edits, discard this draft, or stay with the current selection.</p>
          <Button onClick={() => resolve('apply')}>Apply draft and continue</Button>
          <Button onClick={() => resolve('discard')}>Discard draft and continue</Button>
        </Modal>
      )}
    </>
  );
}
