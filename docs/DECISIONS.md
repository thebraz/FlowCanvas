# Architecture decision register

Status **Selected** means authoritative blueprint design, not implementation validation. Every entry includes context, selected approach, alternatives, rationale, consequences, and owner specifications. Changes require explicit compatibility analysis and updates to affected owners; do not silently supersede an entry.

## D-01 — Controlled React Flow integration (Selected)

Context: rendering libraries carry UI internals that must not define persistent workflow meaning. Selected: `@xyflow/react` controlled nodes/edges/viewport behind a projection/intent adapter. Alternatives: uncontrolled flow as storage truth; custom SVG/canvas engine. Rationale: reuse mature interactions while preserving independent contracts. Consequences: adapter must translate change categories and maintain stable projection identity; library upgrades require editor regressions. Related: [architecture](ARCHITECTURE.md), [interactions](EDITOR_INTERACTIONS.md).

## D-02 — Canonical immutable domain document (Selected)

Context: editor, storage, and runtime need consistent graph truth. Selected: one immutable versioned WorkflowDocument in a session; renderer/index/worker objects are derived. Alternatives: multiple synchronized graph stores; React Flow serialization. Rationale: one owner permits atomic invariants and portable import/export. Consequences: explicit projection and revision bookkeeping; no library internals in JSON. Related: [schema](GRAPH_SCHEMA.md), [state](STATE_MANAGEMENT.md).

## D-03 — Single-input JSON-object DAG (Selected)

Context: implicit merging, streams, and loops create ambiguous execution. Selected: one JsonObject per activation, every input capacity one, no cycles/self/duplicate edges, fan-out allowed, Notes have no ports. Alternatives: arbitrary graphs with implicit merges; array-item streams; join node. Rationale: deterministic inspectable beta with no invented merge semantics. Consequences: conditional branches cannot converge into one node and multiple triggers stay separate; separate Outputs are required. Related: [schema](GRAPH_SCHEMA.md), [nodes](NODE_CONTRACTS.md), [execution](EXECUTION_MODEL.md).

## D-04 — Zustand slices and revision guards (Selected)

Context: persistent and ephemeral state have different lifetimes. Selected: application-scoped vanilla store with canonical session, UI/runtime/save slices, narrow selectors; document/semantic/topology/storage revisions are distinct. Alternatives: context-wide graph subscriptions; independent stores with mirrored graphs. Rationale: targeted rendering and explicit stale-response rejection. Consequences: sessionId changes on every open and async effects carry identity tuples. Related: [state](STATE_MANAGEMENT.md), [persistence](PERSISTENCE.md).

## D-05 — Pure transactional graph commands (Selected)

Context: a partial reconnect/paste/delete can corrupt data and history. Selected: isolated immutable candidate, synchronous validated publication, post-success async effects. Alternatives: event handlers mutating graph arrays; best-effort partial bulk edits. Rationale: failure preservation is directly testable. Consequences: full validation for bulk operations, explicit no-op/failure handling, browser ID/time providers injected. Related: [commands](GRAPH_COMMANDS.md), [algorithms](GRAPH_ALGORITHMS.md).

## D-06 — Bounded snapshot undo/redo (Selected)

Context: beta needs reliable reversal without event-log migration complexity. Selected: before/after editable-content snapshots with structural sharing, transaction/byte caps, gesture grouping; exclude viewport/selection/runtime. Alternatives: unbounded snapshots; generic inverse patches; event sourcing. Rationale: simple exact identity restoration at bounded graph sizes. Consequences: a transaction too large for history clears it with a warning; undo does not restore timestamps/counters. Reconsider patches only after memory evidence. Related: [commands](GRAPH_COMMANDS.md), [performance](PERFORMANCE_SPEC.md).

## D-07 — Native IndexedDB with CAS and backup (Selected)

Context: autosave and multiple tabs can overwrite user data. Selected: one ordered/coalescing per-document queue, revision compare-and-swap transaction, canonical SHA-256, one verified previous backup. Alternatives: localStorage; last-writer-wins; ORM dependency. Rationale: async structured storage with explicit ordering and no avoidable package. Consequences: adapter complexity, quota overhead, no unload guarantee, recovery remains explicit. Related: [persistence](PERSISTENCE.md), [security](SECURITY_MODEL.md).

## D-08 — Strict Zod boundaries and explicit drafts (Selected)

Context: untrusted imports and partially edited forms must not introduce unsupported configs. Selected: preflight bounded JSON then strict schemas, `null` draft marker for transforms, separate readiness diagnostics. Alternatives: strip unknown fields, permissive partial config, partial recovery import. Rationale: preserve meaning and reject corruption atomically while allowing incomplete editing. Consequences: no corrupt-document editor; import-as-new is distinct from codec identity preservation. Related: [schema](GRAPH_SCHEMA.md), [data](DATA_CONTRACT.md).

## D-09 — Safe literal object paths (Selected)

Context: dynamic dotted expressions and inherited keys invite ambiguity/pollution. Selected: literal segment arrays, own properties, object-only traversal, forbidden keys recursively; strict primitive comparisons. Alternatives: JSONPath, expression engine, array-index path syntax, implicit coercion. Rationale: comprehensible bounded transforms. Consequences: cannot update array items or compare structured values in Condition; arrays may be leaf values. Related: [data](DATA_CONTRACT.md), [nodes](NODE_CONTRACTS.md).

## D-10 — Deterministic serial scheduler (Selected)

Context: branching and multiple roots must not depend on rendering or promise races. Selected: lexicographic-ID Kahn order, one pending operation, all triggers, fixed activation/skip rules, fail-fast errors with partial outputs. Alternatives: parallel scheduling; canvas order; trigger selection; implicit merge. Rationale: reproducible outcomes and debugging. Consequences: no parallel speedup; timing excluded from deterministic comparisons. Related: [algorithms](GRAPH_ALGORITHMS.md), [execution](EXECUTION_MODEL.md).

## D-11 — Closed capabilities and worker isolation (Selected)

Context: expensive or unresolved work must not block UI cancellation. Selected: one bundled module worker per run, strict versioned protocol, host watchdogs, terminate after grace; no code/network execution. Alternatives: main-thread execution; worker per node; arbitrary sandboxed scripts. Rationale: responsive bounded processing with a small trusted registry. Consequences: clone/validation overhead, worker response CSP, no claim of a complete sandbox, no silent main-thread fallback. Related: [execution security](EXECUTION_SECURITY.md), [security](SECURITY_MODEL.md).

## D-12 — Measured performance before complexity (Selected)

Context: portfolio quality needs observable budgets, not broad premature optimization. Selected: 20/100/300 fixtures, reproducible p95 methods, granular subscriptions, bounded caches, frame overlays; optimize measured bottlenecks. Alternatives: universal memoization, patch history now, custom rendering. Rationale: simple architecture with measurable acceptance. Consequences: proposed targets need actual stage evidence; reference hardware must be recorded before claiming PASS. Related: [performance](PERFORMANCE_SPEC.md), [state](STATE_MANAGEMENT.md).

## D-13 — Layered verification with real browser boundaries (Selected)

Context: mocks cannot prove storage, worker termination, branded-browser behavior, or assistive technology. Selected: unit/property/component/integration plus real IDB/worker E2E, manual accessibility and branded-browser checks. Alternatives: only snapshots/coverage, only E2E, only emulated engines. Rationale: verify contracts at their owning boundary. Consequences: manual environments and raw evidence required; absent proof is PARTIAL. Related: [testing](TESTING_STRATEGY.md), [quality](QUALITY_GATES.md).

## D-14 — Accessible graph list and restrained visual system (Selected)

Context: graph gestures cannot be the only route to mandatory functionality. Selected: equivalent semantic list/inspector/connection dialog, keyboard movement, tokenized dark/light theme, fixed geometry, reduced motion. Alternatives: pointer-only canvas; custom ARIA tree without full behavior; decorative animation. Rationale: testable access and consistent bounded layout. Consequences: additional UI routes share the same commands, manual reader tests required. Related: [accessibility](ACCESSIBILITY.md), [design](DESIGN_SYSTEM.md), [UX](UI_UX_SPEC.md).

## D-15 — Four isolated stages and separate publication (Selected)

Context: architecture preparation must not silently authorize application or release work. Selected: stage-specific acceptance/reports, no automatic next stage, technical beta readiness separate from publication/deployment. Alternatives: continuous unbounded implementation; automatic release on green tests. Rationale: explicit scope and honest completion. Consequences: preparation may pass as unpublished; assigned publication remains incomplete without destination evidence. Related: [roadmap](ROADMAP.md), [release](RELEASE_CHECKLIST.md).

## D-16 — Explicit versioning and strict imports (Selected)

Context: permissive evolution silently loses data in older readers. Selected: schema/envelope/database/protocol versions evolve independently; persisted shape/semantic changes bump schema; pure validated migrations; import creates fresh identity. Alternatives: unversioned JSON, silent stripping/defaults, overwriting same-ID imports. Rationale: compatibility and data preservation. Consequences: older readers may reject new formats; failed migration retains original and no partial recovery mode exists. Related: [schema](GRAPH_SCHEMA.md), [persistence](PERSISTENCE.md).

## D-17 — Stage 1 theme bootstrap (Selected and implemented)

Context: UI_UX_SPEC requires a local theme preference and pre-shell application; IndexedDB workflow/settings infrastructure belongs to Stage 2. Selected: one strict localStorage key, `flowcanvas.theme.v1`, accepting only System/Dark/Light literals. An absent preference uses Dark as specified; invalid/denied reads use System. Alternatives: premature IndexedDB adapter or a nonpersistent preference. Rationale: satisfy theme foundation without implementing workflow storage. Consequences: denied writes display an explanation; invalid/denied reads use System. Stage 2 migrates the preference into settings transactionally before removing the legacy key. Related owners: PERSISTENCE, STATE_MANAGEMENT, UI_UX_SPEC. Compatibility: schema version 1 and workflow serialization are unchanged; no workflow/payload data enters localStorage.

## D-18 — Verified compatible Stage 1 toolchain (Selected and implemented)

Context: official npm latest tags contain peer conflicts: TypeScript 7 is outside typescript-eslint's `<6.1` range; ESLint 10 is outside jsx-a11y's current `^9` range. Selected: Node 24.19.0 LTS/npm 11.6.4, React/DOM 19.3.1, Vite 8.3.4/plugin-react 6.1.2, TypeScript 6.0.3, ESLint/@eslint-js 9.39.5, typescript-eslint 8.71.2 and exact locked dependencies. Alternatives: force incompatible peers, omit accessibility lint, or adopt an unapproved stack. Rationale: preserve approved tooling and execute real gates without force flags. Consequences: ESLint 9 is upstream-deprecated; review the linter/plugin group before Stage 4, without weakening checks. Registry metadata and audit evidence live in the Stage 1 report. Related owners: TECHNOLOGY_STACK, DEVELOPMENT_WORKFLOW. Compatibility: no document/schema change; package updates still need grouped verification.

## D-19 — Stage 2 implementation choices (Selected; acceptance in Stage 2 report)

Stage 2 implementation decisions (2026-10-15): the existing schema-v1 domain and package baseline are retained. Native IndexedDB implements D-07 without a runtime dependency; fake-indexeddb 6.2.5 is development-only, verified from the official registry (Node >=18, Apache-2.0). Whole-document revision CAS, verified backups and transaction-complete acknowledgements remain authoritative. Grouped inspector intents reuse the same reducer and publish once; malformed drafts are never serialized. Native dialogs provide modal isolation, with explicit focus wrapping/restoration. A controlled React Flow synchronization callback can contain a non-DOM library object: it is excluded from user-gesture publication, while native/programmatic navigation remains functional. Projection arrays/callbacks are stable, and fixed port geometry comes from the closed registry. Profiling compares visible-element rendering before retaining any optimization. No graph invariant, node meaning, document field, schema version, or migration contract changes. Stage acceptance remains governed by the Stage 2 report; no next stage is authorized.

CPU profiling subsequently identified per-key code-point-array allocation in canonical sorting. Direct code-point iteration and UTF-8 byte counting remove those allocations while preserving exact comparison results, canonical bytes and SHA-256 compatibility. A 500-case seeded Unicode equivalence property and the existing import/storage/property suites verify the change. Performance targets remain unchanged; the report retains observed failures and missing manual evidence.

Tailwind source discovery is restricted to `src` so generated benchmark/profile/report data cannot add accidental utility classes to subsequent builds. This preserves application styles while making evidence generation independent of CSS input discovery.

## D-20 — Separate readable JSON export (Selected; scoped follow-up)

The user requested readable downloadable JSON while preserving any byte-exact canonical export contract. DATA_CONTRACT requires compact default export and already permits a separate pretty variant. Keep Export JSON, encodeDocument, canonical hashing and IndexedDB serialization unchanged; add Export readable JSON to the toolbar and workflow manager. Insert only two-space/LF whitespace into the validated canonical token stream, rather than parse/stringify that would reorder integer-like keys. Reject readable output beyond the existing import byte ceiling; never truncate data or silently fall back. Compatibility: additive UI option, identical schema-v1 data/identities/order and import semantics, no migration. Related owners: DATA_CONTRACT, GRAPH_SCHEMA, PERSISTENCE, UI_UX_SPEC. This follow-up does not change Stage 2 acceptance or authorize later stages.

Verification of the scoped D-20 change is recorded in the [readable-export fix report](reports/READABLE_EXPORT_FIX.md); the Stage 2 acceptance report remains unchanged.

## D-21 — Stage 3 execution implementation and prerequisite evidence

The user explicitly assigned Stage 3 and authorized remediation of Stage 2 defects blocking correct integration. Functional prerequisite tests were rerun before implementation. Stage 2's recorded editor performance failures and absent manual accessibility evidence remain visible; this assignment permits execution implementation but does not waive prerequisite acceptance or authorize Stage 4. The Stage 3 report owns the current conclusion.

Implement D-10/D-11 using the existing canonical validator, graph indexes and min-heap order, a pure sequential scheduler, immutable payload registry and one module worker per run. A shared pure event ledger verifies atomic payload publication and terminal consistency separately in the worker and host. Strict unknown-input protocol schemas precede host reduction. Host clocks own UI timings and independent deadlines; worker clocks measure compilation/operations without subtracting cross-origin absolute times. MessageChannel yields permit task-queue controls. UI batching is 16 ms, watchdog polling 25 ms, and at most 32 ordinary unacknowledged controls plus one reserved cancellation request are retained; these are internal transport policies, not changes to resource ceilings. A 40-row timeline window bounds DOM work over the specified ring. Validate may retain ready until an explicit Run/Step or cancellation/deadline.

Integration corrections: aggregate readiness, rather than the capped diagnostic list, blocks compilation and Run. Retained blocking errors displace warnings without increasing the issue budget. Stop retains one reserved transport slot and preserves a valid completed/failed terminal already in transit; forced cancellation still applies after the grace deadline. Terminal error contexts must refer to the current run and known executable graph entities.

The execution panel's settled height/expanded preferences join the existing strict settings record, with defaults for old records and transactional writes. Rendered height remains capped at 50vh. Older Stage 2 clients reject these new preference keys and report the settings read failure; this settings-only compatibility impact does not change workflow documents or envelopes.

Compatibility: no schema-v1 fields, canonical encoding/order, persistent envelope, node semantics, public resource ceilings or migrations change. Runtime/result downloads are separate from workflow exports. Test-only unresolved/synchronous-stall/crash workers exist only in the isolated benchmark artifact, never the production registry. Workers are terminated on terminal acceptance, invalidation, reset/disposal; no main-thread execution fallback exists. All observed failures and missing environments remain governed by QUALITY_GATES.

## D-22 — Stage 4 independent audit and conditional publication

The user explicitly assigned the complete Stage 4 audit on 2026-10-16, including feasible remediation and GitHub beta publication only after all mandatory gates and repository policy permit it. Historical Stage 2/3 FAIL conclusions remain unchanged. The requested `STAGE_4_FINAL_AUDIT.md` owns the current matrix; `STAGE_4_REPORT.md` is its stage-contract entry point, not a second acceptance decision.

Retain schema/envelope/database/worker protocol version 1, canonical bytes/hashes, node meanings and all resource/performance limits. Add save-time key/document identity binding, retain autosave across unrelated/failed deletions, reject stale Save-as-New snapshots, reset missing selection anchors, derive initial connection ports from the registry, link/focus connection errors and make pointer-activated button focus consistent across engines. A namespaced plain-text drag fallback preserves palette transport when WebKit strips custom MIME data, still whitelisting the six node types. Explicit sequential focus includes the skip link in WebKit keyboard navigation. Each confirmed defect has a focused regression or actual browser reproduction. No generic service framework, new production dependency or subsystem rewrite is introduced.

Stage 4 test outputs use isolated evidence paths; original Stage 1–3 evidence is retained. Playwright retries stay zero. The initial two-worker browser matrix and every failure remain recorded; isolated follow-ups use one worker and the same functional assertions. Screenshots run after zero-console assertions because Playwright WebKit's screenshot synchronizer injects a CSP-blocked inline stylesheet; the shipped CSP is unchanged. Browser launch failures and unavailable assistive technology are never counted as passed. Repeated Firefox installation did not resolve its Windows side-by-side activation failure.

The locked compatible toolchain was rechecked against official registry peer ranges; do not force TypeScript 7 or ESLint 10 beyond the accessibility linter's supported peers. ESLint 9's upstream deprecation remains documented. No repository identity, Git history/remote, application LICENSE, security contact or CI destination is established locally. Do not choose legal terms, initialize/publish a guessed repository, bump the package, or create the proposed tag while technical gates remain blocked. Workflow storage must be preserved on rollback. The final audit owns measured performance deviations and unresolved release prerequisites; no target is relaxed by this decision.

Compatibility: additive recovery/UI corrections, no workflow migration or public format change. Related owners: PERSISTENCE, ACCESSIBILITY, EDITOR_INTERACTIONS, TESTING_STRATEGY, RELEASE_CHECKLIST.

## D-23 — Owner-authorized focused first beta

After reviewing the strict Stage 4 result, the owner instructed: optimize only substantial differences, retain minor deviations for the beta, and release before later optimization. The owner then explicitly selected `thebraz/FlowCanvas`, MIT, and requested repository creation. This supersedes D-22's publication block for the first beta's noncritical performance/evidence scope; original reports and failed measurements are historical, not rewritten as PASS.

Retain all data-loss, security, graph/history/persistence/worker correctness gates. Accept observed approximately 17–33 ms selection/clear and 16.8–16.9 ms frame cadence as first-beta limitations. Target the largest observed delay instead: repeated UTF-8/scalar scans in a valid 5 MiB document. An ASCII byte fast path and a Unicode-mode lone-surrogate check preserve exact byte accounting and scalar rejection, verified with arbitrary UTF-16 and existing hostile-boundary tests. No canonical codec, limit, schema, worker capability or production dependency changes.

Release support is explicitly scoped to verified current Chrome/Edge, with Chromium/WebKit automation. Missing Firefox/Safari/previous-stable/manual NVDA/VoiceOver evidence remains NOT TESTED and is deferred from this first beta's certification scope; automated keyboard, labels, focus and non-drag journeys remain required. Indicative coverage targets and complete reference-machine/performance certification remain improvement work. This is a scoped engineering interpretation of the owner's beta instruction, not a claim that the owner named each missing environment or that unexecuted checks passed.

Establish MIT/license notices, version `0.1.0-beta.1`, GitHub repository/CI/security-reporting metadata, clean source/static archives and SHA-256 sums. Verify packaged assets before publication and remotely verify the prerelease/tag/commit/downloaded assets afterwards. No hosted deployment or new paid infrastructure. Rollback preserves IndexedDB. Stable-release performance/accessibility/browser targets remain unchanged; [BETA_READINESS](reports/BETA_READINESS.md) owns the current beta decision.

## Requirement interpretations

| Apparent conflict | Chosen interpretation |
| --- | --- |
| Incomplete editing vs no unsupported config | Explicit null drafts are valid stored state; malformed partial config objects are rejected |
| Branching/multiple roots vs no implicit merge | Fan-out and exclusive routes are supported; convergence is prohibited by one inbound edge |
| Persistent viewport vs no history pollution | Commit settled viewport to document, exclude from history and semantic revision |
| Determinism vs timing/async operations | Serial semantic order; await handlers; run IDs/durations excluded from equality |
| Local-first vs durable save guarantee | Completed IDB transaction is save evidence; shutdown/eviction remain limitations |
| Worker isolation vs browser sandbox claims | Isolation/termination only; trusted-code and origin risks remain |
| Current stable stack vs no invented versions | Verify/pin actual compatible versions at Stage 1, before installation |
| Audit/release stage vs no implicit publication | Technical readiness may pass unpublished; explicit external authorization and verification remain required |
| Rigorous future blueprint vs no implementation now | Types/pseudocode are Markdown contracts only; application/tooling creation waits for stage assignment |
| Minimal design vs advanced debugging/accessibility | Required controls/alternative journeys are mandatory; no extra node/plugin/backend machinery |

## Intentionally deferred operational choices

No fundamental architecture remains undecided. These choices do not block blueprint completion or authorize new work:

| ID | Choice / owner | Deadline / resolution evidence |
| --- | --- | --- |
| O-01 | Exact stable package/Node versions / Stage 1 implementer | Resolved in Stage 1 before installation: D-18, official registry metadata, exact lockfile and Stage 1 report |
| O-02 | Repository owner/URL, license and public security contact / project owner | Resolved by owner: thebraz/FlowCanvas, MIT; private GitHub security reporting and actual creation are verified in beta readiness |
| O-03 | CI provider and hosted-demo vs assets-only release / project owner | Selected GitHub Actions for functional CI, assets-only GitHub prerelease; no hosted deployment |
| O-04 | Hosting provider and actual header support / release operator | Before assigned deployment; document/worker CSP and live verification |
| O-05 | Exact benchmark machine/browser versions / stage verifier | Recorded in Stage 1: Windows 11, i7-1255U (10C/12T), 16 GiB installed RAM, SSD, Iris Xe, 60 Hz, AC power; branded Chrome 155.0.8059.40, 1440x900/scale 1, headless automation. Raw results/limitations in Stage 1 report |
| O-06 | NVDA/VoiceOver and branded-browser test access / stage verifier | Original manual gate remains NOT TESTED; D-23 scopes first beta to verified browsers and disclosed reader limitations |

If an operational dependency is unavailable, record the affected gate as NOT TESTED/PARTIAL. Do not invent a license, a benchmark result, a remote URL, or manual test success.
