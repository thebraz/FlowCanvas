# JSON data and resource contract

This file owns JSON compatibility, safe paths, byte accounting, and numeric resource ceilings. [Graph schema](GRAPH_SCHEMA.md) owns document shape; [nodes](NODE_CONTRACTS.md) owns transformations. All limits are initial design choices, not benchmark results. A change requires a decision and affected limit tests.

## JSON value model

```ts
type JsonPrimitive = null | boolean | number | string;
type JsonValue = JsonPrimitive | JsonValue[] | JsonObject;
interface JsonObject { readonly [key: string]: JsonValue }
type FieldPath = readonly string[];
```

Workflow operation inputs/outputs and Manual Trigger payloads MUST be JSON objects at the root. Nested arrays, primitives, and objects are allowed. Numbers MUST be finite IEEE-754 values; safe integers are recommended when exact integer meaning matters. `NaN`, infinities, `undefined`, bigint, functions, symbols, cycles, sparse arrays, class instances, Dates, Maps, Sets, accessors, and exotic prototypes are forbidden. Normalize negative zero to zero before canonical serialization. JSON does not promise exact arbitrary-precision decimal arithmetic.

For in-memory boundary objects, accept only plain objects with `Object.prototype` or null prototype, own enumerable string data properties, and dense arrays; inspect descriptors without invoking getters. Reject symbol/non-enumerable properties rather than silently dropping them. Internal payloads MUST be immutable by contract; tests/development SHOULD deep-freeze them. Object transformations copy affected paths and safely share unchanged subtrees. Runtime mutation of shared fan-out data is forbidden.

## Safe property access

- Recursively reject object keys and path segments exactly equal to `__proto__`, `prototype`, or `constructor`, at every depth. Reject lone Unicode surrogate code units; keep other valid Unicode as entered without case folding or normalization.
- Keys are nonempty strings of at most 128 Unicode code points. Read only own properties via `Object.hasOwn`; missing is a separate internal sentinel and MUST NOT serialize as undefined or null.
- Paths are arrays of 1–16 literal key segments. A dot inside a segment is an ordinary key, not syntax. No bracket syntax, path escape language, wildcard, expression evaluation, or array indices; ordinary JSON string escaping still applies to encoding each literal segment. Paths traverse objects only; arrays may be leaf values but never intermediate containers.
- An intermediate primitive, null, or array produces a path-type error. Missing intermediates may be created only by Set Field; Pick/Condition apply their explicit missing behavior.
- Duplicate paths and ancestor/descendant overlaps in a Pick Fields list are invalid. Compare literal segment arrays, not joined strings.

## Normative ceilings

MiB and KiB mean powers of 1024. Limits are inclusive; reject at limit + 1. Count UTF-8 bytes with `TextEncoder`, never JavaScript string length. Code-point limits count Unicode scalar values. Runtime and document validators MUST share named constants.

| Constant | Initial ceiling | Reason / enforcement boundary |
| --- | --- | --- |
| MAX_DOCUMENT_BYTES | 5 MiB | Raw import before read/parse, canonical document before command publication/save/export |
| MAX_NODES | 300 | Portfolio beta rendering and bounded graph work |
| MAX_EDGES | 600 | Coarse hostile-envelope cap before graph checks; legal single-input DAGs actually have fewer edges than executable nodes |
| MAX_DOCUMENT_DEPTH | 40 | Bounded lexical preflight and iterative parsed-document walk; document root depth 0 |
| MAX_VALUE_DEPTH | 32 | Each standalone payload/value root depth 0; also subject to the enclosing document depth |
| MAX_DOCUMENT_VALUES | 100,000 | Total visited JSON values in one document, including containers and scalar elements |
| MAX_PAYLOAD_VALUES | 20,000 | Values visited in each payload or configuration JSON value |
| MAX_ARRAY_LENGTH | 10,000 | Every array, including nested data arrays |
| MAX_STRING_BYTES | 64 KiB | Any JSON string value; smaller field-specific limits also apply |
| MAX_KEY_CODEPOINTS | 128 | Object property names and path segments |
| MAX_PATH_SEGMENTS | 16 | Bounded safe object-path transforms |
| MAX_PICK_PATHS | 64 | Bounded projection and path-conflict checks |
| MAX_PAYLOAD_BYTES | 256 KiB | Each input/output object and Set Field constant JSON value in canonical compact form |
| MAX_RUN_PAYLOAD_BYTES | 16 MiB | Sum of produced node-output payload bytes in a run; retained unique payload data cannot exceed this either |
| MAX_RUN_STEPS | 300 | Attempted executable node invocations; skips are not operations |
| MAX_OPERATION_MS | 1,000 ms | Host watchdog per invocation, including awaiting future async handlers |
| MAX_ACTIVE_RUN_MS | 30,000 ms | Active run time, including async waits, excluding pauses |
| MAX_RUN_WALL_MS | 600,000 ms | Entire run lifetime, including pauses; prevents abandoned workers |
| CANCEL_GRACE_MS | 100 ms | Cooperative cancellation acknowledgement before forced termination |
| CANCEL_COMPLETION_MS | 200 ms | Foreground supported-browser cancellation target from request to terminal UI |
| MAX_DIAGNOSTIC_EVENTS | 2,000 | Per-run metadata ring; report evicted-event count |
| MAX_DIAGNOSTIC_BYTES | 2 MiB | Per-run metadata ring, whichever bound is reached first |
| MAX_EVENT_BYTES | 1 KiB | Event metadata only; raw payloads never embedded |
| MAX_WORKER_START_BYTES | 6 MiB | Validated start envelope containing one bounded document snapshot |
| MAX_WORKER_RESULT_BYTES | 512 KiB | Each worker result/control envelope; payload records sent individually |
| MAX_INSPECTOR_PREVIEW_BYTES | 64 KiB | Lazy text/tree preview; show truncation and explicit download for full eligible data |
| MAX_HISTORY_TRANSACTIONS | 100 | Per active document; evict oldest whole transaction |
| MAX_HISTORY_BYTES | 16 MiB | Conservative canonical byte sum of unique snapshots retained across undo/redo |
| MAX_CLIPBOARD_BYTES | 1 MiB | Subgraph JSON before parse and after copy |
| MAX_STORED_DOCUMENTS | 100 | Local workflow library; no automatic document eviction |
| MAX_VALIDATION_ISSUES | 100 | Detailed issues per validation result, with total/truncation indicator |
| MAX_NOTIFICATIONS | 20 | UI notification queue; deduplicate routine status changes |
| MAX_SKIPS_BETWEEN_YIELDS | 32 | Worker task-queue yield interval in skipped regions for control responsiveness |

Node labels, Output names, and workflow titles: 1–120 code points, no control characters, no leading/trailing whitespace, and not whitespace-only. Inspector Apply MAY trim before constructing a command; import validation MUST reject untrimmed names rather than silently change them. Description: at most 2,000 code points. Note text: at most 10,000 code points. Description/Note may contain newlines/tabs; other C0/C1 control characters (U+0000–001F, U+007F–009F) are forbidden. The JSON string-byte cap still applies. Coordinates are finite and within [-100,000, 100,000]; zoom is finite within [0.25, 2]. IDs are lowercase canonical UUID v4 strings. Timestamps are normalized UTC ISO strings with milliseconds; `updatedAt >= createdAt`.

Resource caps may reject a document below 300 nodes due to payload size. Do not imply node count alone guarantees execution. Increase ceilings only with measured performance/security evidence and updated import/worker/storage tests. Lower-cap deployments require an explicit compatibility statement.

## Bounded decoding and canonical encoding

1. Check `File.size` or encoded clipboard/string size before allocation. Decode UTF-8 in fatal mode; one leading UTF-8 BOM MAY be removed. Reject trailing non-whitespace and non-JSON syntax.
2. Perform a bounded lexical scan before `JSON.parse`: count nesting/values, validate JSON string escapes sufficiently to compare decoded object keys, and reject duplicate keys in each object (including escaped equivalents). This scanner is not a second permissive parser: the standard parser still establishes grammar validity. Use an iterative stack; malformed input yields IMPORT_SYNTAX.
3. Parse as `unknown`; iteratively inspect JSON shape, descriptors, forbidden keys, scalar validity, and budgets before invoking recursive Zod schemas. No unbounded recursive validation before depth checks.
4. Apply strict versioned schemas and full structural graph validation. Readiness diagnostics are separate. Reject unsupported versions and unknown fields; never strip data silently.
5. For serialization, emit only canonical document fields, nodes/edges sorted by ASCII UUID, object keys sorted by Unicode code-point order, dense arrays in original order, and standard JSON primitive syntax. Emit ordered key/value pairs directly: constructing a sorted object then calling JSON.stringify is insufficient because integer-like keys may be reordered. Use compact UTF-8 without BOM/newline for canonical byte/hash accounting. A downloadable pretty variant MAY add whitespace but MUST remain within import limits; default export is compact.

No HTML encoding is needed inside JSON itself; values MUST subsequently be rendered as text. Canonicalization is project-defined, not a claim of implementing an external canonical-JSON standard. Canonical bytes feed SHA-256 integrity checks; checksums detect accidental corruption, not malicious authorship.

D-23's beta optimization uses an ASCII-only fast path for UTF-8 byte counting, with the original non-ASCII scalar fallback, and a Unicode-mode lone-surrogate check. It changes execution cost only; accepted values, canonical output, checksums, rejection order and every ceiling above remain unchanged.

The separate **Export readable JSON** option inserts only whitespace into validated canonical output: two spaces per nesting level, LF line breaks, and one space after each colon. Empty containers stay compact. Token/key order, array order and string escapes are preserved directly, including Unicode and integer-like property keys. This output is not used for hashes or persistence. Its complete UTF-8 size MUST also fit MAX_DOCUMENT_BYTES; reject an oversized readable variant without downloading or silently substituting compact output. The original compact export remains available and unchanged.

## Verification obligations

Test every numeric boundary at cap and cap + 1, UTF-8 multibyte sizes, escaped duplicate keys, lone surrogates, forbidden keys in nested arrays, getters that must never execute, inherited keys, negative zero, nonfinite internal values, sparse arrays, cycles, deep inputs, and encode/decode round trips. [Testing](TESTING_STRATEGY.md) assigns these cases to boundary, security, and browser suites.
