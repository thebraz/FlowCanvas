# Graph algorithms

The pure domain owns these algorithms. `V` counts nodes (including Notes where relevant), `E` counts edges, `P` is configuration/payload data size, and `k` is selected nodes. UUID comparisons use ASCII code-unit lexical order, not locale-dependent collation. Arrays must not determine behavior. Contract checks use [schema](GRAPH_SCHEMA.md).

## Indexes and determinism

Build `nodeById`, `edgeById`, outgoing edges by node/port, incoming edge by target port, endpoint-tuple membership, and executable indegrees in O(V + E) time/space. Sort adjacency by target node ID, source port, then edge ID when deterministic traversal is required; this optional preparation adds O(E log E) worst-case time and is not needed for reachability booleans or heap-based topological order. Cache indexes by topology revision; positions, labels, configuration, and viewport do not rebuild adjacency. Derived indexes are replaceable and never persistent authority.

| Operation | Algorithm | Time | Additional space |
| --- | --- | --- | --- |
| Full cycle detection | Iterative color DFS or unsorted Kahn count on executable nodes | O(V + E) | O(V + E) including adjacency |
| Candidate edge | Check indexed shape/capacity/duplicate/type, then reachability target -> source | O(1) basic; O(V + E) worst-case cycle check | O(V) visited/stack |
| Deterministic topological order | Kahn with min-heap of zero-indegree executable IDs | O(E + V log V) | O(V + E) |
| Reachability | Iterative DFS/BFS from sorted roots, visited set | O(Vr + Er) for visited region | O(Vr) |
| Dependencies | Follow incoming chain to root; or traverse reverse adjacency for generic diagnostics | O(Vr + Er) | O(Vr) |
| Full graph traversal | Iterative adjacency traversal with visited set | O(V + E) | O(V) excluding indexes |
| Selection extraction | Selected-ID set and incident outgoing edges; keep edges whose both endpoints are selected | O(k + incident E) | O(k + internal E + copied P) |
| Duplicate/paste remapping | Sorted old/fresh node-ID pairing, then internal-edge endpoints | O(k log k + internal E + copied P) | O(k + internal E + copied P) |
| Delete cleanup | Gather indexed incident edges and delete selected IDs in one candidate | O(k + incident E), plus immutable container-copy cost | O(k + incident E) delta |

Immutable arrays/maps may incur O(V + E) shallow copying on publication. Do not claim O(1) total commands merely because an index lookup is constant. Canonical serialization adds sorted-key/ID cost and O(P) traversal; it must satisfy measured targets.

## Connection validation procedure

```text
validateConnection(graph, candidate, replacedEdgeId?):
  view := graph with replacedEdgeId logically excluded
  check endpoint existence, direction, registry ports, non-Note, non-self
  check target capacity and duplicate endpoint tuple in view
  reject if candidate target can reach candidate source in view
  return success without mutating graph
```

Reconnect excludes only the old edge from capacity, duplicate, and cycle checks, preserving its ID on success. Failed reconnect retains the old edge. Hover feedback is advisory; commit MUST rerun validation against the current canonical document. Two same-frame intents are serialized by the application coordinator.

## Topological schedule and branching

Seed the min-heap with all zero-indegree executable nodes. Pop smallest ID; decrement targets; push each newly zero-indegree ID. If emitted count differs from executable-node count, fail with GRAPH_CYCLE. Include disconnected executable components in this static order; reachability later classifies them as skipped. Exclude Notes completely.

A plan stores static order, roots, adjacency, reachability, and validated configuration references. Runtime iterates this order once, awaiting each activated operation; inactive branches are skipped according to [execution](EXECUTION_MODEL.md). Do not schedule by canvas position, edge array order, object insertion order, animation duration, or promise-resolution races. Sorted plan order plus sequential operations makes output/event order reproducible.

## Mutation validation strategy

- Position, presentation, and label changes: validate changed fields and total document budget; topology cannot change and needs no cycle scan.
- Configuration change: validate that node's exact config and affected readiness diagnostics; configuration cannot change static ports in beta.
- Edge creation/reconnect: indexed local checks plus target-to-source traversal; update indexes atomically after success.
- Edge/node deletion: incident cleanup preserves DAG/capacity invariants; validate IDs and resulting budget. Do not reconnect neighbors automatically.
- Duplicate/paste/bulk changes: construct isolated candidate and full structural validation before publication. Copy only selected internal edges; no external links.
- Full validation is mandatory for import, storage hydration/migration, workflow switching, history restoration in development/tests, execution compilation, and export/save boundaries. Production undo/redo may use trusted snapshot provenance plus bounded shape/budget checks; any invalid snapshot is an internal failure and MUST not publish.

Payload-budget checks on all candidate documents remain mandatory even when graph validation is local. Expensive readiness diagnostics may be batched after commit but must carry the document revision and must not enable Run using stale results. See [state](STATE_MANAGEMENT.md).

## Required proof cases

Self-loop, long-chain back-edge, disconnected cycle, duplicate endpoint tuple, occupied input, invalid handle, trigger as target, Output as source, Note edge, reconnect that frees its old input, reconnect that creates a cycle, and shuffled arrays. Generated DAGs must preserve topological precedence; equivalent permutations must produce the same order. Delete/duplicate properties and history restoration belong to [testing](TESTING_STRATEGY.md).
