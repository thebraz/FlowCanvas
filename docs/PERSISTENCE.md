# Local persistence

## Storage model

Use native IndexedDB database `flowcanvas`, initial database version 1. Database version is independent of workflow schemaVersion and worker protocolVersion. Object stores:

| Store / key | Value and responsibility |
| --- | --- |
| documents / workflow ID | Validated envelope below; index by `document.metadata.updatedAt` for listing |
| backups / workflow ID | Last verified previous envelope, at most one per document |
| settings / literal setting key | Strict theme/grid/panel preferences and lastOpenedWorkflowId only |

```ts
interface StoredEnvelope {
  readonly envelopeVersion: 1;
  readonly storageRevision: number; // positive safe integer
  readonly canonicalBytes: number;
  readonly sha256: string; // lowercase hex, canonical document bytes
  readonly document: WorkflowDocument;
}
```

No editor/session revisions, history, run results, transient status, or worker data are serialized. Workflow listing reads and validates bounded metadata, not a second mutable graph authority; opening still validates the complete envelope/hash/document. Enforce MAX_STORED_DOCUMENTS from [data](DATA_CONTRACT.md), counting existing records within the creation transaction so concurrent tabs cannot exceed the cap. Attempted creation beyond this cap offers explicit deletion/export, never eviction. Backup storage can approximately double document storage and remains subject to browser quota.

Stage 2 implements this database through the native adapter and one active-session save coordinator. Literal setting `preferences` contains strict `{theme, grid, minimap, leftWidth, rightWidth}` values; Stage 3 adds `executionHeight` (integer >=180, rendered at most 50vh) and `executionExpanded` (boolean). Existing records default to 280 and false, then the successful settings transaction stores the complete preferences. An older Stage 2 build rejects the additional preference keys and reports unavailable preferences; workflow records and envelopes are unaffected. `lastOpenedWorkflowId` contains one validated UUID. Settings do not enter workflow JSON. Listing releases each full cursor record after extracting bounded metadata and its storage revision; full verification is required on open/recovery/save. Envelope validation permits exactly the fixed wrapper's additional nesting/value/byte overhead, then independently reapplies all unchanged document budgets. This is not an increase to document limits. CAS compares verified canonical content and envelope fields, so property insertion order cannot manufacture a conflict. Synchronous exceptions inside request callbacks abort the transaction and retain their safe error classification.

Stage 1 has no workflow persistence adapter. D-17 permits only the validated literal theme preference (`system`, `dark`, `light`) at localStorage key `flowcanvas.theme.v1` so initial theme support survives reload without prematurely building Stage 2 IndexedDB. Stage 2 MUST migrate that preference into the settings store after a successful settings transaction and remove the legacy key only after success. An absent preference uses Dark as specified by UI_UX_SPEC; invalid/denied reads use System; denied writes are explicitly reported. This exception cannot store graph data or claim Saved status.

Checksum mismatch or invalid envelope/document means corruption, not automatic repair. Preserve the record and offer explicit recovery from a verified backup as a new workflow, or export raw record for local troubleshooting with a privacy warning. Never overwrite either copy on failed hydration.

Raw-record export is available only if the stored value can be encoded as bounded safe JSON under DATA_CONTRACT. A cyclic, oversized, or otherwise unsafe record stays preserved in IndexedDB with export unavailable and an explanatory error; never execute accessors, truncate it silently, or claim that a diagnostic summary is a complete backup.

## Save state and ordering

States: `clean`, `dirty`, `saving`, `saved`, `error`, `conflict`, `memory-only`. A fresh unsaved document is dirty. Display Saved only after the IndexedDB transaction's completion event, not an individual put request. `saved` may display a timestamp; `clean` is the equivalent hydrated state before edits.

Autosave debounces committed persistent changes by 500 ms, with a maximum 2,000 ms wait during continuous editing. These are scheduling policies, not guarantees under browser suspension. Explicit Save bypasses the debounce and awaits completion. Drag overlays/form drafts are never saved. Settled viewport changes use the same queue but no history.

Per document, allow one in-flight save and at most one coalesced latest pending immutable snapshot. A captured task carries workflow ID, sessionId, documentRevision, and expected base storageRevision. Compute canonical bytes, checksum, full validation, and size BEFORE opening the readwrite transaction. Do not await crypto or unrelated promises inside an active IndexedDB transaction.

Within one `documents` + `backups` readwrite transaction:

1. Read current envelope. For initial creation require absence and expected revision null. For update require exact matching expected storageRevision.
2. On mismatch/missing update target, abort with PERSISTENCE_CONFLICT; never upsert a deleted record accidentally.
3. Put the previous envelope into backups only if it was previously fully verified, its document ID matches the object-store workflow key, and it matches the base revision/hash. A valid foreign document under the wrong key is corruption even if its checksum is correct. Preserve both original and backup and abort with STORAGE_CORRUPT; require a safe load rather than copying corrupt content over a backup.
4. Put the new envelope at revision previous + 1 (or 1 for create); commit atomically.
5. Only transaction completion advances the queue's base revision. Next queued save uses that acknowledged revision, not the stale revision captured before the preceding save.

Application acknowledgements are session/revision scoped. If revision 9 finishes while revision 10 is dirty, retain dirty/saving status. Do not allow a slower earlier serialization task to enqueue after a newer task: serialize tasks per document or discard obsolete captured revisions before submission. Failed saves retain the latest canonical in-memory document and dirty flag; no automatic rollback.

## Multi-tab conflict prevention

IndexedDB compare-and-swap inside a readwrite transaction is the correctness mechanism. Optional BroadcastChannel messages contain workflow ID + storageRevision only and may warn another tab; they are not a lock. Two tabs writing the same base revision cannot both succeed. On conflict halt that document's queue and offer reload verified current record, export unsaved copy, or Save as New with fresh workflow/entity IDs. No automatic merge or last-writer-wins overwrite. Reload requires explicit resolution of unsaved work.

Delete is explicit, confirmed by workflow name, and atomic across document/backup and last-opened setting when relevant. First cancel/resolve that document's pending queue and await an in-flight write; then delete with expected revision. A stale tab's subsequent save must fail on absence, not resurrect the workflow. Undo does not restore deleted workflows; advise export before deletion.

Deleting another workflow must not cancel the active workflow's autosave. A failed active-workflow deletion restores scheduling for retained dirty content unless saving is halted or memory-only. Save as New captures the source session and document before awaiting an in-flight save; if either changes before copying, reject STALE_SESSION and retain the newer active content. These Stage 4 guards preserve the existing queue/CAS contract without changing stored formats (D-22).

## Switching, closing, and recovery

- Before switching, resolve inspector drafts, flush committed content, and await save. On failure keep the current document until the user explicitly chooses export, retry, or continue with an unsaved-loss warning. Load/validate the replacement before swapping sessions.
- Set lastOpenedWorkflowId only after a successful verified open or committed new-document creation. On startup, missing/deleted/corrupt last-opened records show workflow management/recovery; never create a blank document over the old key.
- `visibilitychange`/`pagehide` MAY request an early flush; unload cannot guarantee asynchronous completion. Warn about unsaved changes where browser behavior permits, and show persistent error status. Browser termination may lose edits since the last completed transaction.
- Handle blocked upgrades and `versionchange` by closing the connection, suspending saves, and requesting other tabs close/reload. Do not delete the database as a repair technique.
- Quota/permission/eviction/private-mode errors preserve in-memory edits, allow explicit JSON export, and offer retry or memory-only mode. Never delete unrelated documents automatically to make room. Saved is transaction-level browser acceptance, not a guarantee against OS failure or later eviction.

These transaction/unload constraints follow [IndexedDB guidance](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB); queue/CAS/backup behavior is FlowCanvas policy.

## Import/export and migration

Import always validates in isolation and creates a new local workflow, assigning a new workflow ID and fresh node/edge IDs while preserving content/topology via the order-preserving remap in [commands](GRAPH_COMMANDS.md). Relative executable-node and Output order therefore survives import despite fresh identities. Show the title with an imported-copy suffix if needed, truncating the title by code point to keep the name limit; reset createdAt/updatedAt to import time. It never overwrites a same-ID existing workflow. A rejected import leaves active session, history, and storage unchanged. Require successful creation transaction before switching to the imported workflow; offer explicit memory-only opening on storage failure.

Export serializes the committed canonical document, including its current IDs and settled viewport, after full validation. It excludes uncommitted inspector drafts and runtime data; explain pending drafts before export. Revoke temporary download URLs. Exporting does not claim the browser saved to a user-selected path or mark IndexedDB state Saved.

**Export JSON** remains the compact canonical default. **Export readable JSON** is a separate option in the editor toolbar and saved-workflow manager, with two-space indentation and LF line breaks per [data](DATA_CONTRACT.md). Both exports share validation, draft resolution, download cleanup and import compatibility. Readable output preserves canonical token order and must fit the unchanged raw import byte limit; if formatting exceeds it, show an error and retain the compact option. IndexedDB envelopes, canonicalBytes and SHA-256 continue to use the original compact serialization exclusively.

Version 1 has no migration from an earlier release. Future migrations MUST be explicit `vN -> vN+1` pure transformations, use known historical schemas, validate before/after, retain a verified pre-migration backup, and commit atomically using CAS. Unsupported newer versions fail closed without downgrade. Changing meaning, field shape, or adding persisted fields requires a schema version; runtime-only changes do not. Never silently drop unknown fields. Failed migration preserves original bytes/record and offers export/recovery. Database-store upgrades use the IndexedDB upgrade transaction and must not destructively recreate stores with data.

## Required integrity tests

Real browser reopen/round trip; edit during slow save; serialized overlapping tasks; switching A -> B while A completes; two-tab same-revision race; deletion with stale writer; quota abort preserving old document and backup; blocked upgrade; checksum corruption; invalid stored schema; failed migration preserving input; last-opened missing record; explicit memory-only export. Fast adapter tests use injected failures, but real IndexedDB transaction and reload tests remain mandatory. Abrupt shutdown durability is a documented limitation, not a simulated passing claim.
