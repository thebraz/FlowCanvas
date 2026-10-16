import { failure, type Result } from '../../contracts/errors';
import type { FieldPath, JsonObject, JsonValue } from '../../contracts/workflow';
import { isJsonObject, validPath } from './path';

export function setPath(root: JsonObject, path: FieldPath, value: JsonValue): Result<JsonObject> {
  if (!validPath(path)) return failure('PATH_INVALID', 'config');
  const segment = path[0];
  if (segment === undefined) return failure('PATH_INVALID', 'config');
  if (path.length === 1) return { ok: true, value: { ...root, [segment]: value } };
  const existing = Object.hasOwn(root, segment) ? root[segment] : {};
  if (existing === undefined || !isJsonObject(existing)) return failure('PATH_TYPE', 'execution');
  const nested = setPath(existing, path.slice(1), value);
  return nested.ok ? { ok: true, value: { ...root, [segment]: nested.value } } : nested;
}
