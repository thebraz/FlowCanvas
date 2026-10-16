import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { NODE_REGISTRY } from '../../contracts/workflow';
import { NODE_ICONS, nodeSummary } from '../../ui/node-catalog';
import type { FlowNode } from './projection';
import { NodeStatus } from '../../features/execution/NodeStatus';
export const WorkflowNodeView = memo(function WorkflowNodeView({
  data,
  selected,
}: NodeProps<FlowNode>) {
  const { node } = data;
  const catalog = NODE_REGISTRY[node.type];
  const Icon = NODE_ICONS[node.type];
  return (
    <article
      className={`workflow-node ${node.type === 'note' ? 'note-node' : ''} ${selected ? 'is-selected' : ''}`}
      data-node-type={node.type}
    >
      <header>
        <span className="node-icon">
          <Icon size={18} aria-hidden="true" />
        </span>
        <strong title={node.label}>{node.label}</strong>
      </header>
      <p className="node-summary" title={nodeSummary(node)}>
        {nodeSummary(node)}
      </p>
      {node.config === null && <span className="draft-badge">Needs configuration</span>}
      {selected && <span className="selected-badge">Selected</span>}
      <NodeStatus nodeId={node.id} />
      {catalog.inputs.map((port) => (
        <Handle
          key={port.id}
          id={port.id}
          type="target"
          position={Position.Left}
          isConnectable
          role="img"
          aria-label={`${catalog.title} input ${port.id}`}
        />
      ))}
      {catalog.outputs.map((port, index) => (
        <Handle
          key={port.id}
          id={port.id}
          type="source"
          position={Position.Right}
          isConnectable
          role="img"
          style={{ top: catalog.outputs.length === 2 ? (index === 0 ? '38%' : '74%') : '50%' }}
          aria-label={`${catalog.title} output ${port.id}`}
        >
          {port.id !== 'out' && (
            <span className="port-label">{port.id === 'true' ? 'True' : 'False'}</span>
          )}
        </Handle>
      ))}
    </article>
  );
});
