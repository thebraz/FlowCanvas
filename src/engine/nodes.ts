import { failure, type Result } from '../contracts/errors';
import type { ConditionConfig, JsonObject, SourcePort } from '../contracts/workflow';
import { compareCodePoints } from '../domain/json/canonical';
import { isJsonObject, MISSING, readPath } from '../domain/json/path';
import { setPath } from '../domain/json/transform';
import type { ExecutableNode } from './compile';
import type { RunIdentity } from '../contracts/session';

export interface HandlerResult {
  readonly emitted: Readonly<Partial<Record<SourcePort, JsonObject>>>;
  readonly final?: JsonObject;
}
export interface HandlerContext {
  readonly identity: RunIdentity;
  readonly cancelled: () => boolean;
}
export type NodeHandler = (
  node: ExecutableNode,
  input: JsonObject | undefined,
  context: HandlerContext,
) => Result<HandlerResult> | Promise<Result<HandlerResult>>;

export function evaluateCondition(input: JsonObject, config: ConditionConfig): Result<boolean> {
  const found = readPath(input, config.path);
  if (!found.ok) return found;
  const value = found.value;
  if (config.operator === 'exists') return { ok: true, value: value !== MISSING };
  if (config.operator === 'notExists') return { ok: true, value: value === MISSING };
  if (value === MISSING) return failure('MISSING_FIELD', 'execution');
  if (config.operator === 'eq' || config.operator === 'neq') {
    if (value !== null && typeof value === 'object') return failure('TYPE_MISMATCH', 'execution');
    return {
      ok: true,
      value: config.operator === 'eq' ? value === config.value : value !== config.value,
    };
  }
  if (config.operator === 'contains')
    return typeof value === 'string'
      ? { ok: true, value: value.includes(config.value) }
      : failure('TYPE_MISMATCH', 'execution');
  if (typeof value !== 'number' || !Number.isFinite(value))
    return failure('TYPE_MISMATCH', 'execution');
  switch (config.operator) {
    case 'gt':
      return { ok: true, value: value > config.value };
    case 'gte':
      return { ok: true, value: value >= config.value };
    case 'lt':
      return { ok: true, value: value < config.value };
    case 'lte':
      return { ok: true, value: value <= config.value };
  }
}
export const executeNode: NodeHandler = (node, input, context) => {
  if (context.cancelled()) return failure('INVALID_TRANSITION', 'execution');
  if (node.config === null) return failure('CONFIG_INVALID', 'config');
  if (node.type === 'manualTrigger')
    return { ok: true, value: { emitted: { out: node.config.payload } } };
  if (input === undefined || !isJsonObject(input)) return failure('NODE_FAILED', 'execution');
  switch (node.type) {
    case 'setField': {
      const transformed = setPath(input, node.config.path, node.config.value);
      return transformed.ok
        ? { ok: true, value: { emitted: { out: transformed.value } } }
        : transformed;
    }
    case 'pickFields': {
      let output: JsonObject = {};
      const paths = [...node.config.paths].sort((a, b) => {
        for (let i = 0; i < Math.min(a.length, b.length); i++) {
          const difference = compareCodePoints(a[i] ?? '', b[i] ?? '');
          if (difference) return difference;
        }
        return a.length - b.length;
      });
      for (const path of paths) {
        const found = readPath(input, path);
        if (!found.ok) return found;
        if (found.value === MISSING) {
          if (node.config.missing === 'error') return failure('MISSING_FIELD', 'execution');
          continue;
        }
        const written = setPath(output, path, found.value);
        if (!written.ok) return written;
        output = written.value;
      }
      return { ok: true, value: { emitted: { out: output } } };
    }
    case 'condition': {
      const tested = evaluateCondition(input, node.config);
      return tested.ok
        ? { ok: true, value: { emitted: tested.value ? { true: input } : { false: input } } }
        : tested;
    }
    case 'output':
      return { ok: true, value: { emitted: {}, final: input } };
  }
};
