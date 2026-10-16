# Contributing

Use [GitHub issues](https://github.com/thebraz/FlowCanvas/issues) for reproducible bugs and focused proposals. Use synthetic documents; never attach secrets, real workflow payloads or browser databases. Follow [SECURITY.md](SECURITY.md) for vulnerabilities.

Use Node 24.19.0 and the existing lockfile. Run `npm ci`, `npm run verify`, and `npm run test:security`; use `npm run test:e2e` after changes to editor/storage/worker behavior. Preserve graph invariants, canonical bytes and strict boundary validation. Add a focused regression for a confirmed defect. Keep the six-node scope and module boundaries; discuss public format or node-semantic changes before implementation.

The beta intentionally defers minor performance tuning and broader manual/browser certification. Do not turn missing evidence into a PASS or weaken integrity/security assertions to improve a metric. [D-23](docs/DECISIONS.md) records the owner's beta scope.
