# Security

The supported release line is `0.1.0-beta`. FlowCanvas runs locally with a closed node registry: it does not execute user scripts or call workflow APIs. A worker provides isolation and termination, not a complete security sandbox. Browser storage is origin-local and unencrypted; do not use secrets as workflow data.

Report vulnerabilities privately through [GitHub security advisories](https://github.com/thebraz/FlowCanvas/security/advisories/new). If the private form is unavailable, open an issue requesting a private contact without including exploit details, credentials or user payloads. No response-time guarantee is promised for this beta.

The beta has limited browser/manual accessibility evidence. See [beta readiness](docs/reports/BETA_READINESS.md) for verified environments and known limits. See [the security model](docs/SECURITY_MODEL.md) for boundaries and resource enforcement.
