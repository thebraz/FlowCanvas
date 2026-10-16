export interface WorkerTransport {
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent<unknown>) => void) | null;
  postMessage: (message: unknown) => void;
  terminate: () => void;
}
export function createExecutionWorker(): WorkerTransport {
  return new Worker(new URL('./entry.ts', import.meta.url), {
    type: 'module',
    name: 'flowcanvas-execution',
  });
}
