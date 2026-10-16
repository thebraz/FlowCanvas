# Quality gates

## Status and severity

**PASS:** every mandatory criterion in the assigned stage is implemented and verified with current evidence. **PARTIAL:** some criterion is incomplete, blocked, or insufficiently verified. **FAIL:** observed behavior violates mandatory functionality/integrity/security requirements. No stage passes with an unresolved defect violating its mandatory criteria, regardless of severity label.

Case-level evidence statuses are PASS, FAIL, NOT TESTED, and SKIP (with reason). NOT TESTED is never PASS. N/A is allowed only for criteria explicitly outside the assigned stage or optional deployment/publication; record why. Runtime/build suites were N/A to the documentation-only blueprint, not evidence for Stage 1. The explicitly assigned Stage 1 has its own [acceptance report](reports/STAGE_1_REPORT.md); the blueprint audit remains historical documentation evidence.

| Issue severity | Definition / examples | Release consequence |
| --- | --- | --- |
| Critical | Arbitrary code execution, data exfiltration, widespread unrecoverable saved-data loss | Block all release; contain and fix |
| High | Reproducible graph/history corruption, stale overwrite, incorrect execution/routing, cancellation bypass, inaccessible mandatory journey | Block owning stage and beta |
| Medium | Material usability/performance/compatibility defect with workaround | Block if any mandatory criterion fails; otherwise explicitly accept with owner/limit |
| Low | Cosmetic/documentation imperfection without mandatory-contract impact | May defer with recorded owner and scope |

Severity does not turn a mandatory defect into optional work. Defect acceptance requires actual owner authorization when waiving a nonmandatory issue; agents cannot silently weaken specifications to pass.

## First beta exception authorized by the owner

D-23 supersedes the strict publication profile for `0.1.0-beta.1` only. Minor observed performance differences and unverified advanced/manual/unsupported-browser certification are disclosed first-beta limitations; the full targets below remain the stable-release goal. Original FAIL/PARTIAL cases stay unchanged. No known data-loss, security, graph/history/persistence, worker correctness or mandatory keyboard-flow defect is accepted. Functional checks, verified supported browsers, packaged-asset checks and actual remote identity remain release requirements. The [beta report](reports/BETA_READINESS.md) records exact evidence and accepted scope; no unexecuted case becomes PASS.

## Gates by stage

The [roadmap](ROADMAP.md) owns detailed stage acceptance IDs. These gate categories apply to the implemented scope and all prior-stage regressions.

| Gate | Stage 1 | Stage 2 | Stage 3 | Stage 4 |
| --- | --- | --- | --- | --- |
| Tooling/build/types | Locked compatible stack; strict types; lint/format/build pass | Same, no regressions | Same, worker bundle verified | Reproducible clean install/build; release artifact verified |
| Domain/graph | Canonical types, schemas, invariants, algorithms, test evidence | Every command/history/clipboard preserves invariants | Compile independently revalidates | Adversarial and generated audit |
| Persistence | Architecture/boundary contracts only | Real storage/save/CAS/reload/import-export gates | Runtime state excluded; prior gates rerun | Corruption/quota/conflict/migration audit |
| Execution | Contracts and future boundaries only | No fake runtime features | All node/control/ordering/budget/worker gates | Full deterministic/regression/security audit |
| Security | Bounded validation/safe rendering/import restrictions | Hostile input, paths, storage, XSS | Closed registry, watchdogs, stale protocol, no network | Dependency/CSP/production-policy review |
| Accessibility | Shell semantics, focus, theme tokens, basic canvas/list access | Full editor keyboard and manual editor journeys | Runtime controls/announcements/inspection | Full automated/manual release matrix |
| Performance | Empty shell and domain baselines | Representative rendering/editing/save metrics | Worker/run/cancel/cleanup metrics | All required reference/stress metrics |
| Documentation | Version/dependency choices and S1 report | Editor/storage and S2 report | Runtime/security and S3 report | Accurate limitations/changelog/release evidence |

Gate scope cannot be used to postpone an already implemented feature's safety. For example Stage 1 import validators must enforce data limits even though import UI belongs to Stage 2. New regressions in prior-stage behavior block current-stage PASS.

## Completion report format

Each stage writes `docs/reports/STAGE_N_REPORT.md` using the [report contract](reports/README.md). It MUST include assigned scope and authorization, environment/versions/artifact identity, requirements matrix keyed to Sx IDs, commands and per-suite counts, manual tests, benchmark target vs observed values, known defects/severity/owners, incomplete evidence, compatibility/contract changes, and final PASS/PARTIAL/FAIL with rationale. Evidence references must resolve and use synthetic data.

Do not report a production build as E2E proof. Do not report a mocked storage test as real IndexedDB integrity. Do not report WebKit as branded Safari/VoiceOver proof. No benchmark claims from targets. Link the exact final artifact/revision tested; modifications after verification require rerunning affected gates.

## Exit and publication

An assigned stage exits only after all mandatory stage criteria and prior regressions pass, documents agree, and its acceptance report is complete. Stop at that boundary. The next stage needs a new instruction.

Stage 4 has separate **technical beta readiness** and **publication** rows. Technical gates may PASS with publication NOT AUTHORIZED/N/A when the task only authorized preparation. That status means “beta-ready, unpublished,” never “released.” If publication is explicitly assigned and cannot be completed, overall assigned-stage outcome is PARTIAL even when technical readiness passes. [Release checklist](RELEASE_CHECKLIST.md) controls the final external action and destination verification.

Blueprint completion verifies document presence, substance, relative links, contract consistency, and stage isolation only. It does not pre-pass any application quality gate.
