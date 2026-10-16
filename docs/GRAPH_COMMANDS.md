# Graph commands and history

## Atomic command contract

```ts
type CommandResult =
  | { readonly ok: true; readonly changed: boolean }
  | { readonly ok: false; readonly error: AppError };
// Conceptual pure reducer: (trusted document, validated intent, injected IDs/time)
// -> candidate document and change classification, or error.
```

Commands accept IDs and typed values, not React Flow objects. The application serializes dispatch synchronously. A command MUST build/validate an isolated candidate, satisfy [graph invariants](GRAPH_SCHEMA.md) and [data budgets](DATA_CONTRACT.md), then publish document, indexes, revision changes, and history in one store update. Any failure leaves document, history, selection, revisions, and persistence queue unchanged. Async persistence occurs after publication and cannot roll back a successful edit silently.

`expectedSessionId` guards every editor intent; delayed events for another document are rejected. ID/time providers are injected; allocate all new IDs before candidate validation and never reuse an existing entity ID. A failed allocation/candidate may consume IDs but cannot expose a partial result. No-op commands produce no revision, timestamp, history, or save change.

## Required commands

| Command | Inputs / outcome | Reversibility and checks |
| --- | --- | --- |
| CreateNode | Catalog type, position, optional valid config; assign new ID and default label | Missing transform config becomes explicit null; inverse removes node |
| DeleteNode | Existing node ID | Remove node and all incident edges in one transaction; undo restores exact IDs |
| MoveNodes | Nonempty unique node IDs + absolute positions | One bulk transaction; bounds/grid policy applied before dispatch |
| ChangeNodeConfig | Node ID + complete typed config or permitted null | Exact union validation; preserve type/ports; reject wrong-type config |
| RenameNode / ChangePresentation | ID + bounded label/accent | Presentation-only; no semantic run invalidation |
| RenameWorkflow | Title/description | History content edit, not execution-semantic |
| CreateEdge | Typed endpoints; assign new edge ID | Commit-time connection validation; duplicate endpoints rejected |
| DeleteEdge | Existing edge ID | No automatic neighbor reconnection |
| ReconnectEdge | Existing edge ID + new endpoints | Logically exclude old edge, validate candidate; preserve edge ID |
| DuplicateNode | Existing node ID + default (32,32) offset | Copy node/config only, fresh ID, no incident edges |
| PasteSubgraph | Validated clipboard fragment + destination offset | Fresh IDs for every node and internal edge; atomic full validation |
| BulkDelete | Unique selected node/edge IDs | Delete union of explicit edges and incident edges once |
| AlignNodes | At least two existing nodes + left/right/top/bottom/center axis mode | Based on canonical node rectangles defined below; one MoveNodes transaction |
| Undo / Redo | Active session | Restore trusted historical content atomically; no new undo entry |

Missing/stale entity IDs reject the whole command; a command does not silently apply to a surviving subset. Disabling an impossible action in UI does not remove validation requirements. Clipboard operations and workflow duplication are separate: duplicate workflow preserves relative graph content but assigns a new workflow ID and all entity IDs, resets timestamps and history, and persists as a new record.

Align left/right/top/bottom fixes the chosen rectangle edge to the corresponding minimum/maximum edge of the selected group. Horizontal/vertical center alignment fixes centers to the selected group's bounding-box midpoint on that axis. Other coordinates remain unchanged. Group bounds are computed from canonical rectangles, not transient measurements; clamp only if it preserves alignment, otherwise reject. No implicit distribution or auto-layout is included.

## Copy/paste format and identity

Internal format: `{format:"flowcanvas-subgraph", version:1, nodes:[...], edges:[...]}` with strict keys and the same node/edge schemas. It is not a workflow document. Include only edges with both endpoints selected; edge-only copy is rejected with a message. No viewport, runtime values, storage metadata, or external links. Enforce clipboard bytes, graph, and configuration limits before copying and before pasting.

Order selected nodes by ID, build old-to-new ID maps, remap endpoints, and offset positions together. Paste centers the fragment bounds at the last canvas pointer location if available, otherwise visible canvas center; repeated paste offsets by (32,32) per paste in that session. Clamp the group as a unit within coordinate bounds or reject if it cannot fit. Assign fresh IDs once; undo/redo MUST reuse the original paste IDs. System clipboard access is optional: permission/API failure provides an explicit copy-text/paste-text dialog with the same validator. Do not read the clipboard without user action.

For any batch remapping, sort old node IDs, generate an equally sized set of unique fresh UUIDs excluding source/existing/new-document IDs, sort those fresh UUIDs, and pair by index. Allocate fresh edge IDs and remap endpoints independently. This preserves relative node-ID order inside the copied graph, which matters to deterministic scheduling. Whole-workflow duplication and import-as-new MUST use the same order-preserving node remap so the isomorphic workflow retains its relative execution/Output order; adding a pasted fragment to a different graph may legitimately change its position among existing nodes.

## Geometry and drag transactions

Canonical layout rectangles are 240 x 96 CSS pixels for executable nodes and 240 x 160 for Notes at zoom 1. Content is clipped/summarized inside these fixed rectangles; inspector holds full text. Align uses these dimensions and canonical positions, never transient DOM measurements. Alignment ties preserve node ID order; positions may change but IDs/topology do not.

Drag start captures original positions in ephemeral state. Pointer updates are frame-batched overlays. Drag stop emits one MoveNodes command for all moved nodes; zero net movement creates no history entry. Escape, lost/cancelled pointer capture, document switch, and failed final validation clear the overlay and restore canonical positions. Do not persist intermediate movement. Keyboard movement groups only one held-key gesture (keydown to keyup, or focus loss), not unrelated key presses.

## History semantics

History stores immutable before/after **editable content** snapshots: title, description, nodes, and edges. Workflow ID, createdAt, viewport, settings, selection, panels, runtime, save state, and diagnostic caches are excluded. Structural sharing is allowed; [history caps](DATA_CONTRACT.md) conservatively count canonical bytes of unique retained snapshots across both stacks, without assuming browser object-memory savings.

- Cap both stacks together by transaction count and snapshot bytes. Evict oldest whole transactions first. If a single new transaction exceeds the byte budget, accept the edit, clear history, and announce that undo is unavailable for this edit; never reject the user's valid edit solely due to history size.
- Successful changed commands push one undo entry and clear redo. Failed/no-op commands leave redo intact. Undo moves an entry to redo; redo moves it back. Do not append new entries during restoration.
- Undo restores exact content IDs/values/positions, not old revision counters or timestamps. Set updatedAt to `max(injectedNow, previousUpdatedAt)` and advance document revision. Semantic restoration invalidates runtime results exactly like a new semantic edit.
- Selection is not restored by undo; retain only IDs still present. Creation/paste selects resulting nodes as a post-success UI effect. Deletion focuses the nearest remaining graph-list item or canvas heading. Selection never pollutes history.
- Viewport changes persist separately after gesture settlement and do not enter history. Switching/closing/reloading documents clears history; no cross-document undo and no persisted history.

Full snapshots are chosen for correctness at bounded beta sizes. Patch-based history is not authorized absent measured evidence. [State](STATE_MANAGEMENT.md) defines revision ownership; [testing](TESTING_STRATEGY.md) requires long seeded sequences and command failure atomicity.
