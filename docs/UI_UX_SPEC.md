# UI and UX specification

## Layout and hierarchy

FlowCanvas is a developer tool with a restrained charcoal/blue dark default and a neutral light alternative. Use [design tokens](DESIGN_SYSTEM.md), clear labels, compact summaries, and consistent control behavior. No ornamental animation or imitation of another product's branding.

At >=1280 CSS pixels: 56-pixel top toolbar, 240-pixel left palette/workflow rail, flexible canvas (minimum 480), 320-pixel right inspector, optional 280-pixel bottom execution panel. At 1024–1279, collapse the left rail to a drawer and keep one inspector; panel drawers must not cover focused controls. Panels resize within 240–420 pixels, execution panel 180–50% viewport height, with keyboard size buttons; store settled panel preferences in settings.

Below 1024, default to the accessible graph list and stacked inspector, with an optional canvas view. At 320 CSS pixels and 400% browser zoom, controls and prose reflow; JSON/code regions may scroll locally. No mandatory action may require horizontally scrolling the full app. The two-dimensional graph can retain spatial scrolling, but equivalent list actions remain available.

## Regions and behavior

| Region | Mandatory content / behavior |
| --- | --- |
| Main toolbar | Workflow title/manager, save state, Undo/Redo, Add Node, Run controls by stage, theme and help; overflow menu preserves labels |
| Palette | Search six catalog entries, descriptions and Add buttons; keyboard creation; no unimplemented nodes |
| Canvas | Grid, controlled nodes/edges, zoom/fit controls, minimap toggle, selection summary, connection feedback |
| Graph list | All nodes sorted by label then ID, type/status/config readiness; expandable incoming/outgoing connections with edit/delete actions; equivalent editing access |
| Inspector | Node label/position, type-specific config, Apply/Cancel, validation, connection management; multi-selection bulk tools |
| Execution panel | State, current operation, chronological diagnostics, per-node input/output inspection, final results and partial-result warning |
| Workflow manager | Metadata listing, create/rename/open/duplicate/export/delete; dirty/conflict recovery; stable empty state |
| Diagnostics | Separate graph-readiness and run errors, filters/counts, focus target; truncation indicators |
| Command palette | Search enabled actions plus explained disabled actions; node creation, alignment, workflow management, theme, execution; keyboard and button access |

The editor toolbar and saved-workflow manager retain compact JSON export and offer a separately labeled **Export readable JSON** action. Both export committed content; the readable variant follows DATA_CONTRACT formatting and byte limits and cannot mark storage Saved.

Run results must identify run state and document semantic revision; cleared/stale results cannot appear as current. Preview is bounded and indicates truncation; explicit eligible payload download is separate. Do not render megabytes of JSON into one DOM subtree. Minimap is navigational and does not replace list access.

## Menus, dialogs, notifications

Context menus and command palette share the same command availability predicates as toolbar controls. Show shortcuts and reasons consistently. Menus close on action, Escape, or outside click, and restore focus. Dialogs have a heading, purpose, explicit action/cancel labels, initial focus, trapped focus, and restoration. Destructive workflow deletion names the workflow and starts focus on Cancel.

Notifications are short state confirmations or recoverable errors, bounded by MAX_NOTIFICATIONS in [data](DATA_CONTRACT.md). Routine save success updates status without repeated toasts. Error toasts remain dismissible and link to a durable recovery banner/panel; they must not be the sole carrier of import/save/validation failure. Avoid toast storms during continuous editing. Screen reader announcements summarize events rather than reading every engine step.

## Empty and failure states

- No workflows: explain local-only storage and provide Create / Import.
- Empty graph: Add Manual Trigger and Add Note actions plus keyboard hint; Run explains the missing trigger/output requirements.
- No selection: inspector describes selection and offers graph diagnostics.
- Unconfigured node: visible Draft/Needs configuration badge and inspector action, not fake completed data.
- No execution: explanation and readiness-linked Run; no fabricated charts/logs.
- Storage unavailable: persistent memory-only or error banner with export/retry; avoid Saved wording.
- Conflict/corruption/unsupported version: explicit preservation/recovery actions from persistence; do not replace with a blank screen.
- Internal rendering failure: recover shell and export access where canonical data remains valid; never reset storage automatically.

## Consistency and scope

Labels and technical node names are English throughout blueprint and planned beta. Icons supplement text; icon-only controls require accessible names/tooltips. Every enabled control works in its owning stage. Stage 1 may omit later-stage regions or show explanatory disabled items, never decorative fake functionality. See [roadmap](ROADMAP.md).

Theme selection supports System/Dark/Light; follow system changes only in System mode. Save preference locally, apply before visible shell where possible, and style canvas/popovers/forms together. Reduced-motion settings disable nonessential transitions. Focus and validation styles cannot be overridden by theme or execution highlighting.

Acceptance: visual review at 1440x900, 1024x768, 768x1024, and 320 CSS-pixel width; both themes; 200% text/400% zoom; long labels; all graph/run states; no workflow, dirty/conflict, and truncated results. Screenshot fixtures use synthetic data. Automated images detect regressions but human inspection validates hierarchy and clipping.
