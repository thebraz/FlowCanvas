import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../state/context';
import { NODE_REGISTRY } from '../../contracts/workflow';
import { edgeSchema } from '../../validation/schemas';
import { errorMessage } from '../../ui/messages';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/primitives';
import { isActiveRun } from '../../contracts/execution';
export function ConnectionDialog() {
  const locked = useAppStore((s) => isActiveRun(s.runtime.status));
  const document = useAppStore((s) => s.session.document),
    sessionId = useAppStore((s) => s.session.sessionId),
    dispatch = useAppStore((s) => s.dispatch),
    edgeId = useAppStore((s) => s.edgeEditing),
    close = useAppStore((s) => s.showModal),
    announce = useAppStore((s) => s.announce);
  const edge = document.edges.find((e) => e.id === edgeId);
  const sources = document.nodes.filter((n) => NODE_REGISTRY[n.type].outputs.length),
    targets = document.nodes.filter((n) => NODE_REGISTRY[n.type].inputs.length);
  const [source, setSource] = useState(edge?.source.nodeId ?? sources[0]?.id ?? ''),
    [port, setPort] = useState(
      edge?.source.port ?? NODE_REGISTRY[sources[0]?.type ?? 'note'].outputs[0]?.id ?? 'out',
    ),
    [target, setTarget] = useState(edge?.target.nodeId ?? targets[0]?.id ?? ''),
    [error, setError] = useState('');
  const errorSummary = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (error) errorSummary.current?.focus();
  }, [error]);
  const outputs =
    NODE_REGISTRY[document.nodes.find((n) => n.id === source)?.type ?? 'note'].outputs;
  return (
    <Modal title={edge ? 'Edit connection' : 'Create connection'} onClose={() => close(null)}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (locked) return;
          const endpoints = edgeSchema.pick({ source: true, target: true }).safeParse({
            source: { nodeId: source, port },
            target: { nodeId: target, port: 'in' },
          });
          if (!endpoints.success) {
            setError('Choose source, output port and target input.');
            return;
          }
          const result = dispatch(
            sessionId,
            edge
              ? { type: 'ReconnectEdge', edgeId: edge.id, ...endpoints.data }
              : { type: 'CreateEdge', ...endpoints.data },
          );
          if (result.ok) {
            announce(edge ? 'Connection updated.' : 'Connection created.');
            close(null);
          } else setError(errorMessage(result.error));
        }}
      >
        <label>
          Source node
          <select
            aria-describedby={error ? 'connection-error' : undefined}
            value={source}
            onChange={(e) => {
              const id = e.target.value;
              setSource(id);
              const type = document.nodes.find((n) => n.id === id)?.type;
              const next = type ? NODE_REGISTRY[type].outputs[0]?.id : undefined;
              setPort(next === 'true' || next === 'false' ? next : 'out');
            }}
          >
            {sources.map((n) => (
              <option key={n.id} value={n.id}>
                {n.label} · {n.id.slice(-4)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Source output
          <select
            aria-describedby={error ? 'connection-error' : undefined}
            value={port}
            onChange={(e) => {
              const v = e.target.value;
              if (v === 'out' || v === 'true' || v === 'false') setPort(v);
            }}
          >
            {outputs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id}
              </option>
            ))}
          </select>
        </label>
        <label>
          Target node
          <select
            aria-describedby={error ? 'connection-error' : undefined}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          >
            {targets.map((n) => (
              <option key={n.id} value={n.id}>
                {n.label} · {n.id.slice(-4)}
              </option>
            ))}
          </select>
        </label>
        <p>Target port: in. Each input accepts one connection.</p>
        {error && (
          <p id="connection-error" ref={errorSummary} role="alert" tabIndex={-1}>
            {error}
          </p>
        )}
        <Button
          type="submit"
          disabled={locked}
          title={locked ? 'Stop execution before editing connections' : undefined}
        >
          {edge ? 'Apply connection' : 'Connect'}
        </Button>
      </form>
    </Modal>
  );
}
