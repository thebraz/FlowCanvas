import { Play, PencilSimple, Funnel, GitBranch, Tray, Note } from '@phosphor-icons/react';
import type { NodeType, WorkflowNode } from '../contracts/workflow';
export const NODE_ICONS = {
  manualTrigger: Play,
  setField: PencilSimple,
  pickFields: Funnel,
  condition: GitBranch,
  output: Tray,
  note: Note,
} satisfies Record<NodeType, typeof Play>;
export function nodeSummary(node: WorkflowNode): string {
  if (node.config === null) return 'Needs configuration';
  switch (node.type) {
    case 'manualTrigger':
      return `${Object.keys(node.config.payload).length} input fields`;
    case 'setField':
      return `Set ${node.config.path.join(' › ')}`;
    case 'pickFields':
      return `Keep ${node.config.paths.length} paths · ${node.config.missing}`;
    case 'condition':
      return `${node.config.path.join(' › ')} ${node.config.operator}`;
    case 'output':
      return node.config.name;
    case 'note':
      return node.config.text;
  }
}
