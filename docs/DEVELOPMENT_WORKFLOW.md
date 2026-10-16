# Development workflow

## Entry and scope control

Implementation begins only on an explicit Stage 1, 2, 3, or 4 assignment. Read [AGENTS](../AGENTS.md), [roadmap](ROADMAP.md), relevant contract owners, [decisions](DECISIONS.md), and prior reports. Inspect the actual workspace and instruction hierarchy before modifying; the initial blueprint workspace was empty and not a Git repository. Do not initialize Git or invent remote/CI configuration without an authorized implementation need.

Record stage inputs and current constraints. Prior stages must have PASS evidence or an explicit instruction defining how their deficiencies will be repaired within the assigned work. Do not assume missing reports mean success. Scope expansions, new nodes, backend features, and fundamental contract changes require a documented decision and appropriate authorization; routine implementation choices inside existing contracts do not require repeated confirmation.

## Working sequence

1. Inspect existing modules and tests, then identify the smallest set of affected contracts/callers. Verify knowledge-graph output against source if an index exists.
2. Implement the assigned behavior within dependency boundaries. Keep persisted schemas, domain commands, UI drafts, and worker state distinct. Add safety at the boundary that owns it.
3. Verify relevant behavior and confirmed-defect regressions; test real destination/runtime where the gate requires it. Preserve assertion strength and isolate synthetic storage/workers.
4. Fix failures, rerun affected checks, and validate types/lint/production build. Broaden testing only for a requirement or unresolved risk.
5. Update affected documents/decisions and write the stage report with actual evidence. Stop after the assigned stage; no automatic transition.

## Toolchain scripts to establish

Stage 1 establishes functional scripts for `typecheck`, `lint`, `format:check`, `test:unit`, `test:integration`, `test:e2e`, and `build`, invoked with `npm run <script>`. It also provides `test:components`, `test:coverage`, and the Stage 1-only `test:baselines` harness. `test:e2e` rebuilds and serves production assets with CSP at localhost:4173; `test:baselines` independently bundles test-only empty-shell/graph fixtures at localhost:4175. Integration covers schema/domain/session foundations, not nonexistent persistence/engine behavior. Later owning stages add full `test:security`, `test:a11y`, and `test:performance` suites. [README](../README.md) distinguishes development, local preview, and verification. Run clean installation after active test/build processes finish; Windows locks loaded native dependencies.

Stage 1 verifies stable package/Node compatibility and pins one lockfile. Use a clean reproducible install for stage completion/release checks once tooling exists. Do not install packages during blueprint work. Do not add hidden skip-success scripts. Automated CI is useful after repository hosting is selected; local gates remain mandatory meanwhile. Choose CI provider before Stage 4 and mirror functional scripts without secrets in artifacts.

Stage 2 adds functional `test:security`, `test:a11y` and `test:performance` commands. Native persistence fault tests use the approved development-only fake-indexeddb dependency; production-browser tests independently verify real transactions, reload and multiple tabs. Editor benchmarks and CPU profiling run from a separate optimized test-only bundle, which is absent from `dist`. Run performance measurements without concurrent test/install activity. Keep Stage 2 evidence in its own subdirectory and preserve the Stage 1 report/artifacts.

Stage 3 adds `test:runtime` and `test:runtime-performance`. `test:e2e` builds both production and isolated test-only benchmark assets, then serves them on separate localhost origins. Actual worker/CSP/storage journeys run against production; only stalled/crashed-worker fault injection uses the separate artifact. Stage 3 evidence is under `docs/reports/evidence/stage3`. Do not run performance measurements concurrently with suites/builds. Stage 2 failures remain historical evidence and must not be overwritten by Stage 3 output.

## Change and evidence rules

Use focused changes. Do not reformat unrelated files, rewrite functioning architecture, or add placeholders. Every nontrivial domain/security/persistence change needs behavioral evidence. Use seeded IDs/clocks in tests, actual worker and IndexedDB for browser verification, and named constants tied to DATA_CONTRACT. Contract changes update owner and dependents together; record schema compatibility impact.

Reports include exact dependency versions, OS/browser/test environment, commands/counts, fixture hashes, and relevant traces. Keep payloads/credentials out of logs, screenshots, and report attachments. Use only test-owned profiles/storage; never reset user databases for verification. If a required environment/tool is unavailable, continue meaningful independent work, mark affected rows NOT TESTED, and report PARTIAL rather than repeatedly warning or faking success.

## Commits, release, and deployment

D-23 records the owner's subsequent explicit authorization to create `thebraz/FlowCanvas`, select MIT and publish `v0.1.0-beta.1` under the focused beta profile. This authorizes necessary local Git initialization, non-destructive commits/pushes, CI configuration, tag and GitHub prerelease operations. The historical stricter assessment remains unchanged. Verify the exact packaged and remote artifacts; no hosted deployment or paid service is assigned.

Code completion does not authorize commits, tags, releases, pushes, or deployment. Follow the user's actual task authorization; preserve history and never force-push/overwrite tags. Prepare concrete reviewable release assets and evidence first. If publication authorization is needed, request it only when the release is technically ready, explaining the applicable release rule. A published artifact needs final destination verification after the final change.

Blueprint status, implementation stage status, technical beta readiness, and publication status are separate. [Quality gates](QUALITY_GATES.md) defines how each is reported.
