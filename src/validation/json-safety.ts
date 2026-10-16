import { LIMITS } from '../contracts/limits';
import { failure, type Result } from '../contracts/errors';
import { canonicalJson, utf8Bytes } from '../domain/json/canonical';
import { validKey, validScalarString } from '../domain/json/path';
import type { JsonValue } from '../contracts/workflow';

export interface JsonBudget {
  readonly depth: number;
  readonly values: number;
  readonly bytes: number;
}
export const DOCUMENT_BUDGET: JsonBudget = {
  depth: LIMITS.MAX_DOCUMENT_DEPTH,
  values: LIMITS.MAX_DOCUMENT_VALUES,
  bytes: LIMITS.MAX_DOCUMENT_BYTES,
};
export const PAYLOAD_BUDGET: JsonBudget = {
  depth: LIMITS.MAX_VALUE_DEPTH,
  values: LIMITS.MAX_PAYLOAD_VALUES,
  bytes: LIMITS.MAX_PAYLOAD_BYTES,
};
interface Visit {
  readonly value: unknown;
  readonly depth: number;
  readonly exit?: boolean;
}

function resource(limitName: string, actualCount: number) {
  return failure('RESOURCE_LIMIT', 'resource', { limitName, actualCount });
}

function children(value: object): Result<readonly unknown[]> {
  const isArray = Array.isArray(value);
  if (
    !isArray &&
    Object.getPrototypeOf(value) !== Object.prototype &&
    Object.getPrototypeOf(value) !== null
  )
    return failure('IMPORT_INVALID', 'import');
  if (
    isArray &&
    (Object.getPrototypeOf(value) !== Array.prototype || value.length > LIMITS.MAX_ARRAY_LENGTH)
  ) {
    return value.length > LIMITS.MAX_ARRAY_LENGTH
      ? resource('MAX_ARRAY_LENGTH', value.length)
      : failure('IMPORT_INVALID', 'import');
  }
  const keys = Reflect.ownKeys(value);
  if (isArray && keys.length !== value.length + 1) return failure('IMPORT_INVALID', 'import');
  const values: unknown[] = [];
  for (const key of keys) {
    if (isArray && key === 'length') continue;
    if (typeof key !== 'string') return failure('IMPORT_INVALID', 'import');
    if (isArray) {
      const index = Number(key);
      if (!Number.isInteger(index) || index < 0 || index >= value.length || String(index) !== key)
        return failure('IMPORT_INVALID', 'import');
    } else if (!validKey(key)) return failure('IMPORT_INVALID', 'import');
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value'))
      return failure('IMPORT_INVALID', 'import');
    values.push(descriptor.value);
  }
  return { ok: true, value: values };
}

function inspect(value: unknown, budget: JsonBudget): Result<JsonValue> {
  const stack: Visit[] = [{ value, depth: 0 }];
  const ancestors = new Set<object>();
  let count = 0;
  while (stack.length > 0) {
    const item = stack.pop();
    if (!item) break;
    const current = item.value;
    if (item.exit && current !== null && typeof current === 'object') {
      ancestors.delete(current);
      continue;
    }
    if (++count > budget.values)
      return resource(
        budget === DOCUMENT_BUDGET ? 'MAX_DOCUMENT_VALUES' : 'MAX_PAYLOAD_VALUES',
        count,
      );
    if (item.depth > budget.depth)
      return resource(
        budget === DOCUMENT_BUDGET ? 'MAX_DOCUMENT_DEPTH' : 'MAX_VALUE_DEPTH',
        item.depth,
      );
    if (typeof current === 'string') {
      if (!validScalarString(current)) return failure('IMPORT_INVALID', 'import');
      const bytes = utf8Bytes(current);
      if (bytes > LIMITS.MAX_STRING_BYTES) return resource('MAX_STRING_BYTES', bytes);
    } else if (typeof current === 'number') {
      if (!Number.isFinite(current)) return failure('IMPORT_INVALID', 'import');
    } else if (current !== null && typeof current === 'object') {
      if (ancestors.has(current)) return failure('IMPORT_INVALID', 'import');
      const result = children(current);
      if (!result.ok) return result;
      ancestors.add(current);
      stack.push({ value: current, depth: item.depth, exit: true });
      // Bound queued work as well as visited values.
      if (count + stack.length + result.value.length > budget.values * 2 + budget.depth)
        return resource('MAX_DOCUMENT_VALUES', count + result.value.length);
      for (let i = result.value.length - 1; i >= 0; i--)
        stack.push({ value: result.value[i], depth: item.depth + 1 });
    } else if (current !== null && typeof current !== 'boolean')
      return failure('IMPORT_INVALID', 'import');
  }
  // The descriptor/type walk proves this assertion without accessing getters.
  const json = value as JsonValue;
  const bytes = utf8Bytes(canonicalJson(json));
  return bytes > budget.bytes
    ? resource(budget === DOCUMENT_BUDGET ? 'MAX_DOCUMENT_BYTES' : 'MAX_PAYLOAD_BYTES', bytes)
    : { ok: true, value: json };
}

export function inspectJson(
  value: unknown,
  budget: JsonBudget = DOCUMENT_BUDGET,
): Result<JsonValue> {
  try {
    return inspect(value, budget);
  } catch {
    return failure('IMPORT_INVALID', 'import');
  } // Revoked/exotic proxies fail closed; never log native errors.
}

export function freezeJson<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) freezeJson(child);
  }
  return value;
}
