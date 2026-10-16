# Technology stack

## Selection and compatibility policy

Use the baseline below. Exact versions are intentionally not pinned in a documentation-only, empty workspace. At Stage 1 dependency selection, verify current stable releases, package peer dependencies, Node requirements, licenses, advisories, and mutual compatibility from official registries/documentation; record exact versions in a lockfile and the Stage 1 report. No guessed version numbers or prereleases. Prefer npm with one committed lockfile unless repository conventions later require otherwise.

[Vite's guide](https://vite.dev/guide/) defines its supported Node runtime; the implementing engineer MUST verify the selected release instead of copying an old minimum. Choose an actively supported Node LTS meeting Vite and test-tool requirements. Keep React and React DOM versions identical and use matching React type packages. TypeScript, ESLint plugins, Vite plugin, Tailwind integration, and Vitest MUST support the chosen major versions.

## Major dependencies

| Dependency | Purpose / integration boundary | Alternative and trade-off | Upgrade requirements |
| --- | --- | --- | --- |
| React + React DOM | Components, semantic controls, shell; UI only | Preact adds compatibility uncertainty for the graph library | Check graph-library peers, strict-mode effect cleanup, component/E2E tests |
| TypeScript | Strict domain modeling, discriminated unions, checked worker messages | Plain JS loses compile-time contract checks | Strict flags and exhaustiveness must remain; no mass unsafe assertions |
| Vite + official React plugin | Development server and static production assets, module worker build | Full-stack frameworks add unused server machinery | Recheck Node/browser targets, worker chunks, production asset paths |
| `@xyflow/react` | Controlled canvas rendering and gestures behind one adapter | Custom canvas duplicates accessibility and interaction work | Verify React peers, controlled APIs, handle IDs, reconnection and keyboard behavior |
| Zustand | Vanilla application stores with React selectors; no domain imports | Redux Toolkit adds conventions/middleware not needed at this scope | Confirm selector equality APIs and concurrent React behavior; do not rely on unstable internals |
| Zod | Strict boundary schemas and discriminated unions; inferred boundary types | Ajv requires a separate JSON Schema/type consistency workflow | Check strict object/record/union API changes and error mapping; no coercion |
| Tailwind CSS | Static utility styling mapped to CSS token variables | CSS modules are viable but baseline selects utilities | Use the selected major's documented Vite integration; do not mix setup instructions across majors |
| `@phosphor-icons/react` | Consistent icons with explicit accessible names on controls | Handwritten SVG set increases maintenance | Tree-shake named imports; verify license, sizing and rendering semantics |
| Vitest | Pure/domain/engine tests and browser-adapter integration | Jest duplicates Vite transform configuration | Match Vite support; fake timers must not leak into real-browser evidence |
| React Testing Library + DOM/user-event helpers | User-observable component behavior and keyboard input | Shallow tests do not demonstrate focus behavior | Verify React/DOM-environment compatibility and act semantics |
| Playwright | Chromium/Firefox/WebKit E2E, worker and real IndexedDB verification | Browser mocks cannot validate browser lifecycle | Pin browser binaries with runner; revalidate snapshots/permissions after updates |
| ESLint + TypeScript/React/accessibility plugins | Boundary rules, hook correctness, unsafe patterns | Formatting alone misses semantic issues | Select mutually compatible flat configuration and plugins |
| Prettier | Deterministic source/Markdown formatting | Manual formatting produces review noise | Separate formatting from correctness; avoid reformatting unrelated work |

The [Zod API](https://zod.dev/api) and [Zustand repository](https://github.com/pmndrs/zustand) are integration references, not substitutes for FlowCanvas contracts. Strict schema rejection and selector granularity are project requirements.

## Justified supporting tools

- `fast-check` as a **development dependency** for seeded mutation/history/graph properties. Handwritten examples alone poorly cover long reversible command sequences. Store seed and shrunk counterexample on failure.
- `fake-indexeddb` as a **development dependency** for fast adapter tests. It does not prove browser durability, quota behavior, or transaction scheduling; real browser tests remain mandatory.
- `@axe-core/playwright` as a **development dependency** for automated accessibility checks. It cannot establish complete WCAG or assistive-technology conformance.
- A DOM test environment compatible with the selected Vitest release is required for component tests. Record the chosen environment and its limitations at Stage 1.

Use native IndexedDB, Web Crypto, module workers, `structuredClone`, Clipboard API with a manual fallback, and native HTML controls. Do not add an IndexedDB ORM, router, date library, graph algorithm package, UUID package, generic form engine, global event bus, animation library, or deep-clone dependency without demonstrated need. Native IndexedDB transaction helpers belong in one narrow adapter.

## Update procedure and release evidence

Update one compatible group at a time. Inspect release notes and advisories; rerun type/build/unit/integration gates plus affected canvas, worker, storage, security, and accessibility E2E scenarios. Schema changes require migration decisions regardless of package version. Preserve lockfile reproducibility and record breaking changes in [decisions](DECISIONS.md). Do not resolve peer conflicts with force flags.

The baseline is implemented in Stage 1 with exact versions in package.json/package-lock.json and actual compatibility evidence in [the Stage 1 report](reports/STAGE_1_REPORT.md). TypeScript 6.0.3 satisfies typescript-eslint's `<6.1` peer range; ESLint 9.39.5 satisfies jsx-a11y's current `^9` peer range. The latter is upstream-deprecated and requires a compatible plugin-group review before Stage 4. No force/legacy-peer-deps exception is used. Registry metadata, licenses, and advisory results are retained in report evidence. Hosting, CI provider, repository license, and full branded-browser test access retain their deadlines in [decisions](DECISIONS.md).
