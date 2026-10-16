# Editor interactions

All interactions produce application intents, not direct renderer mutations. [Commands](GRAPH_COMMANDS.md) owns atomicity/history; [state](STATE_MANAGEMENT.md) owns drafts and revisions. Read-only/disabled conditions MUST be visible, focusable where explanation is needed, and announced without pretending an action succeeded.

## Canvas and editing transitions

| Action | Transition and observable outcome | Keyboard/accessibility alternative |
| --- | --- | --- |
| Create node | Palette/catalog -> choose type -> CreateNode at canvas pointer or visible center -> select/focus new node | Palette buttons or command palette; inspector position fields |
| Drag node(s) | Capture -> frame-batched overlay -> one MoveNodes commit; Escape/capture loss cancels | Arrow keys on focused node; Shift+Arrow moves 16 instead of 1 CSS pixel |
| Connect | Start output -> preview -> valid target drop -> CreateEdge | Connection dialog with source node/port and target node/input selectors |
| Invalid connection | Preview reason; drop announces error and changes nothing | Same validation/error in connection dialog |
| Reconnect | Preview with original edge excluded -> valid commit preserving edge ID | Edge details dialog edits endpoints; Cancel leaves old edge |
| Select | Click replaces; Shift+click toggles; Shift+background-drag box adds intersecting rectangles | Graph list multi-selection checkboxes; Shift+keyboard range selection |
| Pan | Middle drag or Space+primary drag on background; no graph command | Canvas-focused pan controls; fit-view and center-selected buttons |
| Zoom | Wheel changes zoom around pointer; toolbar +/- and fit reset | Labeled buttons and numeric zoom control; [0.25,2] bounds |
| Minimap | Click/pointer drag changes viewport only | Focusable minimap controls or canvas pan/fit controls; no required drag |
| Grid | Toggle 16 CSS-pixel snapping; render subtle grid | Labeled toolbar/menu toggle with pressed state |
| Context menu | Node/edge/background actions scoped to clicked entity; select it if needed | Shift+F10/menu key opens same actions on focused entity |
| Delete | One BulkDelete for nodes + edges; remove incident edges; update focus | Delete/Backspace outside text controls, graph list buttons |
| Align | Choose mode for >=2 selected nodes -> one transaction | Command palette/menu actions |

Wheel over canvas is canvas zoom; ordinary page scrolling remains available outside the canvas and in the narrow-width list view. The canvas MUST not capture browser zoom shortcuts or create a keyboard trap. Grid snapping applies to pointer drag settlement and node creation; explicit position fields and 1-pixel keyboard nudges bypass snapping, with that rule stated in help. Bounds are enforced before publication. Pan/zoom gestures settle viewport into persistent data but never history.

Palette dragging supplies the custom node MIME type and a namespaced plain-text fallback for engines that discard custom native drag data. Drop accepts only the closed node-type registry, never executable or arbitrary imported data. Both transports use the same coordinate conversion, grid policy and CreateNode transaction (D-22).

## Clipboard and shortcuts

Use Cmd on macOS and Ctrl elsewhere, displayed from platform context without blocking other platforms.

| Shortcut | Scope and behavior |
| --- | --- |
| Mod+Z | Undo document command |
| Mod+Shift+Z; Ctrl+Y on Windows | Redo |
| Mod+C / Mod+V | Copy selected subgraph / paste validated fragment on canvas/list focus |
| Mod+D | Duplicate selected nodes with internal edges as one subgraph command |
| Mod+A | Select all graph entities while canvas/list focused |
| Mod+S | Explicit Save, await status; override browser save only in an open editor |
| Mod+K | Open command palette outside editable fields |
| Escape | Close top overlay, cancel connection/drag, or clear selection in that priority order |
| Arrow / Shift+Arrow | Move focused selected nodes by 1 / 16 CSS pixels when node movement mode is active |
| Enter | Open focused node inspector or activate current button/menu item |
| F6 / Shift+F6 | Cycle editor regions; help identifies the sequence |

Do not hijack copy/paste/select-all/undo/delete/arrows in inputs, textareas, contenteditable, JSON editor, IME composition, or modal widgets. Native text editing wins. Mod+K is available as an ordinary button from those contexts. Runtime controls use labeled buttons and command actions; no single-letter global shortcut. Key auto-repeat grouping follows GRAPH_COMMANDS. Clipboard read requires user action; denied/unavailable APIs open the manual text dialog.

## Inspector, navigation, and errors

Selecting one node opens its inspector. Multi-selection opens counts, alignment, and bulk actions. Form edits remain local; Apply commits one complete config; Cancel restores values. JSON parse/schema errors are inline, linked to fields, and preserve draft text. Switching selection with dirty draft offers Apply if valid, Discard, or Stay; invalid drafts cannot be applied. Rename uses explicit Apply/Enter and Escape to cancel.

Workflow navigation resolves drafts and pending saves before replacing the session. Import validates in isolation, then opens a new local document according to [persistence](PERSISTENCE.md). Deletion of an entire workflow uses a name-bearing confirmation dialog; ordinary graph deletion relies on undo. A failing import/save/command must leave the graph visible with recovery actions.

Connection failures appear near the candidate target and in an accessible status/error region; do not rely on red coloring or transient toasts alone. Persistent graph diagnostics identify the affected node/edge and provide Focus action. Runtime errors live in the execution panel, with partial output labeled.

## Execution controls

Run is enabled only after current readiness validation. Pause is available while running, Resume/Step while paused, Cancel while validating/ready/running/paused, and Reset after a terminal state. A pending Pause shows its pending status until acknowledged. Disable semantic editing during nonterminal execution; movement/selection/pan and inspection remain available. Guards in the coordinator still handle programmatic semantic changes by cancelling/invalidation. Controls follow [allowed transitions](EXECUTION_MODEL.md); duplicate clicks cannot start overlapping runs.

Acceptance: every table row has a component or E2E scenario with outcome/history/save assertions; keyboard paths must reach the same domain result as pointer paths. Test focus inside forms and dialogs, browser zoom, IME composition, clipboard denial, cancelled gestures, and repeated control clicks. Manual assistive-technology testing follows [accessibility](ACCESSIBILITY.md).
