# Performance specification

All numbers below are **proposed acceptance targets, NOT measured results**. Stage 1–3 establish relevant measurements; Stage 4 verifies the complete beta. Resource ceilings in [data](DATA_CONTRACT.md) are independent safety limits, not throughput promises.

## Owner-authorized first-beta scope

For `0.1.0-beta.1`, D-23 accepts the observed approximately 17–33 ms selection/clear latency and 16.8–16.9 ms frame cadence as minor differences. Optimize the largest observed pause in valid 5 MiB codec work; retain exact canonical bytes, hostile-input checks and resource ceilings. A rare short residual pause at the largest size may remain a disclosed beta limitation. Record the original targets and observed FAILs unchanged, then report the beta acceptance separately. The complete targets and reference/other-browser measurements below remain post-beta work; no stable-performance certification is claimed.

## Reproducible environments and fixtures

Reference environment: physical desktop/laptop with >=4 physical CPU cores / 8 logical threads, 16 GiB RAM, SSD, integrated GPU, 60 Hz display, supported Windows 11, current stable Chrome, 1440x900 CSS viewport, device scale 1, AC power, no CPU throttling, no extensions/background load, production build, DevTools closed except when capturing traces. Record exact CPU/GPU/OS/browser/commit, power mode, resolution, bundle hash, and server configuration. This is a minimum reproducibility profile, not a claim of a tested machine.

Run the same interaction tests on Firefox and Safari; collect engine-specific timing, mark unavailable memory instrumentation honestly. Use Playwright engine tests for regression but branded-browser measurements for the release matrix. Do not silently compare different machines. If a reference machine is unavailable, report PARTIAL until comparable evidence exists.

Create seeded fixtures (`seed=42615`) of exactly 20, 100, and 300 total nodes, approximately 10% Notes, one Manual Trigger, reachable Set/Pick/Condition/Output nodes, single-input acyclic fan-out, both active/inactive branches, fixed UUIDs, fixed grid positions, and approximately 1 KiB initial JSON payload. Keep outputs near 1 KiB (replace existing fields rather than unbounded growth). Check in generator recipe and actual fixture hashes during implementation. Add separate adversarial near-byte/depth-limit fixtures; do not present them as the representative baseline.

Warm up 5 times, then collect 30 samples per operation. Report median, p95 (sorted rank `ceil(0.95*n)`), maximum, and errors; no removing outliers without a documented environmental cause and full rerun. Browser navigation/load uses 10 isolated fresh profiles/caches. Save raw trace/samples and commands in stage reports. Instrument user-intent start through domain publication and next painted frame; async storage completion is measured separately.

## Targets and measurement methods

| Metric | 20 nodes | 100 nodes | 300 nodes | Reproducible method |
| --- | --- | --- | --- | --- |
| Open persisted workflow to usable graph | p95 <=250ms | <=500ms | <=1,000ms | Mark Open intent, real IDB load+validation, next paint with interactive controls |
| Graph first render after validated publication | <=100ms | <=250ms | <=600ms | Performance marks before publication and after two animation frames; verify projected node count/list |
| Pan/zoom frame duration | p95 <=16.7ms | <=20ms | <=25ms | Script 5-second fixed-distance pan and 5-second zoom, capture rAF deltas and browser trace |
| Selected-group drag frame duration | <=16.7ms | <=20ms | <=25ms | Drag 10% of nodes along fixed path for 5 seconds; measure frames and final commit separately |
| Config Apply to painted result | <=20ms | <=35ms | <=50ms | Same bounded Set Field edit, include validation/candidate publication, exclude IDB await |
| Select/clear 10% nodes | <=10ms | <=16ms | <=25ms | Keyboard/list intent to painted selection; no graph mutation |
| Undo/redo to painted restoration | <=30ms | <=60ms | <=100ms | Repeat 30 pairs after fixed 10-command setup; assert restored graph content |
| Full structural/readiness validation | <=10ms | <=25ms | <=75ms | Pure validator marks, fixed fixture, production bundle/browser runner |
| Canonical serialization | <=10ms | <=30ms | <=100ms | Encode full fixture and UTF-8 bytes; separately report SHA-256 time |
| Compile + complete worker execution | <=100ms | <=300ms | <=1,000ms | Start request through validated terminal event; exclude UI animation, include transport/validation |
| JS retained heap above empty-page baseline | <=80MiB | <=120MiB | <=200MiB | Chrome heap snapshots after load + 100 representative commands + 10 runs, GC in measurement harness |

Whole-application cold load: LCP <=2.5s and usable empty shell <=3s at p95 with 10 Mbps download / 1 Mbps upload / 100ms RTT simulated network, no CPU throttling. Measure a production server with cold browser cache, Navigation/Paint timing and an explicit shell-ready mark. Initial JavaScript transfer SHOULD be <=400 KiB gzip; measure built assets and network transfer, reporting lazy chunks separately. A missed SHOULD needs a documented decision, not concealment.

Autosave quiet-edit completion: p95 <=1s from commit to transaction complete for representative fixtures (includes 500ms debounce). Explicit Save: p95 <=500ms. Use real IndexedDB and captured revision assertions; browser suspension is excluded and documented. Near-5MiB import: <=1s bounded decode/validation on the reference machine, with no main-thread task >100ms; use chunked scanning/validation yielding if needed. Max-size serialization/export: <=500ms with no task >100ms. These stress targets are separate from the small representative-fixture row.

Cancellation follows DATA_CONTRACT foreground target; measure request-to-terminal with a deliberately unresolved test-only worker handler. All interaction traces must report >50ms long tasks; no repeated >50ms tasks during steady pan/drag. After 50 open/close/run/reset cycles, post-GC retained heap growth must be <=10MiB above the first 5-cycle baseline, with no retained inactive workers/listeners/payload registries. Unsupported memory APIs are NOT TESTED; use Chrome heap tooling instead of fabricated cross-browser numbers.

## Engineering strategies and constraints

- Narrow selectors, stable component identity/callbacks, memoized entity projections, frame-batched overlays, and revision-keyed derived indexes are required first.
- Recalculate topology only when topology changes; validate changed configs locally while checking global byte budgets. Do not run execution from rendering effects.
- Bound history/caches/events and lazily render JSON previews. Use one worker per run for compilation/operations; do not create a worker per node.
- Viewport culling or list virtualization MAY be enabled only after measured benefit and keyboard/focus/accessibility regression checks. Hidden nodes remain addressable through the graph list.
- Do not add broad memoization, patch-history complexity, offscreen canvases, or layout engines without evidence identifying the bottleneck.

Budget deviations are mandatory gate failures when a required target is exceeded under the agreed environment. Fix the bottleneck or explicitly revise the requirement before declaring PASS, with rationale/evidence; no retroactive relabeling of a failed run. Reports must distinguish proposed target, observed sample, and verified conclusion.
