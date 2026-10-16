export type ErrorCode =
  | 'GRAPH_INVALID'
  | 'GRAPH_CYCLE'
  | 'INVALID_PORT'
  | 'INPUT_OCCUPIED'
  | 'DUPLICATE_EDGE'
  | 'DANGLING_REFERENCE'
  | 'CONFIG_INVALID'
  | 'PATH_INVALID'
  | 'IMPORT_SYNTAX'
  | 'IMPORT_INVALID'
  | 'IMPORT_DUPLICATE_KEY'
  | 'SERIALIZATION_INVALID'
  | 'STORAGE_UNAVAILABLE'
  | 'STORAGE_QUOTA'
  | 'SAVE_FAILED'
  | 'PERSISTENCE_CONFLICT'
  | 'STORAGE_CORRUPT'
  | 'MIGRATION_FAILED'
  | 'MISSING_FIELD'
  | 'PATH_TYPE'
  | 'TYPE_MISMATCH'
  | 'NODE_FAILED'
  | 'WORKER_PROTOCOL'
  | 'WORKER_FAILED'
  | 'INVALID_TRANSITION'
  | 'STALE_SESSION'
  | 'OPERATION_TIMEOUT'
  | 'RUN_TIMEOUT'
  | 'RESOURCE_LIMIT'
  | 'UNSUPPORTED_VERSION'
  | 'INTERNAL_FAILURE';
export type ErrorCategory =
  | 'graph'
  | 'config'
  | 'import'
  | 'serialization'
  | 'persistence'
  | 'execution'
  | 'timeout'
  | 'resource'
  | 'version'
  | 'internal';
export interface ValidationIssue {
  readonly location: readonly string[];
  readonly code: string;
}
export interface AppError {
  readonly code: ErrorCode;
  readonly category: ErrorCategory;
  readonly severity: 'info' | 'warning' | 'error' | 'fatal';
  readonly messageKey: ErrorCode;
  readonly recoverable: boolean;
  readonly context: {
    readonly workflowId?: string;
    readonly nodeId?: string;
    readonly edgeId?: string;
    readonly runId?: string;
    readonly revision?: number;
    readonly limitName?: string;
    readonly actualCount?: number;
  };
  readonly issues?: readonly ValidationIssue[];
}
export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false;
      readonly error: AppError;
      readonly diagnostics?: { readonly total: number; readonly truncated: boolean };
    };
export function failure(
  code: ErrorCode,
  category: ErrorCategory,
  context: AppError['context'] = {},
): { readonly ok: false; readonly error: AppError } {
  return {
    ok: false,
    error: {
      code,
      category,
      severity:
        code === 'INTERNAL_FAILURE'
          ? 'fatal'
          : ['STALE_SESSION', 'INVALID_TRANSITION', 'PERSISTENCE_CONFLICT'].includes(code)
            ? 'warning'
            : 'error',
      messageKey: code,
      recoverable: code !== 'INTERNAL_FAILURE',
      context,
    },
  };
}
export interface Diagnostic {
  readonly code:
    | ErrorCode
    | 'MISSING_TRIGGER'
    | 'MISSING_OUTPUT'
    | 'UNCONFIGURED'
    | 'UNREACHABLE'
    | 'BRANCH_WITHOUT_OUTPUT';
  readonly severity: 'error' | 'warning';
  readonly nodeId?: string;
  readonly edgeId?: string;
}
export interface Diagnostics {
  readonly issues: readonly Diagnostic[];
  readonly total: number;
  readonly truncated: boolean;
}
export interface Readiness extends Diagnostics {
  readonly ready: boolean;
}
