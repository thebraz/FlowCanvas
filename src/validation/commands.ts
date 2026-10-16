import { z } from 'zod';
import { LIMITS } from '../contracts/limits';
import { failure, type Result } from '../contracts/errors';
import type { GraphCommand } from '../domain/graph/commands';
import { inspectJson } from './json-safety';
import {
  configSchemas,
  edgeSchema,
  idSchema,
  nameSchema,
  positionSchema,
  viewportSchema,
  documentSchema,
} from './schemas';
import { subgraphSchema, validateSubgraph } from './subgraph';
const commandSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('RenameWorkflow'),
    title: nameSchema,
    description: documentSchema.shape.metadata.shape.description,
  }),
  z.strictObject({
    type: z.literal('ChangePresentation'),
    nodeId: idSchema,
    presentation: z.strictObject({ accent: z.enum(['neutral', 'blue', 'green', 'amber', 'red']) }),
  }),
  z.strictObject({ type: z.literal('DuplicateNode'), nodeId: idSchema }),
  z.strictObject({
    type: z.literal('DuplicateSelection'),
    nodeIds: z.array(idSchema).min(1).max(LIMITS.MAX_NODES),
  }),
  z.strictObject({
    type: z.literal('PasteSubgraph'),
    fragment: subgraphSchema,
    offset: positionSchema,
  }),
  z.strictObject({
    type: z.literal('BulkDelete'),
    nodeIds: z.array(idSchema).max(LIMITS.MAX_NODES),
    edgeIds: z.array(idSchema).max(LIMITS.MAX_EDGES),
  }),
  z.strictObject({
    type: z.literal('AlignNodes'),
    nodeIds: z.array(idSchema).min(2).max(LIMITS.MAX_NODES),
    mode: z.enum(['left', 'right', 'top', 'bottom', 'horizontal', 'vertical']),
  }),
  z.strictObject({ type: z.literal('ClearWorkflow') }),
  z.strictObject({
    type: z.literal('CreateNode'),
    nodeType: z.enum(['manualTrigger', 'setField', 'pickFields', 'condition', 'output', 'note']),
    position: positionSchema,
    config: z
      .union([
        configSchemas.manualTrigger,
        configSchemas.setField,
        configSchemas.pickFields,
        configSchemas.condition,
        configSchemas.output,
        configSchemas.note,
      ])
      .optional(),
  }),
  z.strictObject({ type: z.literal('DeleteNode'), nodeId: idSchema }),
  z.strictObject({
    type: z.literal('MoveNodes'),
    moves: z
      .array(z.strictObject({ nodeId: idSchema, position: positionSchema }))
      .min(1)
      .max(LIMITS.MAX_NODES),
  }),
  z.strictObject({
    type: z.literal('ChangeNodeConfig'),
    nodeId: idSchema,
    config: z.union([
      configSchemas.manualTrigger,
      configSchemas.setField,
      configSchemas.pickFields,
      configSchemas.condition,
      configSchemas.output,
      configSchemas.note,
    ]),
  }),
  z.strictObject({ type: z.literal('RenameNode'), nodeId: idSchema, label: nameSchema }),
  z.strictObject({
    type: z.literal('CreateEdge'),
    source: edgeSchema.shape.source,
    target: edgeSchema.shape.target,
  }),
  z.strictObject({ type: z.literal('DeleteEdge'), edgeId: idSchema }),
  z.strictObject({
    type: z.literal('ReconnectEdge'),
    edgeId: idSchema,
    source: edgeSchema.shape.source,
    target: edgeSchema.shape.target,
  }),
  z.strictObject({ type: z.literal('SetViewport'), viewport: viewportSchema }),
]);
export function validateCommand(value: unknown): Result<GraphCommand> {
  const safe = inspectJson(value);
  if (!safe.ok) return safe;
  const parsed = commandSchema.safeParse(safe.value);
  if (!parsed.success) return failure('CONFIG_INVALID', 'config');
  if (parsed.data.type === 'CreateNode') {
    const { config, ...base } = parsed.data;
    return { ok: true, value: config === undefined ? base : { ...base, config } };
  }
  if (parsed.data.type === 'PasteSubgraph') {
    const fragment = validateSubgraph(parsed.data.fragment);
    return fragment.ok
      ? { ok: true, value: { ...parsed.data, fragment: fragment.value } }
      : fragment;
  }
  // Config type pairing is checked against its target node on the isolated candidate.
  if (parsed.data.type === 'ChangePresentation')
    return {
      ok: true,
      value: { ...parsed.data, presentation: { accent: parsed.data.presentation.accent } },
    };
  return { ok: true, value: parsed.data };
}
