# Canonical workflow schema

## Document shape

Schema version 1 is the first planned format; no earlier released format exists. The following interfaces specify serialized data, not renderer objects or implementation source. Configuration types are defined completely in [node contracts](NODE_CONTRACTS.md); JSON/path/ID limits belong to [data](DATA_CONTRACT.md).

```ts
interface WorkflowMetadata {
  readonly title: string;
  readonly description: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}
interface Position { readonly x: number; readonly y: number }
interface Viewport extends Position { readonly zoom: number }
interface Presentation {
  readonly accent?: 'neutral' | 'blue' | 'green' | 'amber' | 'red';
}
interface NodeBase<T extends string, C> {
  readonly id: string;
  readonly type: T;
  readonly label: string;
  readonly position: Position;
  readonly config: C;
  readonly presentation?: Presentation;
}
type WorkflowNode =
  | NodeBase<'manualTrigger', TriggerConfig>
  | NodeBase<'setField', SetFieldConfig | null>
  | NodeBase<'pickFields', PickFieldsConfig | null>
  | NodeBase<'condition', ConditionConfig | null>
  | NodeBase<'output', OutputConfig>
  | NodeBase<'note', NoteConfig>;
type SourcePort = 'out' | 'true' | 'false';
type TargetPort = 'in';
interface WorkflowEdge {
  readonly id: string;
  readonly source: { readonly nodeId: string; readonly port: SourcePort };
  readonly target: { readonly nodeId: string; readonly port: TargetPort };
}
interface WorkflowDocument {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly metadata: WorkflowMetadata;
  readonly nodes: readonly WorkflowNode[];
  readonly edges: readonly WorkflowEdge[];
  readonly viewport: Viewport;
}
```

No runtime state, selection, renderer dimensions, history, storage revisions, error objects, or run IDs appear in this format. Viewport is persistent presentation, never executable data. Theme/grid/panel preferences belong to application settings, not this document. IDs are stable across edits, undo, export, and load; creating/duplicating/importing a separate workflow assigns identities according to [commands](GRAPH_COMMANDS.md) and [persistence](PERSISTENCE.md).

Compact export and the optional readable export share exactly this schema and ID/key/array ordering. The readable variant changes whitespace only as specified by [data](DATA_CONTRACT.md); it introduces no fields, version or identity changes.

## Port registry and invariants

| Node type | Inputs | Outputs | Executable |
| --- | --- | --- | --- |
| manualTrigger | none | `out: JsonObject` | yes |
| setField | `in: JsonObject`, capacity 1 | `out: JsonObject` | yes |
| pickFields | `in: JsonObject`, capacity 1 | `out: JsonObject` | yes |
| condition | `in: JsonObject`, capacity 1 | `true: JsonObject`, `false: JsonObject` | yes |
| output | `in: JsonObject`, capacity 1 | none | yes |
| note | none | none | no |

- Document, node, and edge IDs MUST be unique across all identity-bearing entities in that document, not just within their own arrays.
- Every edge MUST reference existing nodes and ports with source-output to target-input direction. No self-edge, dangling reference, Note connection, unsupported node type, or incompatible data kind.
- Each input accepts at most one edge. Outputs MAY fan out. Duplicate edges with equivalent `(source node, source port, target node, target port)` are forbidden even with different IDs.
- The executable graph MUST be acyclic. No implicit joins or data-stream merging. The single-input rule intentionally also forbids convergence of Condition branches into one downstream node. Users must use separate Output branches.
- Each configuration MUST match its node type. `null` is the only explicit draft marker for Set Field, Pick Fields, or Condition; arbitrary partial objects are invalid. Editor form drafts live outside the document until valid Apply.
- Node order in arrays has no execution significance; canonical export sorts IDs. Position/presentation must meet bounded schemas. Graph IDs are not display labels.

## Three validation levels

**Boundary shape:** byte/depth/value limits, supported version, strict field schemas, ID/timestamp/coordinate rules, JSON safety, and configuration union. Failure rejects the document.

**Structural validity:** identity uniqueness, endpoints, ports, capacities, duplicates, and acyclicity. Failure rejects imports/storage hydration and rejects a command atomically. No recovery editor or automatic repair is supplied in beta. Preserve the original file/record and show an error.

**Execution readiness:** computed diagnostics over a structurally valid document. An empty document, missing roots, or draft configuration remains editable. A run requires at least one Manual Trigger, at least one statically reachable Output, and non-null valid configurations for every node reachable from any trigger. Missing-input/unconfigured nodes outside trigger reachability produce warnings and will be skipped as unreachable. A reachable node cannot have missing input under the port/topology rules. A branch without an Output is a warning, not a structural error. These distinctions MUST be visible in the inspector and Run-disabled explanation. The aggregate readiness result MUST account for all diagnostics, independently of the capped visible list. When that list is full, blocking errors replace retained warnings; the unchanged issue budget and truncation count still apply. An invalid readiness result MUST invoke zero operations.

## Zod requirements

Use strict object schemas at every fixed-contract object, a literal `schemaVersion`, discriminated union by node `type`, exact source/target endpoint schemas, enum ports, bounded arrays, finite numeric refinements, strict config unions, and timestamp/UUID refinements. No `coerce`, permissive passthrough, unknown-field stripping, or schema defaults during import. Generic payload object keys are allowed only after DATA_CONTRACT validation. Shared configuration schemas MUST be used by inspector Apply, import, storage hydration, and compilation.

Graph-wide checks MUST return bounded diagnostics with node/edge references and stable codes rather than encoding graph algorithms inside opaque schema transformations. Collect at most 100 issues per validation call and report a total/truncation marker. Boundary validation may stop early on resource breaches. Type inference MUST not widen discriminants or erase nullable draft distinctions.

The Stage 1 boundary result is `{ok:true,value}` or `{ok:false,error,diagnostics?}`. Multi-issue failures include `diagnostics:{total,truncated}` and at most MAX_VALIDATION_ISSUES details in `error.issues`; resource preflight failures may stop immediately with a named limit/count. This metadata is never part of WorkflowDocument. Shape-only validation is an internal command boundary for changes that cannot affect topology; full validation remains mandatory for all external document entry points.

## Minimal valid editable document

```json
{
  "schemaVersion": 1,
  "id": "00000000-0000-4000-8000-000000000001",
  "metadata": {
    "title": "Untitled workflow",
    "description": "",
    "createdAt": "2026-10-15T12:00:00.000Z",
    "updatedAt": "2026-10-15T12:00:00.000Z"
  },
  "nodes": [],
  "edges": [],
  "viewport": { "x": 0, "y": 0, "zoom": 1 }
}
```

This imports successfully but is not runnable. Unknown versions are unsupported, never interpreted as version 1. Backward evolution is specified in [persistence](PERSISTENCE.md): migrations are explicit, ordered, pure, validated, and nondestructive on failure. Adding persisted fields or changing semantics requires a schema/version decision; optional fields are not a loophole for silently breaking strict old readers.
