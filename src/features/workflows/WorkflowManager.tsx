import { useEffect, useRef, useState } from 'react';
import { useStoreApi } from '../../state/context';
import { usePersistence } from './context';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/primitives';
import { errorMessage } from '../../ui/messages';
import type { WorkflowSummary } from '../../adapters/persistence/indexeddb';
import type { Result } from '../../contracts/errors';
import { failure } from '../../contracts/errors';
import { LIMITS } from '../../contracts/limits';
import { downloadText, exportDocument } from './download';
import { inspectJson } from '../../validation/json-safety';
import { canonicalJson, utf8Bytes } from '../../domain/json/canonical';
import { nameSchema } from '../../validation/schemas';
import { decodeDocument } from '../../validation/codec';
import { copyDocument } from '../../application/documents';
import { EXAMPLE_TITLES, exampleJson } from '../../application/examples';
export function WorkflowManager() {
  const coordinator = usePersistence(),
    store = useStoreApi(),
    alive = useRef(true),
    file = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<readonly WorkflowSummary[]>([]),
    [title, setTitle] = useState('Untitled workflow'),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [deleting, setDeleting] = useState<WorkflowSummary | null>(null),
    [importText, setImportText] = useState('');
  const refresh = async () => {
    const listed = await coordinator?.storage?.list();
    if (alive.current && listed) {
      if (listed.ok) {
        const known = store.getState().save.error;
        setItems(
          listed.value.map((item) =>
            known?.context.workflowId === item.id ? { ...item, error: known } : item,
          ),
        );
      } else setError(errorMessage(listed.error));
    }
  };
  useEffect(() => {
    alive.current = true;
    const storage = coordinator?.storage;
    if (storage)
      void storage.list().then((listed) => {
        if (!alive.current) return;
        if (listed.ok) {
          const known = store.getState().save.error;
          setItems(
            listed.value.map((item) =>
              known?.context.workflowId === item.id ? { ...item, error: known } : item,
            ),
          );
        } else setError(errorMessage(listed.error));
      });
    return () => {
      alive.current = false;
    };
  }, [coordinator, store]);
  const close = () => store.getState().showModal(null);
  const run = (operation: () => Promise<Result<unknown>>, exit = true) => {
    if (busy) return;
    setBusy(true);
    setError('');
    void operation()
      .then((result) => {
        if (!alive.current) return;
        if (!result.ok) setError(errorMessage(result.error));
        else if (exit) close();
        else void refresh();
      })
      .catch(() => {
        if (alive.current)
          setError('The operation failed. Your existing workflow has been preserved.');
      })
      .finally(() => {
        if (alive.current) setBusy(false);
      });
  };
  const importFile = async (selected: File): Promise<Result<true>> => {
    if (selected.size > LIMITS.MAX_DOCUMENT_BYTES)
      return failure('RESOURCE_LIMIT', 'resource', {
        limitName: 'MAX_DOCUMENT_BYTES',
        actualCount: selected.size,
      });
    const bytes = new Uint8Array(await selected.arrayBuffer());
    const decoded = decodeDocument(bytes);
    if (!decoded.ok) return decoded;
    let text: string;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      return failure('IMPORT_SYNTAX', 'import');
    }
    return coordinator ? coordinator.import(text) : failure('STORAGE_UNAVAILABLE', 'persistence');
  };
  return (
    <Modal title="Workflows" onClose={busy ? () => {} : close}>
      <p>Workflows stay in this browser. Export copies before deleting or clearing browser data.</p>
      <details>
        <summary>Executable examples</summary>
        <p>Open a new editable copy. The validation example intentionally needs configuration.</p>
        <div className="action-row">
          {EXAMPLE_TITLES.map((name) => (
            <Button
              key={name}
              disabled={busy}
              onClick={() =>
                run(
                  () =>
                    coordinator?.import(exampleJson(name)) ??
                    Promise.resolve(failure('STORAGE_UNAVAILABLE', 'persistence')),
                )
              }
            >
              {name}
            </Button>
          ))}
        </div>
      </details>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () =>
              coordinator?.create(title.trim()) ??
              Promise.resolve(failure('STORAGE_UNAVAILABLE', 'persistence')),
          );
        }}
      >
        <label>
          Workflow title
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <Button type="submit" disabled={busy || !nameSchema.safeParse(title.trim()).success}>
          Create workflow
        </Button>
      </form>
      <label>
        Import workflow JSON
        <input
          ref={file}
          type="file"
          accept=".json,application/json"
          disabled={busy}
          onChange={(event) => {
            const selected = event.target.files?.[0];
            if (selected) run(() => importFile(selected));
            event.target.value = '';
          }}
        />
      </label>
      <details>
        <summary>Import from JSON text</summary>
        <label>
          Workflow JSON
          <textarea rows={6} value={importText} onChange={(e) => setImportText(e.target.value)} />
        </label>
        <Button
          disabled={busy || !importText}
          onClick={() =>
            run(
              () =>
                coordinator?.import(importText) ??
                Promise.resolve(failure('STORAGE_UNAVAILABLE', 'persistence')),
            )
          }
        >
          Import as new
        </Button>
        <Button
          disabled={busy}
          onClick={() => {
            run(async () => {
              const decoded = decodeDocument(importText);
              if (!decoded.ok) return decoded;
              const copied = copyDocument(
                decoded.value,
                () => crypto.randomUUID(),
                () => new Date().toISOString(),
                ' imported',
              );
              if (!copied.ok) return copied;
              const flushed = await coordinator?.flush();
              if (
                flushed &&
                !flushed.ok &&
                !window.confirm(
                  'Changes could not be saved. Export first, or confirm discarding them to open this imported copy.',
                )
              )
                return flushed;
              store.getState().openDocument(copied.value, crypto.randomUUID(), null);
              coordinator?.memoryOnly();
              return { ok: true, value: true };
            });
          }}
        >
          Open validated text in memory only
        </Button>
      </details>
      {busy && <p role="status">Working…</p>}
      {error && <p role="alert">{error}</p>}
      {!items.length && (
        <p>
          No saved workflows. Create or import a workflow, or close this dialog to edit the unsaved
          sample.
        </p>
      )}
      <Button
        disabled={busy}
        onClick={() => {
          void refresh();
        }}
      >
        Refresh list
      </Button>
      <Button disabled={busy} onClick={() => store.getState().showModal('rename')}>
        Rename current workflow
      </Button>
      <ul className="workflow-list">
        {items.map((item) => (
          <li key={item.id}>
            <strong>{item.title}</strong>
            <span className="muted">{item.updatedAt}</span>
            {item.error ? (
              <>
                <p>{errorMessage(item.error)}</p>
                <Button
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const backup = await coordinator?.storage?.load(item.id, true);
                      if (!backup) return failure('STORAGE_UNAVAILABLE', 'persistence');
                      return backup.ok && coordinator
                        ? coordinator.duplicate(backup.value.document, true)
                        : backup;
                    })
                  }
                >
                  Recover verified backup as new
                </Button>
                <Button
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const raw = await coordinator?.storage?.raw(item.id);
                      if (!raw) return failure('STORAGE_UNAVAILABLE', 'persistence');
                      if (!raw.ok) return raw;
                      const safe = inspectJson(raw.value);
                      if (!safe.ok) return safe;
                      const text = canonicalJson(safe.value);
                      if (utf8Bytes(text) > LIMITS.MAX_DOCUMENT_BYTES)
                        return failure('RESOURCE_LIMIT', 'resource');
                      return downloadText(text, 'raw-workflow-record');
                    }, false)
                  }
                >
                  Export raw record (may contain private data)
                </Button>
              </>
            ) : (
              <div className="action-row">
                <Button
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const result =
                        (await coordinator?.open(item.id)) ??
                        failure('STORAGE_UNAVAILABLE', 'persistence');
                      if (!result.ok && alive.current)
                        setItems((current) =>
                          current.map((entry) =>
                            entry.id === item.id ? { ...entry, error: result.error } : entry,
                          ),
                        );
                      return result;
                    })
                  }
                >
                  Open {item.title}
                </Button>
                <Button
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const loaded = await coordinator?.storage?.load(item.id);
                      return loaded?.ok && coordinator
                        ? coordinator.duplicate(loaded.value.document)
                        : (loaded ?? failure('STORAGE_UNAVAILABLE', 'persistence'));
                    })
                  }
                >
                  Duplicate {item.title}
                </Button>
                {(['canonical', 'readable'] as const).map((format) => (
                  <Button
                    key={format}
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        const loaded = await coordinator?.storage?.load(item.id);
                        return loaded?.ok
                          ? exportDocument(loaded.value.document, format)
                          : (loaded ?? failure('STORAGE_UNAVAILABLE', 'persistence'));
                      }, false)
                    }
                  >
                    {format === 'canonical'
                      ? `Export ${item.title}`
                      : `Export readable JSON: ${item.title}`}
                  </Button>
                ))}
                <Button disabled={busy} onClick={() => setDeleting(item)}>
                  Delete {item.title}
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {deleting && (
        <Modal title={`Delete ${deleting.title}?`} initialCancel onClose={() => setDeleting(null)}>
          <p>Delete “{deleting.title}” and its backup? This cannot be undone. Export first.</p>
          <Button
            disabled={busy}
            onClick={() =>
              run(async () => {
                const result =
                  (await coordinator?.remove(deleting.id, deleting.storageRevision)) ??
                  failure('STORAGE_UNAVAILABLE', 'persistence');
                if (result.ok && alive.current) setDeleting(null);
                return result;
              }, false)
            }
          >
            Confirm deletion
          </Button>
        </Modal>
      )}
    </Modal>
  );
}
