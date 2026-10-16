# FlowCanvas 0.1.0-beta.1 — readiness and publication

**RELEASE STATUS: RELEASED — public GitHub prerelease, MIT.**

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

## Verified publication

- Release: [v0.1.0-beta.1](https://github.com/thebraz/FlowCanvas/releases/tag/v0.1.0-beta.1), published 2026-10-16T18:15:49Z. GitHub reports prerelease=true and draft=false.
- Release/tag/source commit: `761710cf6b53ad8b684bc503bb54f0bdf7599612`. The annotated remote tag was dereferenced and matches that exact commit. No existing tag/history was overwritten.
- [GitHub CI](https://github.com/thebraz/FlowCanvas/actions/runs/38945465251): completed successfully on the exact release commit, including clean npm install, types/lint/format, full fast coverage suite and production build.
- All four public assets were downloaded and SHA-256/length matched their locally prepared values. The downloaded static ZIP then passed **5/5** production editor/storage/import/worker/control/Unicode cases, with zero retries/skips. This supplements the **5/5** prepublication package cases and **124** post-optimization browser cases.
- Hosted deployment: NOT ATTEMPTED, outside the assets-only release.
- Git commits/tag are not GPG-signed: the workstation global signing configuration referenced an unavailable placeholder key. Per-command unsigned operations preserved the global setting; no signature is claimed.

| Published file                     | Bytes  | SHA-256                                                            |
| ---------------------------------- | ------ | ------------------------------------------------------------------ |
| flowcanvas-0.1.0-beta.1.zip        | 250969 | `d8679027c41429c68a9e0916dfea40c9dc8b14a29d05c91271183b1a286537da` |
| flowcanvas-0.1.0-beta.1-source.zip | 410510 | `d03d0c8d48213ea3d2cc4a617b95ce8d2b77974545544e08daf1751ed4330b4e` |
| RELEASE_NOTES.md                   | 2435   | `5fcfc632f9d5f21b1677b624f7152a92416ca8c86edd6e35dbb845f4bd67c749` |
| SHA256SUMS.txt                     | 278    | `a5304f89ded95cbb05eecf8ca4134fbb595d869cf7db88a1d5b6f02cc5bb3a64` |

The release tag and uploaded archives remain at the verified release commit. This later documentation receipt records remote verification without changing released code, moving the tag or replacing an asset. Minor performance and unverified environment limitations remain accepted as documented above; original strict FAIL/PARTIAL reports remain historical evidence.
