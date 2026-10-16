# First beta release checklist

Proposed prerelease: package version `0.1.0-beta.1`, Git tag `v0.1.0-beta.1`. Neither exists at blueprint creation. This checklist is a future gate, not authorization to initialize Git, commit, tag, push, publish, or deploy. Current row-by-row evidence and unresolved gates are recorded in the [Stage 4 final audit](reports/STAGE_4_FINAL_AUDIT.md). A locally passing subset does not check off the complete release requirement. The owner subsequently authorized the focused beta profile in D-23. The original checklist below remains the stricter future target; the current first-beta checklist and actual publication status are in [BETA_READINESS](reports/BETA_READINESS.md). Missing evidence is disclosed rather than checked off as PASS.

## Technical readiness

- [ ] Stage 1–3 PASS reports exist for the actual final code and Stage 4 audit criteria S4-01–05 pass.
- [ ] Clean reproducible install using the selected supported Node and lockfile; typecheck/lint/format checks and production build pass without unexplained warnings.
- [ ] Unit/property/component/integration/security/E2E/accessibility suites pass; counts, environment, retries, and skipped/unexecuted cases are reported honestly.
- [ ] Production build, not only development server, is used for worker, persistence, CSP, and browser evidence. Bundle/fixture hashes identify the tested artifact.
- [ ] Graph invariants, all atomic commands, generated history sequences, stable IDs, deletion cleanup, and import rejection preservation are verified.
- [ ] Canonical codec round trips, strict version handling, import-as-new remapping, backups/checksums, two-tab CAS, deletion races, quota/abort/reload, and last-opened recovery pass using isolated real browser storage where required.
- [ ] Every node contract, branching/skips/fan-out/multiple triggers, deterministic ordering, partial failures, lifecycle controls, cancellation/timeout, and stale-result invalidation pass in pure and actual worker tests.
- [ ] All shared resource caps are enforced and tested; runtime state is absent from exported/stored documents; no arbitrary code or execution network traffic is possible through supplied nodes.
- [ ] Security/dependency review is complete; no unresolved Critical/High issue or mandatory security/integrity failure. Record every accepted nonmandatory finding with owner/rationale.
- [ ] Required 20/100/300 and stress performance targets pass with raw samples and reference environment; cleanup/memory/cancel evidence exists.
- [ ] Automated and manual accessibility journeys pass in required NVDA/VoiceOver environments; dark/light, focus, text zoom, and non-drag alternatives verified.
- [ ] Current/previous stable Chrome, Edge, Firefox, and Safari core journeys are checked; exact versions and actual branded-browser evidence recorded separately from Playwright engines.

## Documentation and repository readiness

- [ ] README accurately explains installation, development, build/test commands, local-only behavior, six nodes, limits, supported browsers, storage/export/recovery, and known beta limitations.
- [ ] Specifications/decisions match final behavior; stage and audit reports link to existing evidence; no speculative feature is presented as implemented.
- [ ] Real repository URL/owner, chosen open-source LICENSE, package metadata, description, topics, contributing guidance, security-reporting contact, and dependency notices are established. Never invent ownership/contact/license grant.
- [ ] Changelog and beta release notes describe actual changes, known limitations, browser storage risks, no at-rest encryption, no arbitrary-code/API execution, no joins/loops, no cold offline launch guarantee, and supported format versions.
- [ ] Version files agree; tag name is unused; history is preserved; no force push, destructive tag overwrite, or accidental stable-release label.
- [ ] CI runs the functional required checks, or an explicit authorized repository-hosting constraint and equivalent release verification is documented. Local passing checks alone do not imply CI has run.

## Assets and compatibility

- [ ] Prepare source archive/repository reference, production static build archive, SHA-256 sums, release notes, and synthetic sample workflows; exclude secrets, user data, test-only handlers, node_modules, and machine-specific paths.
- [ ] Validate packaged archive contents and hashes, then unpack and serve the exact build asset; repeat critical editor/save/reload/run/cancel journeys.
- [ ] State workflow schema version, database envelope/store versions, and protocol version compatibility. First beta has no prior-release migration; future prereleases require tested migrations and downgrade limitations.
- [ ] Define rollback as restoring application assets without deleting user IndexedDB; if a schema downgrade is unsupported, preserve/export data and block unsafe rollback rather than resetting storage.

## Authorization and final destination

- [ ] Explicit publication authorization names the intended repository/release destination and scope. Technical completion alone is insufficient.
- [ ] If deployment is assigned, hosting and URL are real and approved; production document/worker headers support the policy, HTTPS/MIME/assets work, and no development CSP relaxation is shipped.
- [ ] After publication, download/inspect the actual release assets, compare checksums, confirm prerelease/version/tag/source identity, and verify links. Do not equate local prepared assets with published assets.
- [ ] After deployment, test the actual final URL for load, graph editing, IDB reopen, import/export, worker execution/cancellation, and security headers; verify data remains origin-local and disclose that changing origins does not migrate storage.
- [ ] Write Stage 4 final report with separate technical-readiness, publication, and deployment outcomes. No deployment is required for an explicitly repository-assets-only release; record N/A with scope.

A release is blocked by unresolved critical integrity, security, execution failures, any other mandatory criterion violation, missing required evidence, or missing authorization. Preparation-only work may end as beta-ready/unpublished according to [quality gates](QUALITY_GATES.md). An unavailable required environment is PARTIAL, not a waived check.
