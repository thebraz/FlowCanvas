import { useAppStore } from '../../state/context';
import type { Diagnostic } from '../../contracts/errors';
const messages: Readonly<Record<Diagnostic['code'], string>> = {
  MISSING_TRIGGER: 'Add a Manual Trigger before running.',
  MISSING_OUTPUT: 'A reachable Output is required before running.',
  UNCONFIGURED: 'This node needs configuration.',
  UNREACHABLE: 'This node is not reachable from a trigger.',
  BRANCH_WITHOUT_OUTPUT: 'This branch has no Output.',
  GRAPH_INVALID: 'This change would create an invalid workflow.',
  GRAPH_CYCLE: 'Connections must not create a cycle.',
  INVALID_PORT: 'Use an output port and a compatible input port.',
  INPUT_OCCUPIED: 'Each input accepts only one connection.',
  DUPLICATE_EDGE: 'This connection already exists.',
  DANGLING_REFERENCE: 'A referenced node is unavailable.',
  CONFIG_INVALID: 'Review the highlighted configuration fields.',
  PATH_INVALID: 'Use a valid literal object path.',
  IMPORT_SYNTAX: 'This file is not a valid FlowCanvas workflow.',
  IMPORT_INVALID: 'This file is not a valid FlowCanvas workflow.',
  IMPORT_DUPLICATE_KEY: 'This file contains a duplicate object key.',
  SERIALIZATION_INVALID: 'This workflow could not be exported or saved safely.',
  STORAGE_UNAVAILABLE: 'Changes are not saved. Retry or export a copy.',
  STORAGE_QUOTA: 'Changes are not saved. Retry or export a copy.',
  SAVE_FAILED: 'Changes are not saved. Retry or export a copy.',
  PERSISTENCE_CONFLICT:
    'This workflow changed in another tab. Choose how to preserve your changes.',
  STORAGE_CORRUPT: 'This saved workflow needs recovery. The original has been preserved.',
  MIGRATION_FAILED: 'This saved workflow needs recovery. The original has been preserved.',
  MISSING_FIELD: 'A node could not process its input. Inspect its configuration and input.',
  PATH_TYPE: 'A node could not process its input. Inspect its configuration and input.',
  TYPE_MISMATCH: 'A node could not process its input. Inspect its configuration and input.',
  NODE_FAILED: 'A node could not process its input. Inspect its configuration and input.',
  WORKER_PROTOCOL: 'Execution stopped unexpectedly. Your workflow is unchanged.',
  WORKER_FAILED: 'Execution stopped unexpectedly. Your workflow is unchanged.',
  INVALID_TRANSITION: 'This action is no longer available.',
  STALE_SESSION: 'This action is no longer available.',
  OPERATION_TIMEOUT: 'Execution exceeded its time limit and was stopped.',
  RUN_TIMEOUT: 'Execution exceeded its time limit and was stopped.',
  RESOURCE_LIMIT: 'This operation exceeds the supported limit.',
  UNSUPPORTED_VERSION: 'This format version is not supported by this application.',
  INTERNAL_FAILURE: 'Something went wrong. Your existing workflow has been preserved.',
};
export function Diagnostics() {
  const diagnostics = useAppStore((state) => state.diagnostics);
  const select = useAppStore((state) => state.select);
  return (
    <section className="diagnostics" aria-labelledby="diagnostics-heading">
      <div>
        <h2 id="diagnostics-heading" tabIndex={-1}>
          Graph diagnostics
        </h2>
        <p>
          {diagnostics.total === 0
            ? 'No readiness issues. The workflow is structurally valid.'
            : `${diagnostics.total} readiness issues${diagnostics.truncated ? ' · details truncated' : ''}`}
        </p>
      </div>
      <ul>
        {diagnostics.issues.map((issue, i) => (
          <li key={`${issue.code}-${issue.nodeId ?? i}`}>
            {messages[issue.code]}{' '}
            {issue.nodeId && (
              <button
                type="button"
                onClick={() => {
                  select(issue.nodeId ?? null);
                }}
              >
                Inspect node
              </button>
            )}
          </li>
        ))}
      </ul>
      <p className="muted">
        Readiness validates graph configuration. Runtime results appear in Execution.
      </p>
    </section>
  );
}
