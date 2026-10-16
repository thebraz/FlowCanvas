# Security model

## Assets and trust boundaries

Protect workflow integrity, local payload confidentiality, stored documents/backups, UI availability, and accurate execution results. Untrusted inputs include imported files, clipboard JSON, persisted records, node text/configuration, and worker messages. Bundled application code and vetted dependencies are trusted but may contain vulnerabilities. Browser extensions, compromised OS/browser, other same-origin code, and malicious hosting are outside the application's enforceable protection boundary.

Local-first does not mean encrypted or immune to XSS. IndexedDB is origin-scoped browser storage, not a credential vault. No authentication, credentials, accounts, external API calls, telemetry, remote data processing, or network workflow nodes exist in beta. Users should avoid secrets in workflows and understand that explicit export/download copies data to disk.

## Threats, controls, and evidence

| Threat / impact | Mandatory mitigation | Regression evidence |
| --- | --- | --- |
| Malformed/unsupported imports -> corrupt graph | Bounded decode, strict schema, full invariants, isolated candidate, atomic reject | Invalid import leaves active document/storage/history byte-equivalent |
| Duplicate JSON keys -> ambiguous validation | Decoded-key duplicate rejection before parse | Literal and escaped duplicate keys fail |
| Oversized/deep JSON or costly graph -> UI exhaustion | Shared byte/depth/value/graph budgets before recursive validation; iterative algorithms | Every cap and cap+1; adversarial depth/fan-out |
| Pollution/path traversal -> inherited mutation/access | Forbidden keys recursively, own-data properties, object-only literal paths | Prototype canaries, inherited properties, getters never invoked |
| Script-like labels/data -> XSS/navigation | React text/plain text nodes, no unsafe HTML/Markdown/URL execution | Script/HTML payloads remain literal across canvas/inspector/errors |
| Storage corruption/stale writes -> data loss | Checksum, full hydration validation, verified backup, atomic CAS queue | Corrupt record, abort, two-tab conflict, deleted-record race |
| Unconstrained execution -> code/network execution | Closed node registry, no eval/Function/dynamic code/network; worker lifecycle | Capability lint plus no-network runtime test |
| Stalled operation/cancel failure -> availability loss | Host watchdog, cooperative abort then terminate, finite run lifetime | Real worker hang/cancel and visibility-return tests |
| Stale async results -> misleading state/data | Session + semantic revision + run ID and storage revision guards | Reopen same ID, semantic undo, switch during save/run |
| Diagnostics leak -> exposure | Metadata-only logs, bounded text previews, explicit data export | Fake-sensitive canary absent from logs/reports |
| Vulnerable dependency/supply chain | Lockfile, minimal dependency set, advisory/license review, compatible updates | Stage 4 dependency report and targeted regressions |
| Browser eviction/shutdown -> lost writes | Honest dirty/error state, explicit export, recovery copies | Real reload/transaction tests; limitation documented |

[DATA_CONTRACT](DATA_CONTRACT.md) owns exact limits. [EXECUTION_SECURITY](EXECUTION_SECURITY.md) owns engine boundaries. [PERSISTENCE](PERSISTENCE.md) owns storage ordering and recovery. This file does not redefine them. The forbidden-key/own-property policy is consistent with [OWASP prototype-pollution prevention guidance](https://cheatsheetseries.owasp.org/cheatsheets/Prototype_Pollution_Prevention_Cheat_Sheet.html).

## Safe rendering, logging, and privacy

No `dangerouslySetInnerHTML`, raw HTML insertion, user-derived CSS, script URLs, automatic external links, or markdown HTML. Presentation accent is a fixed enum. Sanitize export filenames using a bounded safe title-derived string; never interpret titles as paths. Revoke object URLs after downloads. Clipboard access occurs only following the user's copy/paste action; provide a manual alternative without broad permission requests.

Production console diagnostics contain stable error codes, random entity IDs where necessary, counts, version, and limit names only. Do not log raw imported bytes, filenames, payloads, node labels, field values/paths, stack locals, or native error strings that may embed them. Full local inspection is user-triggered; copying diagnostics defaults to redacted metadata. No automatic error-upload endpoint or third-party analytics.

## Production browser policy

The intended static-host response policy is:

```text
default-src 'self'; script-src 'self'; style-src 'self';
style-src-attr 'unsafe-inline'; img-src 'self' data:; font-src 'self';
connect-src 'none'; worker-src 'self'; object-src 'none';
base-uri 'none'; frame-ancestors 'none'; form-action 'none'
```

Serve document and worker JavaScript with appropriate CSP response headers, restrictive `connect-src`, correct MIME types, HTTPS, `X-Content-Type-Options: nosniff`, and `Referrer-Policy: no-referrer`. Workers need their own response policy; the document's policy is not a general sandbox for worker code. No inline script or unsafe-eval exception. Same-origin bundled module worker chunks MUST work under policy. The narrow style-attribute exception accommodates graph positioning/style properties; untrusted CSS remains forbidden. Verify actual rendered behavior instead of assuming all style update mechanisms have identical CSP behavior.

[CSP documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy) and [style attribute directives](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/style-src-attr) define browser behavior; the above policy is a proposed application requirement. Development HMR may require a separate localhost-only policy; never ship its relaxations. Frame-ancestor protection requires response headers, so meta-only hosting cannot satisfy hosted-release policy. Hosting selection is due before Stage 4 release preparation.

## Residual risks and response

CSP reduces injection exposure but cannot compensate for malicious trusted code or all navigation channels. No at-rest encryption or secure erasure guarantee. Browser storage quotas/eviction and background scheduling are not controlled by the app. Document these limitations in beta notes without claiming a complete sandbox.

Classify findings using [quality severity](QUALITY_GATES.md). Confirmed data-loss, arbitrary execution, or payload-exfiltration vulnerabilities block release. Fix with a minimal root-cause change, synthetic regression, relevant full gates, and updated contracts if behavior changes. Private reporting/contact details are deferred until repository ownership is set; they must be real before public release, never invented.
