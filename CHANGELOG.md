# Changelog

## 0.1.0-beta.1 — 2026-10-16

First GitHub beta under MIT, authorized with the focused beta profile in [D-23](docs/DECISIONS.md). The package remains private to prevent accidental npm publication. The strict historical audit is preserved; [beta readiness](docs/reports/BETA_READINESS.md) owns current release evidence.

### Implemented product

- Six-node local visual editor: Manual Trigger, Set Field, Pick Fields, Condition, Output and Note.
- Atomic graph commands, bounded undo/redo, clipboard remapping and keyboard graph-list alternatives.
- Local IndexedDB workflows with ordered autosave, revision conflicts, verified backups and strict JSON import/export; readable export preserves canonical token order.
- Deterministic module-worker execution, pause/resume/step/stop, bounded debugging and explicit partial results.
- Dark/light/System themes, responsive list editing, accessible forms/dialogs and production-browser test infrastructure.

### Audit corrections

- Reject a valid envelope under a different workflow's storage key before any update or backup replacement.
- Preserve active autosave when deleting another workflow or when deletion fails; reject a stale Save-as-New copy after edits during a pending save.
- Recover range selection after its anchor is deleted or belongs to another document.
- Initialize a Condition's connection port from the actual source registry; focus and link rejected-connection errors.
- Normalize pointer button focus for WebKit keyboard movement and dialog restoration.
- Preserve palette dragging when WebKit strips custom MIME types; include the skip link in sequential keyboard focus.
- Isolate Stage 4 evidence and benchmark outputs; preserve earlier stage reports, assertions and performance targets.

- Accelerate ASCII byte counting and Unicode scalar validation without changing canonical bytes or hostile-input rejection.

### Compatibility and known limits

Workflow schema, storage envelope, database and worker protocol remain version 1. No public workflow format or node semantics changed; no migration is introduced. A rollback must preserve IndexedDB and block unsupported schema downgrades rather than reset user data.

Required performance, full branded current/previous-browser and manual NVDA/VoiceOver gates are not certified. Browser storage is local and unencrypted, may be evicted, and cannot guarantee unsaved changes survive abrupt shutdown. There are no joins/loops, arbitrary scripts, API/network nodes, account synchronization or cold offline-launch guarantee. Publication targets thebraz/FlowCanvas under MIT; actual remote verification is recorded in the beta report. No hosted deployment is included.
