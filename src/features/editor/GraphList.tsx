import { useMemo, useRef } from 'react';
import { NODE_REGISTRY } from '../../contracts/workflow';
import { compareAscii, compareCodePoints } from '../../domain/json/canonical';
import { useAppStore } from '../../state/context';
import { Button } from '../../ui/primitives';
import { NodeStatus } from '../execution/NodeStatus';
import { isActiveRun } from '../../contracts/execution';
export function GraphList() {
  const anchor = useRef<string | null>(null);
  const locked = useAppStore((s) => isActiveRun(s.runtime.status));
  const document = useAppStore((state) => state.session.document);
  const selection = useAppStore((state) => state.selection);
  const select = useAppStore((state) => state.select);
  const setSelection = useAppStore((s) => s.setSelection),
    showModal = useAppStore((s) => s.showModal),
    dispatch = useAppStore((s) => s.dispatch),
    sessionId = useAppStore((s) => s.session.sessionId),
    request = useAppStore((s) => s.request);
  const nodes = useMemo(
    () =>
      [...document.nodes].sort(
        (a, b) => compareCodePoints(a.label, b.label) || compareAscii(a.id, b.id),
      ),
    [document.nodes],
  );
  return (
    <section className="graph-list region" aria-labelledby="graph-list-heading">
      <h2 id="graph-list-heading" tabIndex={-1}>
        Graph list
      </h2>
      <p className="muted">Keyboard access to every node and connection.</p>
      <ul>
        {nodes.map((node) => (
          <li key={node.id}>
            <label>
              <input
                type="checkbox"
                aria-label={`Select ${node.label}`}
                checked={selection.has(node.id)}
                readOnly
                onClick={(e) => {
                  const a = nodes.findIndex((n) => n.id === anchor.current);
                  if (e.shiftKey && a >= 0) {
                    const b = nodes.findIndex((n) => n.id === node.id);
                    setSelection([
                      ...new Set([
                        ...selection,
                        ...nodes.slice(Math.min(a, b), Math.max(a, b) + 1).map((n) => n.id),
                      ]),
                    ]);
                  } else {
                    setSelection(
                      !selection.has(node.id)
                        ? [...selection, node.id]
                        : [...selection].filter((id) => id !== node.id),
                    );
                    anchor.current = node.id;
                  }
                }}
              />
              Select {node.label}
            </label>
            <Button
              aria-pressed={selection.has(node.id)}
              onContextMenu={(event) => {
                event.preventDefault();
                select(node.id);
                showModal('commands');
              }}
              onClick={() => {
                select(node.id);
              }}
              aria-label={`Inspect ${node.label}`}
            >
              {node.label}
            </Button>
            <span>
              {NODE_REGISTRY[node.type].title} ·{' '}
              {node.config === null
                ? 'Needs configuration'
                : node.type === 'note'
                  ? 'Annotation'
                  : 'Configured'}
            </span>
            <NodeStatus nodeId={node.id} />
            <details>
              <summary>Connections for {node.label}</summary>
              <ul>
                {document.edges
                  .filter(
                    (edge) => edge.source.nodeId === node.id || edge.target.nodeId === node.id,
                  )
                  .map((edge) => (
                    <li key={edge.id}>
                      {document.nodes.find((n) => n.id === edge.source.nodeId)?.label} (
                      {edge.source.port}) →{' '}
                      {document.nodes.find((n) => n.id === edge.target.nodeId)?.label} (
                      {edge.target.port})
                      <Button
                        disabled={locked}
                        title={locked ? 'Stop execution before editing connections' : undefined}
                        aria-label={`Edit connection ${edge.id.slice(-4)}`}
                        onClick={() => showModal('connection', edge.id)}
                      >
                        Edit connection
                      </Button>
                      <Button
                        disabled={locked}
                        title={locked ? 'Stop execution before editing connections' : undefined}
                        aria-label={`Delete connection ${edge.id.slice(-4)}`}
                        onClick={() =>
                          request(() => {
                            dispatch(sessionId, { type: 'DeleteEdge', edgeId: edge.id });
                          })
                        }
                      >
                        Delete connection
                      </Button>
                    </li>
                  ))}
                {!document.edges.some(
                  (edge) => edge.source.nodeId === node.id || edge.target.nodeId === node.id,
                ) && <li>No connections</li>}
              </ul>
            </details>
            <Button
              data-movement="true"
              onClick={() => select(node.id)}
              aria-label={`Move ${node.label} with arrows`}
            >
              Move with arrows
            </Button>
            <span className="muted">
              Focus Move, press Enter, then arrows. Escape exits movement.
            </span>
            <Button
              disabled={locked}
              title={locked ? 'Stop execution before editing connections' : undefined}
              onClick={() => {
                select(node.id);
                showModal('connection');
              }}
            >
              Add connection
            </Button>
          </li>
        ))}
      </ul>
      {nodes.length === 0 && (
        <p>This workflow has no nodes. Add Manual Trigger or Note from the node palette.</p>
      )}
    </section>
  );
}
