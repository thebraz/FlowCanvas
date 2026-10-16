# Product specification

First-beta release scope (D-23): `0.1.0-beta.1` verifies current local Chrome/Edge and discloses unverified Firefox/Safari/manual-reader environments. The broader supported-platform and certification targets below remain post-beta goals. All graph, storage, execution, security and keyboard functionality remains required; the exception accepts minor measured performance differences, not correctness defects.

## Scope and users

FlowCanvas is a single-user, browser-based developer tool for arranging processing nodes, editing JSON operations, validating a directed graph, simulating it locally, inspecting intermediate data, and maintaining reusable workflow documents. Target users are developers learning data transformations, engineers explaining branching workflows, and reviewers evaluating the portfolio project. It is not an automation server or an n8n replacement.

Users need to see why a connection is invalid, understand exactly which branch ran, safely revise mistakes, and recover work after reopening the browser. Local data ownership and inspectable behavior take priority over connector breadth.

## Mandatory beta requirements

| ID | Capability and observable acceptance | Stage |
| --- | --- | --- |
| PR-01 | Create, rename, list, open, duplicate as a new workflow, and explicitly delete local documents; show save status | 2 |
| PR-02 | Create and configure each catalog node; preserve stable IDs and graph invariants | 1 foundation; 2 full editing |
| PR-03 | Connect, reconnect, select, move, align, duplicate, copy/paste, and delete graph elements with atomic undo/redo | 2 |
| PR-04 | Reject malformed imports without changing the open document; export canonical JSON and reopen it without semantic loss | 2 |
| PR-05 | Persist committed document edits; stale saves cannot overwrite newer or foreign-tab changes | 2 |
| PR-06 | Run all Manual Triggers deterministically in an isolated worker; inspect inputs, outputs, route decisions, and structured failures | 3 |
| PR-07 | Pause at operation boundaries, step one executable operation, resume, and cancel within the specified acknowledgement budget | 3 |
| PR-08 | Provide keyboard alternatives for node movement and connection management, accessible dialogs/forms, and usable text scaling | 2; runtime controls 3; audit 4 |
| PR-09 | Meet bounded-data and hostile-input requirements and the measured graph-size targets | 1 contracts; enforce by owning stage; audit 4 |
| PR-10 | Supply coherent dark/light themes, meaningful empty/error states, a minimap, grid toggle, and functional command palette | 2 |

Stage 1 exposes a shell and basic canvas with a small synthetic graph; it does not need finished editor controls, storage, or runtime functionality. Never display enabled placeholders for later-stage features.

## Node catalog

| Type | Purpose |
| --- | --- |
| Manual Trigger | Owns an editable JSON object and emits it once when a run begins; all triggers participate |
| Set Field | Immutably assigns a constant JSON value at a safe object-only nested path |
| Pick Fields | Builds a new object containing explicitly selected nested paths with an explicit missing-field policy |
| Condition | Evaluates a strictly typed comparison and emits the unchanged object on exactly one of `true` or `false` |
| Output | Records its incoming object as one named final result; it has no outgoing port |
| Note | Stores plain text annotations; it has no ports and never executes |

The exact configuration and edge cases are owned by [node contracts](NODE_CONTRACTS.md). The beta processes one JSON object per activation, never streams, batches, joins, loops, or implicit merges.

## Primary journeys and acceptance scenarios

1. **Build and inspect:** create Trigger with `{"customer":{"tier":"gold"}}`, set `reviewed` to `true`, condition `customer.tier eq "gold"`, connect true and false to separate Outputs. Run: exactly the true Output contains the original customer and reviewed flag; the false Output is skipped. Repeat without edits: semantic events and values are identical, excluding run IDs and timing.
2. **Revise safely:** move a three-node selection in one gesture, modify a configuration with Apply, reconnect an edge, delete its source. Undo each operation: exact IDs, endpoints, values, and positions return. Redo reapplies them. Failed connections leave document and history unchanged.
3. **Reopen:** edit, wait for Saved, reload the same origin, open the same workflow. Canonical document content and last settled viewport match. Selection, undo history, and run results do not survive reload.
4. **Import hostile data:** select an oversized, cyclic, unknown-version, or pollution-key document. An actionable error appears; active document, storage, and history remain unchanged. A structurally valid document with missing configuration opens with diagnostics and may remain editable.
5. **Operate without dragging:** create nodes using the palette or command palette, set positions in the inspector, add an edge using a port dialog, inspect and delete that edge from the graph list, run and step with keyboard controls.
6. **Storage conflict:** open the same workflow in two tabs. After one tab saves, the other's stale write fails safely and offers reload or save as a new workflow; no automatic overwrite occurs.

## Non-functional requirements and environments

- Domain correctness, safe transactions, and durability follow [schema](GRAPH_SCHEMA.md), [commands](GRAPH_COMMANDS.md), and [persistence](PERSISTENCE.md).
- Resource ceilings and JSON compatibility follow [data](DATA_CONTRACT.md). Performance thresholds are proposed, unmeasured targets in [performance](PERFORMANCE_SPEC.md).
- Accessibility targets relevant WCAG 2.2 AA criteria with manual evaluation, as scoped in [accessibility](ACCESSIBILITY.md); passing an automated scan alone is insufficient.
- Beta support: current and previous stable desktop Chrome, Edge, Firefox, and Safari at release time, on supported Windows/macOS versions. Verify Chrome/Edge/Firefox on Windows and Safari on macOS at minimum; additional OS/browser combinations are supplementary. Capture exact versions in Stage 4 evidence. Playwright Chromium/Firefox/WebKit are test engines, not substitutes for branded-browser spot checks.
- Full canvas editing requires a desktop-class viewport of at least 1024 CSS pixels. At narrower widths the accessible graph list and inspector MUST remain usable down to 320 CSS pixels. Touch-first graph gestures and mobile Safari are not beta commitments.
- Secure context (HTTPS or localhost), IndexedDB, module workers, Web Crypto, and structured clone are required. Unsupported capabilities produce an explanatory state; storage failure permits explicitly labeled memory-only work and export. No silent execution fallback to the main thread.
- Once application assets are loaded, editing/execution require no network. Cold offline launch/PWA caching is outside beta scope.

## Explicit non-goals and limitations

No authentication, accounts, cloud sync, external database, backend, remote execution, API connectors, arbitrary scripts, shell commands, credentials, distributed workers, collaboration, plugin marketplace, streaming items, graph joins, automatic layout engine, or expression language. Notes are plain text. Data is not encrypted at rest by FlowCanvas. Browser eviction and abrupt termination can lose unsaved work. Import is strict and atomic; there is no partial recovery editor for corrupt files. These limitations MUST be visible in user documentation before beta publication.

Future enhancements require a separate decision and authorization; none is an implied Stage 1–4 deliverable.
