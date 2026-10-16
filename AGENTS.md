# FlowCanvas engineering rules

These rules govern all work in this directory. MUST, MUST NOT, SHOULD, and MAY are normative. The engineering blueprint is complete documentation, not an implemented or tested application. No implementation stage is authorized by the existence of these files.

## Read before changing

1. Inspect existing files, applicable parent instructions, the assigned stage, and current reports before editing. Preserve legitimate work. Use an available code knowledge graph to narrow existing-code investigations, then verify the source; a missing index is not proof that code is absent.
2. Read [README](README.md), [roadmap](docs/ROADMAP.md), [architecture](docs/ARCHITECTURE.md), and [quality gates](docs/QUALITY_GATES.md), then the contract owners for the affected area.
3. Treat normative specifications as authoritative. Resolve contradictions explicitly in [decisions](docs/DECISIONS.md), update every affected contract, and identify the compatibility impact. Never silently change an invariant or public document format.

## Contract owners

| Concern | Read before implementation |
| --- | --- |
| Product and scope | [Product](docs/PRODUCT_SPEC.md), [roadmap](docs/ROADMAP.md) |
| Stack and module boundaries | [Architecture](docs/ARCHITECTURE.md), [technology](docs/TECHNOLOGY_STACK.md) |
| Documents and graph validity | [Graph schema](docs/GRAPH_SCHEMA.md), [data](docs/DATA_CONTRACT.md), [algorithms](docs/GRAPH_ALGORITHMS.md) |
| Editing and ownership | [Commands](docs/GRAPH_COMMANDS.md), [state](docs/STATE_MANAGEMENT.md), [interactions](docs/EDITOR_INTERACTIONS.md) |
| Node behavior and runs | [Nodes](docs/NODE_CONTRACTS.md), [execution](docs/EXECUTION_MODEL.md), [execution security](docs/EXECUTION_SECURITY.md) |
| Storage and failures | [Persistence](docs/PERSISTENCE.md), [errors](docs/ERROR_HANDLING.md) |
| Interface | [UX](docs/UI_UX_SPEC.md), [design](docs/DESIGN_SYSTEM.md), [accessibility](docs/ACCESSIBILITY.md) |
| Risk and evidence | [Security](docs/SECURITY_MODEL.md), [performance](docs/PERFORMANCE_SPEC.md), [testing](docs/TESTING_STRATEGY.md) |
| Completion and publication | [Workflow](docs/DEVELOPMENT_WORKFLOW.md), [release](docs/RELEASE_CHECKLIST.md), [reports](docs/reports/README.md) |

## Architectural discipline

- The pure graph domain MUST NOT import React, `@xyflow/react`, Zustand, DOM APIs, persistence, or application UI. Dependencies point inward as specified in the architecture.
- The execution engine MUST NOT import rendering, animations, editor stores, or storage. A worker adapter carries validated messages; it is not a security sandbox.
- One canonical workflow document owns graph truth. Rendering projections, indexes, drafts, and worker snapshots MUST NOT become competing mutable authorities.
- Persistent document data and ephemeral interaction/runtime state MUST remain separate. Preserve module boundaries and reject circular dependencies.
- Prefer small composable functions and modules with direct dependencies. Do not add generic plugin frameworks, repositories, services, or dependencies without a concrete requirement. Do not rewrite a functioning subsystem without documented evidence and justification.

## Implementation discipline

- Use strict TypeScript, `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes`. Boundary inputs are `unknown`; unjustified `any`, unsafe assertions, and suppression comments are prohibited.
- Validate every untrusted import, storage record, clipboard fragment, and worker message. Follow the exact budgets in [data](docs/DATA_CONTRACT.md).
- Never use `eval`, `Function`, executable user expressions, dynamic code from data, shell execution, or network nodes.
- Do not swallow exceptions, silently discard user changes, or substitute production behavior with mocks. Disabled controls must explain their condition; decorative nonfunctional controls are prohibited.
- Give constants names and contract references. Review components over 250 nonblank lines or functions over 80 nonblank lines for splitting; these are review triggers, not an excuse for meaningless extraction.
- Every asynchronous operation MUST define failure, cancellation, stale-result handling, and cleanup. Remove event listeners; terminate workers; revoke object URLs; close IndexedDB connections on version changes.

## Testing discipline

- Test observable contracts and confirmed-defect regressions. Preserve passing tests and assertion strength. Do not skip required cases, fake evidence, or optimize for coverage numbers alone.
- Use seeded deterministic fixtures. Test graph transactions, history, hostile input, real browser storage, and the actual worker path where required.
- Run relevant tests, type checking, lint, and production build after material implementation changes. Stage gates define additional required suites. Report commands, counts, environment, failures, and NOT TESTED cases honestly.
- A failed mandatory test is FAIL; absent evidence is PARTIAL. An unexecuted test never passes.

## Security discipline

- Imports are hostile. Enforce byte, structure, nesting, graph, payload, history, and run limits before expensive work. Reject forbidden property keys recursively; never merge imported objects into globals or stores.
- Render labels, notes, payloads, and diagnostics as text. Never pass them to unsafe HTML, URL navigation, or executable templates. No unnecessary browser permissions, telemetry, external fonts, or remote processing.
- Do not commit secrets or payload contents to logs, reports, screenshots, or fixtures. Use synthetic data. Follow [security](docs/SECURITY_MODEL.md).

## Stage, communication, and release discipline

- Implement ONLY the explicitly assigned stage. Passing a stage does not authorize starting the next. Each stage needs its own report and gate verification.
- Work autonomously on ordinary engineering decisions. Do not narrate routine steps, give implementation tutorials, or ask avoidable questions. Higher-priority environment requirements still apply. At completion provide the required concise technical report and disclose genuine blockers and incomplete work.
- Do not commit, tag, publish, deploy, or create releases without appropriate task authorization. Completion alone is insufficient. Never force-push, overwrite tags, or destroy history.
- Publication requires [release gates](docs/RELEASE_CHECKLIST.md), explicit authorization, and verification of the resulting artifact or destination. Keep unresolved requirements visible.
