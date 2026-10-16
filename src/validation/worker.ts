import { z } from 'zod';
import { LIMITS } from '../contracts/limits';
import { failure, type Result } from '../contracts/errors';
import type { HostMessage, WorkerMessage } from '../contracts/worker';
import { inspectJson } from './json-safety';
import { idSchema, nameSchema } from './schemas';

const count = z.number().int().nonnegative().safe();
const identity = {
  protocolVersion: z.literal(1),
  sessionId: idSchema,
  semanticRevision: count,
  runId: idSchema,
  sequence: count.min(1),
};
const hostSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    ...identity,
    kind: z.literal('start'),
    requestId: idSchema,
    document: z.unknown(),
  }),
  z.strictObject({
    ...identity,
    kind: z.literal('begin'),
    requestId: idSchema,
    mode: z.enum(['run', 'pauseBeforeFirst']),
  }),
  ...(['pause', 'resume', 'step', 'cancel'] as const).map((kind) =>
    z.strictObject({ ...identity, kind: z.literal(kind), requestId: idSchema }),
  ),
]);

// The worker receives controls only; avoid constructing host-only response schemas in every new worker.
function createWorkerSchema() {
  const duration = z.number().finite().nonnegative();
  const payloadId = z.string().regex(/^p[1-9][0-9]{0,3}$/u);
  const codes = z.enum([
    'GRAPH_INVALID',
    'GRAPH_CYCLE',
    'INVALID_PORT',
    'INPUT_OCCUPIED',
    'DUPLICATE_EDGE',
    'DANGLING_REFERENCE',
    'CONFIG_INVALID',
    'PATH_INVALID',
    'IMPORT_SYNTAX',
    'IMPORT_INVALID',
    'IMPORT_DUPLICATE_KEY',
    'SERIALIZATION_INVALID',
    'STORAGE_UNAVAILABLE',
    'STORAGE_QUOTA',
    'SAVE_FAILED',
    'PERSISTENCE_CONFLICT',
    'STORAGE_CORRUPT',
    'MIGRATION_FAILED',
    'MISSING_FIELD',
    'PATH_TYPE',
    'TYPE_MISMATCH',
    'NODE_FAILED',
    'WORKER_PROTOCOL',
    'WORKER_FAILED',
    'INVALID_TRANSITION',
    'STALE_SESSION',
    'OPERATION_TIMEOUT',
    'RUN_TIMEOUT',
    'RESOURCE_LIMIT',
    'UNSUPPORTED_VERSION',
    'INTERNAL_FAILURE',
  ]);
  const status = z.enum([
    'idle',
    'validating',
    'ready',
    'running',
    'paused',
    'completed',
    'failed',
    'cancelled',
  ]);
  const errorSchema = z
    .strictObject({
      code: codes,
      category: z.enum([
        'graph',
        'config',
        'import',
        'serialization',
        'persistence',
        'execution',
        'timeout',
        'resource',
        'version',
        'internal',
      ]),
      severity: z.enum(['info', 'warning', 'error', 'fatal']),
      messageKey: codes,
      recoverable: z.boolean(),
      context: z.strictObject({
        workflowId: idSchema.optional(),
        nodeId: idSchema.optional(),
        edgeId: idSchema.optional(),
        runId: idSchema.optional(),
        revision: count.optional(),
        limitName: z
          .string()
          .refine((name) => Object.hasOwn(LIMITS, name))
          .optional(),
        actualCount: duration.optional(),
      }),
      issues: z
        .array(
          z.strictObject({
            location: z.array(z.string().max(128)).max(48),
            code: z.string().max(64),
          }),
        )
        .max(LIMITS.MAX_VALIDATION_ISSUES)
        .optional(),
    })
    .refine((error) => error.code === error.messageKey);
  const outputs = z.strictObject({
    out: payloadId.optional(),
    true: payloadId.optional(),
    false: payloadId.optional(),
  });
  const reason = z.enum(['unreachable', 'branch-not-selected', 'upstream-skipped', 'run-failed']);
  const record = z.strictObject({
    nodeId: idSchema,
    disposition: z.enum(['pending', 'running', 'completed', 'skipped', 'failed', 'cancelled']),
    inputPayloadId: payloadId.optional(),
    outputPayloadIds: outputs.optional(),
    skipReason: reason.optional(),
    errorCode: codes.optional(),
    durationMs: duration.optional(),
  });
  const runResultSchema = z.strictObject({
    runId: idSchema,
    sessionId: idSchema,
    semanticRevision: count,
    status: z.enum(['completed', 'failed', 'cancelled']),
    nodeRecords: z.array(record).max(LIMITS.MAX_NODES),
    outputs: z
      .array(
        z.strictObject({ nodeId: idSchema, name: nameSchema, payloadId, sequenceIndex: count }),
      )
      .max(LIMITS.MAX_NODES),
    partial: z.boolean(),
    error: errorSchema.optional(),
    timings: z.strictObject({
      compileMs: duration,
      activeMs: duration,
      pausedMs: duration,
      wallMs: duration,
    }),
    counts: z.strictObject({
      operations: count,
      completed: count,
      skipped: count,
      failed: count,
      cancelled: count,
      eventsEvicted: count,
    }),
  });
  return z.discriminatedUnion('kind', [
    z.strictObject({
      ...identity,
      kind: z.literal('ready'),
      order: z.array(idSchema).max(LIMITS.MAX_NODES),
      compileMs: duration,
    }),
    z.strictObject({ ...identity, kind: z.literal('state'), status }),
    z.strictObject({
      ...identity,
      kind: z.literal('control-ack'),
      requestId: idSchema,
      outcome: z.enum(['accepted', 'no-op', 'rejected']),
      code: z.literal('INVALID_TRANSITION').optional(),
    }),
    z.strictObject({
      ...identity,
      kind: z.literal('node-start'),
      nodeId: idSchema,
      inputPayloadId: payloadId.optional(),
    }),
    z.strictObject({
      ...identity,
      kind: z.literal('payload-record'),
      nodeId: idSchema,
      payloadId,
      value: z.unknown(),
    }),
    z.strictObject({
      ...identity,
      kind: z.literal('node-complete'),
      nodeId: idSchema,
      outputPayloadIds: outputs,
      durationMs: duration,
    }),
    z.strictObject({ ...identity, kind: z.literal('node-skip'), nodeId: idSchema, reason }),
    z.strictObject({
      ...identity,
      kind: z.literal('node-fail'),
      nodeId: idSchema,
      code: codes,
      durationMs: duration,
    }),
    z.strictObject({
      ...identity,
      kind: z.literal('warning'),
      code: z.literal('NO_OUTPUT_ACTIVATED'),
    }),
    z.strictObject({ ...identity, kind: z.literal('terminal'), result: runResultSchema }),
  ]);
}
let cachedWorkerSchema: ReturnType<typeof createWorkerSchema> | null = null;
function envelope(input: unknown, bytes: number): boolean {
  return inspectJson(input, {
    depth: LIMITS.MAX_DOCUMENT_DEPTH + 2,
    values: LIMITS.MAX_DOCUMENT_VALUES + 1000,
    bytes,
  }).ok;
}
export function parseHostMessage(input: unknown): Result<HostMessage> {
  if (!envelope(input, LIMITS.MAX_WORKER_START_BYTES))
    return failure('WORKER_PROTOCOL', 'execution');
  const parsed = hostSchema.safeParse(input);
  // Strict schemas + descriptor preflight prove the transport shape. The start document
  // is independently validated by compile before any node can execute.
  return parsed.success
    ? { ok: true, value: parsed.data as HostMessage }
    : failure('WORKER_PROTOCOL', 'execution');
}
export function parseWorkerMessage(input: unknown): Result<WorkerMessage> {
  if (!envelope(input, LIMITS.MAX_WORKER_RESULT_BYTES))
    return failure('WORKER_PROTOCOL', 'execution');
  const parsed = (cachedWorkerSchema ??= createWorkerSchema()).safeParse(input);
  // Payload roots/budgets and result consistency are checked atomically by RunLedger.
  return parsed.success
    ? { ok: true, value: parsed.data as WorkerMessage }
    : failure('WORKER_PROTOCOL', 'execution');
}
