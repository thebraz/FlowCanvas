import { useEffect, useState } from 'react';
import { useAppStore, useStoreApi } from '../../state/context';
import { usePersistence } from './context';
import { Button } from '../../ui/primitives';
import { errorMessage } from '../../ui/messages';
import { exportDocument } from './download';
export function SaveControls() {
  const coordinator = usePersistence(),
    store = useStoreApi(),
    save = useAppStore((s) => s.save),
    session = useAppStore((s) => s.session),
    message = useAppStore((s) => s.message),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const before = (event: BeforeUnloadEvent) => {
      const s = store.getState();
      if (s.draft.dirty || s.session.savedDocumentRevision !== s.session.documentRevision) {
        event.preventDefault();
      }
    };
    const visibility = () => {
      if (document.visibilityState === 'hidden') void coordinator?.flush();
    };
    window.addEventListener('beforeunload', before);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', visibility);
    return () => {
      window.removeEventListener('beforeunload', before);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', visibility);
    };
  }, [coordinator, store]);
  return (
    <div className="save-controls">
      <div className="sr-only" role="status">
        {save.status}. {message}
      </div>
      <span className="memory-badge" aria-label="Save status">
        {session.baseStorageRevision === null && save.status === 'dirty'
          ? 'Sample · not saved'
          : save.status === 'saved' || save.status === 'clean'
            ? 'Saved'
            : save.status === 'memory-only'
              ? 'Memory only · export to keep'
              : save.status === 'saving'
                ? 'Saving…'
                : save.status === 'conflict'
                  ? 'Conflict · not saved'
                  : save.status === 'error'
                    ? 'Error · not saved'
                    : 'Unsaved changes'}
      </span>
      <Button
        disabled={busy || !coordinator || save.status === 'memory-only'}
        title={
          !coordinator
            ? 'Browser storage is not connected'
            : save.status === 'memory-only'
              ? 'Memory-only mode: export a copy'
              : undefined
        }
        onClick={() => {
          if (!coordinator) return;
          setBusy(true);
          void coordinator
            .flush(true)
            .then((r) => {
              if (!r.ok) store.getState().announce(errorMessage(r.error));
            })
            .finally(() => setBusy(false));
        }}
      >
        Save
      </Button>
      {(['canonical', 'readable'] as const).map((format) => (
        <Button
          key={format}
          onClick={() =>
            store.getState().request(() => {
              const r = exportDocument(store.getState().session.document, format);
              if (!r.ok) store.getState().announce(errorMessage(r.error));
            })
          }
        >
          {format === 'canonical' ? 'Export JSON' : 'Export readable JSON'}
        </Button>
      ))}
    </div>
  );
}
export function SaveRecovery() {
  const coordinator = usePersistence(),
    store = useStoreApi(),
    save = useAppStore((s) => s.save);
  if (!save.error) return null;
  return (
    <div className="recovery-banner">
      <p role="alert">{errorMessage(save.error)}</p>
      <Button
        onClick={() => {
          if (coordinator) void coordinator.flush(true);
        }}
      >
        Retry save
      </Button>
      <Button
        onClick={() => {
          store.getState().request(() => {
            const result = exportDocument(store.getState().session.document);
            if (!result.ok) store.getState().announce(errorMessage(result.error));
          });
        }}
      >
        Export unsaved copy
      </Button>
      <Button
        onClick={() => {
          store.getState().request(() => {
            if (coordinator)
              void coordinator.duplicate(store.getState().session.document, true).then((r) => {
                if (!r.ok) store.getState().announce(errorMessage(r.error));
              });
          });
        }}
      >
        Save as new
      </Button>
      <Button
        onClick={() => {
          store.getState().request(() => {
            if (
              window.confirm('Discard unsaved changes and reload the verified saved version?') &&
              coordinator
            )
              void coordinator.open(store.getState().session.document.id, true).then((r) => {
                if (!r.ok) store.getState().announce(errorMessage(r.error));
              });
          });
        }}
      >
        Reload saved version
      </Button>
      <Button onClick={() => coordinator?.memoryOnly()}>Continue in memory only</Button>
    </div>
  );
}
