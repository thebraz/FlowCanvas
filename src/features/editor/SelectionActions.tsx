import { useAppStore, useStoreApi } from '../../state/context';
import { Button } from '../../ui/primitives';
import { errorMessage } from '../../ui/messages';
import { isActiveRun } from '../../contracts/execution';
export function SelectionActions() {
  const locked = useAppStore((s) => isActiveRun(s.runtime.status));
  const selection = useAppStore((s) => s.selection),
    workflow = useAppStore((s) => s.session.document),
    store = useStoreApi();
  const nodes = [...selection].filter((id) => workflow.nodes.some((n) => n.id === id)),
    edges = [...selection].filter((id) => workflow.edges.some((e) => e.id === id));
  const run = (intent: unknown) =>
    store.getState().request(() => {
      const s = store.getState(),
        r = s.dispatch(s.session.sessionId, intent);
      s.announce(r.ok ? 'Change applied.' : errorMessage(r.error));
      if (r.ok) document.getElementById('graph-list-heading')?.focus();
    });
  return (
    <div className="selection-actions">
      <div className="action-row">
        <Button
          disabled={!selection.size || locked}
          title={
            locked
              ? 'Stop execution before deleting graph items'
              : !selection.size
                ? 'Select graph items first'
                : undefined
          }
          onClick={() => run({ type: 'BulkDelete', nodeIds: nodes, edgeIds: edges })}
        >
          Delete selected
        </Button>
        <Button
          disabled={!nodes.length || locked}
          title={
            locked
              ? 'Stop execution before duplicating nodes'
              : !nodes.length
                ? 'Select nodes first'
                : undefined
          }
          onClick={() => run({ type: 'DuplicateSelection', nodeIds: nodes })}
        >
          Duplicate selected
        </Button>
        <Button
          onClick={() => store.getState().showModal('copy')}
          disabled={!nodes.length}
          title={!nodes.length ? 'Select nodes to copy' : undefined}
        >
          Copy selection
        </Button>
        <Button
          disabled={locked}
          title={locked ? 'Stop execution before pasting nodes' : undefined}
          onClick={() => store.getState().showModal('paste')}
        >
          Paste selection
        </Button>
      </div>
      <label>
        Align selected
        <select
          defaultValue=""
          disabled={nodes.length < 2}
          title={nodes.length < 2 ? 'Select at least two nodes' : undefined}
          onChange={(e) => {
            if (e.target.value) run({ type: 'AlignNodes', nodeIds: nodes, mode: e.target.value });
            e.target.value = '';
          }}
        >
          <option value="">Choose alignment</option>
          {['left', 'right', 'top', 'bottom', 'horizontal', 'vertical'].map((mode) => (
            <option key={mode} value={mode}>
              {mode}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
