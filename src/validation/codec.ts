import { LIMITS, SCHEMA_VERSION } from '../contracts/limits';
import { failure, type Result } from '../contracts/errors';
import type { JsonValue, WorkflowDocument } from '../contracts/workflow';
import { isJsonObject } from '../domain/json/path';
import { validateStructure } from '../domain/graph/invariants';
import { canonicalDocument, utf8Bytes } from '../domain/json/canonical';
import { freezeJson, inspectJson, PAYLOAD_BUDGET } from './json-safety';
import { lexicalPreflight } from './lexical';
import { documentSchema } from './schemas';

export function validateDocumentShape(input: unknown): Result<WorkflowDocument> {
  const json = inspectJson(input);
  if (!json.ok) return json;
  if (!isJsonObject(json.value)) return failure('IMPORT_INVALID', 'import');
  if (Object.hasOwn(json.value, 'schemaVersion') && json.value.schemaVersion !== SCHEMA_VERSION)
    return failure('UNSUPPORTED_VERSION', 'version');
  const rawNodes = json.value.nodes;
  if (Array.isArray(rawNodes) && rawNodes.length > LIMITS.MAX_NODES)
    return failure('RESOURCE_LIMIT', 'resource', {
      limitName: 'MAX_NODES',
      actualCount: rawNodes.length,
    });
  const rawEdges = json.value.edges;
  if (Array.isArray(rawEdges) && rawEdges.length > LIMITS.MAX_EDGES)
    return failure('RESOURCE_LIMIT', 'resource', {
      limitName: 'MAX_EDGES',
      actualCount: rawEdges.length,
    });
  if (Array.isArray(rawNodes))
    for (const raw of rawNodes as readonly JsonValue[]) {
      if (!isJsonObject(raw) || raw.config === undefined || !isJsonObject(raw.config)) continue;
      const payload =
        raw.type === 'manualTrigger'
          ? raw.config.payload
          : raw.type === 'setField'
            ? raw.config.value
            : undefined;
      if (payload !== undefined) {
        const budget = inspectJson(payload, PAYLOAD_BUDGET);
        if (!budget.ok) return budget;
      }
    }
  const parsed = documentSchema.safeParse(json.value);
  if (!parsed.success) {
    const error = failure('IMPORT_INVALID', 'import').error;
    return {
      ok: false,
      diagnostics: {
        total: parsed.error.issues.length,
        truncated: parsed.error.issues.length > LIMITS.MAX_VALIDATION_ISSUES,
      },
      error: {
        ...error,
        issues: parsed.error.issues
          .slice(0, LIMITS.MAX_VALIDATION_ISSUES)
          .map((issue) => ({ location: issue.path.map(String), code: issue.code })),
      },
    };
  }
  // Zod infers explicit undefined for optional fields; exact optional canonical types
  // require removing those only for trusted schemas (imports reject undefined above).
  const nodes = parsed.data.nodes.map((node) => {
    const { presentation, ...base } = node;
    return presentation === undefined
      ? base
      : {
          ...base,
          presentation: presentation.accent === undefined ? {} : { accent: presentation.accent },
        };
  });
  const document: WorkflowDocument = { ...parsed.data, nodes };
  const bytes = utf8Bytes(canonicalDocument(document));
  if (bytes > LIMITS.MAX_DOCUMENT_BYTES)
    return failure('RESOURCE_LIMIT', 'resource', {
      limitName: 'MAX_DOCUMENT_BYTES',
      actualCount: bytes,
    });
  return { ok: true, value: freezeJson(document) };
}
export function validateDocument(input: unknown): Result<WorkflowDocument> {
  const shaped = validateDocumentShape(input);
  if (!shaped.ok) return shaped;
  const document = shaped.value;
  const structural = validateStructure(document);
  const first = structural.issues[0];
  if (first)
    return {
      ok: false,
      diagnostics: { total: structural.total, truncated: structural.truncated },
      error: {
        ...failure(first.code, 'graph', {
          ...(first.nodeId === undefined ? {} : { nodeId: first.nodeId }),
          ...(first.edgeId === undefined ? {} : { edgeId: first.edgeId }),
        }).error,
        issues: structural.issues.map((issue) => ({ location: [], code: issue.code })),
      },
    };
  return { ok: true, value: document };
}
export function decodeDocument(input: unknown): Result<WorkflowDocument> {
  let text: string;
  if (typeof input === 'string') {
    const bytes = utf8Bytes(input);
    if (bytes > LIMITS.MAX_DOCUMENT_BYTES)
      return failure('RESOURCE_LIMIT', 'resource', {
        limitName: 'MAX_DOCUMENT_BYTES',
        actualCount: bytes,
      });
    text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  } else if (input instanceof Uint8Array) {
    if (input.byteLength > LIMITS.MAX_DOCUMENT_BYTES)
      return failure('RESOURCE_LIMIT', 'resource', {
        limitName: 'MAX_DOCUMENT_BYTES',
        actualCount: input.byteLength,
      });
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(input);
    } catch {
      return failure('IMPORT_SYNTAX', 'import');
    }
  } else return failure('IMPORT_INVALID', 'import');
  const preflight = lexicalPreflight(text);
  if (!preflight.ok) return preflight;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return failure('IMPORT_SYNTAX', 'import');
  }
  return validateDocument(parsed);
}
export function encodeDocument(input: unknown): Result<string> {
  const checked = validateDocument(input);
  if (!checked.ok)
    return {
      ...checked,
      error: {
        ...checked.error,
        code: 'SERIALIZATION_INVALID',
        category: 'serialization',
        messageKey: 'SERIALIZATION_INVALID',
      },
    };
  return { ok: true, value: canonicalDocument(checked.value) };
}
