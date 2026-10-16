import { z } from 'zod';
import type { Result } from '../contracts/errors';
import { failure } from '../contracts/errors';
import { LIMITS } from '../contracts/limits';
import type { Subgraph } from '../domain/graph/subgraph';
import { lexicalPreflight } from './lexical';
import { inspectJson } from './json-safety';
import { edgeSchema, nodeSchema } from './schemas';
import { validateDocument } from './codec';
import { utf8Bytes } from '../domain/json/canonical';
export const subgraphSchema = z.strictObject({
  format: z.literal('flowcanvas-subgraph'),
  version: z.literal(1),
  nodes: z.array(nodeSchema).min(1).max(LIMITS.MAX_NODES),
  edges: z.array(edgeSchema).max(LIMITS.MAX_EDGES),
});
export function parseSafeJson(text: string, max = LIMITS.MAX_CLIPBOARD_BYTES): Result<unknown> {
  if (utf8Bytes(text) > max)
    return failure('RESOURCE_LIMIT', 'resource', {
      limitName: max === LIMITS.MAX_CLIPBOARD_BYTES ? 'MAX_CLIPBOARD_BYTES' : 'MAX_PAYLOAD_BYTES',
      actualCount: utf8Bytes(text),
    });
  const lexical = lexicalPreflight(text);
  if (!lexical.ok) return lexical;
  try {
    const value: unknown = JSON.parse(text);
    const safe = inspectJson(value);
    return safe.ok ? { ok: true, value } : safe;
  } catch {
    return failure('IMPORT_SYNTAX', 'import');
  }
}
export function validateSubgraph(input: unknown): Result<Subgraph> {
  const safe = inspectJson(input);
  if (!safe.ok) return safe;
  const shape = subgraphSchema.safeParse(safe.value);
  if (!shape.success) return failure('IMPORT_INVALID', 'import');
  const used = new Set([
    ...shape.data.nodes.map((n) => n.id),
    ...shape.data.edges.map((e) => e.id),
  ]);
  let sequence = 0,
    documentId = '';
  do {
    documentId = `ffffffff-ffff-4fff-8fff-${(sequence++).toString(16).padStart(12, '0')}`;
  } while (used.has(documentId));
  const checked = validateDocument({
    schemaVersion: 1,
    id: documentId,
    metadata: {
      title: 'Clipboard',
      description: '',
      createdAt: '2026-10-15T00:00:00.000Z',
      updatedAt: '2026-10-15T00:00:00.000Z',
    },
    nodes: shape.data.nodes,
    edges: shape.data.edges,
    viewport: { x: 0, y: 0, zoom: 1 },
  });
  if (!checked.ok) return checked;
  const fragment: Subgraph = {
    format: 'flowcanvas-subgraph',
    version: 1,
    nodes: checked.value.nodes,
    edges: checked.value.edges,
  };
  if (utf8Bytes(JSON.stringify(fragment)) > LIMITS.MAX_CLIPBOARD_BYTES)
    return failure('RESOURCE_LIMIT', 'resource', { limitName: 'MAX_CLIPBOARD_BYTES' });
  return { ok: true, value: fragment };
}
export function decodeSubgraph(text: string): Result<Subgraph> {
  const parsed = parseSafeJson(text);
  return parsed.ok ? validateSubgraph(parsed.value) : parsed;
}
