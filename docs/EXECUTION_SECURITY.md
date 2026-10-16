# Execution security

## Boundary and capabilities

Execution accepts only a validated canonical snapshot and the six-node closed registry. Notes never dispatch. The node registry maps literal node types to bundled handlers; unknown types fail closed. No `eval`, `Function`, dynamic imports from configuration, scripts, expression language, WASM from data, shell commands, fetch/network nodes, credentials, or user-defined executable code. Payload strings are inert values.

A dedicated module worker isolates expensive engine work from UI and allows termination. It is **not a complete security sandbox**: worker code can have browser capabilities, and compromised shipped dependencies or same-origin code remain trusted-code risks. Prohibit network/storage imports and dynamic-code patterns in engine lint rules; use CSP/deployment controls from [security model](SECURITY_MODEL.md). Do not describe worker isolation as preventing all malicious code execution.

## Boundary checks

| Boundary | Required defenses | Failure |
| --- | --- | --- |
| Editor -> run coordinator | Current semantic revision, complete readiness, immutable capture, document budgets | No worker starts on stale/invalid data |
| Host -> worker start | Strict protocol union, identity types, bounded envelope, full document validation and compilation | Fail validating, zero operations |
| Host -> control | Correct run identity and request ID, allowed transition | Ignore stale run; acknowledge/reject current request |
| Worker -> host | Strict schema, current identity tuple, contiguous sequence, valid node/port IDs, byte/value budgets | Drop stale traffic; fail current malformed protocol |
| Handler input/output | Root object, immutable ownership, safe paths and exact emitted port set | Fail node; no partial output publication |
| Result -> UI | Bounded lazy text/tree rendering, no HTML/URLs, explicit truncation | Safe preview and structured error |

Use [shared ceilings](DATA_CONTRACT.md) for node/edge/document/payload/depth/steps/duration/diagnostics. Validate before expensive cloning and again at the receiving trust boundary. Structured clone itself is not validation. Do not allow a message to nominate arbitrary functions or storage keys. Port sets are validated against the node type; Condition cannot emit both routes.

Validate protocol state as well as message shape: each node follows pending -> running -> completed/failed/cancelled or pending -> skipped/cancelled; no second invocation/completion, unknown payload reference, or payload-ID redefinition is accepted. Tentative payload records remain invisible until their node completion commits. A malformed current-run transition fails WORKER_PROTOCOL and disposes staged data; stale-run messages are discarded before reduction.

## Resource enforcement

Compile with iterative graph traversals. Check operation count before invocation, per-payload limits before publication, cumulative produced bytes before accepting emitted results, and retained unique bytes before storing inspection data. Expensive JSON validation must be depth/value bounded. Limit event metadata and results separately; log truncation never silently evicts Output payloads to pretend the run succeeded. If required result retention cannot fit, fail RESOURCE_LIMIT.

The host owns independent per-operation, active-run, and wall-run watchdogs; a hung worker cannot disable them. Cooperative abort is attempted, then terminate the worker and mark the run cancelled/failed. Release worker references, message handlers, timers, and payload registries on reset or document switch. The wall deadline includes paused runs.

Results are accepted only for matching sessionId + semanticRevision + runId. Do not merely compare workflow IDs: reopening the same workflow creates a different session. An older promise cannot restore UI state, Saved status, or payloads after cancellation, undo, import, or switching.

## Security regressions

The implemented protocol preflights descriptor safety, depth/value/UTF-8 envelope budgets and exact schemas before reducing current traffic. Payload IDs are run-local `p1`… references. Payload records are staged privately; the committed registry and outputs change together only on a valid completion. The host verifies static node order, input references, exact output port sets, dispositions and terminal record/output/count consistency. Independent watchdogs also check elapsed time before accepting messages and on visibility return. The production artifact contains only the closed module worker; stalled/crashed handlers are isolated test fixtures. [Stage 3 evidence](reports/STAGE_3_REPORT.md) distinguishes pure tests, actual worker tests, limits and incomplete environments.

- Reject injected node types, unknown fields, fake ports, oversized start/result messages, sequence replay/gaps, and results for deleted node IDs.
- Reject pollution keys and unsafe path segments at all nesting levels; assert `Object.prototype` remains unchanged. Reject inherited-property access and getters without invoking them.
- Use script-like strings in trigger data, notes, node names, errors, and output inspection; assert literal rendering and no execution/navigation/network.
- Exercise max steps/bytes/depth/duration, fan-out accounting, event-ring truncation, and unresolved async cancellation. Verify a real worker is terminated within the foreground target and stale traffic is ignored.
- Assert no workflow network/API call or user-data transmission occurs, no runtime data enters persistence, and no payload content enters captured logs. Only audited same-origin static application/worker asset loading is permitted when starting a worker; asset URLs cannot contain user data.

Synthetic delayed/hung handlers are test-only fixtures, never production registry members. Pure-engine tests establish semantics; real browser worker/security tests establish transport, cleanup, and responsive cancellation. [Testing](TESTING_STRATEGY.md) and [quality gates](QUALITY_GATES.md) require both.
