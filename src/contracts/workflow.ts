export type GraphId = string; // Refined to canonical UUID v4 at every boundary.
export type JsonPrimitive = null | boolean | number | string;
export type JsonValue = JsonPrimitive | readonly JsonValue[] | JsonObject;
export interface JsonObject {
  readonly [key: string]: JsonValue;
}
export type FieldPath = readonly string[];
export interface Position {
  readonly x: number;
  readonly y: number;
}
export interface Viewport extends Position {
  readonly zoom: number;
}
export interface WorkflowMetadata {
  readonly title: string;
  readonly description: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}
export interface Presentation {
  readonly accent?: 'neutral' | 'blue' | 'green' | 'amber' | 'red';
}
export interface TriggerConfig {
  readonly payload: JsonObject;
}
export interface SetFieldConfig {
  readonly path: FieldPath;
  readonly value: JsonValue;
}
export interface PickFieldsConfig {
  readonly paths: readonly FieldPath[];
  readonly missing: 'omit' | 'error';
}
export type ConditionConfig =
  | { readonly path: FieldPath; readonly operator: 'exists' | 'notExists' }
  | { readonly path: FieldPath; readonly operator: 'eq' | 'neq'; readonly value: JsonPrimitive }
  | {
      readonly path: FieldPath;
      readonly operator: 'gt' | 'gte' | 'lt' | 'lte';
      readonly value: number;
    }
  | { readonly path: FieldPath; readonly operator: 'contains'; readonly value: string };
export interface OutputConfig {
  readonly name: string;
}
export interface NoteConfig {
  readonly text: string;
}
export interface NodeBase<T extends string, C> {
  readonly id: GraphId;
  readonly type: T;
  readonly label: string;
  readonly position: Position;
  readonly config: C;
  readonly presentation?: Presentation;
}
export type WorkflowNode =
  | NodeBase<'manualTrigger', TriggerConfig>
  | NodeBase<'setField', SetFieldConfig | null>
  | NodeBase<'pickFields', PickFieldsConfig | null>
  | NodeBase<'condition', ConditionConfig | null>
  | NodeBase<'output', OutputConfig>
  | NodeBase<'note', NoteConfig>;
export type NodeType = WorkflowNode['type'];
export type SourcePort = 'out' | 'true' | 'false';
export type TargetPort = 'in';
export interface WorkflowEdge {
  readonly id: GraphId;
  readonly source: { readonly nodeId: GraphId; readonly port: SourcePort };
  readonly target: { readonly nodeId: GraphId; readonly port: TargetPort };
}
export interface WorkflowDocument {
  readonly schemaVersion: 1;
  readonly id: GraphId;
  readonly metadata: WorkflowMetadata;
  readonly nodes: readonly WorkflowNode[];
  readonly edges: readonly WorkflowEdge[];
  readonly viewport: Viewport;
}
export interface PortDefinition {
  readonly id: SourcePort | TargetPort;
  readonly direction: 'input' | 'output';
  readonly kind: 'JsonObject';
  readonly capacity: 1 | 'many';
}
const input: PortDefinition = { id: 'in', direction: 'input', kind: 'JsonObject', capacity: 1 };
const output: PortDefinition = {
  id: 'out',
  direction: 'output',
  kind: 'JsonObject',
  capacity: 'many',
};
export const NODE_REGISTRY: Readonly<
  Record<
    NodeType,
    {
      readonly title: string;
      readonly description: string;
      readonly executable: boolean;
      readonly inputs: readonly PortDefinition[];
      readonly outputs: readonly PortDefinition[];
    }
  >
> = {
  manualTrigger: {
    title: 'Manual Trigger',
    description: 'Starts with a JSON object',
    executable: true,
    inputs: [],
    outputs: [output],
  },
  setField: {
    title: 'Set Field',
    description: 'Assigns a constant at a literal path',
    executable: true,
    inputs: [input],
    outputs: [output],
  },
  pickFields: {
    title: 'Pick Fields',
    description: 'Keeps selected nested fields',
    executable: true,
    inputs: [input],
    outputs: [output],
  },
  condition: {
    title: 'Condition',
    description: 'Routes to True or False',
    executable: true,
    inputs: [input],
    outputs: [
      { ...output, id: 'true' },
      { ...output, id: 'false' },
    ],
  },
  output: {
    title: 'Output',
    description: 'Names a final result',
    executable: true,
    inputs: [input],
    outputs: [],
  },
  note: {
    title: 'Note',
    description: 'Plain text annotation; never executes',
    executable: false,
    inputs: [],
    outputs: [],
  },
};
export const NODE_TYPES: readonly NodeType[] = [
  'manualTrigger',
  'setField',
  'pickFields',
  'condition',
  'output',
  'note',
];
