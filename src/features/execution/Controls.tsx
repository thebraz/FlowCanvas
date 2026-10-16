import { useAppStore } from '../../state/context';
import { useExecution } from './context';
import { Button } from '../../ui/primitives';
import { isActiveRun } from '../../contracts/execution';
import { errorMessage } from '../../ui/messages';
export type ExecutionAction = 'validate' | 'run' | 'pause' | 'resume' | 'step' | 'stop' | 'reset';
export function ExecutionControls({
  actions = ['validate', 'pause', 'resume', 'step', 'stop', 'reset'],
}: {
  readonly actions?: readonly ExecutionAction[];
}) {
  const coordinator = useExecution();
  const status = useAppStore((s) => s.runtime.status),
    pausePending = useAppStore((s) => s.runtime.pausePending),
    cancelPending = useAppStore((s) => s.runtime.cancelPending),
    diagnostics = useAppStore((s) => s.diagnostics),
    draft = useAppStore((s) => s.draft.dirty),
    announce = useAppStore((s) => s.announce);
  const active = isActiveRun(status),
    runnable = diagnostics.ready;
  const available = {
    validate: !active,
    run: (!active || status === 'ready') && runnable && !draft,
    pause: status === 'running' && !pausePending && !cancelPending,
    resume: status === 'paused' && !cancelPending,
    step:
      (!active || status === 'paused' || status === 'ready') &&
      runnable &&
      !draft &&
      !cancelPending,
    stop: active && !cancelPending,
    reset: ['completed', 'failed', 'cancelled'].includes(status),
  };
  return (
    <div className="action-row execution-controls">
      {actions.map((action) => {
        const enabled = coordinator !== null && available[action];
        const reason = !coordinator
          ? 'Execution coordinator unavailable in this session.'
          : !runnable && (action === 'run' || action === 'step')
            ? 'Resolve graph readiness errors before execution.'
            : draft && (action === 'run' || action === 'step')
              ? 'Apply or cancel inspector edits before execution.'
              : `Available ${action === 'pause' ? 'while running' : action === 'resume' ? 'while paused' : action === 'reset' ? 'after a terminal run' : action === 'stop' ? 'during an active run' : 'in an idle, ready or terminal run'}.`;
        return (
          <Button
            key={action}
            disabled={!enabled}
            title={!enabled ? reason : undefined}
            onClick={() => {
              const result = coordinator?.[action]();
              if (result && !result.ok) announce(errorMessage(result.error));
            }}
          >
            {action[0]?.toUpperCase()}
            {action.slice(1)}
          </Button>
        );
      })}
      {pausePending && <span>Pause requested · waiting for operation boundary</span>}
      {cancelPending && <span>Stopping execution…</span>}
    </div>
  );
}
