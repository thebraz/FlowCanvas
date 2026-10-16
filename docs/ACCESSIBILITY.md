# Accessibility requirements

Target relevant [WCAG 2.2 AA](https://www.w3.org/TR/WCAG22/) requirements throughout the application. This is a planned target, not a conformance claim. The two-dimensional canvas has an equivalent accessible graph list; spatial complexity does not excuse inaccessible creation, editing, connection management, or execution.

For the owner-authorized first beta (D-23), verified keyboard/non-drag journeys, labels, focus and automated accessibility remain required. Real NVDA/VoiceOver, native platform zoom/contrast and complete manual certification remain NOT TESTED and are deferred to broader certification; no WCAG conformance claim is made. An observed inaccessible mandatory journey still blocks release. The full manual matrix below remains the target beyond this scoped beta.

## Required behavior and acceptance

| ID | Requirement | Verification |
| --- | --- | --- |
| A11Y-01 | All functions operable by keyboard with no trap; logical toolbar -> palette/list -> canvas -> inspector -> execution region order; skip-to-editor link | Automated keyboard journey plus manual traversal |
| A11Y-02 | Semantic buttons, labels, headings, landmarks, names and states; no unlabeled icon controls | Component tests and axe; screen reader confirmation |
| A11Y-03 | Focus visible and not fully obscured by sticky panels/dialogs; opening/closing overlays restores logical focus | Browser assertions and visual/manual review |
| A11Y-04 | Nodes creatable, movable via fields/arrows, alignable and deletable without dragging; edges creatable/reconnectable/deletable via labeled dialog/list | Equivalent-output E2E tests |
| A11Y-05 | Inputs have labels and instructions; errors linked using describedby/invalid, preserved draft data, summary focus on failed submit | Component/E2E plus reader review |
| A11Y-06 | Status messages announce save/conflict/run terminal states; failures use bounded assertive announcement, routine state polite | Live-region DOM tests and manual reader timing |
| A11Y-07 | Text, controls, ports, edges and focus use required contrast from design system; color never sole meaning | Automated contrast where supported; manual canvas/SVG checks |
| A11Y-08 | At 200% text and 400% zoom / 320 CSS pixels, equivalent list editing reflows; no lost controls or clipped dialog actions | Screenshots/layout tests and manual zoom |
| A11Y-09 | Reduced motion removes nonessential transitions; no flashing effects; execution independent of animation | Media-query browser tests |
| A11Y-10 | Modal has heading, modal semantics, focus containment, Escape/Cancel, background inert, focus restoration | Component/browser tests and reader review |
| A11Y-11 | Required targets meet size/spacing rules; single-pointer alternative to drag/pan gestures always available | Geometry checks/manual pointer review |
| A11Y-12 | Shortcut conflicts obey text input/IME/native editing; browser zoom remains intact | Focus-context matrix and manual platform checks |

## Accessible graph model

The graph list is a labeled region with one expandable item per node, sorted by label then ID. Each item exposes label/type, configuration readiness, selection checkbox, incoming connection, outgoing connections with ports/target names, and runtime disposition when present. Actions open the same inspector/connection dialog used by canvas affordances. Avoid a custom ARIA tree unless its full keyboard model is implemented; a semantic list with buttons is sufficient.

Canvas nodes have accessible labels including type and short status, not entire JSON payloads. Focused-node movement is an explicit mode with instructions and Escape exit. A selected node's complete text remains available in the inspector. Provide Center selected as a button; do not unexpectedly pan on screen reader list browsing. Fit/zoom/minimap have ordinary labeled controls.

Connection dialog selects source node/output port and target node/input port. Filter invalid options where practical, but keep explanations available; commit uses the same structural validator. Announce “Connection created” or the specific reason for rejection. Existing edges are discoverable and editable from both endpoints. No handle dragging is required for an equivalent action.

## Announcements and focus

Use one polite status region and one bounded error announcement region. Coalesce routine execution progress to no more than one announcement per second; always announce terminal status promptly. Do not announce every payload, timing event, hover, or pan. Visual diagnostics remain navigable independently of live regions. Save status changes must not move focus. A failed form Apply focuses error summary/first invalid control without deleting draft text.

After deleting focused nodes, focus the next graph-list item in stable order or the canvas heading. Document switch focuses the new workflow heading. Modal closure returns focus to the invoker if it survives, otherwise the nearest region heading. Context menus return focus to their node/edge/list control. Confirm workflow deletion initially focuses Cancel.

## Manual evaluation scope

Before beta, perform Windows NVDA with current Chrome and Firefox, and macOS VoiceOver with Safari. Record OS, browser, reader version, keyboard layout, journey, observed failures, and date. Required journeys: create/configure/connect without drag, encounter/resolve validation error, import rejection, save conflict recovery, Run/Pause/Step/Cancel, inspect partial results, and switch workflow. Browser automation and WebKit emulation cannot substitute for actual assistive technology or branded Safari.

Manual checks also cover focus visibility against graph states, zoom/reflow, high-contrast/forced-colors mode, pointer target use, and announcement usability. Stage 2 must test editor journeys; Stage 3 adds runtime journeys; Stage 4 repeats the complete release matrix. Missing manual evidence yields PARTIAL for affected gates, not a compliance badge.

## Scope boundaries

Node placement itself is spatial; the alternative offers numeric coordinates and alignment rather than an identical nonvisual canvas metaphor. Code/JSON blocks may scroll internally; app navigation/forms must reflow. Touch-first editing is not promised, but all beta-required controls must have equivalent accessible actions. Any exception to an applicable criterion needs a documented basis and cannot waive a mandatory product function silently. See [quality gates](QUALITY_GATES.md).
