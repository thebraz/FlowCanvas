# FlowCanvas v0.1.0-beta.1

First public beta of the local visual JSON workflow editor, released under MIT.

Create, configure, connect and run Manual Trigger, Set Field, Pick Fields, Condition and Output nodes; Notes remain inert. The editor includes atomic undo/redo, keyboard alternatives, local IndexedDB autosave/conflict recovery, strict JSON import/export, deterministic worker execution and bounded debugging.

The audit corrected nine integrity/usability/accessibility defects, including storage-key corruption handling and stale-save races. Large JSON processing now avoids repeated per-scalar work for ASCII data while preserving exact canonical bytes and hostile-input rejection. Existing non-ASCII behavior remains intact, with seeded Unicode and actual-browser regressions.

## Beta limitations

- Minor measured selection/frame differences are accepted for this beta; deeper optimization follows later. Maximum-size imports may still briefly pause the main thread.
- Current local Chrome/Edge are verified branded targets. Chromium/WebKit automation supplements them. Firefox/Safari, previous-stable browsers and manual NVDA/VoiceOver certification remain unverified; no WCAG conformance claim is made.
- Storage is local, origin-scoped and unencrypted. Browser eviction or abrupt shutdown can lose changes after the last completed save. Keep exported copies; changing origins does not migrate data.
- No joins/loops, arbitrary scripts, API/network nodes, account synchronization or cold offline-launch guarantee. Worker isolation permits termination and is not a complete sandbox.

## Assets and compatibility

The static ZIP contains the application, local CSP server, licenses/notices and synthetic examples. Extract it, run `node scripts/serve.mjs` from its root with Node 24, and open http://127.0.0.1:4173. The source ZIP contains development inputs and excludes bulky/internal diagnostics. SHA256SUMS.txt identifies the exact downloads.

Workflow schema, stored envelope, IndexedDB and worker protocol remain version 1. No migration is introduced. Rollback restores compatible application files while preserving IndexedDB; export data before any unsupported downgrade or origin change.

See [beta verification](https://github.com/thebraz/FlowCanvas/blob/main/docs/reports/BETA_READINESS.md) for measured results and accepted scope. Report vulnerabilities through the repository's private security-reporting form.
