import { failure, type Result } from '../../contracts/errors';
import type {
  NodeType,
  Position,
  Viewport,
  WorkflowDocument,
  WorkflowEdge,
  WorkflowNode,
  Presentation,
} from '../../contracts/workflow';
import {
  alignedMoves,
  entityIds,
  extractSubgraph,
  remapSubgraph,
  type AlignMode,
  type Subgraph,
} from './subgraph';
import { NODE_REGISTRY } from '../../contracts/workflow';
import { validateConnection } from './invariants';
import { canonicalDocument } from '../json/canonical';

export type GraphCommand =
  | {
      readonly type: 'CreateNode';
      readonly nodeType: NodeType;
      readonly position: Position;
      readonly config?: WorkflowNode['config'];
    }
  | { readonly type: 'DeleteNode'; readonly nodeId: string }
  | {
      readonly type: 'MoveNodes';
      readonly moves: readonly { readonly nodeId: string; readonly position: Position }[];
    }
  | {
      readonly type: 'ChangeNodeConfig';
      readonly nodeId: string;
      readonly config: WorkflowNode['config'];
    }
  | { readonly type: 'RenameNode'; readonly nodeId: string; readonly label: string }
  | {
      readonly type: 'ChangePresentation';
      readonly nodeId: string;
      readonly presentation: Presentation;
    }
  | { readonly type: 'RenameWorkflow'; readonly title: string; readonly description: string }
  | { readonly type: 'DuplicateNode'; readonly nodeId: string }
  | { readonly type: 'DuplicateSelection'; readonly nodeIds: readonly string[] }
  | { readonly type: 'PasteSubgraph'; readonly fragment: Subgraph; readonly offset: Position }
  | {
      readonly type: 'BulkDelete';
      readonly nodeIds: readonly string[];
      readonly edgeIds: readonly string[];
    }
  | { readonly type: 'AlignNodes'; readonly nodeIds: readonly string[]; readonly mode: AlignMode }
  | { readonly type: 'ClearWorkflow' }
  | {
      readonly type: 'CreateEdge';
      readonly source: WorkflowEdge['source'];
      readonly target: WorkflowEdge['target'];
    }
  | { readonly type: 'DeleteEdge'; readonly edgeId: string }
  | {
      readonly type: 'ReconnectEdge';
      readonly edgeId: string;
      readonly source: WorkflowEdge['source'];
      readonly target: WorkflowEdge['target'];
    }
  | { readonly type: 'SetViewport'; readonly viewport: Viewport };
export interface CommandPorts {
  readonly id: () => string;
  readonly now: () => string;
  readonly validate: (candidate: unknown) => Result<WorkflowDocument>;
  readonly validateShape: (candidate: unknown) => Result<WorkflowDocument>;
}
export interface CommandChange {
  readonly document: WorkflowDocument;
  readonly changed: boolean;
  readonly semantic: boolean;
  readonly topology: boolean;
  readonly history: boolean;
}
export function defaultNode(type: NodeType, id: string, position: Position): WorkflowNode {
  const base = { id, position, label: NODE_REGISTRY[type].title };
  switch (type) {
    case 'manualTrigger':
      return { ...base, type, config: { payload: {} } };
    case 'output':
      return { ...base, type, config: { name: 'Result' } };
    case 'note':
      return { ...base, type, config: { text: '' } };
    case 'setField':
    case 'pickFields':
    case 'condition':
      return { ...base, type, config: null };
  }
}
interface Candidate {
  readonly metadata: WorkflowDocument['metadata'];
  readonly nodes: readonly unknown[];
  readonly edges: readonly WorkflowEdge[];
  readonly viewport: Viewport;
  readonly semantic: boolean;
  readonly topology: boolean;
}
function candidate(
  document: WorkflowDocument,
  command: GraphCommand,
  ports: CommandPorts,
): Result<Candidate> {
  const base: Candidate = {
    metadata: document.metadata,
    nodes: document.nodes,
    edges: document.edges,
    viewport: document.viewport,
    semantic: false,
    topology: false,
  };
  switch (command.type) {
    case 'RenameWorkflow':
      return {
        ok: true,
        value: {
          ...base,
          metadata: {
            ...document.metadata,
            title: command.title,
            description: command.description,
          },
        },
      };
    case 'ClearWorkflow':
      return {
        ok: true,
        value: {
          ...base,
          nodes: [],
          edges: [],
          semantic: document.nodes.some((n) => n.type !== 'note'),
          topology: document.nodes.length > 0 || document.edges.length > 0,
        },
      };
    case 'BulkDelete': {
      const nodes = new Set(command.nodeIds),
        edges = new Set(command.edgeIds);
      if (
        nodes.size !== command.nodeIds.length ||
        edges.size !== command.edgeIds.length ||
        command.nodeIds.some((id) => !document.nodes.some((n) => n.id === id)) ||
        command.edgeIds.some((id) => !document.edges.some((e) => e.id === id))
      )
        return failure('DANGLING_REFERENCE', 'graph');
      return {
        ok: true,
        value: {
          ...base,
          nodes: document.nodes.filter((n) => !nodes.has(n.id)),
          edges: document.edges.filter(
            (e) => !edges.has(e.id) && !nodes.has(e.source.nodeId) && !nodes.has(e.target.nodeId),
          ),
          semantic:
            edges.size > 0 || document.nodes.some((n) => nodes.has(n.id) && n.type !== 'note'),
          topology: true,
        },
      };
    }
    case 'AlignNodes': {
      const selected = document.nodes.filter((n) => command.nodeIds.includes(n.id));
      if (selected.length < 2 || selected.length !== command.nodeIds.length)
        return failure('GRAPH_INVALID', 'graph');
      return candidate(
        document,
        { type: 'MoveNodes', moves: alignedMoves(selected, command.mode) },
        ports,
      );
    }
    case 'DuplicateNode':
    case 'DuplicateSelection':
    case 'PasteSubgraph': {
      const fragment =
        command.type === 'PasteSubgraph'
          ? { ok: true as const, value: command.fragment }
          : extractSubgraph(
              document,
              command.type === 'DuplicateNode' ? [command.nodeId] : command.nodeIds,
            );
      if (!fragment.ok) return fragment;
      const mapped = remapSubgraph(
        fragment.value,
        entityIds(document),
        ports.id,
        command.type === 'PasteSubgraph' ? command.offset : { x: 32, y: 32 },
      );
      if (!mapped.ok) return mapped;
      return {
        ok: true,
        value: {
          ...base,
          nodes: [...document.nodes, ...mapped.value.nodes],
          edges: [...document.edges, ...mapped.value.edges],
          semantic: mapped.value.nodes.some((n) => n.type !== 'note'),
          topology: true,
        },
      };
    }
    case 'CreateNode':
      return {
        ok: true,
        value: {
          ...base,
          nodes: [
            ...document.nodes,
            {
              ...defaultNode(command.nodeType, ports.id(), command.position),
              ...(command.config === undefined ? {} : { config: command.config }),
            },
          ],
          semantic: command.nodeType !== 'note',
          topology: true,
        },
      };
    case 'DeleteNode': {
      const node = document.nodes.find((node) => node.id === command.nodeId);
      if (!node) return failure('DANGLING_REFERENCE', 'graph');
      return {
        ok: true,
        value: {
          ...base,
          nodes: document.nodes.filter((node) => node.id !== command.nodeId),
          edges: document.edges.filter(
            (edge) =>
              edge.source.nodeId !== command.nodeId && edge.target.nodeId !== command.nodeId,
          ),
          semantic: node.type !== 'note',
          topology: true,
        },
      };
    }
    case 'MoveNodes': {
      const moves = new Map(command.moves.map((move) => [move.nodeId, move.position]));
      if (
        moves.size === 0 ||
        moves.size !== command.moves.length ||
        [...moves.keys()].some((id) => !document.nodes.some((node) => node.id === id))
      )
        return failure('GRAPH_INVALID', 'graph');
      return {
        ok: true,
        value: {
          ...base,
          nodes: document.nodes.map((node) => {
            const position = moves.get(node.id);
            return !position || (node.position.x === position.x && node.position.y === position.y)
              ? node
              : { ...node, position };
          }),
        },
      };
    }
    case 'ChangeNodeConfig':
    case 'ChangePresentation':
    case 'RenameNode': {
      const node = document.nodes.find((node) => node.id === command.nodeId);
      if (!node) return failure('DANGLING_REFERENCE', 'graph');
      return {
        ok: true,
        value: {
          ...base,
          nodes: document.nodes.map((existing) =>
            existing.id !== node.id
              ? existing
              : command.type === 'RenameNode'
                ? { ...existing, label: command.label }
                : command.type === 'ChangePresentation'
                  ? { ...existing, presentation: command.presentation }
                  : { ...existing, config: command.config },
          ),
          semantic: command.type === 'ChangeNodeConfig' && node.type !== 'note',
        },
      };
    }
    case 'CreateEdge':
    case 'ReconnectEdge': {
      const edge: WorkflowEdge = {
        id: command.type === 'CreateEdge' ? ports.id() : command.edgeId,
        source: command.source,
        target: command.target,
      };
      const valid = validateConnection(
        document,
        edge,
        command.type === 'ReconnectEdge' ? command.edgeId : undefined,
      );
      if (!valid.ok) return valid;
      return {
        ok: true,
        value: {
          ...base,
          edges:
            command.type === 'CreateEdge'
              ? [...document.edges, edge]
              : document.edges.map((old) => (old.id === edge.id ? edge : old)),
          semantic: true,
          topology: true,
        },
      };
    }
    case 'DeleteEdge': {
      if (!document.edges.some((edge) => edge.id === command.edgeId))
        return failure('DANGLING_REFERENCE', 'graph');
      return {
        ok: true,
        value: {
          ...base,
          edges: document.edges.filter((edge) => edge.id !== command.edgeId),
          semantic: true,
          topology: true,
        },
      };
    }
    case 'SetViewport':
      return { ok: true, value: { ...base, viewport: command.viewport } };
  }
}
export function reduceCommand(
  document: WorkflowDocument,
  command: GraphCommand,
  ports: CommandPorts,
): Result<CommandChange> {
  try {
    const proposed = candidate(document, command, ports);
    if (!proposed.ok) return proposed;
    const validate = proposed.value.topology ? ports.validate : ports.validateShape;
    const result = validate({
      ...document,
      metadata: proposed.value.metadata,
      nodes: proposed.value.nodes,
      edges: proposed.value.edges,
      viewport: proposed.value.viewport,
    });
    if (!result.ok) {
      if (
        (command.type === 'ChangeNodeConfig' || command.type === 'CreateNode') &&
        result.error.code === 'IMPORT_INVALID'
      ) {
        return {
          ...result,
          error: {
            ...result.error,
            code: 'CONFIG_INVALID',
            category: 'config',
            messageKey: 'CONFIG_INVALID',
          },
        };
      }
      return result;
    }
    const checked = result.value;
    // Comparing bounded canonical content makes repeated Apply/reconnect true no-ops.
    if (canonicalDocument(checked) === canonicalDocument(document))
      return {
        ok: true,
        value: { document, changed: false, semantic: false, topology: false, history: false },
      };
    const now = ports.now();
    const updatedAt = now > document.metadata.updatedAt ? now : document.metadata.updatedAt;
    const dated = ports.validateShape({ ...checked, metadata: { ...checked.metadata, updatedAt } });
    if (!dated.ok) return dated;
    const oldNodes = new Map(document.nodes.map((node) => [node.id, node]));
    const oldEdges = new Map(document.edges.map((edge) => [edge.id, edge]));
    const nodes = dated.value.nodes.map((node, i) =>
      proposed.value.nodes[i] === oldNodes.get(node.id) ? (oldNodes.get(node.id) ?? node) : node,
    );
    const edges = dated.value.edges.map((edge, i) =>
      proposed.value.edges[i] === oldEdges.get(edge.id) ? (oldEdges.get(edge.id) ?? edge) : edge,
    );
    const next = Object.freeze({
      ...dated.value,
      nodes: Object.freeze(nodes),
      edges: Object.freeze(edges),
    });
    return {
      ok: true,
      value: {
        document: next,
        changed: true,
        semantic: proposed.value.semantic,
        topology: proposed.value.topology,
        history: command.type !== 'SetViewport',
      },
    };
  } catch {
    return failure('INTERNAL_FAILURE', 'internal');
  }
}
