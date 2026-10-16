import { z } from 'zod';
import { FIELDS, LIMITS, SCHEMA_VERSION } from '../contracts/limits';
import type { JsonObject, JsonValue } from '../contracts/workflow';
import { pathsOverlap, validKey, validScalarString } from '../domain/json/path';
import { inspectJson, PAYLOAD_BUDGET } from './json-safety';

export const idSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
const boundedText = (max: number, multiline: boolean) =>
  z.string().refine(
    (value) =>
      validScalarString(value) &&
      Array.from(value).length <= max &&
      Array.from(value).every((scalar) => {
        const cp = scalar.codePointAt(0) ?? 0;
        return !(cp <= 31 || (cp >= 127 && cp <= 159)) || (multiline && [9, 10, 13].includes(cp));
      }),
  );
export const nameSchema = boundedText(FIELDS.NAME, false).refine(
  (value) => value.length > 0 && value === value.trim(),
);
const timestampSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u)
  .refine((value) => {
    const time = Date.parse(value);
    return Number.isFinite(time) && new Date(time).toISOString() === value;
  });
const coordinate = z.number().finite().min(-FIELDS.COORDINATE).max(FIELDS.COORDINATE);
export const positionSchema = z.strictObject({ x: coordinate, y: coordinate });
export const viewportSchema = z.strictObject({
  x: coordinate,
  y: coordinate,
  zoom: z.number().finite().min(FIELDS.MIN_ZOOM).max(FIELDS.MAX_ZOOM),
});
export const pathSchema = z.array(z.string().refine(validKey)).min(1).max(LIMITS.MAX_PATH_SEGMENTS);
const jsonValueSchema = z.custom<JsonValue>((value) => inspectJson(value, PAYLOAD_BUDGET).ok);
const jsonObjectSchema = z.custom<JsonObject>(
  (value) =>
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    inspectJson(value, PAYLOAD_BUDGET).ok,
);
const primitive = z.union([z.null(), z.boolean(), z.number().finite(), z.string()]);
export const configSchemas = {
  manualTrigger: z.strictObject({ payload: jsonObjectSchema }),
  setField: z.strictObject({ path: pathSchema, value: jsonValueSchema }).nullable(),
  pickFields: z
    .strictObject({
      paths: z
        .array(pathSchema)
        .min(1)
        .max(LIMITS.MAX_PICK_PATHS)
        .refine((paths) => !pathsOverlap(paths)),
      missing: z.enum(['omit', 'error']),
    })
    .nullable(),
  condition: z
    .discriminatedUnion('operator', [
      z.strictObject({ path: pathSchema, operator: z.enum(['exists', 'notExists']) }),
      z.strictObject({ path: pathSchema, operator: z.enum(['eq', 'neq']), value: primitive }),
      z.strictObject({
        path: pathSchema,
        operator: z.enum(['gt', 'gte', 'lt', 'lte']),
        value: z.number().finite(),
      }),
      z.strictObject({ path: pathSchema, operator: z.literal('contains'), value: z.string() }),
    ])
    .nullable(),
  output: z.strictObject({ name: nameSchema }),
  note: z.strictObject({ text: boundedText(FIELDS.NOTE, true) }),
} as const;
const base = {
  id: idSchema,
  label: nameSchema,
  position: positionSchema,
  presentation: z
    .strictObject({ accent: z.enum(['neutral', 'blue', 'green', 'amber', 'red']).optional() })
    .optional(),
};
export const nodeSchema = z.discriminatedUnion('type', [
  z.strictObject({
    ...base,
    type: z.literal('manualTrigger'),
    config: configSchemas.manualTrigger,
  }),
  z.strictObject({ ...base, type: z.literal('setField'), config: configSchemas.setField }),
  z.strictObject({ ...base, type: z.literal('pickFields'), config: configSchemas.pickFields }),
  z.strictObject({ ...base, type: z.literal('condition'), config: configSchemas.condition }),
  z.strictObject({ ...base, type: z.literal('output'), config: configSchemas.output }),
  z.strictObject({ ...base, type: z.literal('note'), config: configSchemas.note }),
]);
export const edgeSchema = z.strictObject({
  id: idSchema,
  source: z.strictObject({ nodeId: idSchema, port: z.enum(['out', 'true', 'false']) }),
  target: z.strictObject({ nodeId: idSchema, port: z.literal('in') }),
});
export const documentSchema = z.strictObject({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id: idSchema,
  metadata: z
    .strictObject({
      title: nameSchema,
      description: boundedText(FIELDS.DESCRIPTION, true),
      createdAt: timestampSchema,
      updatedAt: timestampSchema,
    })
    .refine((metadata) => metadata.updatedAt >= metadata.createdAt),
  nodes: z.array(nodeSchema).max(LIMITS.MAX_NODES),
  edges: z.array(edgeSchema).max(LIMITS.MAX_EDGES),
  viewport: viewportSchema,
});
