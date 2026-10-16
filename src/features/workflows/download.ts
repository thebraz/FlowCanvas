import { encodeDocument } from '../../validation/codec';
import { encodeReadableDocument } from '../../validation/readable-export';
import type { WorkflowDocument } from '../../contracts/workflow';
import type { Result } from '../../contracts/errors';
import { failure } from '../../contracts/errors';
export function downloadText(text: string, title: string): Result<true> {
  let url: string | null = null;
  try {
    url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = (title.replace(/[^\p{L}\p{N}_-]/gu, '_').slice(0, 80) || 'workflow') + '.json';
    link.click();
    return { ok: true, value: true };
  } catch {
    return failure('SERIALIZATION_INVALID', 'serialization');
  } finally {
    if (url) URL.revokeObjectURL(url);
  }
}
export function exportDocument(
  document: WorkflowDocument,
  format: 'canonical' | 'readable' = 'canonical',
): Result<true> {
  const encoded =
    format === 'readable' ? encodeReadableDocument(document) : encodeDocument(document);
  return encoded.ok ? downloadText(encoded.value, document.metadata.title) : encoded;
}
