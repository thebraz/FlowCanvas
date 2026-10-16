import type { AppError } from '../contracts/errors';
export function errorMessage(error: AppError): string {
  switch (error.code) {
    case 'GRAPH_CYCLE':
      return 'This connection would create a cycle.';
    case 'INPUT_OCCUPIED':
      return 'The target input already has a connection.';
    case 'DUPLICATE_EDGE':
      return 'This connection already exists.';
    case 'INVALID_PORT':
      return 'Choose an output port and a compatible input port.';
    case 'DANGLING_REFERENCE':
      return 'An item is no longer available. Select it again.';
    case 'PERSISTENCE_CONFLICT':
      return 'This workflow changed in another tab. Export your edits, reload the saved version, or save as new.';
    case 'STORAGE_CORRUPT':
      return 'This saved workflow needs recovery. The original has been preserved.';
    case 'STORAGE_UNAVAILABLE':
      return 'Browser storage is unavailable. Retry or choose memory-only editing and export.';
    case 'STORAGE_QUOTA':
      return 'Storage is full. Your edits are still in memory. Export a copy or free space explicitly.';
    case 'SAVE_FAILED':
      return 'Changes are not saved. Retry or export a copy.';
    case 'UNSUPPORTED_VERSION':
      return 'This format version is not supported.';
    case 'RESOURCE_LIMIT':
      return `This operation exceeds ${error.context.limitName ?? 'the supported limit'}.`;
    case 'CONFIG_INVALID':
    case 'PATH_INVALID':
      return 'Review the highlighted configuration fields.';
    case 'IMPORT_SYNTAX':
    case 'IMPORT_INVALID':
    case 'IMPORT_DUPLICATE_KEY':
      return 'This is not valid FlowCanvas JSON. Check the format, keys and graph structure.';
    case 'STALE_SESSION':
      return 'This action belongs to a previously opened workflow.';
    default:
      return 'The operation could not be completed. Your existing workflow has been preserved.';
  }
}
