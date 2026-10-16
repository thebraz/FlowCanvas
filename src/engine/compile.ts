import { failure, type Readiness, type Result } from '../contracts/errors';
import type { WorkflowDocument, WorkflowNode } from '../contracts/workflow';
import { validateDocument } from '../validation/codec';
import { buildIndexes, type GraphIndexes } from '../domain/graph/indexes';
import { readiness } from '../domain/graph/invariants';
import { reachable, topologicalOrder } from '../domain/graph/algorithms';
import { compareAscii } from '../domain/json/canonical';

export type ExecutableNode = Exclude<WorkflowNode, { readonly type: 'note' }>;
export interface ExecutionPlan {
  readonly document: WorkflowDocument;
  readonly indexes: GraphIndexes;
  readonly order: readonly string[];
  readonly roots: readonly string[];
  readonly reachable: ReadonlySet<string>;
  readonly diagnostics: Readiness;
}
export function compile(
  input: unknown,
  cancelled: () => boolean = () => false,
): Result<ExecutionPlan> {
  if (cancelled()) return failure('INVALID_TRANSITION', 'execution');
  const checked = validateDocument(input);
  if (!checked.ok) return checked;
  if (cancelled()) return failure('INVALID_TRANSITION', 'execution');
  const document = checked.value,
    indexes = buildIndexes(document);
  const diagnostics = readiness(document, indexes);
  const issue = diagnostics.issues.find((item) => item.severity === 'error');
  if (!diagnostics.ready)
    return failure('CONFIG_INVALID', 'config', {
      ...(issue?.nodeId ? { nodeId: issue.nodeId } : {}),
    });
  const sorted = topologicalOrder(indexes);
  if (!sorted.ok) return sorted;
  const roots = document.nodes
    .filter((node) => node.type === 'manualTrigger')
    .map((node) => node.id)
    .sort(compareAscii);
  if (cancelled()) return failure('INVALID_TRANSITION', 'execution');
  return {
    ok: true,
    value: {
      document,
      indexes,
      order: sorted.value,
      roots,
      reachable: reachable(indexes, roots),
      diagnostics,
    },
  };
}
