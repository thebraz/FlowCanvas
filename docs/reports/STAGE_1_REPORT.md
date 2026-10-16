# FLOWCANVAS — STAGE 1

Date: 2026-10-15, America/Sao_Paulo. **OVERALL STATUS: PASS for Stage 1 only.**

## Assignment, baseline, and artifact

Authorization: the user's explicit “Architecture Implementation, Core Domain & Application Foundation” Stage 1 assignment. All required specifications, parent/project AGENTS instructions, and the historical BLUEPRINT_AUDIT were inspected before implementation. The workspace contained documentation only and no Git repository. The knowledge-graph service returned zero registered repositories; filesystem inspection independently confirmed the baseline. No Git initialization, commit, tag, publication, deployment, automation, or later-stage implementation occurred.

Delivered: a locally runnable React application, one immutable canonical document/session, strict hostile-data boundaries, graph algorithms, atomic command primitives, controlled React Flow rendering, six node views, accessible shell/list, test infrastructure, locked dependencies, and retained verification evidence. The sample contains seven instances of the six catalog types and five real canonical edges. It has no fabricated execution results.

Final source/config/test identity and all build hashes are recorded in [artifact-manifest.json](evidence/artifact-manifest.json). That manifest excludes this report to avoid a self-referential hash. The lockfile and production assets are individually hashed. The final browser suite and benchmark rebuilt the same production assets after the final application changes. The separate `dist-benchmark` artifact contains test-only benchmark entry points; these are absent from `dist`.

## Environment and selected versions

| Item                       | Actual environment                                                                           |
| -------------------------- | -------------------------------------------------------------------------------------------- |
| OS                         | Windows 11 Home Single Language, 10.0.26200                                                  |
| CPU                        | Intel Core i7-1255U, 10 physical cores / 12 logical threads                                  |
| Memory / disk              | 16 GiB installed RAM, 16,890,978,304 usable bytes; SSD                                       |
| Graphics / display / power | Intel Iris Xe, 60 Hz, AC power Online, Balanced power plan                                   |
| Node / npm                 | 24.19.0 / 11.6.4                                                                             |
| Production browser smoke   | Playwright 1.64.1, bundled Chromium 156.0.8078.4, headless, scale 1                          |
| Production baselines       | Installed branded Chrome 155.0.8059.40, headless, 1440x900, scale 1, no CPU throttling       |
| Component environment      | jsdom 30.1.3; layout/gesture correctness is established by the real-browser suite, not jsdom |

Hardware evidence: [hardware.json](evidence/hardware.json). Browser identity: [browser.json](evidence/browser.json). This is physical reference-class hardware, with automated headless browser measurements. Ambient OS activity is not certified absent; release-wide headed/branded-browser, assistive-technology, and memory evidence remains outside this stage.

| Dependency group                                   | Selected exact versions          |
| -------------------------------------------------- | -------------------------------- |
| React / React DOM / React types                    | 19.3.1 / 19.3.1 / 19.3.0         |
| Vite / official React plugin / TypeScript          | 8.3.4 / 6.1.2 / 6.0.3            |
| React Flow / Zustand / Zod                         | 12.12.0 / 5.0.15 / 4.6.7         |
| Tailwind / Vite integration / Phosphor             | 4.3.3 / 4.3.3 / 2.1.10           |
| Vitest / V8 coverage / fast-check                  | 5.0.4 / 5.0.4 / 4.10.2           |
| ESLint / TypeScript ESLint / hooks / accessibility | 9.39.5 / 8.71.2 / 7.1.1 / 6.10.2 |
| Prettier / axe Playwright                          | 3.9.10 / 4.13.0                  |

Every remaining direct package, engine range, peer range, and license is recorded in [selected-packages.json](evidence/selected-packages.json) and [installed-dependencies.json](evidence/installed-dependencies.json). Official registry selection metadata is in [dependency-selection.json](evidence/dependency-selection.json); exact fallback metadata is in [typescript-compatibility.json](evidence/typescript-compatibility.json) and [eslint-compatibility.json](evidence/eslint-compatibility.json). TypeScript 7 and ESLint 10 were not selected because they conflict with required plugin peers. No force or legacy-peer-deps flags were used. ESLint 9's upstream deprecation is retained as a maintenance risk, not concealed. Clean `npm ci` installed 402 packages successfully; the npm advisory result has zero vulnerabilities. Its logical dependency inventory includes optional cross-platform packages and differs from the installed package count.

Official references consulted: [Node release status](https://nodejs.org/en/about/previous-releases), [Vite runtime guidance](https://vite.dev/guide/), [React Flow controlled APIs](https://reactflow.dev/api-reference/react-flow), [Zod schemas](https://zod.dev/api), and [Tailwind's Vite integration](https://tailwindcss.com/docs/installation/using-vite). Exact version/peer decisions use registry evidence rather than guessed latest tags.

## Implemented modules

| Area                | Implementation and responsibility                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pure contracts      | [workflow](../../src/contracts/workflow.ts), [limits](../../src/contracts/limits.ts), [errors](../../src/contracts/errors.ts), [session](../../src/contracts/session.ts): closed node/port/config types, UUID-boundary identity, versions, metadata, revisions, future history/run identity contracts                                                                                                                                                                                                                                                |
| Pure JSON           | [canonical form](../../src/domain/json/canonical.ts), [paths](../../src/domain/json/path.ts): code-point key order, UTF-8 accounting, missing sentinel, literal own-property reads and path conflict checks                                                                                                                                                                                                                                                                                                                                          |
| Pure graph          | [indexes](../../src/domain/graph/indexes.ts), [algorithms](../../src/domain/graph/algorithms.ts), [invariants](../../src/domain/graph/invariants.ts), [commands](../../src/domain/graph/commands.ts): indexes, iterative traversal/cycles, min-heap topology, readiness, isolated command candidates                                                                                                                                                                                                                                                 |
| Boundary validation | [schemas](../../src/validation/schemas.ts), [JSON inspection](../../src/validation/json-safety.ts), [lexical preflight](../../src/validation/lexical.ts), [codec](../../src/validation/codec.ts), [intents](../../src/validation/commands.ts): unknown inputs, pre-recursion budgets, duplicate keys, strict Zod, full structural entry checks                                                                                                                                                                                                       |
| Session/state       | [store](../../src/state/store.ts), [selectors/context](../../src/state/context.tsx), [synthetic sample](../../src/application/sample.ts): one scoped vanilla store, synchronous publication, explicit revision classification, selection/viewport/UI separation                                                                                                                                                                                                                                                                                      |
| Renderer            | [projection](../../src/adapters/react-flow/projection.ts), [node views](../../src/adapters/react-flow/WorkflowNodeView.tsx): canonical-to-library projection, stable unchanged entities, fixed geometry and port identity; no renderer serialization authority                                                                                                                                                                                                                                                                                       |
| Shell/UI            | [composition](../../src/app/App.tsx), [canvas](../../src/features/editor/Canvas.tsx), [navigation](../../src/features/editor/CanvasControls.tsx), [palette](../../src/features/editor/Palette.tsx), [list](../../src/features/editor/GraphList.tsx), [inspector](../../src/features/editor/Inspector.tsx), [diagnostics](../../src/features/editor/Diagnostics.tsx), [tokens](../../src/ui/styles.css), [boundary](../../src/ui/ErrorBoundary.tsx): semantic regions, keyboard access, themes, responsive read-only foundation and explicit failures |

Core commands: CreateNode, DeleteNode with incident cleanup, MoveNodes atomically, ChangeNodeConfig, RenameNode, CreateEdge, DeleteEdge, ReconnectEdge, and settled SetViewport. They return changed/semantic/topology/history classification. They do not implement undo/redo, inspector editing, clipboard, drag transactions, storage, or execution. Shape/budget validation is injected into the pure reducer; topology-preserving edits do not rebuild adjacency or scan for cycles. External document entry points always run full validation.

## Roadmap acceptance matrix

“Implemented and verified” means PASS in the assigned scope, not completion of future beta capabilities.

| ID    | Mandatory Stage 1 outcome                                                                    | Implementation / verification evidence                                                                               | Classification / result         |
| ----- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| S1-01 | React/Vite/strict TS, lockfile, scripts, lint/format/types/build, production shell           | Root tooling; strict/noUncheckedIndexedAccess/exactOptionalPropertyTypes; clean install; 18 production browser cases | Implemented and verified — PASS |
| S1-02 | Canonical types, closed registry, JSON budgets, strict schemas, canonical codec, invariants  | contracts/domain/validation; 18 schema + 12 budget + 16 graph + 1 error-safety unit cases                            | Implemented and verified — PASS |
| S1-03 | Indexes, connection/cycle/reachability/dependencies/topology, determinism, forbidden imports | Pure graph modules; 500 seeded DAG cases, 500 supported-JSON round trips; AST boundary/cycle test and lint           | Implemented and verified — PASS |
| S1-04 | One document/session, controlled renderer adapter, sample, separated selection/viewport      | store/projection; 9 integration cases including 100 x 100 seeded command sequences; 8 component cases                | Implemented and verified — PASS |
| S1-05 | Tokens, dark/light/System, semantic regions, canvas/list keyboard access, responsiveness     | shell/features/UI; 8 component and 18 browser cases; both-theme screenshots at four sizes and 200% text              | Implemented and verified — PASS |
| S1-06 | Domain and empty-shell performance baselines, required gates, report                         | 20/100/300 seeded fixtures; 5 warmups + 30 samples/operation; 10 fresh browser profiles; raw samples/hashes below    | Implemented and verified — PASS |

## Assignment requirement traceability

| Request requirement                                                        | Owning implementation                             | Observable verification / result                                                                                                |
| -------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Approved React/TS/Vite/React Flow/Zustand/Zod/Tailwind/icons/tooling       | package.json, lockfile, root configs, composition | Install, types, lint, formatting, build, real browser load — PASS                                                               |
| Workflow/document/metadata/node/edge/port/config/ID/version/viewport types | contracts/workflow.ts, schemas.ts                 | Strict supported shape, no runtime/renderer fields, union/config pairing — PASS                                                 |
| Invalid external objects cannot enter authoritative state                  | codec.ts, commands.ts, store.ts                   | Full initial validation, malformed intents, unchanged state on rejection — PASS                                                 |
| Identity uniqueness across all entity classes                              | invariants.ts                                     | Document/node/edge collisions and duplicate IDs reject — PASS                                                                   |
| Endpoint existence, port direction/kind, Notes, self edges                 | invariants.ts, registry                           | Dangling references, invalid handles, Trigger target, Output source, Note edges, self loop — PASS                               |
| Duplicate edges, capacity one, DAG validity                                | invariants.ts, algorithms.ts                      | Equivalent tuples, occupied input, long-chain back edge, disconnected cycle — PASS                                              |
| Deterministic algorithms and static port semantics                         | indexes.ts, algorithms.ts                         | Generated DAG precedence, reversed arrays, smallest-ID topology, roots/dependencies/selection — PASS                            |
| Structural invalidity separate from editable incompleteness                | codec.ts, readiness                               | Empty graphs/null drafts accepted; reachable draft blocks readiness; unreachable drafts warn — PASS                             |
| Atomic immutable command foundation, explicit failures                     | graph/commands.ts, store.ts                       | Failed provider/ID/config/reconnect/bulk move leaves protected state unchanged; valid create/delete/reconnect tested — PASS     |
| No-op, stable IDs, revision/history readiness                              | commands.ts, contracts/session.ts                 | Repeated Apply/reconnect does not change state/timestamp; viewport excludes history; semantic/topology counters verified — PASS |
| Separated persistent/interaction/selection/viewport/UI/runtime ownership   | store.ts, context.tsx                             | Selection/overlay/theme/grid leave graph revisions unchanged; stale session rejected; selector render count verified — PASS     |
| Canonical rendering adapters, real sample graph                            | projection.ts, WorkflowNodeView.tsx, sample.ts    | 7 real nodes/5 edges; six types; unchanged projections retain identity; browser canvas mounted — PASS                           |
| Pan/zoom/fit/grid/basic viewport interaction                               | Canvas.tsx, CanvasControls.tsx                    | Pointer pan, wheel zoom, labeled zoom/pan/fit controls and grid toggle in real browser — PASS                                   |
| Shell regions, consistent primitives, focus, themes and responsive basics  | UI/features/App                                   | Keyboard skip/list/inspection, 3px focus, 320px reflow, 200% text, reduced motion, theme reload/System changes — PASS           |
| Safe untrusted text, defensive data handling and structured errors         | JSON/codec/errors, React text, ErrorBoundary      | Pollution/getter/XSS/log canaries, capped diagnostics, unsupported startup, rendering recovery preserves document — PASS        |
| Architecture independent from rendering and storage                        | AST architecture test + ESLint                    | Forbidden domain imports/capabilities and source import cycles checked — PASS                                                   |
| Traceability, actual evidence, maintained blueprint and stage isolation    | This report, README, decisions/owners             | Linked reports/evidence; schema compatibility unchanged; no later-stage or external publication claims — PASS                   |
| Full history, advanced editor, persistence/import UI                       | Roadmap Stage 2                                   | Explicitly deferred by roadmap; NOT IMPLEMENTED / N/A for Stage 1                                                               |
| Node handlers, worker messages/engine, execution/debugging                 | Roadmap Stage 3                                   | Explicitly deferred by roadmap; NOT IMPLEMENTED / N/A for Stage 1                                                               |
| Full release browser/reader/security/performance audit and publication     | Roadmap Stage 4 + separate authorization          | Explicitly deferred; NOT TESTED / N/A for Stage 1; publication NOT AUTHORIZED                                                   |

No mandatory Stage 1 item is classified as unverified, blocked, or not implemented. Future shared contracts anticipate history content, semantic/storage revisions, worker identity/versioning, safe paths, fixed geometry, and resource accounting; no future subsystem is disguised as operational.

## Architecture verification

1. **PASS:** contracts/domain import only inward pure modules. Zod stays in validation; browser IDs/time are injected.
2. **PASS:** WorkflowDocument version 1 is the single canonical format. Unknown fields/versions fail closed; renderer/runtime/session fields cannot serialize.
3. **PASS:** graph validation/algorithms execute without React, Zustand, React Flow, DOM, or storage.
4. **PASS:** isolated candidates and synchronous atomic store publication prevent partial mutation. Failed/no-op dispatch preserves store identity; stale intents reject.
5. **PASS:** one scoped vanilla store owns the session; interaction/UI slices are ephemeral. Topology adjacency is reused for presentation/config/viewport edits; current node lookup and diagnostics remain synchronized.
6. **PASS:** fixed 240x96 executable / 240x160 Note geometry, shared CSS tokens, named ports, semantic list/inspector, medium palette disclosure, compact stacked list, and initial Dark theme follow owners.
7. **PASS:** the final production build was served under response-header CSP and loaded without application console errors in the smoke journey.
8. **PASS:** Stage 2 controls are absent/explained; Run is disabled with a Stage 3 explanation. No fake save, execution, charts, history, or workers.
9. **PASS:** no fundamental design or workflow-format deviation. The limited theme bootstrap exception is explicit D-17; toolchain compatibility is D-18.
10. **PASS:** 65 unit/integration/component tests and 18 browser tests pass, with zero final skips/failures/flaky cases; applicable measured baselines pass.

Review triggers were examined: the closed command dispatcher exceeds the function-length review threshold but keeps explicit bounded cases and one publication path, supported by atomicity tests. Canvas navigation was split into a focused component; all React Flow selection and viewport callbacks retain stable identities across unrelated renders. No generic plugin/service/container framework was introduced. Source import cycles are rejected by the architecture suite.

## Graph and hostile-data integrity results

| Contract                                     | Result / evidence                                                                                                                                                                                                    |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Strict fixed objects and exact config unions | PASS; unknown fields, partial configs, irrelevant Condition values, wrong types and null rules                                                                                                                       |
| Raw decode                                   | PASS; byte-first check including BOM, fatal UTF-8, JSON syntax, escaped duplicate keys, depth/value lexical bounds                                                                                                   |
| JSON ownership/safety                        | PASS; descriptors inspected without invoking getters; symbols, hidden/inherited properties, exotic prototypes, nonfinite values, sparse arrays, cycles and lone surrogates rejected                                  |
| Relevant numeric caps                        | PASS; cap/cap+1 for document/payload bytes, document/value depth and counts, strings/UTF-8, keys, arrays, nodes/edge envelope, paths/pick lists, names/descriptions/Notes, coordinates/zoom, diagnostics and preview |
| Canonical form                               | PASS; direct sorted key emission including integer-like/astral keys, sorted UUID arrays, negative-zero normalization, 500 round trips                                                                                |
| Structural invariants                        | PASS; uniqueness, references, direction/ports/kind, Notes, self edges, duplicates, occupied inputs, disconnected cycles and 300-node back edges                                                                      |
| Readiness                                    | PASS; editable empty/draft state, reachable configuration errors, unreachable warnings and bounded issue totals/truncation                                                                                           |
| Command protection                           | PASS; stale callbacks, invalid target config, duplicate allocations, partial-invalid bulk moves, reconnect rollback and deletion cleanup                                                                             |
| Rendering/privacy                            | PASS; script-like strings stay literal; no content in error/log outputs; real loaded-shell interactions make zero network requests                                                                                   |

Later-stage runtime/history/storage/worker/clipboard/library/notification ceilings are named shared constants only; their enforcement tests are N/A until their owning systems exist. No claim that all 33 ceilings already have operational runtime enforcement is made. Version 1 has no earlier released schema to migrate; future migrations must use the persistence contract.

## Commands and actual outcomes

| Command                                                                                                                                             | Final result / counts                                                                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm ci`                                                                                                                                            | PASS; clean install completed, 402 packages installed, no peer conflict override                                                                       |
| `npm run typecheck`                                                                                                                                 | PASS; zero errors, strict flags active                                                                                                                 |
| `npm run lint`                                                                                                                                      | PASS; zero errors/warnings allowed                                                                                                                     |
| `npm run format:check`                                                                                                                              | PASS; source/config/README/report formatting checked; unchanged normative Markdown excluded from bulk reformatting                                     |
| `npm run test:unit`                                                                                                                                 | PASS; 5 files / 48 tests                                                                                                                               |
| `npm run test:integration`                                                                                                                          | PASS; 1 file / 9 tests, including 100 seeded sequences x 100 commands                                                                                  |
| `npm run test:components`                                                                                                                           | PASS; 1 file / 8 tests                                                                                                                                 |
| `node node_modules/vitest/vitest.mjs run --coverage --reporter=default --reporter=json --outputFile.json=docs/reports/evidence/vitest-results.json` | PASS; combined final rerun 7 files / 65 tests; no skipped tests. This is the same suite population, not 65 additional tests                            |
| `npm run build`                                                                                                                                     | PASS; final static assets and build manifest emitted; Vite's >500kB raw chunk advisory remains visible                                                 |
| `npm run test:e2e`                                                                                                                                  | PASS; production rebuild + localhost CSP server; 18/18 Chromium cases, zero skips, retries, unexpected failures or flaky results                       |
| `npm run test:baselines`                                                                                                                            | PASS; production rebuild + separate optimized benchmark; three fixture sizes, 30 samples after 5 warmups per operation; 10 fresh cold browser profiles |
| `npm ls --depth=0 --json`                                                                                                                           | PASS; selected direct package inventory has no invalid peers                                                                                           |
| `npm audit --json`                                                                                                                                  | PASS; zero advisory vulnerabilities at audit time, not a substitute for the future release security audit                                              |

Raw automated outcomes: [Vitest](evidence/vitest-results.json), [Playwright](evidence/e2e-results.json), [coverage](evidence/coverage-summary.json), [npm audit](evidence/npm-audit.json). PowerShell's npm wrapper did not forward extra reporter flags in one earlier invocation; the final retained Vitest report was produced by the explicit Node command above. No missing report file was counted as evidence.

Coverage: overall 95.48% statements, 90.37% branches, 99.12% functions, 97.21% lines. Domain branch aggregate is **91.60% (240/262)**; application/sample plus actual session store is **80.00% (24/30)**, with store itself 81.48%. Type-only contracts and UI/adapter modules are outside these domain/application coverage percentages; UI/adapter behavior is exercised by integration/component/browser cases. The sample module alone is 66.66% branches because its bundled-fixture rejection guard is not forced by corrupting the shipped fixture; invalid initial-session rejection is independently tested. No blanket exclusion or weakened assertion was used to conceal it. Coverage is supporting evidence, not conformance proof.

## Performance evidence

All times below are milliseconds. Final measured run: 2026-10-15T13:33:54.432Z.

| Metric                                       |  Median |     p95 | Maximum | Target p95 | Result |
| -------------------------------------------- | ------: | ------: | ------: | ---------: | ------ |
| Structural + readiness / 20 nodes            |    0.20 |    0.30 |    1.20 |         10 | PASS   |
| Canonical encoding / 20 nodes                |    0.70 |    1.40 |    1.50 |         10 | PASS   |
| Structural + readiness / 100 nodes           |    0.75 |    1.60 |    2.20 |         25 | PASS   |
| Canonical encoding / 100 nodes               |    3.30 |    4.80 |    4.90 |         30 | PASS   |
| Structural + readiness / 300 nodes           |    2.50 |    3.60 |    4.00 |         75 | PASS   |
| Canonical encoding / 300 nodes               |    6.85 |    9.70 |   10.30 |        100 | PASS   |
| Cold usable empty shell / 10 profiles        | 1038.45 | 1076.60 | 1076.60 |       3000 | PASS   |
| Cold empty-shell LCP / 10 valid observations | 1200.00 | 1248.00 | 1248.00 |       2500 | PASS   |

- [20-node fixture](evidence/fixture-20.json): 7845 bytes; SHA-256 `66fb4d7809292aa5c17104c14221b2e524d1408af07581ca894c67bd26554791`.
- [100-node fixture](evidence/fixture-100.json): 34852 bytes; SHA-256 `d39ffba0412d2f012478efa8be192347211c33c6dccc0789b53742733da9cb84`.
- [300-node fixture](evidence/fixture-300.json): 102559 bytes; SHA-256 `0a553c0cc5ca09ed65f10fe077c71820c36de09806f14bd3035f573b711a4b7d`.

Production index-DGUmE-gW.js: 552435 raw bytes, 168543 measured gzip bytes (164.59 KiB). SHA-256: `fa053d3849f0d3f3261be00919a253f6df1f6f6ecda053a1b22afafe0c4d766f`.

Production index-WmKlZ0ns.css: 33567 raw bytes, 7028 measured gzip bytes (6.86 KiB). SHA-256: `15717888dd99e647a7c71fdd5b7a2375043e20ac5467a69356c1d7f2ca7f2894`.

The 400 KiB initial JavaScript gzip SHOULD target is met. Validation/encoding fixture errors: zero. Final source identity: `60d078036fee3904e0dce60005baa21ea3cb8ff418bffdaac4a87be0baac6126`; lockfile SHA-256: `ffc26e0e86c0bdeda59f372e7b6cd4bf7599d3fc489a7ad0bd2b6f62dabb573b`.

Recipe: [graphs.ts](../../tests/fixtures/graphs.ts), seed 42615, exactly 20/100/300 nodes with approximately 10% Notes, one trigger, bounded approximately 1 KiB synthetic payload, typed transforms, both Condition branches, fixed IDs and grid positions. Actual canonical fixtures and SHA-256 identities are retained in evidence. Static structural/readiness validation and canonical encoding run in an optimized production browser bundle; SHA-256 timings are separately labeled one-off Node observations, not formal browser hash benchmarks.

Method: 5 warmups, 30 retained samples per operation; p95 sorted rank ceil(0.95*n). Cold load: 10 isolated new Chrome processes/profiles, cache disabled, 10 Mbps down / 1 Mbps up / 100ms RTT, no CPU throttling, two-frame shell-ready mark. The collector waits for positive LCP observation and fails on missing/zero samples. No outlier was removed. Raw samples, cold long-task durations, transfer sizes, environment and asset hashes are in [baselines.json](evidence/baselines.json). Cold long tasks are reported; steady pan/drag stress, storage, worker, memory cleanup, near-limit import/export responsiveness and full Firefox/Safari comparisons belong to later-stage performance gates.

The local test server serves uncompressed assets; actual recorded network transfer is distinguished from measured gzip asset bytes. No lazy chunks exist in this foundation build. Vite's raw-size warning is not suppressed. The gzip budget is met and cold-load targets pass, so speculative splitting was not added under D-12. Headless automation and ambient OS activity remain reproducibility limits; these results do not establish full beta performance certification.

## UI, accessibility and visual evidence

Production journeys verify real node/edge rendering, pointer pan, wheel/button zoom, fit, four-direction pan controls, grid, selection/inspector, keyboard skip/list access, focus ring, theme persistence and System changes, reduced motion, initial Dark even with a light OS preference, unavailable-capability explanation, and no post-load workflow network activity. Axe reports zero violations in the canvas and dark/light list journeys. This is scoped automated evidence, not full WCAG or reader conformance.

Both themes were rendered and visually inspected at 1440x900, 1024x768, 768x1024 and 320px width. Browser assertions reject page-level horizontal overflow. At 200% text both themes retain list access and readable inspector content. Narrow view defaults to a semantic list; the medium palette is a disclosure instead of covering focus. 320px reflow is automation evidence; actual OS/browser-menu 400% zoom and NVDA/VoiceOver journeys remain NOT TESTED and are assigned to later editor/release manual gates.

Examples: [dark canvas](evidence/shell-dark-1440.png), [light canvas](evidence/shell-light-1440.png), [medium dark](evidence/shell-dark-1024.png), [medium light](evidence/shell-light-1024.png), [768 dark](evidence/shell-dark-768.png), [768 light](evidence/shell-light-768.png), [320 dark](evidence/shell-dark-320.png), [320 light](evidence/shell-light-320.png), [200% dark](evidence/text-200-dark.png), [200% light](evidence/text-200-light.png). No physical screen-reader session or manual human journey is represented as performed.

## Defects, corrections and remaining risks

No unresolved defect is known to violate a mandatory Stage 1 criterion.

| Finding                                                                                         | Resolution / current risk                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canvas handles had labels on generic divs (mandatory accessibility defect)                      | Fixed with static port image semantics; real-canvas axe regression now passes without excluding handles                                                                                     |
| Initial sample required excessively small fit zoom; medium palette and rem sizing needed review | Compacted synthetic positions while preserving graph/IDs/config, implemented medium disclosure, corrected rem base and toolbar reflow; final size/theme/200% cases pass                     |
| Cross-type configuration rejection used import taxonomy                                         | Fixed in the command boundary; CONFIG_INVALID/config classification and unchanged session are asserted by the integration regression                                                        |
| Topology-preserving command validation rebuilt temporary adjacency                              | Split shape/budget validation from full external validation; reuse topology adjacency, refresh current node lookup, preserve unchanged projections; integration and architecture gates pass |
| Raw BOM size and payload resource errors needed precise accounting                              | Raw byte cap includes BOM; payload breaches retain RESOURCE_LIMIT taxonomy; regressions pass                                                                                                |
| LCP collector read before observer delivery                                                     | Added explicit observation wait and missing-sample rejection; final 10/10 LCP samples are positive; earlier zero-valued samples are not acceptance evidence                                 |
| Native JSON generator produced forbidden empty keys                                             | Restricted generated round-trip fixtures to the supported JSON contract; invalid keys remain explicit rejection tests; 500 accepted cases still run                                         |
| Long required command property exceeded the initial 30s test timeout                            | Allocated 120s to that case; all 100 x 100 operations run, no skips or reduced case count                                                                                                   |
| Clean install overlapped an active test, causing Windows EPERM and an invalidated test run      | Finished/cleared the test cycle, completed clean npm ci, reran all 65 tests and browser/build gates; failed intermediate evidence is not reused                                             |
| Sandbox DNS/localhost restrictions                                                              | Registry/install and real-browser verification ran through authorized host access; test-owned server conflicts were cleaned up                                                              |
| ESLint 9 upstream-deprecated                                                                    | Medium maintenance risk; Stage 4 owner must review the compatible linter/accessibility-plugin group. Current strict lint and advisory checks pass; no peer requirements bypassed            |
| Raw JS chunk exceeds Vite's 500kB heuristic                                                     | Low maintenance concern; actual gzip/cold targets pass. Keep visible; optimize only measured bottlenecks                                                                                    |
| Full beta systems and manual compatibility evidence absent                                      | Intentional roadmap boundary, not verified functionality; Stage 2–4 must implement/test their own contracts                                                                                 |

## Contract maintenance and Stage 2 dependencies

Workflow schema version remains 1 with no added persisted fields, altered node semantics, migration, or renderer serialization. Shape-only validation is confined to trusted topology-preserving command candidates; decoding, initial opening and public encoding fully revalidate. Multi-issue failure totals/truncation are result metadata outside the document format.

Maintained owners: README, TECHNOLOGY_STACK, DEVELOPMENT_WORKFLOW, GRAPH_SCHEMA, STATE_MANAGEMENT, PERSISTENCE, ROADMAP, QUALITY_GATES, DECISIONS, reports index. The original substantive blueprint is preserved; BLUEPRINT_AUDIT remains historical. D-17 permits theme-only localStorage bootstrap while IndexedDB remains deferred; missing preference uses Dark, invalid/denied reads use System, write failure explains itself. Stage 2 must migrate that preference into IndexedDB settings after a successful transaction and only then remove the old key. D-18 records the compatible locked toolchain and deprecation risk. No fundamental contradiction remains unresolved.

Stage 2 requires a new explicit assignment. It should reuse the reducer/schema/codec/registry and add bounded transactional history, full editor/clipboard/keyboard interactions, workflow management, native IndexedDB/CAS/backups/save acknowledgements, import-as-new/export UI and complete editor accessibility. It must preserve current stale-session, identity, no-op, reference and revision guarantees. Storage/run ceilings named now still need their owning-stage enforcement. Stage 3 must implement strict worker protocols and real deterministic execution; the current idle run contract is not an engine. Stage 4 still owns full browser/reader/security/license/hosting/release evidence. Repository ownership/license/CI/hosting remain intentionally unresolved before their documented deadlines.

## Stage 1 acceptance checklist

- [x] S1-01 functional locked application/tooling, production shell and relevant scripts verified.
- [x] S1-02 strict canonical types, bounded schemas/codec and integrity evidence verified.
- [x] S1-03 deterministic pure graph algorithms and import boundaries verified.
- [x] S1-04 canonical session/controlled adapter/selection/viewport foundation verified.
- [x] S1-05 scoped shell/canvas/list/theme/focus/responsive foundation verified.
- [x] S1-06 applicable baselines, actual evidence, traceability and report completed.
- [x] No commits, tags, publication, deployment or Stage 2–4 implementation performed.

Architecture: PASS. Domain model: PASS. Graph validation: PASS. Application foundation: PASS. UI foundation: PASS. Tests: PASS. Documentation: PASS.

**OVERALL STATUS: PASS — Stage 1 complete. Stop at this boundary.**
