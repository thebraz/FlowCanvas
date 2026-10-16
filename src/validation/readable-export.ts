import { failure, type Result } from '../contracts/errors';
import { LIMITS } from '../contracts/limits';
import { utf8Bytes } from '../domain/json/canonical';
import { encodeDocument } from './codec';

const INDENT = '  '; // DATA_CONTRACT.md: separate readable export, never hash/persistence bytes.
export function encodeReadableDocument(input: unknown): Result<string> {
  const encoded = encodeDocument(input);
  if (!encoded.ok) return encoded;
  const compact = encoded.value;
  let bytes = utf8Bytes(compact),
    depth = 0,
    quoted = false,
    escaped = false,
    start = 0,
    text = '';
  for (let index = 0; index < compact.length; index++) {
    const char = compact[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    let before = '',
      after = '';
    if (char === '"') quoted = true;
    else if (char === '{' || char === '[') {
      depth++;
      if (compact[index + 1] !== '}' && compact[index + 1] !== ']')
        after = '\n' + INDENT.repeat(depth);
    } else if (char === '}' || char === ']') {
      depth--;
      if (compact[index - 1] !== '{' && compact[index - 1] !== '[')
        before = '\n' + INDENT.repeat(depth);
    } else if (char === ',') after = '\n' + INDENT.repeat(depth);
    else if (char === ':') after = ' ';
    if (!before && !after) continue;
    bytes += before.length + after.length; // Only ASCII whitespace is inserted.
    if (bytes > LIMITS.MAX_DOCUMENT_BYTES)
      return failure('RESOURCE_LIMIT', 'resource', {
        limitName: 'MAX_DOCUMENT_BYTES',
        actualCount: bytes,
      });
    text += compact.slice(start, index) + before + char + after;
    start = index + 1;
  }
  // Preserve token order directly; parse/stringify would reorder integer-like keys.
  return { ok: true, value: text + compact.slice(start) };
}
