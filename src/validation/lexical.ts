import { LIMITS } from '../contracts/limits';
import { failure, type Result } from '../contracts/errors';
import { utf8Bytes } from '../domain/json/canonical';
import { validKey, validScalarString } from '../domain/json/path';

interface Frame {
  readonly kind: '{' | '[';
  readonly keys: Set<string>;
}
// Bounded lexical preflight. JSON.parse remains the sole grammar authority.
export function lexicalPreflight(text: string): Result<true> {
  const bytes = utf8Bytes(text);
  if (bytes > LIMITS.MAX_DOCUMENT_BYTES)
    return failure('RESOURCE_LIMIT', 'resource', {
      limitName: 'MAX_DOCUMENT_BYTES',
      actualCount: bytes,
    });
  const stack: Frame[] = [];
  let values = 0;
  let rootSeen = false;
  for (let i = 0; i < text.length; i++) {
    const token = text[i];
    if (token === undefined || /\s/u.test(token) || token === ',' || token === ':') continue;
    if (token === '}' || token === ']') {
      const frame = stack.pop();
      if (!frame || (token === '}' ? frame.kind !== '{' : frame.kind !== '['))
        return failure('IMPORT_SYNTAX', 'import');
      continue;
    }
    if (token === '"') {
      const start = i;
      let closed = false;
      for (i++; i < text.length; i++) {
        if (text[i] === '\\') {
          i++;
          continue;
        }
        if (text[i] === '"') {
          closed = true;
          break;
        }
      }
      if (!closed) return failure('IMPORT_SYNTAX', 'import');
      let decoded: unknown;
      try {
        decoded = JSON.parse(text.slice(start, i + 1));
      } catch {
        return failure('IMPORT_SYNTAX', 'import');
      }
      if (typeof decoded !== 'string' || !validScalarString(decoded))
        return failure('IMPORT_INVALID', 'import');
      if (utf8Bytes(decoded) > LIMITS.MAX_STRING_BYTES)
        return failure('RESOURCE_LIMIT', 'resource', {
          limitName: 'MAX_STRING_BYTES',
          actualCount: utf8Bytes(decoded),
        });
      let next = i + 1;
      while (next < text.length && /[\t\r\n ]/u.test(text[next] ?? '')) next++;
      const frame = stack.at(-1);
      if (text[next] === ':' && frame?.kind === '{') {
        if (!validKey(decoded)) return failure('IMPORT_INVALID', 'import');
        if (frame.keys.has(decoded)) return failure('IMPORT_DUPLICATE_KEY', 'import');
        frame.keys.add(decoded);
        continue;
      }
    } else if (token === '{' || token === '[') {
      stack.push({ kind: token, keys: new Set() });
    } else {
      while (i + 1 < text.length && !/[\s,}\]]/u.test(text[i + 1] ?? '')) i++;
    }
    const depth = stack.length - (token === '{' || token === '[' ? 1 : 0);
    if (depth > LIMITS.MAX_DOCUMENT_DEPTH)
      return failure('RESOURCE_LIMIT', 'resource', {
        limitName: 'MAX_DOCUMENT_DEPTH',
        actualCount: depth,
      });
    if (++values > LIMITS.MAX_DOCUMENT_VALUES)
      return failure('RESOURCE_LIMIT', 'resource', {
        limitName: 'MAX_DOCUMENT_VALUES',
        actualCount: values,
      });
    if (stack.length === 0 && rootSeen) return failure('IMPORT_SYNTAX', 'import');
    rootSeen = true;
  }
  return stack.length === 0 && rootSeen
    ? { ok: true, value: true }
    : failure('IMPORT_SYNTAX', 'import');
}
