# Four-stage implementation roadmap

This roadmap assigns work, not authorization. Each stage must be explicitly assigned, must satisfy its gates, and must stop at its exit. The initial blueprint task produced documentation only. Stage 1 evidence is in [its report](reports/STAGE_1_REPORT.md). Stage 2 evidence and unresolved gates remain in [its report](reports/STAGE_2_REPORT.md). Stage 3 was explicitly assigned on 2026-10-15, including remediation of integration blockers; implementation and current acceptance are in [its report](reports/STAGE_3_REPORT.md). This assignment does not waive earlier failures. Stage 4 was explicitly assigned on 2026-10-16 for independent audit and feasible remediation. Its [final audit](reports/STAGE_4_FINAL_AUDIT.md) records current verification and release blockers; earlier reports remain historical evidence. The owner subsequently authorized the focused first-beta profile, repository creation and MIT publication in D-23. The original strict gate results remain historical; BETA_READINESS.md owns current beta acceptance. No hosted deployment is assigned.

## Stage 1 — Architecture & Foundation

**Inputs:** this blueprint, inspected workspace/instructions, explicit Stage 1 assignment. Resolve exact compatible stable package/Node versions before installation and record them.

**Required implementation and acceptance:**

| ID | Mandatory outcome and evidence |
| --- | --- |
| S1-01 | Functional Vite/React/strict TypeScript baseline, lockfile, lint/format/types/build and test scripts; production shell loads without errors |
| S1-02 | Pure canonical types, closed node/config/port registry, JSON limits, strict boundary schemas, deterministic canonical codec, and graph invariants; cap/cap+1 and hostile-input tests |
| S1-03 | Indexes, connection/cycle/reachability/topological algorithms with deterministic generated tests; forbidden imports enforced |
| S1-04 | Application store/session and controlled renderer adapter foundation; synthetic basic graph, no competing authority; selection/viewport separated from canonical graph |
| S1-05 | Token-based shell, dark/light foundation, semantic navigation, basic canvas and accessible node-list/region access; shell keyboard/component/browser smoke |
| S1-06 | Domain validation and empty-shell performance baseline using specified methods; required foundation gates verified, report written |

Stage 1 MUST anticipate schema migrations, atomic command/history interfaces, semantic/storage revisions, worker protocol boundaries, safe paths, fixed node geometry, accessibility alternatives, and resource accounting. Implement shared contracts/validators needed now; do not build future storage/engine/UI systems to “future-proof” the shell. Basic sample nodes may render verified synthetic data but must not imply real execution.

**Tests:** unit/schema/graph/property tests, module boundaries, shell/canvas component and production-browser smoke, applicable shell/domain performance. **Docs/deliverables:** functional source/tooling, accurate setup README, selected versions/decisions, `STAGE_1_REPORT.md`. **Blockers:** incompatible toolchain, invariant failures, unsafe schema behavior, no build or required evidence. **Exit:** S1-01–06 and applicable gates PASS; stop. Advanced editing, persistence, and runtime are outside this stage.

## Stage 2 — Advanced Visual Editor

**Inputs:** Stage 1 PASS report and artifacts, explicit Stage 2 assignment.

| ID | Mandatory outcome and evidence |
| --- | --- |
| S2-01 | All editing commands atomic, full inspector configs, connection/reconnection validation, stable IDs; failed operations unchanged |
| S2-02 | Multi-select/drag/align/duplicate/copy-paste/bulk delete and bounded undo/redo; keyboard focus conflicts and gesture grouping verified |
| S2-03 | Workflow CRUD/duplicate, IndexedDB ordered autosave/CAS/backups, last-opened recovery, explicit memory-only path; real reload/two-tab tests |
| S2-04 | Strict isolated import-as-new and canonical export, unsupported/corrupt/oversized rejection, no runtime serialization |
| S2-05 | Full palette/canvas/inspector/list/menus/dialogs/command palette, theme/minimap/grid; keyboard connection/movement parity and manual editor accessibility |
| S2-06 | Editor/state/history/persistence/security regression suites and representative editor/save performance pass; prior-stage regressions pass |

**Tests:** component/domain/integration, generated long history sequences, real browser storage/import/export/editor E2E, hostile imports/XSS/paths, automated and manual editor accessibility, 20/100/300 editor targets. **Docs/deliverables:** complete functional editor/storage, updated contracts if needed, test fixtures/evidence, `STAGE_2_REPORT.md`. **Blockers:** stale overwrite, invalid transaction/history restoration, inaccessible mandatory editor action, invalid import changes state, required evidence missing. **Exit:** S2-01–06 PASS; stop. No fake Run results or runtime engine implementation.

## Stage 3 — Execution Engine & Debugging

**Inputs:** Stage 2 PASS report/artifacts, explicit Stage 3 assignment.

| ID | Mandatory outcome and evidence |
| --- | --- |
| S3-01 | Worker compilation, exact six-node catalog semantics (Note excluded), deterministic sequential topology schedule, all-trigger execution |
| S3-02 | True/false activation, fan-out immutability, unreachable/skipped semantics, partial-error outputs, reproducible ordering |
| S3-03 | Tested lifecycle with Pause/Resume/Step/Cancel/Reset, host watchdogs and stale-result guards; real-worker cancellation within target |
| S3-04 | Visual status overlays, bounded diagnostics and payload inspection, final/partial results, semantic-edit invalidation, runtime accessibility |
| S3-05 | Every runtime resource cap enforced; closed capabilities, strict protocol, no network/arbitrary execution; security regressions |
| S3-06 | Pure engine and actual worker/browser tests, execution/cancel/cleanup performance, prior-stage full regressions; accurate report |

**Tests:** all node cases, engine properties/state transitions, synthetic async hang/crash fixtures, actual module worker/CSP-capability tests, runtime accessibility, full Stage 1/2 regressions. **Docs/deliverables:** functional engine/debugging, measured runtime evidence and updated limitations, `STAGE_3_REPORT.md`. **Blockers:** wrong route/value/order, uncancellable run, stale result acceptance, budget bypass, runtime serialized into documents, missing gates. **Exit:** S3-01–06 PASS; stop. No release/publication authorization inferred.

## Stage 4 — Audit & Beta Release

**Inputs:** Stage 1–3 PASS reports, explicit Stage 4 assignment, repository/license/CI/browser-access decisions resolved, and separate publication authorization when publication is assigned.

| ID | Mandatory outcome and evidence |
| --- | --- |
| S4-01 | Architecture/graph/history/persistence/security audits complete, confirmed defects fixed with regressions, no unresolved mandatory defect |
| S4-02 | Complete production performance reference/stress/cleanup benchmarks with raw evidence; optimize only measured bottlenecks |
| S4-03 | Full WCAG-target audit and manual NVDA/VoiceOver journeys, both themes/zoom, current/previous stable branded-browser matrix plus Playwright engines |
| S4-04 | Reproducible clean build and all mandatory tests, dependency/license/CSP review, complete honest documentation/changelog/repository metadata |
| S4-05 | Versioned beta assets, hashes, release notes/known limits, migration compatibility and rollback plan; release checklist verified |
| S4-06 | If explicitly authorized: publish proposed beta without overwriting history, download/verify release assets, validate deployed destination/headers/worker/storage when deployment applies |

**Tests:** complete release matrix in TESTING_STRATEGY and RELEASE_CHECKLIST after final fixes. **Docs/deliverables:** final audits, evidence, user/setup/security/contribution documentation, changelog/license/release assets as authorized, `STAGE_4_REPORT.md`. **Blockers:** Critical/High findings, any failed mandatory criterion regardless of severity, missing accessibility/browser/performance proof, unresolved license/ownership, missing publication authorization for an assigned external action. **Exit:** S4-01–05 establish technical beta readiness; S4-06 is separately authorized. Preparation-only scope may pass as beta-ready/unpublished. If publication was assigned but unfinished, outcome is PARTIAL. Stop after assigned scope.

## Explicit deferrals

No extra nodes, joins, loops, arbitrary code, accounts, backend, synchronization, multiplayer, mobile-first editing, PWA install/offline boot, or automatic layout are implied. Nontechnical deferred choices have deadlines in [decisions](DECISIONS.md). Future enhancements need a new scope decision; they must not inflate any of these four stages.
