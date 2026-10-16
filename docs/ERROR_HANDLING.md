# Error handling

## Structured contract

```ts
type ErrorSeverity = 'info' | 'warning' | 'error' | 'fatal';
interface AppError {
  readonly code: string; // closed registry below, no arbitrary exception names
  readonly category: 'graph' | 'config' | 'import' | 'serialization' | 'persistence'
    | 'execution' | 'timeout' | 'resource' | 'version' | 'internal';
  readonly severity: ErrorSeverity;
  readonly messageKey: string; // stable catalog key, rendered as plain text
  readonly recoverable: boolean;
  readonly context: {
    readonly workflowId?: string; readonly nodeId?: string; readonly edgeId?: string;
    readonly runId?: string; readonly revision?: number;
    readonly limitName?: string; readonly actualCount?: number;
  };
  readonly issues?: readonly { readonly location: readonly string[]; readonly code: string }[];
}
```

Use a TypeScript literal union for `code` in implementation. The illustrative string annotation above abbreviates the registry, not permission to emit arbitrary codes. Error severity is UI/recovery urgency; issue severity Critical/High/Medium/Low in [quality gates](QUALITY_GATES.md) is release risk and is separate. Diagnostic locations render as text and may contain field keys; they MUST be omitted from logs by default. Native exception objects/stacks are never serialized into documents or worker messages.

## Registry and recovery

Every row requires a trigger test, user-message assertion, safe-state assertion, recovery test, and log-redaction test. Log policy M means redacted metadata only, once per action/run; N means no production console log (still visible inline). Messages below are English defaults.

| Category / codes | Severity / trigger | User message | Diagnostic / recovery / log |
| --- | --- | --- | --- |
| graph: GRAPH_INVALID, GRAPH_CYCLE, INVALID_PORT, INPUT_OCCUPIED, DUPLICATE_EDGE, DANGLING_REFERENCE | error; invariant violation | “This change would create an invalid workflow.” Use specific safe reason for port/cycle/capacity | Entity IDs and reason; reject whole command/import, focus diagnostic; N |
| config: CONFIG_INVALID, PATH_INVALID | error; strict config/path violation | “Review the highlighted configuration fields.” | Bounded locations/reason; preserve draft, block Apply/readiness only where relevant; N |
| import: IMPORT_SYNTAX, IMPORT_INVALID, IMPORT_DUPLICATE_KEY | error; malformed bytes/shape | “This file is not a valid FlowCanvas workflow.” | Safe counts/reason, not bytes/filename; retain current document, choose another file; M |
| serialization: SERIALIZATION_INVALID | error; invalid internal JSON/canonical output | “This workflow could not be exported or saved safely.” | Validation code/entity ID; retain memory, block write/export, investigate; M |
| persistence: STORAGE_UNAVAILABLE, STORAGE_QUOTA, SAVE_FAILED | error; permission/quota/transaction failure | “Changes are not saved. Retry or export a copy.” | Browser failure class only; retain dirty/latest data, retry/export/memory-only; M |
| persistence: PERSISTENCE_CONFLICT | warning; CAS revision mismatch/missing update target | “This workflow changed in another tab. Choose how to preserve your changes.” | Expected/current revision, no payload; halt queue, reload or Save as New/export; M |
| persistence: STORAGE_CORRUPT, MIGRATION_FAILED | error; checksum/schema/migration failure | “This saved workflow needs recovery. The original has been preserved.” | Hash-match boolean/version, not content; verified backup as new/export raw; M |
| execution: MISSING_FIELD, PATH_TYPE, TYPE_MISMATCH, NODE_FAILED | error; activated operation cannot produce valid output | “A node could not process its input. Inspect its configuration and input.” | Node/run ID and code; fail fast, label partial results, edit/rerun; M |
| execution: WORKER_PROTOCOL, WORKER_FAILED | error; malformed current-run message or worker crash | “Execution stopped unexpectedly. Your workflow is unchanged.” | Protocol version/sequence/code; terminate worker, Reset/rerun; M |
| execution: INVALID_TRANSITION, STALE_SESSION | warning; disallowed control/stale editor intent | “This action is no longer available.” | State/identity only; no mutation, refresh current controls; N |
| timeout: OPERATION_TIMEOUT, RUN_TIMEOUT | error; host deadline exceeded | “Execution exceeded its time limit and was stopped.” | Node/run ID, duration, limit name; terminate and preserve partial view; M |
| resource: RESOURCE_LIMIT | error; any shared ceiling breached | “This operation exceeds the supported limit.” | Named limit, numeric measured count and ceiling; reject import/command or fail run atomically; M |
| version: UNSUPPORTED_VERSION | error; document/envelope/protocol version unsupported | “This format version is not supported by this application.” | Numeric version only; preserve original, use compatible app; M |
| internal: INTERNAL_FAILURE | fatal for affected operation; unexpected invariant/exception | “Something went wrong. Your existing workflow has been preserved.” | Correlation ID and safe operation code; error boundary/reload/export valid data; M |

Informational lifecycle statuses `RUN_CANCELLED`, `NODE_SKIPPED`, `NO_OUTPUT_ACTIVATED`, `HISTORY_TRUNCATED`, and `DIAGNOSTICS_TRUNCATED` are typed warnings/status events, not exceptions. Cancellation is a terminal state, never hidden as success. Stale worker traffic is silently discarded and counted locally rather than toast-spammed; malformed current-run traffic is WORKER_PROTOCOL.

## Routing and aggregation

Inline field errors belong to inspector/forms. Graph-readiness diagnostics belong to the graph diagnostics panel with entity focus actions. Import errors remain in the import dialog/banner; persistence failures remain in persistent save status/banner. Runtime errors belong to the current run panel; error toasts are supplementary. Unexpected rendering exceptions are caught by region boundaries and preserve the canonical session if valid.

Cap each validation result at 100 issue details with total/truncated indication. Aggregate repeats by code/entity/revision; do not flood notifications or live regions. Production errors must avoid raw exception messages, user strings, or payloads. Development diagnostics MAY include stack traces from synthetic data only and must not be shipped as automatic telemetry.

No catch-and-ignore, fake default payload, automatic document reset, partial graph command publication, or retry loop without bounds. Persistence retry is user initiated or a maximum of two transient retries at 250/1,000ms for clearly retryable aborted operations; never retry quota, corruption, validation, or CAS conflicts automatically. Each retry must use the current queue identity/revision and preserve at-most-one in-flight save.

## Verification

Force each category with synthetic fixtures and injected boundary failures, then verify visible recovery and unchanged protected state. Test hostile text in error locations, duplicate async rejection handling, log canaries, bounded issue aggregation, and that failures do not produce unhandled promise rejections. [Testing](TESTING_STRATEGY.md) assigns concrete suite requirements; [persistence](PERSISTENCE.md) and [execution](EXECUTION_MODEL.md) own subsystem transitions.
