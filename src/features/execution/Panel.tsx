import { useState } from 'react';
import { useAppStore, useStoreApi } from '../../state/context';
import { Region, Button } from '../../ui/primitives';
import { errorMessage } from '../../ui/messages';
import { ExecutionControls } from './Controls';
import { PayloadView } from './PayloadView';
import { NodeStatus } from './NodeStatus';
import { RunAnnouncement } from './RunAnnouncement';
const TIMELINE_PAGE_SIZE = 40; // Bounded DOM window over DATA_CONTRACT's diagnostic ring.
function NodeInspection({ nodeId }: { readonly nodeId: string }) {
  const record = useAppStore((s) => s.runtime.records.get(nodeId));
  const input = useAppStore((s) =>
    record?.inputPayloadId ? s.runtime.payloads.get(record.inputPayloadId) : undefined,
  );
  const outputs = useAppStore((s) => s.runtime.payloads);
  if (!record) return <p>Select an executed node to inspect its data.</p>;
  return (
    <div>
      <h3>Node inspection</h3>
      <code>{nodeId}</code>
      <NodeStatus nodeId={nodeId} />
      <PayloadView title="Node input" value={input} />
      {Object.entries(record.outputPayloadIds ?? {}).map(([port, id]) => (
        <PayloadView key={port} title={`Node output ${port}`} value={outputs.get(id)} />
      ))}
      {record.errorCode && <p>{record.errorCode}: inspect this node's input and configuration.</p>}
    </div>
  );
}
export function ExecutionPanel() {
  const runtime = useAppStore((s) => s.runtime),
    selection = useAppStore((s) => s.selection),
    nodes = useAppStore((s) => s.session.document.nodes),
    select = useAppStore((s) => s.select),
    height = useAppStore((s) => s.executionHeight),
    expanded = useAppStore((s) => s.executionExpanded);
  const store = useStoreApi();
  const [timelinePage, setTimelinePage] = useState<{
    readonly runId: string | null;
    readonly offset: number;
  }>({ runId: null, offset: 0 });
  const offset = timelinePage.runId === runtime.identity?.runId ? timelinePage.offset : 0;
  const setOffset = (value: number) =>
    setTimelinePage({ runId: runtime.identity?.runId ?? null, offset: value });
  const selected = [...selection].find((id) => runtime.records.has(id));
  const end = Math.max(0, runtime.events.length - offset),
    start = Math.max(0, end - TIMELINE_PAGE_SIZE);
  return (
    <Region
      title="Execution"
      id="execution-heading"
      className={`execution-panel ${expanded ? 'expanded' : ''}`}
    >
      <div className="action-row">
        <strong data-testid="run-status">{runtime.status}</strong>
        <Button
          aria-expanded={expanded}
          onClick={() => store.setState({ executionExpanded: !expanded })}
        >
          {expanded ? 'Collapse execution' : 'Expand execution'}
        </Button>
        {expanded && (
          <>
            <Button
              aria-label="Shorter execution panel"
              onClick={() => store.setState({ executionHeight: Math.max(180, height - 40) })}
            >
              −
            </Button>
            <Button
              aria-label="Taller execution panel"
              onClick={() =>
                store.setState({
                  executionHeight: Math.max(
                    180,
                    Math.min(Math.floor(window.innerHeight / 2), height + 40),
                  ),
                })
              }
            >
              +
            </Button>
          </>
        )}
      </div>
      <RunAnnouncement status={runtime.status} />
      {runtime.error && (
        <p role="alert">
          {runtime.error.code}: {errorMessage(runtime.error)}
        </p>
      )}
      <ExecutionControls />
      {!runtime.identity && (
        <p>Validate the graph, Run all triggers, or Step one operation at a time.</p>
      )}
      {runtime.identity && (
        <p className="run-identity">
          Run {runtime.identity.runId} · semantic revision {runtime.identity.semanticRevision}
        </p>
      )}
      {runtime.result && (
        <p>
          {runtime.result.partial ? 'Partial results · ' : ''}
          {runtime.result.status} · {runtime.result.counts.operations} operations · active{' '}
          {runtime.result.timings.activeMs.toFixed(2)} ms · paused{' '}
          {runtime.result.timings.pausedMs.toFixed(2)} ms · wall{' '}
          {runtime.result.timings.wallMs.toFixed(2)} ms
        </p>
      )}
      {expanded && (
        <div className="execution-detail" style={{ height: `min(${height}px, 50vh)` }}>
          <div>
            <h3>Execution timeline</h3>
            <p>
              {runtime.eventsEvicted} events evicted · {runtime.events.length} retained
            </p>
            <div className="action-row">
              <Button
                disabled={start === 0}
                title={start === 0 ? 'At the oldest retained events' : undefined}
                onClick={() => setOffset(offset + TIMELINE_PAGE_SIZE)}
              >
                Older events
              </Button>
              <Button
                disabled={offset === 0}
                title={offset === 0 ? 'At the newest events' : undefined}
                onClick={() => setOffset(Math.max(0, offset - TIMELINE_PAGE_SIZE))}
              >
                Newer events
              </Button>
            </div>
            <ol className="execution-timeline">
              {runtime.events.slice(start, end).map((event) => (
                <li key={event.sequence}>
                  #{event.sequence} · {event.atMs.toFixed(2)} ms · {event.kind} {event.status}{' '}
                  {event.code} {event.port}
                  {event.durationMs === undefined ? '' : ` · ${event.durationMs.toFixed(2)} ms`}
                  {event.nodeId && (
                    <Button
                      aria-label={`Inspect ${nodes.find((node) => node.id === event.nodeId)?.label ?? event.nodeId} at event ${event.sequence}`}
                      onClick={() => select(event.nodeId ?? null)}
                    >
                      Inspect{' '}
                      {nodes.find((node) => node.id === event.nodeId)?.label ?? event.nodeId}
                    </Button>
                  )}
                </li>
              ))}
            </ol>
          </div>
          <div>
            <label htmlFor="execution-node">Inspect execution node</label>
            <select
              id="execution-node"
              value={selected ?? ''}
              onChange={(event) => select(event.target.value || null)}
            >
              <option value="">Choose a node</option>
              {[...runtime.records.values()].map((record) => (
                <option key={record.nodeId} value={record.nodeId}>
                  {nodes.find((node) => node.id === record.nodeId)?.label ?? record.nodeId} ·{' '}
                  {record.disposition}
                </option>
              ))}
            </select>
            {selected && <NodeInspection nodeId={selected} />}
            <h3>Final output{runtime.result?.partial ? ' · partial' : ''}</h3>
            {runtime.outputs.map((output) => (
              <details key={output.nodeId}>
                <summary>
                  {output.name} · Output #{output.sequenceIndex + 1} · {output.nodeId}
                </summary>
                <PayloadView
                  title={`Final output ${output.sequenceIndex + 1}`}
                  value={runtime.payloads.get(output.payloadId)}
                />
              </details>
            ))}
            {runtime.result?.status === 'completed' && !runtime.outputs.length && (
              <p>NO_OUTPUT_ACTIVATED · No final output was activated.</p>
            )}
          </div>
        </div>
      )}
    </Region>
  );
}
