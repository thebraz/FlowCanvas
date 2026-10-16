import { z } from 'zod';
import { failure, type AppError, type Result } from '../../contracts/errors';
import { LIMITS } from '../../contracts/limits';
import type { WorkflowDocument } from '../../contracts/workflow';
import { canonicalDocument, utf8Bytes } from '../../domain/json/canonical';
import { validateDocument } from '../../validation/codec';
import { inspectJson } from '../../validation/json-safety';
import { idSchema, documentSchema } from '../../validation/schemas';

export interface StoredEnvelope {
  readonly envelopeVersion: 1;
  readonly storageRevision: number;
  readonly canonicalBytes: number;
  readonly sha256: string;
  readonly document: WorkflowDocument;
}
export interface WorkflowSummary {
  readonly id: string;
  readonly title: string;
  readonly updatedAt: string;
  readonly error: AppError | null;
  readonly storageRevision: number | null;
}
export const settingsSchema = z.strictObject({
  theme: z.enum(['system', 'dark', 'light']),
  grid: z.boolean(),
  minimap: z.boolean(),
  leftWidth: z.number().int().min(240).max(420),
  rightWidth: z.number().int().min(240).max(420),
  // UI_UX_SPEC: old settings gain defaults; actual rendered height stays capped at 50vh.
  executionHeight: z.number().int().min(180).max(Number.MAX_SAFE_INTEGER).default(280),
  executionExpanded: z.boolean().default(false),
});
export type Preferences = z.infer<typeof settingsSchema>;
// PERSISTENCE envelope adds one container and four scalar fields around the document.
const ENVELOPE_BUDGET = {
  depth: LIMITS.MAX_DOCUMENT_DEPTH + 1,
  values: LIMITS.MAX_DOCUMENT_VALUES + 5,
  bytes: LIMITS.MAX_DOCUMENT_BYTES + 1024,
};
const envelopeSchema = z.strictObject({
  envelopeVersion: z.literal(1),
  storageRevision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  canonicalBytes: z.number().int().positive().max(LIMITS.MAX_DOCUMENT_BYTES),
  sha256: z.string().regex(/^[0-9a-f]{64}$/u),
  document: z.unknown(),
});
export function storageError(error: unknown): AppError {
  return failure(
    error instanceof DOMException && error.name === 'QuotaExceededError'
      ? 'STORAGE_QUOTA'
      : 'SAVE_FAILED',
    'persistence',
  ).error;
}
async function checksum(text: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('');
}
export async function makeEnvelope(
  input: unknown,
  revision: number,
): Promise<Result<StoredEnvelope>> {
  if (!Number.isSafeInteger(revision) || revision < 1) return failure('SAVE_FAILED', 'persistence');
  const checked = validateDocument(input);
  if (!checked.ok) return checked;
  const text = canonicalDocument(checked.value);
  try {
    return {
      ok: true,
      value: {
        envelopeVersion: 1,
        storageRevision: revision,
        canonicalBytes: utf8Bytes(text),
        sha256: await checksum(text),
        document: checked.value,
      },
    };
  } catch {
    return failure('STORAGE_UNAVAILABLE', 'persistence');
  }
}
export async function verifyEnvelope(input: unknown): Promise<Result<StoredEnvelope>> {
  const safe = inspectJson(input, ENVELOPE_BUDGET);
  if (!safe.ok) return failure('STORAGE_CORRUPT', 'persistence');
  const shape = envelopeSchema.safeParse(safe.value);
  if (!shape.success) return failure('STORAGE_CORRUPT', 'persistence');
  const checked = await makeEnvelope(shape.data.document, shape.data.storageRevision);
  if (
    !checked.ok ||
    checked.value.sha256 !== shape.data.sha256 ||
    checked.value.canonicalBytes !== shape.data.canonicalBytes
  )
    return failure('STORAGE_CORRUPT', 'persistence');
  return checked;
}
function sameVerifiedRecord(raw: unknown, verified: StoredEnvelope): boolean {
  const safe = inspectJson(raw, ENVELOPE_BUDGET);
  if (!safe.ok) return false;
  const envelope = envelopeSchema.safeParse(safe.value);
  if (!envelope.success) return false;
  const document = validateDocument(envelope.data.document);
  return (
    document.ok &&
    envelope.data.storageRevision === verified.storageRevision &&
    envelope.data.sha256 === verified.sha256 &&
    envelope.data.canonicalBytes === verified.canonicalBytes &&
    canonicalDocument(document.value) === canonicalDocument(verified.document)
  );
}
function ownData(value: unknown, key: string): unknown {
  if (value === null || typeof value !== 'object') return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  const data: unknown =
    descriptor && Object.hasOwn(descriptor, 'value') ? descriptor.value : undefined;
  return data;
}
function summary(raw: unknown, id: string): WorkflowSummary {
  const document = ownData(raw, 'document'),
    metadata = ownData(document, 'metadata'),
    safe = inspectJson(metadata);
  const checked = safe.ok ? documentSchema.shape.metadata.safeParse(safe.value) : null;
  const revision = z
    .number()
    .int()
    .positive()
    .max(Number.MAX_SAFE_INTEGER)
    .safeParse(ownData(raw, 'storageRevision'));
  return checked?.success && ownData(document, 'id') === id && ownData(raw, 'envelopeVersion') === 1
    ? {
        id,
        title: checked.data.title,
        updatedAt: checked.data.updatedAt,
        error: null,
        storageRevision: revision.success ? revision.data : null,
      }
    : {
        id,
        title: 'Saved workflow needs recovery',
        updatedAt: '',
        error: failure('STORAGE_CORRUPT', 'persistence', { workflowId: id }).error,
        storageRevision: null,
      };
}
export class WorkflowStorage {
  constructor(private readonly db: IDBDatabase) {}
  close() {
    this.db.close();
  }
  private read(store: string, key: IDBValidKey): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(store, 'readonly'),
        request = tx.objectStore(store).get(key);
      request.onsuccess = () => {
        const value: unknown = request.result;
        resolve(value);
      };
      request.onerror = () => reject(new Error('Storage read failed'));
    });
  }
  async raw(id: string): Promise<Result<unknown>> {
    try {
      return { ok: true, value: await this.read('documents', id) };
    } catch (e) {
      return { ok: false, error: storageError(e) };
    }
  }
  async load(id: string, backup = false): Promise<Result<StoredEnvelope>> {
    try {
      const raw = await this.read(backup ? 'backups' : 'documents', id);
      if (raw === undefined) return failure('STORAGE_CORRUPT', 'persistence');
      const verified = await verifyEnvelope(raw);
      if (verified.ok && verified.value.document.id !== id)
        return failure('STORAGE_CORRUPT', 'persistence');
      return verified.ok
        ? verified
        : {
            ...verified,
            error: { ...verified.error, context: { ...verified.error.context, workflowId: id } },
          };
    } catch (e) {
      return { ok: false, error: storageError(e) };
    }
  }
  async list(): Promise<Result<readonly WorkflowSummary[]>> {
    try {
      const records = await new Promise<readonly WorkflowSummary[]>((resolve, reject) => {
        const tx = this.db.transaction('documents', 'readonly'),
          request = tx.objectStore('documents').openCursor(),
          items: WorkflowSummary[] = [];
        let scanned = 0;
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) {
            resolve(items);
            return;
          }
          if (scanned++ >= LIMITS.MAX_STORED_DOCUMENTS) {
            reject(new Error('Document cap'));
            return;
          }
          const value: unknown = cursor.value;
          if (typeof cursor.key === 'string') items.push(summary(value, cursor.key));
          cursor.continue();
        };
        request.onerror = () => reject(new Error('Storage list failed'));
      });
      const items = [...records];
      return { ok: true, value: items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) };
    } catch (e) {
      return { ok: false, error: storageError(e) };
    }
  }
  async save(document: WorkflowDocument, expected: number | null): Promise<Result<StoredEnvelope>> {
    const prepared = await makeEnvelope(document, expected === null ? 1 : expected + 1);
    if (!prepared.ok) return prepared;
    let previous: StoredEnvelope | null = null;
    if (expected !== null) {
      const raw = await this.raw(document.id);
      if (!raw.ok) return raw;
      if (raw.value === undefined) return failure('PERSISTENCE_CONFLICT', 'persistence');
      const verified = await verifyEnvelope(raw.value);
      if (!verified.ok) return verified;
      if (verified.value.document.id !== document.id)
        return failure('STORAGE_CORRUPT', 'persistence', { workflowId: document.id });
      previous = verified.value;
      if (previous.storageRevision !== expected)
        return failure('PERSISTENCE_CONFLICT', 'persistence');
    }
    return new Promise((resolve) => {
      let error: AppError | null = null;
      try {
        const tx = this.db.transaction(['documents', 'backups'], 'readwrite'),
          documents = tx.objectStore('documents'),
          request = documents.get(document.id);
        const reject = (e: AppError) => {
          error = e;
          tx.abort();
        };
        const commit = () => {
          try {
            if (previous) tx.objectStore('backups').put(previous, document.id);
            documents.put(prepared.value, document.id);
          } catch (e) {
            reject(storageError(e));
          }
        };
        request.onsuccess = () => {
          const current: unknown = request.result;
          if (expected === null) {
            if (current !== undefined) {
              reject(failure('PERSISTENCE_CONFLICT', 'persistence').error);
              return;
            }
            const count = documents.count();
            count.onsuccess = () => {
              if (count.result >= LIMITS.MAX_STORED_DOCUMENTS)
                reject(
                  failure('RESOURCE_LIMIT', 'resource', {
                    limitName: 'MAX_STORED_DOCUMENTS',
                    actualCount: count.result + 1,
                  }).error,
                );
              else commit();
            };
          } else if (!previous || !sameVerifiedRecord(current, previous))
            reject(failure('PERSISTENCE_CONFLICT', 'persistence').error);
          else commit();
        };
        tx.oncomplete = () => resolve(prepared);
        tx.onabort = () => resolve({ ok: false, error: error ?? storageError(tx.error) });
        tx.onerror = (event) => {
          if (event.target instanceof IDBRequest && event.target.error)
            error ??= storageError(event.target.error);
        };
      } catch (e) {
        resolve({ ok: false, error: storageError(e) });
      }
    });
  }
  async remove(id: string, expected: number): Promise<Result<true>> {
    const verified = await this.load(id);
    if (!verified.ok) return verified;
    if (verified.value.storageRevision !== expected)
      return failure('PERSISTENCE_CONFLICT', 'persistence');
    return new Promise((resolve) => {
      let error: AppError | null = null;
      try {
        const tx = this.db.transaction(['documents', 'backups', 'settings'], 'readwrite'),
          documents = tx.objectStore('documents'),
          request = documents.get(id);
        request.onsuccess = () => {
          const value: unknown = request.result;
          if (!sameVerifiedRecord(value, verified.value)) {
            error = failure('PERSISTENCE_CONFLICT', 'persistence').error;
            tx.abort();
            return;
          }
          documents.delete(id);
          tx.objectStore('backups').delete(id);
          const last = tx.objectStore('settings').get('lastOpenedWorkflowId');
          last.onsuccess = () => {
            if (last.result === id) tx.objectStore('settings').delete('lastOpenedWorkflowId');
          };
        };
        tx.oncomplete = () => resolve({ ok: true, value: true });
        tx.onabort = () => resolve({ ok: false, error: error ?? storageError(tx.error) });
        tx.onerror = (event) => {
          if (event.target instanceof IDBRequest && event.target.error)
            error ??= storageError(event.target.error);
        };
      } catch (e) {
        resolve({ ok: false, error: storageError(e) });
      }
    });
  }
  async setting(key: 'preferences' | 'lastOpenedWorkflowId'): Promise<Result<unknown>> {
    try {
      const value = await this.read('settings', key);
      if (value === undefined) return { ok: true, value: null };
      const checked =
        key === 'preferences' ? settingsSchema.safeParse(value) : idSchema.safeParse(value);
      return checked.success
        ? { ok: true, value: checked.data }
        : failure('STORAGE_CORRUPT', 'persistence');
    } catch (e) {
      return { ok: false, error: storageError(e) };
    }
  }
  async putSetting(
    key: 'preferences' | 'lastOpenedWorkflowId',
    value: unknown,
  ): Promise<Result<true>> {
    const checked =
      key === 'preferences' ? settingsSchema.safeParse(value) : idSchema.safeParse(value);
    if (!checked.success) return failure('CONFIG_INVALID', 'config');
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction('settings', 'readwrite');
        tx.objectStore('settings').put(checked.data, key);
        tx.oncomplete = () => resolve({ ok: true, value: true });
        tx.onabort = () => resolve({ ok: false, error: storageError(tx.error) });
      } catch (e) {
        resolve({ ok: false, error: storageError(e) });
      }
    });
  }
}
export function openStorage(onClosed: () => void): Promise<Result<WorkflowStorage>> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: Result<WorkflowStorage>) => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };
    try {
      const request = indexedDB.open('flowcanvas', 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        const documents = db.createObjectStore('documents');
        documents.createIndex('updatedAt', 'document.metadata.updatedAt');
        db.createObjectStore('backups');
        db.createObjectStore('settings');
      };
      request.onsuccess = () => {
        const db = request.result;
        if (settled) {
          db.close();
          return;
        }
        db.onversionchange = () => {
          db.close();
          onClosed();
        };
        db.onclose = onClosed;
        finish({ ok: true, value: new WorkflowStorage(db) });
      };
      request.onerror = () => finish(failure('STORAGE_UNAVAILABLE', 'persistence'));
      request.onblocked = () => finish(failure('STORAGE_UNAVAILABLE', 'persistence'));
    } catch {
      finish(failure('STORAGE_UNAVAILABLE', 'persistence'));
    }
  });
}
