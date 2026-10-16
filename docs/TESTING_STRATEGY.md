# Testing strategy

## Evidence policy and organization

Test contracts and failure preservation, not private implementation shape. All application suites are **NOT TESTED at blueprint creation** because no implementation exists. Do not create tests that only assert a mock implementation returns its own values. Pure tests prove algorithms; real browser tests prove worker/storage/rendering integration.

Use Vitest for pure/integration tests, React Testing Library with user-event for components, and Playwright for browser E2E. Development-only fast-check, fake-indexeddb, and axe tooling are justified in [stack](TECHNOLOGY_STACK.md). Each fixture is synthetic and versioned. Naming: `<behavior>.test.ts`, `<component>.test.tsx`, `<journey>.spec.ts`; test titles read “given X, when Y, then Z.” Arrange fixtures under `tests/fixtures/{documents,graphs,payloads,malformed,migrations}` and suites under the architecture's proposed test directories.

Store fixed IDs/timestamps and seeded generators. Property failures report seed, shrunk commands, and minimal input. Do not snapshot entire mutable UI DOM or giant documents to hide assertions; assert relevant outputs, invariants, history, and preservation.

## Required suites and cases

| Suite | Mandatory coverage | Evidence boundary |
| --- | --- | --- |
| Contract/unit | Strict schemas, null drafts, JSON safety, every relevant cap/cap+1, canonical bytes/hashes, field paths | Typed/pure behavior; not browser durability |
| Graph algorithms | Self/dangling/duplicate/occupied/Note/port/cycle rejection; disconnected cycles; topological tie order; reachability/dependency; extraction/remapping/deletion | Domain tests with shuffled arrays and generated DAGs |
| Commands/history | All commands, no-op/failure atomicity, reconnect old edge retained, bulk all-or-nothing, redo invalidation, stable paste IDs, drag grouping, bounded history, viewport/selection exclusion, switching | Domain + application integration |
| Components | Palette/inspector Apply/Cancel, invalid drafts, focus conflicts, menus/dialogs, save/error states, shortcut scope, command palette | User-observable roles/labels/actions; no production mocks |
| State synchronization | Canonical-to-renderer projection, overlays, entity selector renders, stale diagnostics, semantic vs presentation revision, document switch cleanup | Real store/domain/adapter integration |
| Engine | Every node contract, multiple roots, fan-out immutability, both routes, disconnected/skipped nodes, no Output activation, partial failure results, determinism, pause/resume/step/cancel | Pure scheduler plus real worker journey |
| Persistence | Round trips, checksums, queue ordering, save during edit, A/B switching, CAS two-tab race, backup, delete stale writer, failed migration, quota/corrupt/unavailable behavior | Fast fault-injection plus real IndexedDB reload/two-tab tests |
| Security | Malformed/duplicate-key/deep/oversized input, pollution/getter canaries, text XSS, payload log canary, worker replay/stale/malformed messages, budgets/watchdogs, no network execution | Boundary tests + production-browser CSP/worker tests |
| Accessibility | Automated axe, roles/names, keyboard parity, dialogs/focus, zoom/reflow, reduced motion, form errors, announcements | Automation + manual NVDA/VoiceOver matrix |
| Performance | 20/100/300 graphs and stress fixtures, timings/frame traces, bounded history/payload/log memory, repeated cleanup | Production build, exact environment, raw samples |
| Cross-browser | Core editor, IDB reopen/import/export, worker controls, errors, keyboard paths | Chromium/Firefox/WebKit E2E + branded current/previous stable browser spot checks |

## Property-based proof obligations

Run at least 500 generated cases per graph/JSON property and 100 seeded command sequences of 100 operations for stage completion. Development may use 50-case smoke settings; release uses full settings. Generated documents stay within budgets and use synthetic constants. Properties:

1. Every successful command preserves structural invariants; rejected commands preserve canonical content, revisions, history, and queues exactly.
2. Undo all retained successful commands restores the initial editable content; redo restores the final content and stable IDs. Test separately when history eviction intentionally limits reversibility; timestamps/revision counters/viewport are not compared as history content.
3. Full topology order respects every edge; permutations of serialized arrays yield the same order.
4. Encode -> decode -> encode yields equal canonical bytes for supported valid documents, accounting for intentional negative-zero normalization. Import-as-new identity remapping is tested separately from codec round trips: IDs are fresh, endpoint topology is isomorphic, and mapped relative execution/Output order and payload values are preserved.
5. Deletion leaves no dangling edges; duplication/paste retains only internal edges and maps every endpoint to the fresh ID set.
6. Identical run snapshots yield identical semantic records/results excluding IDs/timing; input objects remain unchanged through all node operations.

## Critical integration journeys

Implement PR acceptance scenarios from [product](PRODUCT_SPEC.md) and gate IDs from [roadmap](ROADMAP.md). Include real reload after Saved, two independent browser pages racing storage, a suspended/slow save completing after switch, and a real worker running compiled production code. Use test-only transport handlers to simulate unresolved promises/crashes; those handlers MUST not be bundled in production. Test cancellation at compile, active operation, pause, and after terminal completion.

Security tests intercept network after assets load and assert zero workflow API/network calls or user-data transmission. Allow only exact same-origin static app/worker asset GET URLs from the production build manifest, with no user-derived query/path; worker startup resource fetches are not workflow network execution. CSP tests serve production artifacts with intended response headers, including worker response headers, then verify successful valid operation and blocked unsafe scripts/connects. Test UI text injection in all displayed user strings. Capture console/unhandled rejections and synthetic secret canaries without including the canary value in reports.

Persistence fault injection may simulate quota and aborted transactions where browser automation cannot deterministically exhaust quota. Mark injection versus real browser behavior distinctly. At least one real browser transaction-abort preservation case and two-tab CAS race are mandatory. Existing user storage must never serve as test data; use isolated origins/profiles/databases and remove only test-owned records.

For the owner-authorized `0.1.0-beta.1` profile (D-23), full fast functional/security checks, current supported-browser core journeys and packaged-asset editor/storage/worker verification remain required. Previously recorded extensive Chromium/WebKit results supplement the focused post-optimization run. Missing Firefox/Safari/manual-reader coverage and indicative branch-target gaps remain disclosed limitations, not passed tests. No data/hostile-input assertion is weakened.

## Suite cadence and pass rules

- Each change: affected unit/component/integration tests plus types/lint/build after material changes.
- Stage 1: contract/domain/property foundation, shell/canvas smoke, import-boundary primitive checks, dependency-boundary checks; no later-stage fake suite results.
- Stage 2: full editor/history/persistence/security-boundary/keyboard suites and representative editor performance.
- Stage 3: complete node/engine/worker/security/runtime accessibility suites, plus Stage 1/2 regressions.
- Stage 4/release: all mandatory suites, production build/serve E2E across engines, manual accessibility/branded-browser matrix, performance/security audits, and artifact validation.

Stage 1 must add actual scripts with stable names documented in DEVELOPMENT_WORKFLOW: `typecheck`, `lint`, `format:check`, `test:unit`, `test:integration`, `test:e2e`, and `build`; later stages add `test:security`, `test:a11y`, and `test:performance` when the corresponding coverage exists. Do not add always-successful placeholders. A report records actual command/suite counts, PASS/FAIL/NOT TESTED/SKIP with reason, and artifact paths. Required skipped/unexecuted cases make the gate PARTIAL, not PASS.

Coverage is a discovery signal: target >=90% branch coverage in domain/engine and >=80% in persistence/application modules once implemented, excluding type-only/generated files with explicit rationale. A coverage miss requires investigation; 100% does not waive missing contract cases. No weakening assertions, unexplained retries, deleted regression fixtures, or blanket excludes to improve metrics. Flaky mandatory tests remain unresolved defects until fixed and rerun; retries must remain visible.
