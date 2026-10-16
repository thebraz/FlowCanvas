> Historical strict assessment. The owner subsequently authorized the focused beta profile; see [BETA_READINESS.md](BETA_READINESS.md) and D-23. Results below retain their original status and artifact identity.

# FLOWCANVAS — FINAL ENGINEERING AUDIT

Audit date: 2026-10-16. Assigned scope: Stage 4 independent engineering/security audit, feasible hardening and conditional GitHub public beta publication. **Overall Stage 4: FAIL. RELEASE STATUS: BLOCKED.**

## Technical assessment

The application has a coherent, working local editor, canonical graph, transactional history, IndexedDB coordinator and closed worker engine. Nine confirmed integrity/usability/accessibility defects were corrected without changing canonical serialization, workflow formats, node semantics or public limits. The current evidence does not establish beta readiness: mandatory performance targets fail, manual accessibility and the full branded-browser matrix are unavailable, and repository/license/publication metadata is unresolved. Passing local functional cases does not waive those gates.

| Area                  | Audit result                                                                       |
| --------------------- | ---------------------------------------------------------------------------------- |
| Architecture          | PASS                                                                               |
| Graph integrity       | PASS                                                                               |
| Undo/redo             | PASS                                                                               |
| Persistence           | PASS for tested local engines                                                      |
| Execution engine      | PARTIAL: functional cases pass; fault-path coverage target missed                  |
| Security              | PARTIAL: no reportable vulnerability; original scan snapshot/final-platform limits |
| Performance           | FAIL                                                                               |
| Accessibility         | PARTIAL                                                                            |
| Browser compatibility | PARTIAL                                                                            |
| Automated tests       | PARTIAL: available suites pass, mandatory Firefox cannot launch                    |
| Documentation         | PASS for local audit deliverables; public metadata remains unresolved              |

Package version remains **0.0.0**, private. Proposed `v0.1.0-beta.1` was not created. There is no local `.git`, commit hash, branch, remote, established GitHub destination, application LICENSE, public security contact or CI configuration. **No commit, tag, release, asset publication or deployment was performed. GitHub release URL: none.** Conditional publication authorization exists in the assignment, but no concrete destination or passing release gate permits the external operation.

Historical Stage 1 PASS and Stage 2/3 FAIL reports were inspected and retained. They were not accepted as proof of current behavior or rewritten after scoped fixes. [D-22](../DECISIONS.md) records Stage 4 authorization, compatibility and evidence policy. [STAGE_4_REPORT.md](STAGE_4_REPORT.md) is the standard stage-report entry point; this file owns the assessment.

## Scope, method and environment

Read the root and applicable parent instructions, README, all 25 normative engineering specifications, roadmap/decisions/release checklist and previous implementation/browser reports. The code knowledge graph narrowed the investigation before source verification; its roughly 18-hour-old index (1,967 nodes/110 files, no community partition) was not treated as current proof. First-party source/config/scripts/tests/styles were independently reviewed. Generated artifacts and installed dependency source were excluded from line-by-line first-party review; dependency advisories/licenses and actual build behavior were checked separately.

Verification used synthetic documents, isolated browser profiles/databases and the production static server with intended document/worker CSP. No existing user database was cleared, and no payload/secret was added to production logs or reports. Fast storage fault tests use fake-indexeddb; browser persistence cases use real IndexedDB. Quota is deterministic failure injection, not proof of physically exhausted browser quota. There is no earlier released schema to migrate; unknown versions and preservation on failed validation are tested instead of inventing a historical migration.

| Environment item       | Actual evidence                                                                                                                                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| OS/hardware            | Windows 11 Home Single Language 10.0.26200; Intel i7-1255U, 10 cores/12 logical processors; approximately 16 GiB RAM; Iris Xe driver 32.0.101.7082; physical display 1366×768 at 60 Hz                                   |
| Runtime/toolchain      | Node 24.19.0, npm 11.6.4; exact package versions in package-lock.json                                                                                                                                                    |
| Browser engines        | Playwright 1.64.1: Chromium 156.0.8078.4; WebKit 27.2. Firefox 157.0/revision 1555 installed but cannot launch                                                                                                           |
| Branded browsers       | Chrome 155.0.8059.82; Edge 155.0.4283.45                                                                                                                                                                                 |
| Browser geometry       | Headless desktop automation; 1440×900 CSS pixels; Chromium/Chrome/Edge scale 1, WebKit Desktop Safari device profile scale 2; responsive cases also 1024/1023/768/320. Chrome performance runners explicitly use scale 1 |
| Power/reference limits | Balanced power plan. AC power, ambient load, throttling and every reference-machine condition were not independently certified; cross-machine/browser comparisons are not claimed                                        |
| Artifact identity      | Final source/build/fixture/evidence SHA-256 inventory: [artifact-manifest.json](evidence/stage4/artifact-manifest.json). No Git commit identity exists                                                                   |

[environment.json](evidence/stage4/environment.json), [browser-availability.json](evidence/stage4/browser-availability.json) and the final manifest identify exact local inputs. Final source identity: `17521c56ffd6ee339ae031b363d5c0cecc28a2ac29a24f492a2528b4c4b7c3c1` (method and 172 source/config/public/doc inputs in the manifest). Production `dist` contains the closed worker, no stalled/crashed test handlers. `dist-benchmark` is a separate optimized test artifact and must never be shipped as the application.

## Requirement traceability

Results below distinguish functional proof from incomplete release-wide evidence. Source paths are relative to the repository; linked evidence is current Stage 4 evidence unless explicitly labeled an earlier attempt.

| ID / source                              | Implementation and independent verification                                                                                                                                   | Result / deviation                                                                               |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| PR-01, PRODUCT_SPEC: document management | application/persistence.ts, documents.ts; features/workflows; 27 adapter/coordinator cases and production editor creation/open/rename/duplicate/delete/reload journeys        | PASS locally after AUD-02/03; browser release matrix remains incomplete                          |
| PR-02: six node types/configuration      | contracts/workflow.ts, validation/schemas.ts, Inspector/Palette; strict schema and component tests, actual editor Apply/Cancel                                                | PASS                                                                                             |
| PR-03: commands/history/clipboard        | domain/graph/commands.ts, history.ts, subgraph.ts, state/store.ts; generated transactions, grouped operations, real handle reconnect, clipboard fallback and interrupted drag | PASS after selection/drag fixes; exact final browser evidence below                              |
| PR-04: hostile import/canonical export   | validation/codec.ts, lexical.ts, json-safety.ts, readable-export.ts; 500 JSON properties, malformed UTF-8/duplicate keys/unknown fields/size, actual downloads/import-as-new  | PASS; compact bytes/hashes unchanged                                                             |
| PR-05: durable ordering/CAS              | persistence adapter/coordinator; actual transaction-complete Saved, two-tab conflict, save/delete races, checksum/backup preservation                                         | PASS for tested local engines after AUD-01/02/03; Firefox/Safari proof unavailable               |
| PR-06: deterministic closed worker       | engine compile/nodes/scheduler/ledger, worker entry and RunCoordinator; independent expected results, 500 array permutations, actual production module worker                 | PASS functional subset; engine coverage target and performance remain below target               |
| PR-07: lifecycle/control budgets         | application/execution.ts, scheduler.ts; pause/step/resume/reset, hung/stalled/crashed workers, reserved cancel slot and watchdogs                                             | PASS functional/control subset; synthetic delay is 200 ms per operation, under 1,000 ms watchdog |
| PR-08, ACCESSIBILITY                     | graph list, numeric movement, connection dialog, Modal, shortcuts/live regions; components, axe, real keyboard tests                                                          | PARTIAL: corrected mandatory focus errors; NVDA/VoiceOver/manual release proof absent            |
| PR-09, DATA_CONTRACT/PERFORMANCE_SPEC    | shared contracts/limits.ts and validators on every boundary; hostile input/worker budget tests and 20/100/300/5 MiB benchmarks                                                | FAIL: measured performance criteria exceeded; safety ceilings retained                           |
| PR-10: themes/empty states/navigation    | App, theme, editor controls, examples, diagnostics and execution panels; both themes, 320 px list, forced-colors emulation, command palette                                   | PASS automated local subset; native contrast/physical-device review NOT TESTED                   |
| S4-01, ROADMAP                           | complete source review, nine fixes with regressions; graph/history/storage/worker evidence                                                                                    | PARTIAL until full release evidence; no blanket certification from source review                 |
| S4-02                                    | independent foundation/editor/runtime/stress/cold runs, raw samples and heap snapshots                                                                                        | FAIL; detailed table below                                                                       |
| S4-03                                    | Playwright engine runs plus current local Chrome/Edge subset                                                                                                                  | PARTIAL: manual readers, branded Safari/Firefox and previous-stable matrix unavailable           |
| S4-04                                    | clean lockfile install, strict types/lint/format/build, all fast suites, advisory/license/CSP review and updated docs                                                         | PARTIAL: final local checks recorded; public metadata/CI unresolved                              |
| S4-05                                    | changelog, compatibility and rollback recorded                                                                                                                                | PARTIAL: no versioned beta package/tag/assets while earlier gates fail                           |
| S4-06                                    | assignment authorizes publication only after gates and repository policy permit                                                                                               | NOT TESTED / BLOCKED: no destination, no passing technical gates; no external action attempted   |

## Architecture, graph and history

The AST architecture regression checks every source module for resolved imports, inward domain/contracts dependencies, engine isolation, forbidden executable/network capabilities and import cycles. Source review confirmed one immutable WorkflowDocument is graph truth; React Flow arrays/indexes/overlays are derived, and runtime/drafts/history remain outside persistent documents. No competing mutable graph authority or production test hook was found. Strict TypeScript, noUncheckedIndexedAccess and exactOptionalPropertyTypes remain enabled. No production dependency was added.

| Contract                                                                                                                          | Source / observable proof                                                                                                                 | Result                                 |
| --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Unique workflow/node/edge IDs, exact node/port registry, no dangling/self/duplicate/occupied inputs, no executable links to Notes | GRAPH_SCHEMA; invariants.ts, strict codec; graph/schema/budget tests, rejected real connections                                           | PASS                                   |
| Acyclic whole executable graph, including disconnected components; deterministic topological order/reachability                   | GRAPH_ALGORITHMS; iterative algorithms/indexes; 500 generated DAGs with seed 42615 and array permutations                                 | PASS                                   |
| Atomic accepted/rejected commands and stable IDs                                                                                  | GRAPH_COMMANDS; reducer/store candidates; 100 seeded sequences of 100 operations plus explicit invalid reconnect/config/ID-provider cases | PASS                                   |
| Bulk deletion cleanup, duplication/paste internal-edge remapping, copy identity/order preservation                                | commands/subgraph/documents; integration/clipboard/real editor tests                                                                      | PASS                                   |
| Exact undo/redo content restoration, redo invalidation, bounded history, no alias mutation                                        | history.ts; mixed generated sequences, bulk/config/paste/drag grouping and boundary cases                                                 | PASS                                   |
| Persistent/semantic/topology revisions, viewport/selection exclusion, switch isolation                                            | STATE_MANAGEMENT; store/session integration and real switch/save journeys                                                                 | PASS                                   |
| Interrupted drag/capture and overlays never save partial commands                                                                 | EDITOR_INTERACTIONS; useCanvasInteractions; production escape/capture/reload journeys                                                     | PASS                                   |
| Narrow subscriptions/projection reuse                                                                                             | projection.ts, selectors, component render regression and integration identity assertions                                                 | PASS; 300-node frame budget still FAIL |

The line-count review triggers were considered for larger state/persistence/engine modules; existing cohesive ownership and tested direct dependencies were retained. No speculative service/repository/plugin framework or broad rewrite was introduced merely to reduce line counts.

## Confirmed defects and corrections

| ID / severity                                             | Reproduction and root cause                                                                                                                              | Correction and regression                                                                                                                                                                                                                                          |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AUD-01 High: wrong-key storage envelope destroys evidence | A valid checksummed B envelope injected under A's record key passed save preverification; a subsequent A save could replace original and verified backup | Bind previous envelope document.id to requested workflow key before any transaction. [storage-before.json](evidence/stage4/storage-before.json) reproduced failure; integration and actual browser audit preserve both copies and reject STORAGE_CORRUPT           |
| AUD-02 Medium: deletion silently cancels autosave         | remove() cleared active timer while deleting another/missing document; failed active deletion also left retained dirty content unscheduled               | Pause only active target; finally reschedule retained dirty captured session unless disposed/halted/memory-only/switched. Tests include unrelated, missing and wrong-revision deletion                                                                             |
| AUD-03 High: stale Save-as-New loses newer edits          | duplicate(document,true) captured old content, awaited in-flight save, then switched over edits made during the await                                    | Capture session before await and reject STALE_SESSION if session/document changes. Newer active content remains untouched                                                                                                                                          |
| AUD-04 Medium: stale selection anchor                     | Shift-click after switch/deleting the prior anchor selected no current node                                                                              | Only range-select when anchor exists in current sorted list; ordinary selection otherwise. Two component regressions                                                                                                                                               |
| AUD-05 Medium: wrong initial connection port              | First source Condition displayed true while internal default was out                                                                                     | Initialize port from actual closed node registry. Component regression connects to actual Output                                                                                                                                                                   |
| AUD-06 Medium: connection errors lose accessible context  | Failed submission left focus on submit and selects lacked linked error                                                                                   | Focusable error summary, describedby links and success announcement. Component and real-browser rejection tests verify unchanged graph                                                                                                                             |
| AUD-07 Medium: pointer button focus differs in WebKit     | Pointer invocation did not focus movement/dialog invoker; arrows and restoration failed                                                                  | Shared Button focuses itself before caller callback. Existing real WebKit movement/modal regressions pass                                                                                                                                                          |
| AUD-08 Medium: palette drag ignored in WebKit             | Native transport discarded custom MIME type; drop contained text types but no registered node type                                                       | Supply namespaced plain-text fallback alongside custom MIME; whitelist NODE_TYPES before CreateNode. [webkit-diagnostics.json](evidence/stage4/webkit-diagnostics.json) records original native events; unchanged coordinate/grid/undo regression passes after fix |
| AUD-09 High: mandatory skip navigation inaccessible       | WebKit traversed controls/body repeatedly but omitted the native anchor                                                                                  | Explicit tabIndex=0 includes skip link in sequential navigation. Existing keyboard-only browser regression passes after fix                                                                                                                                        |

[editor-before.json](evidence/stage4/editor-before.json) retains four original editor failures; [races-before.json](evidence/stage4/races-before.json) retains both race failures. [regressions-after.json](evidence/stage4/regressions-after.json) records the initial 31 passing focused regressions; [final-targeted.json](evidence/stage4/final-targeted.json) records 45 passing component/storage cases including failed active deletion. Final complete verification supersedes these intermediate counts without erasing their evidence.

Harness corrections are separate from product fixes: stage-isolated evidence directories; per-browser trace destinations; a 60 s multi-step test deadline (no performance target change); one-worker isolated follow-ups, zero retries; screenshots after zero-console/network assertions because WebKit screenshot synchronization injects a CSP-blocked `body {}` stylesheet even with caret preservation. Production CSP and functional assertions stay unchanged. A 30 ms synthetic operation delay could finish the complete 15-operation run before WebKit's stable-button click; the test-only delay is now 200 ms, still below the unchanged operation watchdog, and pause/resume assertions are unchanged. This delay is absent from production handlers.

## Persistence and execution audit

Persistence review traced each await, captured identity, in-flight/latest queue, CAS transaction, backup promotion, close/versionchange and disposal path. Save success comes only from transaction completion. Updates require the expected revision and existing key; deletion cannot be resurrected by a stale save. Failed quota/abort/corruption/unsupported record reads preserve memory and stored evidence. Last-opened/settings writes occur after verified creation/open; runtime state is excluded from stored/exported documents. Recovery is explicit backup-as-new, export, retry or memory-only, never silent repair/merge/eviction.

Real-browser cases cover overlapping writes, edit during slow checksum, switch while saving, two tabs from one revision, stale delete writers, transaction abort, blocked upgrade/versionchange, malformed/oversized/versioned imports, corrupt checksums, raw-record/backup recovery and reload. The miskeyed-envelope audit is synthetic corruption injection; it is a genuine integrity defect, not evidence that an unprivileged import can arbitrarily write another key.

Engine review verified all executable node contracts and inert Notes, immutable payload ownership, literal own-property paths, UUID order, multiple triggers, fan-out, exclusive Condition routes, inactive branches, disconnected nodes, missing/null/type distinctions, Output order, partial failures and no activated output. Generated semantic comparisons exclude run IDs/timing only. The host and worker independently compile/validate. Current messages require strict shape/budget, identity, contiguous sequence, known nodes/ports, legal lifecycle, staged atomic payload publication and consistent terminal counts. Stale traffic is ignored; malformed current traffic terminates safely. Host watchdogs and foreground cancellation remain independent of cooperative worker progress. Reset/switch/dispose terminate workers and release registries/listeners/timers.

The runtime unit/integration/security subset contains 60 cases (44+12+4) within the full fast run. Real production-worker and delayed/hung/synchronously-blocked/crashed test-worker paths are separate evidence. Performance proof, missing platforms and coverage gaps limit release confidence even when functional cases pass.

## Security assessment

Codex Security standard scan `d0a4581b-cb29-41e7-9d1e-d169d5a3fa6f` completed with **0 reportable attacker-driven vulnerabilities**, seven reviewed surfaces and explicit generated/dependency exclusions. Canonical report/threat-model/findings/coverage/SARIF paths, original snapshot digest, warnings and measured usage are recorded in [security-scan-summary.json](evidence/stage4/security-scan-summary.json). The scanner warned that the directory changed/target became unavailable during scanning; it saved the original sealed snapshot. The canonical report is source-review evidence for that snapshot, not a certification of a later release artifact. Parent source review and final runtime regressions cover the corrections separately.

AUD-01 was reproduced and fixed as a High engineering integrity defect. The security candidate was rejected because no hostile-import route to wrong-key storage was established; compromised same-origin code already holds direct IndexedDB authority and is outside the stated attacker policy. This calibration does not downgrade its release-critical data-integrity impact.

| Surface                 | Verified defenses / evidence                                                                                                                                                                   | Limits                                                                                    |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| XSS/data egress         | React text, bounded literal previews, explicit eligible downloads, sanitized filenames/object URL cleanup; hostile labels/notes/payloads remain inert with zero unexpected requests/navigation | No remote deployment inspected                                                            |
| Prototype/path attacks  | Recursive forbidden keys, descriptor/prototype checks without getter execution, own-property literal paths, strict unknown inputs and duplicate-key lexical preflight                          | Browser/OS and trusted dependencies remain privileged                                     |
| Resource exhaustion     | Byte/depth/value/node/edge/history/payload/event/control/operation/run budgets and bounded diagnostics; schema/budget/security/worker regressions                                              | Valid near-limit synchronous codec still violates long-task performance target            |
| Code/network capability | Closed bundled handlers, no eval/Function/user expressions/data-selected imports/network nodes; AST/lint/source review and actual worker CSP/no-network tests                                  | Worker is isolation/termination, not a complete sandbox                                   |
| Storage                 | Checksums/canonical bytes, key binding, transaction CAS and verified backups; actual corrupt/abort/two-tab tests                                                                               | Checksum is not authentication or encryption; browser eviction/shutdown remains possible  |
| Supply chain/secrets    | Clean locked install; live npm audit on 2026-10-16: 0 advisories of every severity; first-party secret/config sweep; dependency license inventory                                              | Advisory snapshot is time-bounded, not exhaustive dependency source review                |
| Response policy         | Local production document and worker use intended CSP, nosniff/no-referrer, exact static asset whitelist; no permissive script/eval allowance                                                  | Vite preview is inspection-only; HTTPS/live host policy NOT TESTED because no host exists |

[npm-audit.json](evidence/stage4/npm-audit.json) and [dependency-licenses.json](evidence/stage4/dependency-licenses.json) are raw evidence. Clean `npm ci` installed 403 packages/audited 404; the initial offline attempt failed ENOTCACHED and is retained, then the network-enabled locked install passed. Lock inventory contains 449 entries, 403 installed; installed packages have recorded license metadata, runtime licenses MIT/ISC/BSD-3-Clause. This does not supply an application license grant. Official registry peer checks still support the selected TypeScript <6.1/ESLint ^9 group; upstream ESLint 9 deprecation remains known, with no unsupported forced upgrade.

Security workbench returned measured token usage, coverage complete across five threads: total **27,020,613**, input **26,937,891**, cached input **25,981,184**, output 82,722 (reasoning output 27,895). These are tool-reported accounting values, not a cost estimate or a claim about this audit's source size.

## Performance

Authoritative targets remain [PERFORMANCE_SPEC](../PERFORMANCE_SPEC.md). Seed 42615 creates exact 20/100/300-node representative DAGs with Notes, fixed identities/positions, bounded approximately 1 KiB payloads, active/inactive branches and single input. Each operation uses five warmups and 30 retained samples; p95 is sorted rank ceil(0.95×n). Pan/zoom/group overlays use fixed five-second paths and frame deltas. Raw median/p95/max/samples, fixture hashes, traces and long tasks are retained. Cold load uses ten new profiles, disabled cache, 10 Mbps down/1 Mbps up/100 ms latency and no CPU throttle. No outlier was discarded.

Final measurement tables are generated below from the current evidence. The separate foundation shell is identified honestly; the additional cold runner serves actual production `dist`, waits for storage-ready plus two frames and verifies the enabled first-run manager. The final foundation measurement adds UTF-8 encoding and isolated browser SHA-256 samples: only its entry chunk/HTML and benchmark manifest changed, as verified in [benchmark-identity-change.json](evidence/stage4/benchmark-identity-change.json); production and editor/runtime/worker harness assets are unchanged. The prior text-only baseline remains baselines-before-utf8.json. Neither optimized harness nor headless Chrome substitutes for branded Firefox/Safari/reference-machine/manual proof.

<!-- PERFORMANCE_TABLES -->

Representative values are **p95 milliseconds**. Median, maximum and every raw sample are in the linked JSON; no outlier was removed.

| Metric                           | Target 20 / 100 / 300 | Observed 20 / 100 / 300  | Result |
| -------------------------------- | --------------------- | ------------------------ | ------ |
| Structural/readiness validation  | 10 / 25 / 75          | 0.40 / 1.10 / 2.30       | PASS   |
| Canonical text + UTF-8 encoding  | 10 / 30 / 100         | 0.60 / 2.40 / 4.10       | PASS   |
| open                             | 250 / 500 / 1000      | 34.00 / 33.60 / 34.40    | PASS   |
| firstRender                      | 100 / 250 / 600       | 34.50 / 33.60 / 34.40    | PASS   |
| config                           | 20 / 35 / 50          | 17.00 / 17.60 / 18.50    | PASS   |
| select                           | 10 / 16 / 25          | 17.70 / 20.20 / 33.10    | FAIL   |
| clear                            | 10 / 16 / 25          | 17.20 / 20.50 / 29.20    | FAIL   |
| undo                             | 30 / 60 / 100         | 16.90 / 19.40 / 21.90    | PASS   |
| redo                             | 30 / 60 / 100         | 18.30 / 18.90 / 26.20    | PASS   |
| save                             | 500 / 500 / 500       | 8.10 / 14.90 / 38.60     | PASS   |
| autosave                         | 1000 / 1000 / 1000    | 532.80 / 544.40 / 598.20 | PASS   |
| pan frame                        | 16.7 / 20 / 25        | 16.90 / 16.80 / 16.90    | FAIL   |
| zoom frame                       | 16.7 / 20 / 25        | 16.80 / 16.80 / 16.80    | FAIL   |
| drag frame                       | 16.7 / 20 / 25        | 16.80 / 16.80 / 16.80    | FAIL   |
| Compile + complete actual worker | 100 / 300 / 1000      | 73.20 / 93.00 / 231.60   | PASS   |

Browser SHA-256 p95 (pre-encoded canonical bytes): 20: 0.10 ms; 100: 0.10 ms; 300: 0.30 ms. Node one-off fixture hash timings are retained separately and are not browser latency claims.

[Foundation samples](evidence/stage4/foundation/baselines.json), [editor samples/frames](evidence/stage4/editor/editor-performance.json), [worker samples/trace](evidence/stage4/runtime/runtime-performance.json). Gesture long tasks: 20 nodes: 0, maximum 0 ms; 100 nodes: 0, maximum 0 ms; 300 nodes: 0, maximum 0 ms. Runtime main-thread long tasks: 3, maximum 56 ms.

| Actual production cold load          | Median / p95 / maximum ms   | Target p95 | Result |
| ------------------------------------ | --------------------------- | ---------- | ------ |
| Storage-ready usable first-run shell | 1010.15 / 1249.30 / 1249.30 | 3000       | PASS   |
| LCP                                  | 1186.00 / 1256.00 / 1256.00 | 2500       | PASS   |

[Actual production cold samples](evidence/stage4/cold/cold-performance.json): main JavaScript 653039 raw bytes / 195689 gzip bytes; worker is a separate asset loaded on execution. Initial JS gzip is below 400 KiB. The separate empty-shell foundation harness reports ready p95 1031.40 ms / LCP 1164.00 ms; it does not replace the actual-app row.

| 5 MiB stress operation | Median / p95 / maximum ms | p95 target | Maximum main-thread task / target | Result |
| ---------------------- | ------------------------- | ---------- | --------------------------------- | ------ |
| import                 | 244.25 / 314.20 / 362.00  | 1000       | 362 / 100 ms                      | FAIL   |
| export                 | 175.15 / 213.70 / 264.10  | 500        | 264 / 100 ms                      | FAIL   |

The valid stress fixture is exactly 5242880 bytes, 44 nodes / 22 edges, SHA-256 `6d52745f1c4fbc08d7208e400a9d610f5ab2462b036969e4d67296c9cacfde76`. [Stress evidence](evidence/stage4/stress/stress-performance.json) retains samples/tasks; file picker/read/download overhead is excluded.

| Fixture | Post-GC heap above empty baseline MiB | Target MiB | Commands / runs / worker cleanup | Result |
| ------- | ------------------------------------- | ---------- | -------------------------------- | ------ |
| 20      | 6.13                                  | 80         | 100 / 10 / 10 of 10              | PASS   |
| 100     | 9.33                                  | 120        | 100 / 10 / 10 of 10              | PASS   |
| 300     | 17.21                                 | 200        | 100 / 10 / 10 of 10              | PASS   |

Heap snapshots are retained under evidence/stage4/stress/heap-{20,100,300}.heapsnapshot. The 100 committed commands are repeated node movements; this does not claim every command family was exercised in the heap fixture. After 5 baseline + 50 actual open/run/reset cycles, post-GC growth was 0.12 MiB (target <=10 MiB); cleanup is 226/226 workers, 0 payloads, 0 events. Cancellation maximums: hang 6.70 ms; blocked 120.10 ms (foreground <=200 ms). Unsupported cross-browser heap measurements are NOT TESTED.

<!-- /PERFORMANCE_TABLES -->

Measured bottlenecks: selection's painted-frame latency sits near the 60 Hz frame interval, exceeding the 10/16 ms targets even without repeated long tasks; frame/selection deviations and their exact sizes are shown above. The initial runtime run missed the 20-node execution target (148.5 ms p95 versus 100 ms); the final runtime run passes locally. Both datasets remain retained under initial-measurements/runtime and runtime, with no outlier removed or unsupported claim of environmental cause. Near-5 MiB decode/validation/encoding execute synchronously in the current boundary and block the main thread beyond 100 ms. Existing narrow selectors, stable projection entities, frame-batched overlays, viewport culling, bounded caches and canonical allocation optimizations were retained. Solving the stress target requires a separately verified cooperative/asynchronous boundary or worker transport while preserving canonical bytes; no format/limit relaxation or speculative rewrite is used to fabricate a pass. Current editor/stress deviations remain release blockers owned by the editor/codec maintainers; runtime/reference variability remains a verification limitation, not an accepted exception.

## Accessibility and browser verification

Automated accessibility covers both themes, labels/roles, dialogs/inert background/focus wrap/restoration, connection error focus, keyboard/list parity, numeric/arrows/connection alternatives, text reflow, 320 px, reduced motion, forced-colors emulation, runtime announcements and output inspection. Screenshots are actual synthetic browser captures; they are not manual assistive-technology evidence. Native Windows contrast, physical pointer targets, screen-reader timing, real 200% platform text/400% browser zoom and IME/platform behavior require manual confirmation where automation only emulates/checks geometry.

| Accessibility IDs | Current evidence                                                                                                          | Result                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| A11Y-01/03/04/10  | Production keyboard/modal/movement/list/connection tests; AUD-06/07/09 regressions                                        | Automated subset PASS; manual traversal/restoration review NOT TESTED |
| A11Y-02/05/06     | Component semantics/labels/errors/live regions, axe both themes; failed connection retains graph and focuses linked error | PARTIAL: real reader semantics/announcement timing NOT TESTED         |
| A11Y-07           | Axe contrast and SVG edge/focus assertions, text status alongside colors                                                  | PARTIAL: manual canvas/native contrast review absent                  |
| A11Y-08/09        | Responsive screenshots and layout assertions, 200% CSS text/reduced-motion automation                                     | PARTIAL: physical 400% browser zoom/manual proof absent               |
| A11Y-11/12        | Control geometry, non-drag alternatives, shortcut editable-context/IME guards                                             | PARTIAL: manual target/platform/IME matrix absent                     |

Required NVDA with current Chrome and Firefox, and macOS VoiceOver with Safari: **NOT TESTED**. NVDA is absent from the standard local install path; this is not a claim of a full-device software inventory. No macOS/Safari/VoiceOver environment was available. No accessibility conformance badge is claimed.

<!-- BROWSER_TABLES -->

| Browser                                        | Scope                         | Actual final cases        | Elapsed  | Result                 |
| ---------------------------------------------- | ----------------------------- | ------------------------- | -------- | ---------------------- |
| chromium 156.0.8078.4                          | full production engine suite  | 78 PASS / 0 FAIL / 0 SKIP | 237.12 s | PASS local subset      |
| webkit 27.2                                    | full engine suite; not Safari | 78 PASS / 0 FAIL / 0 SKIP | 366.21 s | PASS local subset      |
| chrome 155.0.8059.82                           | current branded core subset   | 14 PASS / 0 FAIL / 0 SKIP | 43.12 s  | PASS local subset      |
| msedge 155.0.4283.45                           | current branded core subset   | 14 PASS / 0 FAIL / 0 SKIP | 44.28 s  | PASS local subset      |
| Firefox 157.0, revision 1555                   | cannot launch                 | NOT TESTED                | —        | UNAVAILABLE            |
| Branded Safari/macOS; previous stable browsers | no environment                | NOT TESTED                | —        | PARTIAL release matrix |

Available final browser total: **184 passed**, no retries or skips in those four runs. Exact per-case results/logs: [Chromium](evidence/stage4/e2e-chromium-final.json), [WebKit](evidence/stage4/e2e-webkit-final.json), [Chrome](evidence/stage4/e2e-chrome-final.json), [Edge](evidence/stage4/e2e-msedge-final.json). Workers: 1; test deadline: 60 s; production dist and separate actual-worker test harness. No unavailable Firefox journey is included in this total.

<!-- /BROWSER_TABLES -->

Original failures remain in [e2e-chromium-first-final.json](evidence/stage4/e2e-chromium-first-final.json) (77/78) and [e2e-webkit-first-final.json](evidence/stage4/e2e-webkit-first-final.json) (70/78), with their original logs. The first matrix used two workers and zero retries; WebKit had an anomalous 32.9-minute run including timeouts whose reported elapsed durations exceeded the configured deadline. No environmental cause was proven and no samples were silently removed. Serial follow-ups distinguish findings: actual versionchange and responsive cases passed; screenshot console pollution was traced to Playwright source; real native-drag and skip-link failures were corrected; controlled delayed-worker pause passed after the fixture correction. The initial missing-shell Chromium T07 case passed in an isolated rerun; its original startup failure remains visible rather than relabeled PASS.

Firefox installation and one forced reinstall both left launch failure `spawn UNKNOWN`; direct Windows activation reported a side-by-side dependency failure for mozglue. [firefox-runtime-diagnostic.json](evidence/stage4/firefox-runtime-diagnostic.json) and install/probe logs retain that environment evidence. Firefox functional journeys are **UNAVAILABLE / NOT TESTED**, not application test failures or passes. WebKit 27.2 is not branded Safari. Current/previous stable branded Chrome, Edge, Firefox and Safari release coverage is incomplete even if all available local engine cases pass.

## Automated checks and coverage

<!-- CHECK_TABLES -->

| Command / suite                           | Actual result                     | Evidence under evidence/stage4                                         |
| ----------------------------------------- | --------------------------------- | ---------------------------------------------------------------------- |
| npm ci --cache .tmp/npm-cache             | PASS; 403 installed / 404 audited | [clean-install-network.log](evidence/stage4/clean-install-network.log) |
| npm run typecheck                         | PASS                              | [typecheck.log](evidence/stage4/typecheck.log)                         |
| npm run lint                              | PASS                              | [lint.log](evidence/stage4/lint.log)                                   |
| npm run format:check                      | PASS                              | [format.log](evidence/stage4/format.log)                               |
| vitest full run --coverage                | 190/190 PASS; 0 FAIL; 0 pending   | [vitest-results.json](evidence/stage4/vitest-results.json)             |
| npm run build; benchmark production build | PASS; raw chunk warning explained | [build-final.log](evidence/stage4/build-final.log)                     |
| Clean repeated production build           | PASS                              | [reproducible-build.json](evidence/stage4/reproducible-build.json)     |

Fast suite counts (mutually exclusive): unit **110**, integration **56**, component **18**, dedicated security **6**; total **190** in 19 files. Coverage: statements 90.58%, branches 86.17%, functions 92.06%, lines 93.81%.

| Coverage group | Covered branches | Target %         | Assessment   |
| -------------- | ---------------- | ---------------- | ------------ |
| domain         | 350/383 (91.38%) | 90               | recorded     |
| engine         | 389/442 (88.01%) | 90               | BELOW TARGET |
| application    | 291/367 (79.29%) | 80               | BELOW TARGET |
| persistence    | 102/124 (82.26%) | 80               | recorded     |
| state          | 89/121 (73.55%)  | discovery signal | recorded     |
| validation     | 287/313 (91.69%) | discovery signal | recorded     |

Full commands: `node node_modules/vitest/vitest.mjs run --coverage --coverage.reportsDirectory=docs/reports/evidence/stage4/coverage --reporter=default --reporter=json --outputFile=docs/reports/evidence/stage4/vitest-results.json`; `node node_modules/@playwright/test/cli.js test --config playwright.audit.config.ts --project <browser>` with FLOWCANVAS_BROWSER/FLOWCANVAS_EVIDENCE_DIR set for each recorded project (Chrome/Edge use the core-title grep, visible in final JSON selected cases). Performance commands: `node scripts/measure.mjs`, `node scripts/measure-editor.mjs`, `node scripts/measure-runtime.mjs`, `node scripts/measure-stress.mjs`, `node scripts/measure-cold.mjs`, run sequentially with FLOWCANVAS_EVIDENCE_DIR=docs/reports/evidence/stage4/{foundation,editor,runtime,stress,cold}. Benchmark build: `node node_modules/vite/bin/vite.js build --config vite.benchmark.config.ts`. Logs/exit codes retain failed performance statuses; absent platforms are not counted.

<!-- /CHECK_TABLES -->

The full fast run includes the 500-case DAG/JSON/Unicode/semantic permutation properties and 100×100 command sequences; those iterations are inside tests, not additional test-case counts. Security-script-equivalent boundary files are included in the full run; do not add their overlapping counts to the total. No test was skipped, retried, or assertion relaxed. Forced failures are synthetic and explicitly identified.

Coverage measures domain/engine/application/state/persistence/validation only, excluding type-only/rendering/generated files as configured. It is a discovery signal, not proof that unexecuted environments passed. Domain/engine target >=90% and application/persistence >=80% were investigated against the actual HTML source coverage: compile cancellation checks; scheduler stopped/emit/handler-failure and active-run deadline branches; ledger extra/missing staged payload, illegal status and resource paths; coordinator disposal during awaits, preferences failures, halted-save and deletion/in-flight branches remain incompletely covered. Some are defensive checks after earlier validation, but their lack of execution is retained rather than excluded as unreachable. Examples/sample branches are exercised in browsers but not included as fast coverage hits. No confirmed additional implementation defect follows solely from an uncovered branch; confidence remains limited and those meaningful fault-path tests are follow-up work. No production file was excluded or mirrored test added solely to raise numbers. Current percentages and limits are recorded with the final check table.

Production build's >500 kB raw chunk warning is retained and explained: the measured gzip initial application JavaScript is below the 400 KiB SHOULD budget; raw warning threshold does not equal transfer size. No warning threshold or CSP was raised to hide it. Playwright's NO_COLOR/FORCE_COLOR warning is test-runner configuration noise. Offline cache miss and initial new-script lint issue were corrected and their intermediate evidence retained; final check status comes from final logs, not those attempts.

Local Markdown links were checked across 37 files with no missing targets; [document-links.json](evidence/stage4/document-links.json) records the final count. External URLs and anchors were not validated by this filesystem check.

## Release checklist, row by row

Row order matches [RELEASE_CHECKLIST](../RELEASE_CHECKLIST.md). Case result N/A is used only for deployment outside assigned scope; missing required proof stays NOT TESTED/PARTIAL.

| Row | Requirement                                                | Result / actual evidence                                                                                                                                  |
| --- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T01 | Stage 1–3 PASS and S4-01–05                                | FAIL: historical Stage 2/3 FAIL, current performance and evidence gaps                                                                                    |
| T02 | Clean supported install/types/lint/format/build            | PASS locally after final checks; explained raw bundle warning; no packaged-release proof                                                                  |
| T03 | All mandatory automated/manual suites                      | PARTIAL: available local automation recorded; required environments/manual cases absent                                                                   |
| T04 | Production worker/persistence/CSP/browser artifacts hashed | PASS locally: dist/worker and final manifest; no published artifact                                                                                       |
| T05 | Graph/commands/history/IDs/deletion/import integrity       | PASS: generated/explicit/production browser evidence after corrections                                                                                    |
| T06 | Codec/version/remap/backups/CAS/races/abort/reload         | PASS tested engines: fast faults plus real browser storage; no invented migration                                                                         |
| T07 | Nodes/order/branches/failures/controls/cancel/stale        | PASS functional subset: pure and actual workers; performance is separate failed row                                                                       |
| T08 | Caps/no runtime serialization/no arbitrary code/network    | PARTIAL: tested boundaries/AST/worker/CSP and export/storage assertions pass; not every defensive limit branch is directly executed                       |
| T09 | Security/dependencies/no unresolved High issue             | PARTIAL: 0 reportable source vulnerabilities, integrity fixes verified; sealed scan snapshot and missing final hosting/browser matrix limit certification |
| T10 | Representative/stress/reference/memory/cancel performance  | FAIL: raw measured deviations, missing other branded timings/reference certification                                                                      |
| T11 | Full automated/manual reader accessibility                 | PARTIAL: NVDA/VoiceOver and native manual checks NOT TESTED                                                                                               |
| T12 | Current/previous stable branded matrix                     | PARTIAL: local current Chrome/Edge subset, engine tests; Firefox launch blocked; Safari/previous stable unavailable                                       |
| D01 | Accurate README usage/security/limits                      | PASS: updated README links audit and release blockers                                                                                                     |
| D02 | Consistent specifications/decisions/reports/evidence       | PASS locally: D-22, contracts and verified links; earlier acceptance preserved                                                                            |
| D03 | Real owner/URL/LICENSE/metadata/security contact/notices   | PARTIAL: dependency inventory exists; owner/destination/license/contact unresolved                                                                        |
| D04 | Actual changelog/release notes/limitations                 | PARTIAL: accurate Unreleased changelog; no versioned release notes/assets yet                                                                             |
| D05 | Version/tag/branch/history agreement                       | NOT TESTED: private 0.0.0, no Git/history/tags/destination; proposed version uncreated                                                                    |
| D06 | CI or authorized hosted constraint/equivalent checks       | NOT TESTED: no CI destination/configuration or owner waiver; local checks do not imply CI                                                                 |
| A01 | Source/static archives/hashes/notes/samples                | NOT TESTED: conditional preparation cannot finalize beta assets while gates fail                                                                          |
| A02 | Unpack/serve exact packaged archive and journeys           | NOT TESTED: no beta archive prepared/published                                                                                                            |
| A03 | Format/database/protocol/migration compatibility           | PASS: all version 1; no prior release migration; strict newer-version rejection; Stage 3 settings-only downgrade limitation retained                      |
| A04 | Rollback without deleting user IndexedDB                   | PASS documented: restore compatible assets, preserve/export data, block unsupported downgrade; not an executed deployment rollback                        |
| P01 | Authorized named publication destination                   | PARTIAL: conditional GitHub publication assigned, concrete repository identity unresolved                                                                 |
| P02 | Approved deployment/HTTPS/host headers                     | N/A: no hosted deployment assigned or established; no hosting invented                                                                                    |
| P03 | Download/verify remote tag/assets/version/links            | NOT TESTED: release operation BLOCKED, no URL                                                                                                             |
| P04 | Test actual deployed final URL                             | N/A: no authorized deployment or destination                                                                                                              |
| P05 | Separate technical/publication/deployment report           | PASS: this report; technical FAIL, publication BLOCKED, deployment NOT ATTEMPTED                                                                          |

## Compatibility, rollback and residual risk

Workflow schemaVersion 1, envelopeVersion 1, IndexedDB flowcanvas version 1 and worker protocolVersion 1 remain unchanged. Canonical comparator/serialization/UTF-8/hash/storage bytes and readable-export token order remain unchanged. Clipboard/import-as-new remap and node semantics remain unchanged. The new drag transport is an internal UI fallback with the same closed node whitelist and graph transaction. No production API, capability, permission, telemetry, external font or package dependency was added.

Rollback restores compatible application assets at the same origin while preserving IndexedDB; export copies first when possible. Do not reset/delete stores to make a downgrade appear successful. Older Stage 2 builds reject Stage 3 execution preference keys; that previously documented settings-only limitation remains. Unsupported future workflow/database downgrade must be blocked while preserving originals. Changing origin does not migrate local data.

Remaining release blockers: failed editor/stress performance, incomplete reference/browser/manual-reader proof, uncovered engine/coordinator fault branches requiring further focused tests, and unresolved repository/license/contact/CI/version/asset metadata. Initial runtime timing variability is retained as a limitation. These are visible requirements, not approved waivers. Browser eviction, unsaved abrupt-shutdown loss, same-origin trusted-code risk, local unencrypted storage and no cold offline-launch guarantee are product limitations. No joins/loops, arbitrary scripts, API nodes or account synchronization are promised.

The audit and feasible nine fixes are delivered. **Technical beta readiness: FAIL. Publication: BLOCKED. Deployment: NOT ATTEMPTED.** Stop at Stage 4; no unrelated development or release action is implied.
