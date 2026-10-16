# Design system

## Tokens

Use CSS custom properties as the single token source, exposed through Tailwind utilities. Node adapters and dialogs MUST use the same tokens. Values below are selected design targets; rendered contrast/focus must still be tested in Stage 2/4.

| Token | Dark | Light | Use |
| --- | --- | --- | --- |
| background | #0D1117 | #F5F7FA | Canvas/app background |
| surface | #161B22 | #FFFFFF | Node, toolbar, inspector |
| surface-raised | #21262D | #EEF2F7 | Menus/hover surfaces |
| text | #E6EDF3 | #17212F | Main text |
| text-muted | #9DA7B3 | #4B5563 | Secondary readable text |
| accent | #58A6FF | #185ADB | Selection/link/icon accent |
| primary-fill | #1F6FEB | #185ADB | Primary action background |
| on-primary | #FFFFFF | #FFFFFF | Primary button text |
| control-border | #718096 | #667085 | Required boundaries and default edges |
| divider | #30363D | #D7DEE8 | Decorative separators only |
| grid | #30363D | #DDE3EB | Nonessential 16-pixel grid |
| success | #56D364 | #16713D | Completed icon/text |
| warning | #E3B341 | #8A5700 | Warning/draft icon/text |
| danger | #FF7B72 | #B42318 | Invalid/failed icon/text |
| focus | #FFDF5D | #174EA6 | Visible keyboard ring |

Text uses text/text-muted on background, surface, or surface-raised; primary text uses on-primary on primary-fill. Status colors are text/icons on neutral surfaces, not colored text on other status fills. Links are underlined outside obvious controls. Divider/grid need not meet interactive contrast because they carry no required information. Boundaries/ports/edges/focus indicators that carry information MUST meet 3:1 against their adjacent surface; normal text 4.5:1, large text 3:1. Never reduce essential text contrast through opacity. Disabled controls use text-muted plus a disabled state, not unreadable transparency.

Typography: locally available `Inter, ui-sans-serif, system-ui, sans-serif` (do not fetch fonts); JSON/code `ui-monospace, SFMono-Regular, Consolas, monospace`. Base 14px/20px, body 16px/24px, small labels 12px/18px, region headings 16px/24px semibold, dialog headings 20px/28px semibold. Use rem equivalents for typography. User content MUST NOT require tiny text. Node summaries are concise; full text appears in inspector.

Spacing scale: 0, 4, 8, 12, 16, 24, 32, 48 CSS pixels (rem equivalents in layout). Radii: 4 small, 8 standard/control/node, 12 dialogs. Border: 1px standard; selected ring 2px; focus ring 3px with 2px offset. Shadows: small `0 2px 8px rgb(0 0 0 / 0.16)`, dialog `0 12px 32px rgb(0 0 0 / 0.28)`; no glow/neon.

Layer tokens: canvas grid 0, edges 10, nodes 20, selected nodes 30, canvas controls 40, panels 100, menus 200, modal backdrop 300, modal 310, toast 400, tooltip 500. Keep local stacking contexts explicit; tooltips never escape a modal focus boundary.

Motion: 0ms reduced motion, 100ms hover/color, 150ms panel/menu, 200ms maximum nonessential transition. No animated edge particles, pulsing canvas, looping success effects, or animation-dependent state changes. Runtime progress uses static icons/status and optional subtle spinner respecting reduced motion.

Breakpoints: compact <768, medium 768–1023, desktop 1024–1279, wide >=1280 CSS pixels. [UX](UI_UX_SPEC.md) owns region behavior.

## Graph visual rules

Executable node rectangle: 240x96 at zoom 1; Note 240x160. Header includes icon, type/label, and readable status; body contains a one-line operation summary or Needs configuration. Use ellipsis visually while accessible name/full inspector preserve content. Input left, output right, Condition outputs labeled True and False in fixed vertical order. Ports have a visible 12-pixel marker and at least a 24x24 hit region; keyboard connection dialog is always available.

Default edges use control-border, 2px stroke and arrowhead; selected edges accent, 3px plus selected label. Inactive runtime branches use dashed edges and a Skipped explanation; required edges remain contrast-compliant. Do not route selection or execution meaning through color alone. Edge hit region is at least 12px; graph-list controls provide a larger alternative.

| Node state | Visual treatment and semantic label |
| --- | --- |
| Default | Surface, control-border, type icon |
| Hovered | Surface-raised, unchanged readable border |
| Selected | Accent 2px ring, selected state/checkbox |
| Invalid/draft | Danger or warning icon and explicit Invalid / Needs configuration text |
| Running | Accent progress icon and Running text |
| Completed | Success check icon and Completed text |
| Skipped | Muted dashed status badge and Skipped reason; never hide the node |
| Failed | Danger icon, Failed text, linked diagnostic |
| Cancelled | Neutral stop icon and Cancelled text |

Priority: keyboard focus ring outermost; selection ring remains visible; status icon/text remains inside. Failure does not erase selection/focus. Hover cannot hide invalid markers. Run states are ephemeral overlays; they never serialize into presentation metadata. Note accent is cosmetic and must not imply execution.

## Component requirements

Buttons, inputs, toggles, menus, tooltips, dialogs, status badges, banners, tables, code previews, and command palette use shared semantic primitives. Default target size SHOULD be 32x32 or larger; no required action target below 24x24 without a valid WCAG exception and an equivalent accessible control. Inputs use persistent labels, inline error text, and no placeholder-only naming. Provide disabled/loading/pressed/focus/error states before a component is considered complete.

Acceptance requires computed contrast checks for actual pairings, keyboard focus inspection, both themes, reduced motion, text scaling, all node states, and clipping review. Token arithmetic alone does not establish complete rendered accessibility.
