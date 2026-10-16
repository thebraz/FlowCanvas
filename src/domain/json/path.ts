import { FORBIDDEN_KEYS, LIMITS } from '../../contracts/limits';
import type { FieldPath, JsonObject, JsonValue } from '../../contracts/workflow';
import { failure, type Result } from '../../contracts/errors';
export const MISSING = Symbol('missing');
export function isJsonObject(value: JsonValue): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function validScalarString(value: string): boolean {
  // In Unicode mode paired surrogates are one astral scalar; this range finds only lone units.
  return !/[\uD800-\uDFFF]/u.test(value);
}
export function validKey(key: string): boolean {
  return (
    key.length > 0 &&
    Array.from(key).length <= LIMITS.MAX_KEY_CODEPOINTS &&
    !FORBIDDEN_KEYS.has(key) &&
    validScalarString(key)
  );
}
export function validPath(path: FieldPath): boolean {
  return path.length >= 1 && path.length <= LIMITS.MAX_PATH_SEGMENTS && path.every(validKey);
}
export function pathsOverlap(paths: readonly FieldPath[]): boolean {
  return paths.some((path, i) =>
    paths
      .slice(i + 1)
      .some((other) =>
        path
          .slice(0, Math.min(path.length, other.length))
          .every((segment, j) => segment === other[j]),
      ),
  );
}
export function readPath(root: JsonObject, path: FieldPath): Result<JsonValue | typeof MISSING> {
  if (!validPath(path)) return failure('PATH_INVALID', 'config');
  let current: JsonValue = root;
  for (const segment of path) {
    if (!isJsonObject(current)) return failure('PATH_TYPE', 'execution');
    if (!Object.hasOwn(current, segment)) return { ok: true, value: MISSING };
    // Own data properties are guaranteed by the bounded JSON boundary.
    const next: JsonValue | undefined = current[segment];
    if (next === undefined) return failure('SERIALIZATION_INVALID', 'serialization');
    current = next;
  }
  return { ok: true, value: current };
}
