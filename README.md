# FlowCanvas

FlowCanvas is a local-first visual JSON workflow editor with transactional editing, IndexedDB persistence, deterministic worker execution and bounded visual debugging.

**Beta: 0.1.0-beta.1 · MIT.** [Downloads](https://github.com/thebraz/FlowCanvas/releases) · [Repository](https://github.com/thebraz/FlowCanvas) · [Beta verification and known limits](docs/reports/BETA_READINESS.md). Current Chrome and Edge are the verified branded targets; Firefox/Safari and manual screen-reader certification remain unverified. Minor measured performance deviations are accepted for this prerelease. The initial synthetic sample is editable and unsaved until a completed save. The workflow manager creates, lists, opens, duplicates and deletes local documents. The graph list supplies keyboard access and is the default below 1024 px. No hosted deployment is provided.

## Run locally

Use Node **24.19.0** (the checked LTS baseline) and npm **11.6.4**. Exact dependencies are locked; no account, API key, backend, database service, or paid API is required.

```text
npm ci
npm run dev
```

Open the local URL printed by Vite. Development uses localhost; production preview is `npm run build` followed by `npm run preview`. Preview is for local inspection, not deployment. Assets are local and no external fonts are fetched. Network is needed for dependency/browser installation, not graph inspection after assets load.

```text
npm run typecheck
npm run lint
npm run format:check
npm run test:unit
npm run test:integration
npm run test:components
npm run build
npx playwright install chromium
npm run test:e2e
```

`test:e2e` rebuilds and serves production assets with the intended CSP on localhost:4173. `test:coverage` runs the implemented unit/integration/component suites with coverage. `test:baselines` builds a **separate, test-only** empty-shell/graph benchmark and measures installed branded Chrome on localhost:4175; Chrome must be installed. It stores raw samples and hashes under `docs/reports/evidence`. `npm run verify` runs the non-browser gates; browser and baseline gates are separate. No script silently passes a missing suite.

Workflows and settings use IndexedDB. The legacy theme key is removed only after its settings transaction succeeds. Dark is initial; System follows operating-system changes. Committed content and the settled viewport survive reload; selection, history and drafts do not. Autosave waits 500 ms after edits, with a 2-second maximum scheduling wait. Saved means the transaction completed; browser eviction and abrupt shutdown remain limitations. Storage failures retain edits and offer retry, export, save as new or explicit memory-only editing. Two tabs cannot silently overwrite the same revision. Conflicts require a user choice; there is no automatic merge.

Add nodes from the palette or Commands. Select nodes, edit label/position and complete JSON configuration in Properties, then Apply or Cancel. Paths use literal key arrays. Shift selects multiple nodes; the list has checkboxes and Move-with-arrows controls. Connections can be dragged or managed in the labeled dialog. Copy/paste regenerates identities and includes only internal links; clipboard denial offers a JSON text dialog. Grid snapping affects pointer placement; fields and keyboard nudges bypass it. Help lists platform modifier conventions and F6 region navigation.

Import validates in isolation and creates a new workflow with fresh identities. Export includes committed canonical schema-v1 data, excludes drafts/history/runtime, and never marks browser storage Saved. Corrupt records are preserved; verified backup recovery creates a new document. Version 1 has no historical migration; unknown versions fail closed. Browser data is origin-scoped, local and unencrypted. Use synthetic/nonsecret data and export copies before deleting workflows or clearing browser storage. Full accessibility/manual browser evidence and release performance remain incomplete until their gates are explicitly satisfied.

**Export JSON** keeps the compact canonical format. Use **Export readable JSON** in the toolbar or saved-workflow manager for two-space indentation and line breaks, preserving all data and deterministic ordering. If formatting would exceed the 5 MiB import limit, readable export reports an error; compact export remains available. Both files import through the same validated import-as-new flow. Hashing and internal persistence always use compact canonical bytes.

`test:security` runs real boundary regressions; `test:a11y` runs production-browser keyboard/axe/reflow cases. `test:performance` measures the 20/100/300-node editor and real IndexedDB in installed Chrome. `test:baselines` reruns foundation measurements under `docs/reports/evidence/stage2/foundation` without overwriting Stage 1 evidence. Tests use isolated profiles and synthetic data. The fast storage suite uses fake-indexeddb; the E2E suite uses actual browser IndexedDB.

## Execute and debug locally

Validate compiles a ready plan without invoking nodes. Run starts all Manual Triggers in UUID topological order. Pause acknowledges the next operation boundary; Resume continues; Step from idle starts paused and invokes one activated node. Stop cancels cooperatively and terminates an unresponsive worker after 100 ms. Reset clears terminal runtime data. Semantic edits invalidate results; moves, labels, Notes and viewport preserve them. Runtime data never enters workflow exports, history or storage.

Expand Execution to browse the chronological timeline, select node input/output, inspect branch decisions and download eligible full JSON payloads. Previews are limited to 64 KiB; metadata is capped at 2,000 events / 2 MiB. Failed/cancelled runs label earlier outputs as partial. The worker has a closed node registry with no arbitrary code or workflow network requests; isolation permits termination and is not a complete security sandbox.

Workflows → Executable examples opens fresh editable copies for transformation, conditional routing, multiple branches and an intentionally unconfigured validation example. All use the production engine.

`npm run test:runtime` runs the pure engine/coordinator/protocol suites. `test:e2e` also builds a separate test-only harness served on localhost:4176 for stalled/crashed workers; these handlers are absent from production `dist`. `npm run test:runtime-performance` measures installed Chrome compilation, execution, cancellation, event overhead and cleanup. The existing `test:performance` retains editor targets. Manual readers and other-browser measurements remain incomplete as recorded in the stage reports.

## Beta scope

The six initial nodes are Manual Trigger, Set Field, Pick Fields, Condition, Output, and Note. The beta supports transactional editing, undo/redo, keyboard alternatives, IndexedDB storage, JSON import/export, deterministic worker execution, pause/resume/step/cancel, and bounded debugging. Workflows never execute arbitrary user code or external requests. Beta scope, exact verification and accepted limits are recorded in the beta report.

See [product requirements](docs/PRODUCT_SPEC.md) for scope, supported environments, and acceptance journeys.

## Beta limitations and verification

The first beta supports the verified current Chrome/Edge targets. Broader current/previous-stable Firefox/Safari and manual NVDA/VoiceOver certification remain future work under D-23. Actual versions and unavailable environments are recorded in beta readiness; Playwright WebKit is not branded Safari evidence. Firefox's installed test binary currently fails Windows activation even after reinstall; this is not a passing compatibility result. No WCAG conformance or production readiness is claimed.

The audit corrects storage-key corruption handling, autosave cancellation during deletion, stale Save-as-New copies, stale range-selection anchors, initial Condition connection ports, connection-error focus and WebKit button focus. These changes preserve schema-v1 canonical bytes, IndexedDB envelopes and worker protocol v1. See the [changelog](CHANGELOG.md) for the beta changes.

There are no joins, loops, API/network nodes, arbitrary scripts, account sync, at-rest encryption or cold offline-launch guarantee. Browser eviction and abrupt shutdown can lose changes after the last completed save. Keep independent exports. The exact public resource limits remain in [DATA_CONTRACT](docs/DATA_CONTRACT.md).

Contribution preparation follows [AGENTS](AGENTS.md): preserve contracts, add a regression for a confirmed defect, run relevant checks and retain actual evidence. The owner selected thebraz/FlowCanvas and MIT. Use GitHub issues for contributions and SECURITY.md for private vulnerability reporting.

## Specification map

| Area                       | Authoritative specifications                                                                                                                                                             |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Governance                 | [Agent rules](AGENTS.md), [decisions](docs/DECISIONS.md), [development workflow](docs/DEVELOPMENT_WORKFLOW.md)                                                                           |
| Structure and dependencies | [Architecture](docs/ARCHITECTURE.md), [technology stack](docs/TECHNOLOGY_STACK.md)                                                                                                       |
| Graph and data             | [Graph schema](docs/GRAPH_SCHEMA.md), [JSON and limits](docs/DATA_CONTRACT.md), [algorithms](docs/GRAPH_ALGORITHMS.md)                                                                   |
| Editor                     | [Commands](docs/GRAPH_COMMANDS.md), [state](docs/STATE_MANAGEMENT.md), [interactions](docs/EDITOR_INTERACTIONS.md)                                                                       |
| Execution                  | [Node contracts](docs/NODE_CONTRACTS.md), [execution model](docs/EXECUTION_MODEL.md), [execution security](docs/EXECUTION_SECURITY.md)                                                   |
| Durability and errors      | [Persistence](docs/PERSISTENCE.md), [error handling](docs/ERROR_HANDLING.md)                                                                                                             |
| Interface                  | [UI/UX](docs/UI_UX_SPEC.md), [design system](docs/DESIGN_SYSTEM.md), [accessibility](docs/ACCESSIBILITY.md)                                                                              |
| Assurance                  | [Security model](docs/SECURITY_MODEL.md), [performance](docs/PERFORMANCE_SPEC.md), [testing](docs/TESTING_STRATEGY.md), [quality gates](docs/QUALITY_GATES.md)                           |
| Delivery                   | [Four-stage roadmap](docs/ROADMAP.md), [release checklist](docs/RELEASE_CHECKLIST.md), [report requirements](docs/reports/README.md), [blueprint audit](docs/reports/BLUEPRINT_AUDIT.md) |

MUST/MUST NOT express requirements; SHOULD permits a documented reason for deviation; MAY is optional. Each subject has one owner document. Related files reference that owner instead of redefining the contract. Numeric resource limits belong to DATA_CONTRACT; node semantics belong to NODE_CONTRACTS; lifecycle belongs to EXECUTION_MODEL.

## Implementation entry point

Read AGENTS, the architecture, canonical schema, data budgets, decisions, and stage gates before making changes. Package choices, compatibility constraints, measurements, and limitations are recorded in [decisions](docs/DECISIONS.md) and the Stage 1 report. A passing stage never authorizes the next.

Repository: https://github.com/thebraz/FlowCanvas. Prerelease: v0.1.0-beta.1 under MIT. Publication verification is recorded in beta readiness. A hosted deployment is outside this release.

## License and contribution

[MIT](LICENSE), copyright 2026 thebraz. Runtime dependencies retain their own [license notices](THIRD_PARTY_NOTICES.md). See [CONTRIBUTING.md](CONTRIBUTING.md) for focused contributions.

The static release archive runs with Node 24: extract it, run `node scripts/serve.mjs` from its root and open http://127.0.0.1:4173. The source archive builds with the commands above. Keep exported backups; browser data is local to the origin.
