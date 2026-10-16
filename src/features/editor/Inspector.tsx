import { useCallback, useEffect, useState } from 'react';
import { useAppStore } from '../../state/context';
import { NODE_REGISTRY, type WorkflowNode } from '../../contracts/workflow';
import { LIMITS } from '../../contracts/limits';
import { Region, Button } from '../../ui/primitives';
import { parseSafeJson } from '../../validation/subgraph';
import { nodeSchema } from '../../validation/schemas';
import { errorMessage } from '../../ui/messages';
import { SelectionActions } from './SelectionActions';
import { isActiveRun } from '../../contracts/execution';
export { boundedPreview } from '../../ui/bounded-preview';
const EXAMPLES: Record<WorkflowNode['type'], string> = {
  manualTrigger: '{"payload":{"customer":{"tier":"gold"}}}',
  setField: '{"path":["reviewed"],"value":true}',
  pickFields: '{"paths":[["customer"],["reviewed"]],"missing":"omit"}',
  condition: '{"path":["customer","tier"],"operator":"eq","value":"gold"}',
  output: '{"name":"Result"}',
  note: '{"text":"Plain text annotation"}',
};
function fieldMessage(path: readonly PropertyKey[]): string {
  const field = path.map(String).join('.');
  const rule = field.startsWith('position')
    ? 'Use finite coordinates between -100000 and 100000.'
    : field === 'label' || field === 'config.name'
      ? 'Use 1–120 characters without surrounding whitespace or control characters.'
      : field.startsWith('config.payload')
        ? 'Payload must be a JSON object within the payload limits.'
        : field.startsWith('config.path')
          ? 'Use literal key arrays with 1–16 safe segments. Pick paths must be unique and nonoverlapping.'
          : field === 'config.value'
            ? 'The value must match the selected operator: primitive for eq/neq, number for numeric comparisons, string for contains.'
            : field === 'config.operator'
              ? 'Choose a supported operator shown in Configuration format.'
              : field === 'config.text'
                ? 'Use plain text up to 10000 characters, with no unsupported control characters.'
                : 'Use only the complete fields shown in Configuration format; no extra or missing fields.';
  return `${field || 'Configuration'}: ${rule}`;
}
function NodeForm({ node }: { readonly node: WorkflowNode }) {
  const locked = useAppStore((s) => isActiveRun(s.runtime.status)) && node.type !== 'note';
  const [label, setLabel] = useState(node.label),
    [x, setX] = useState(String(node.position.x)),
    [y, setY] = useState(String(node.position.y)),
    [text, setText] = useState(JSON.stringify(node.config, null, 2)),
    [accent, setAccent] = useState(node.presentation?.accent ?? 'neutral'),
    [attempted, setAttempted] = useState(false);
  const sessionId = useAppStore((s) => s.session.sessionId),
    transaction = useAppStore((s) => s.transaction),
    setDraft = useAppStore((s) => s.setDraft),
    showModal = useAppStore((s) => s.showModal);
  const dirty =
    label !== node.label ||
    x !== String(node.position.x) ||
    y !== String(node.position.y) ||
    text !== JSON.stringify(node.config, null, 2) ||
    accent !== (node.presentation?.accent ?? 'neutral');
  const parsed = parseSafeJson(text, LIMITS.MAX_PAYLOAD_BYTES + 4096);
  const checked = parsed.ok
    ? nodeSchema.safeParse({
        ...node,
        label: label.trim(),
        position: { x: x.trim() === '' ? NaN : Number(x), y: y.trim() === '' ? NaN : Number(y) },
        config: parsed.value,
        presentation: { accent },
      })
    : null;
  const issues =
    checked && !checked.success
      ? checked.error.issues.map((i) => fieldMessage(i.path)).slice(0, LIMITS.MAX_VALIDATION_ISSUES)
      : [];
  const valid = parsed.ok && checked?.success === true;
  const apply = useCallback(() => {
    setAttempted(true);
    const json = parseSafeJson(text, LIMITS.MAX_PAYLOAD_BYTES + 4096);
    if (!json.ok) return false;
    const intents: unknown[] = [];
    if (label.trim() !== node.label)
      intents.push({ type: 'RenameNode', nodeId: node.id, label: label.trim() });
    if (Number(x) !== node.position.x || Number(y) !== node.position.y)
      intents.push({
        type: 'MoveNodes',
        moves: [
          {
            nodeId: node.id,
            position: {
              x: x.trim() === '' ? NaN : Number(x),
              y: y.trim() === '' ? NaN : Number(y),
            },
          },
        ],
      });
    if (text !== JSON.stringify(node.config, null, 2))
      intents.push({ type: 'ChangeNodeConfig', nodeId: node.id, config: json.value });
    if (accent !== (node.presentation?.accent ?? 'neutral'))
      intents.push({ type: 'ChangePresentation', nodeId: node.id, presentation: { accent } });
    const result = transaction(sessionId, intents);
    if (!result.ok) return false;
    if (!result.value.changed) {
      setLabel(node.label);
      setX(String(node.position.x));
      setY(String(node.position.y));
      setText(JSON.stringify(node.config, null, 2));
      setAccent(node.presentation?.accent ?? 'neutral');
    }
    setDraft(false, null);
    return true;
  }, [transaction, sessionId, node, label, x, y, text, accent, setDraft]);
  useEffect(() => {
    setDraft(dirty, apply);
    return () => setDraft(false, null);
  }, [dirty, apply, setDraft]);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!apply()) document.getElementById('config-errors')?.focus();
      }}
    >
      <h3>{node.label}</h3>
      <span className="type-badge">{NODE_REGISTRY[node.type].title}</span>
      <p>
        {node.config === null
          ? 'Needs configuration'
          : node.type === 'note'
            ? 'Annotation · not executable'
            : 'Configured'}
      </p>
      <label>
        Node label
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          aria-invalid={attempted && issues.some((i) => i.startsWith('label'))}
          aria-describedby="config-errors"
        />
      </label>
      <div className="position-fields">
        <label>
          Position X
          <input
            type="number"
            value={x}
            onChange={(e) => setX(e.target.value)}
            aria-describedby="config-errors"
          />
        </label>
        <label>
          Position Y
          <input
            type="number"
            value={y}
            onChange={(e) => setY(e.target.value)}
            aria-describedby="config-errors"
          />
        </label>
      </div>
      <p className="muted">Position fields bypass grid snapping.</p>
      <label>
        Accent
        <select
          value={accent}
          onChange={(e) => {
            const v = e.target.value;
            if (v === 'neutral' || v === 'blue' || v === 'green' || v === 'amber' || v === 'red')
              setAccent(v);
          }}
        >
          {['neutral', 'blue', 'green', 'amber', 'red'].map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
      </label>
      <h3>Configuration</h3>
      <label htmlFor="node-config">Node configuration</label>
      <textarea
        disabled={locked}
        title={locked ? 'Stop execution before changing executable configuration' : undefined}
        id="node-config"
        className="config-preview"
        rows={10}
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
        aria-invalid={!valid}
        aria-describedby="config-help config-errors"
      />
      <details id="config-help">
        <summary>Configuration format</summary>
        <code>{EXAMPLES[node.type]}</code>
        <p>Paths are arrays of literal keys. No expressions or array indices.</p>
        {node.type === 'condition' && (
          <p>
            Operators: exists, notExists, eq, neq, gt, gte, lt, lte, contains. Omit value for
            exists/notExists.
          </p>
        )}
        {['setField', 'pickFields', 'condition'].includes(node.type) && (
          <p>Use null to keep an explicit draft.</p>
        )}
      </details>
      <div id="config-errors" tabIndex={-1} role={!valid ? 'alert' : undefined}>
        {!parsed.ok ? errorMessage(parsed.error) : issues.map((issue, i) => <p key={i}>{issue}</p>)}
      </div>
      <div className="action-row">
        <Button
          type="submit"
          disabled={!valid || !dirty || (locked && text !== JSON.stringify(node.config, null, 2))}
          title={
            !valid ? 'Review configuration errors' : !dirty ? 'No changes to apply' : undefined
          }
        >
          Apply
        </Button>
        <Button
          onClick={() => {
            setLabel(node.label);
            setX(String(node.position.x));
            setY(String(node.position.y));
            setText(JSON.stringify(node.config, null, 2));
            setAccent(node.presentation?.accent ?? 'neutral');
            setAttempted(false);
          }}
        >
          Cancel edits
        </Button>
      </div>
      <dl>
        <dt>Input ports</dt>
        <dd>{NODE_REGISTRY[node.type].inputs.map((p) => p.id).join(', ') || 'None'}</dd>
        <dt>Output ports</dt>
        <dd>{NODE_REGISTRY[node.type].outputs.map((p) => p.id).join(', ') || 'None'}</dd>
      </dl>
      <Button
        disabled={locked}
        title={locked ? 'Stop execution before editing connections' : undefined}
        onClick={() => showModal('connection')}
      >
        Manage connections
      </Button>
    </form>
  );
}
export function Inspector() {
  const draftEpoch = useAppStore((s) => s.draftEpoch);
  const selection = useAppStore((s) => s.selection),
    node = useAppStore((s) => s.session.document.nodes.find((n) => selection.has(n.id))),
    sessionId = useAppStore((s) => s.session.sessionId);
  return (
    <Region title="Properties" id="inspector-heading" className="inspector">
      {selection.size === 1 && node ? (
        <NodeForm
          key={`${sessionId}:${node.id}:${JSON.stringify(node)}:${draftEpoch}`}
          node={node}
        />
      ) : (
        <div className="empty-inspector">
          <h3>{selection.size ? `${selection.size} items selected` : 'Inspect a node'}</h3>
          <p>Select a canvas node or use the graph list to edit its configuration.</p>
        </div>
      )}
      <SelectionActions />
    </Region>
  );
}
