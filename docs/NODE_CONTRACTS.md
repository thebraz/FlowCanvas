# Initial node contracts

## Shared behavior

All executable nodes operate on one immutable root `JsonObject`, never streams. They execute at most once per run; ports and capacities are fixed by [graph schema](GRAPH_SCHEMA.md). Safe JSON and literal array paths follow [data](DATA_CONTRACT.md). Config objects are strict; no unknown fields, coercion, expression evaluation, or automatic defaults on import. A transform config may be `null` only as the documented editable draft marker.

Handlers receive validated config, optional typed input, and an execution context with run identity, cancellation signal, and budget accounting. They return an emitted-port map, a final Output result, or a structured error. The scheduler accepts sync or promise results uniformly and awaits one handler at a time. Side effects, network requests, mutation of inputs, random/time-based transformations, and console payload logging are prohibited.

## Manual Trigger (`manualTrigger`)

```ts
interface TriggerConfig { readonly payload: JsonObject }
```

Input: none. Output: `out`. Default on creation: `{payload:{}}`. Inspector creates input using a JSON text/tree editor with boundary validation; root arrays/scalars and invalid JSON cannot be applied. No separate hidden runtime override exists in beta.

At Run, every Manual Trigger emits its configured object once in deterministic plan order. A new run uses a fresh immutable snapshot; prior downstream operations cannot change the trigger. No automatic execution on load/edit. Errors: invalid root JSON/config, payload or run budget exceeded, cancellation. Example `{payload:{"ticket":7}}` emits `{"ticket":7}`. An empty object is valid. Two triggers start independent components; input-capacity rules prohibit merging their outputs.

## Set Field (`setField`)

```ts
interface SetFieldConfig { readonly path: FieldPath; readonly value: JsonValue }
```

Input: `in`. Output: `out`. Default config: null, requiring Apply. Set a constant value at the path using immutable copy-on-write. Create missing intermediate objects; preserve unrelated keys and arrays by safe immutable sharing. Replace an existing leaf value of any JSON type. An existing intermediate scalar, array, or null is PATH_TYPE; never replace it silently with an object. Every segment is a literal own-property key.

Example input `{"user":{"name":"Ana"},"active":false}`, config `{path:["user","tier"],value:"gold"}` -> `{"user":{"name":"Ana","tier":"gold"},"active":false}`. Input `{}` with path `["a","b"]` and value null -> `{"a":{"b":null}}`. Input `{"a":3}` for that path fails PATH_TYPE and leaves input unchanged. Path `["a.b"]` writes a literal `a.b` key. Empty/forbidden paths fail configuration validation. Large appended values may make the output exceed payload limits even when each config value was independently valid; fail RESOURCE_LIMIT atomically.

## Pick Fields (`pickFields`)

```ts
interface PickFieldsConfig {
  readonly paths: readonly FieldPath[];
  readonly missing: 'omit' | 'error';
}
```

Input: `in`. Output: `out`. Default config: null. `paths` accepts 1–64 unique nonoverlapping paths; selection of ancestor and descendant together is invalid. Build a new object preserving each selected path's nested shape. This is a projection, not flattening or renaming. Process paths in deterministic lexicographic segment order; this order cannot change meaning.

With input `{"user":{"name":"Ana","tier":"gold"},"count":2}`, paths `[["user","name"],["count"]]` -> `{"user":{"name":"Ana"},"count":2}`. Missing leaves or missing intermediate properties: `omit` skips the entire missing path; `error` fails MISSING_FIELD. Input `{"a":null}` and path `["a","b"]` fails PATH_TYPE under either policy. Present null is retained, never treated as missing. If all selected paths are absent under omit, output `{}`. Arrays can be picked as whole leaf values; no array indexing. Enforce output budgets before emitting.

## Condition (`condition`)

```ts
type ConditionConfig =
  | { readonly path: FieldPath; readonly operator: 'exists' | 'notExists' }
  | { readonly path: FieldPath; readonly operator: 'eq' | 'neq'; readonly value: JsonPrimitive }
  | { readonly path: FieldPath; readonly operator: 'gt' | 'gte' | 'lt' | 'lte'; readonly value: number }
  | { readonly path: FieldPath; readonly operator: 'contains'; readonly value: string };
```

Input: `in`. Outputs: `true`, `false`. Default config: null. Strict discriminated operator schemas reject irrelevant `value` for exists/notExists. Numeric operands must be finite. Exactly one output emits the unchanged input object; the other is inactive. A comparison error does not route false: it fails the run.

| Operator | Required field / behavior |
| --- | --- |
| exists / notExists | Own-property presence; present null counts as existing. Missing intermediate property means absent; wrong-type intermediate still fails PATH_TYPE |
| eq / neq | Primitive field only; strict primitive equality, no coercion. Different primitive types yield false/true respectively; null equals null; objects/arrays fail TYPE_MISMATCH |
| gt / gte / lt / lte | Both field and operand finite numbers; standard numeric comparison; strings fail TYPE_MISMATCH |
| contains | Both field and operand strings; case-sensitive substring comparison; empty operand matches every string |

Any nonexistence comparison with a missing field fails MISSING_FIELD. Unicode strings are compared as entered, with no normalization, locale, or numeric conversion. `{"age":18}` with path `["age"]`, operator gte, value 18 emits true. `{"age":"18"}` with the same config fails TYPE_MISMATCH. `eq` with numeric 18 against string `"18"` emits false. `{"x":null}` with exists emits true. For inactive paths, downstream nodes skip rather than receive `{}`, null, or the last run's value.

## Output (`output`)

```ts
interface OutputConfig { readonly name: string }
```

Input: `in`. Outputs: none. Default `{name:"Result"}`. Name is 1–120 code points under label rules. On activation, record one immutable result keyed by Output node ID, with display name, input payload reference, run ID, and deterministic sequence index. Duplicate display names are allowed because node IDs disambiguate them. Output does not stringify, flatten, download, or forward data automatically.

Example input `{"ok":true}` records that exact object. The UI provides bounded tree/text inspection and explicit JSON download on user action. No incoming activation means a skipped record and no result. Output itself creates no new transformed payload for cumulative produced-byte accounting; retention of the existing reference still counts toward retained unique bytes. Errors: invalid config, input invariant violation, retention budget breach, cancellation.

## Note (`note`)

```ts
interface NoteConfig { readonly text: string }
```

No inputs or outputs. Default `{text:""}`. Store bounded plain text; no Markdown/HTML/link execution. Notes appear in the canvas/list and participate in move/copy/delete/history/persistence. They are excluded from compilation scheduling, execution records, step budgets, reachability, and cycle semantics. Note edits do not invalidate run results. A connection involving a Note fails graph validation. Example `<script>alert(1)</script>` displays as literal text.

## Test matrix

Each node needs valid/default/empty/nested/null/missing/wrong-type cases, config-union rejection, immutable input assertions, relevant size boundaries, and stable results under repeated runs. Cross-node cases MUST include fan-out, two triggers, both Condition routes, inactive descendants, path errors, duplicate Output names, and a workflow containing only Notes. [Execution](EXECUTION_MODEL.md) defines scheduling/errors; [testing](TESTING_STRATEGY.md) defines suite ownership.
