# FlowCanvas 0.1.0-beta.1 readiness

This report supersedes the strict publication decision in the historical [Stage 4 audit](STAGE_4_FINAL_AUDIT.md) for this beta only. Original FAIL/PARTIAL measurements remain unchanged. On 2026-10-16 the owner requested only substantial optimization, accepted small performance differences for a beta, and explicitly authorized creation/publication of **thebraz/FlowCanvas** under **MIT**.

## Scope and accepted limitations

- Keep graph, history, persistence, safe import, canonical bytes, worker correctness, cancellation and security boundaries mandatory. No known data-loss/security/correctness defect is accepted.
- Accept the measured selection/clear latency of approximately 17–33 ms and the roughly 16.8–16.9 ms frame cadence against the stricter original targets. These do not justify editor/architecture rewrites for the first beta.
- Optimize the largest observed delay: repeated scalar/UTF-8 scans in a valid 5 MiB document. Use native linear Unicode regular-expression scans with the original non-ASCII byte-count fallback. Canonical encoding, hashes, validation order and resource limits are unchanged.
- Current local Chrome/Edge are the verified branded targets. Chromium/WebKit automation supplements that proof. Firefox cannot launch on the audit machine; branded Safari, previous-stable browsers and manual NVDA/VoiceOver remain NOT TESTED and are disclosed, not certified.
- Engine/application branch-coverage targets and reference-machine certification remain improvement work. Automated keyboard/non-drag/focus paths remain mandatory; no WCAG conformance claim is made.

## Measured change

Same synthetic exact 5 MiB fixture, five warmups plus 30 retained samples, branded headless Chrome on the same machine; no sample removed. Original Stage 4 raw data remains local.

| Operation | Before p95 / maximum | After p95 / maximum | Assessment    |
| --------- | -------------------- | ------------------- | ------------- |
| import    | 314.20 / 362.00 ms   | 124.80 / 135.00 ms  | 60% lower p95 |
| export    | 213.70 / 264.10 ms   | 74.90 / 75.10 ms    | 65% lower p95 |

The initial follow-up observed import 97 ms p95 / 134 ms maximum and export 65.70 ms p95 / 73.70 ms maximum. The original 100 ms maximum-task target remained FAIL for import; the rare short pause at the maximum document size is accepted for this beta rather than mislabeled PASS. Final measurements and verification are recorded below before publication.

## Verification and assets

Local functional verification: **PASS**. Fast suites **191/191**, zero failures/skips. Types, lint, formatting, production and benchmark builds pass. Chromium **79/79** full suite; WebKit, Chrome and Edge **15/15** core cases each: **124 passing browser cases**, zero retries/skips, including actual Unicode import/export/reload and hostile lone-surrogate rejection. Chrome 155.0.8059.82 / Edge 155.0.4283.45; Chromium 156.0.8078.4 / WebKit 27.2 engines.

The final 5 MiB import is **124.80 ms p95 / 135 ms maximum**, export **74.90 ms p95 / 75.10 ms maximum**. Import retains strict FAIL against the original 100 ms maximum-task target; the residual short maximum-size pause is **ACCEPTED FOR THIS BETA**. Retained-heap checks for 20/100/300 nodes and 10/10 worker cleanup pass. Canonical bytes/hashes, scalar rejection and all numeric ceilings are unchanged.

The static ZIP was unpacked, every file checksum matched, and **5/5** packaged production journeys passed: editing/save/reopen, malformed/oversized import preservation, actual worker execution, Step/cancellation and Unicode storage round trip. No test-only compiled worker, node_modules, cache, user data or machine path is included in the static ZIP.

Public repository: https://github.com/thebraz/FlowCanvas. Owner-selected MIT; private vulnerability reporting enabled. GitHub Actions uses pinned official actions and verifies a clean lockfile install/types/lint/format/all fast tests/build. Its actual remote result and release identity are checked before publication. Candidate prerelease: **v0.1.0-beta.1**. This candidate file records local readiness; the release page/final receipt establishes publication. No hosted deployment is assigned.

The static archive includes dist, local CSP server, license/notices and synthetic examples. The source archive contains development inputs; raw diagnostics, node_modules, test-only compiled artifacts and historical internal audit reports are excluded from release archives. Original audit captures remain local.

Workflow schema/envelope/database/worker protocol stay version 1. Rollback restores compatible assets without deleting IndexedDB. Export before clearing browser storage or changing origins. Older Stage 2 settings-only downgrade limitations remain. No at-rest encryption, account sync, API/script nodes, joins/loops or cold offline-launch guarantee.
