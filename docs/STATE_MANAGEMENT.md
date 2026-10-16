# State management

## Ownership

Use one application-scoped vanilla Zustand store composed of slices, with React hooks exposing narrow selectors. The store contains one active document session and bounded background save tasks, not an independently editable library of graph copies. Workflow listing is loaded metadata from storage. Domain reducers remain framework-independent.

Stage 1 established document, derived-cache, interaction, viewport, and UI ownership in one vanilla store. Stage 2 implements bounded immutable-content history, grouped Apply/drag transactions, selection/draft guards, ephemeral pointer/drag/viewport overlays, and the ordered save coordinator. Stage 3 adds the ephemeral runtime slice, reduced by the independent run coordinator and tagged with session/semantic revision/run identity. Immutable per-node records retain identity across unrelated events; the canvas and list subscribe by node ID. Runtime updates are batched separately from canonical publication. The D-17 theme bootstrap is migrated transactionally to IndexedDB settings; session counters/history/runtime remain transient. Native gesture callbacks are distinguished from controlled viewport synchronization so projection updates cannot schedule persistent edits.

| State | Authority | Persistent? | History? |
| --- | --- | --- | --- |
| Workflow document | Document session, immutable canonical object | Yes, explicit projection | Editable content only |
| Derived graph indexes/readiness | Domain/application cache tagged by revisions | No | No |
| Undo/redo | Graph session | No | Self-owned bounded stacks |
| Selection/focus/hover | Editor interaction slice | No | No |
| Drag and form drafts | Interaction/inspector slice | No | No |
| Viewport during gesture | Editor overlay | No until settlement | No |
| Settled viewport | Canonical document viewport | Yes | No |
| Panels/modals/command palette | UI slice | Panel/theme/grid preferences only in settings, including execution height/expanded state | No |
| Execution status/events/results | Run coordinator slice | No | No |
| Notifications | Bounded UI queue under MAX_NOTIFICATIONS | No | No |
| Save state/revisions/pending snapshots | Persistence coordinator | Only storage envelope revision | No |

## Session and revision model

```ts
interface DocumentSession {
  readonly sessionId: string; // fresh on each open, including reopening same workflow
  readonly document: WorkflowDocument;
  readonly documentRevision: number;
  readonly semanticRevision: number;
  readonly topologyRevision: number;
  readonly baseStorageRevision: number | null; // null for not-yet-created record
  readonly savedDocumentRevision: number | null;
}
```

Counters are nonnegative safe integers scoped to a session, not serialized in workflow JSON. Every committed persistent change increments documentRevision, including settled viewport. Topology changes increment topologyRevision. Semantic changes increment semanticRevision: executable node create/delete, executable config edits, and edge create/delete/reconnect. Moving/labeling nodes, editing Notes, changing titles/presentation, or viewport do not change execution meaning. Adding/deleting a Note is topology-index relevant but not execution-semantic. Classification is explicit in command results, never guessed by object-reference inequality alone.

Semantic changes cancel an active run, invalidate its plan, clear accepted runtime results, and reject subsequent events from that run. Position/presentation changes may preserve results. While running/paused, inspector semantic Apply and topology controls are disabled; API-level edits remain safe via cancellation/invalidation. Undo/redo with semantic content changes follows the same rule. A run snapshot is accepted only for matching sessionId + semanticRevision + runId.

Save acknowledgements include sessionId, captured documentRevision, and new storageRevision. An old acknowledgement must never mark a newer revision Saved. A background save for document A cannot update active document B's status. [Persistence](PERSISTENCE.md) owns queue ordering and conflicts.

## Transitions and effects

User intent -> validate current session -> pure command candidate -> synchronous atomic publication -> post-success effects. Publish document, history, indexes, selection cleanup, and revision counters together. Schedule save only afterward. Form drafts may be incomplete but cannot mutate canonical config. Apply is enabled only for a valid complete config; Cancel restores document values. An open invalid draft does not overwrite storage or become runnable.

Document switching requires resolving dirty persistence and dirty inspector drafts separately: apply/discard/cancel draft, then flush saved content or explicitly choose export/continue with an unsaved warning on failure. On switch success clear selection, overlays, history, notifications scoped to the prior session, run state, and caches. A failed load keeps the previous document active. Never clear the current document before the replacement passes validation.

Readiness computation carries semanticRevision and is pending until current diagnostics arrive. Run cannot start on stale diagnostics; compilation still independently revalidates. Small graph structural checks run synchronously at command commit; expensive UI diagnostics can batch once per frame.

## Selector and rendering rules

- Select node by ID and the specific needed config/position/status, selected-ID membership, or panel visibility. Avoid subscribing every node to the full document, nodes array, selection set, or run log.
- Memoize graph projection by entity identity and overlay changes. Stable `nodeTypes`, callbacks, and component definitions MUST not be recreated on each render. A single config edit should update that node and affected diagnostics, not all node bodies.
- Use equality-aware selectors for small tuple/object selections; do not mutate Sets/Maps in place. React hooks use public Zustand APIs only.
- Hover must not trigger domain validation/save/history. Pan/drag writes are frame-batched overlays. Events update runtime state in bounded batches without changing engine order.
- Clear bounded caches on session replacement. Do not retain prior workflow payloads through subscriptions or closures. Dispose effects on unmount and strict-mode reinitialization.

The [Zustand repository](https://github.com/pmndrs/zustand) documents selector-based subscriptions; the above ownership/revision rules are FlowCanvas decisions.

## Verification

Test atomic command failure, redo preservation for no-op, cross-document stale callbacks, old save acknowledgement after newer edit, worker event after semantic undo, presentation edit preserving results, overlay cancellation, invalid draft isolation, and subscription render counts. Use observable UI outcomes plus store/domain integration; do not assert incidental slice implementation. Timing/render budgets belong to [performance](PERFORMANCE_SPEC.md).
