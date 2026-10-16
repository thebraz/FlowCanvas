import { createRoot } from 'react-dom/client';
import '@xyflow/react/dist/style.css';
import '../../src/ui/styles.css';
import { App } from '../../src/app/App';
import { createAppStore } from '../../src/state/store';
import { StoreProvider } from '../../src/state/context';
import { RunCoordinator } from '../../src/application/execution';
import { ExecutionProvider } from '../../src/features/execution/context';
import { validateDocument, validateDocumentShape } from '../../src/validation/codec';
import { representativeGraph } from '../fixtures/graphs';
import { canonicalDocument } from '../../src/domain/json/canonical';
import { compile } from '../../src/engine/compile';
import { createExecutionWorker, type WorkerTransport } from '../../src/adapters/worker/factory';
import type { RunResult } from '../../src/contracts/execution';
import { LIMITS } from '../../src/contracts/limits';
type FixtureMode = 'production' | 'hang' | 'blocked' | 'crash' | 'delay';
const store = createAppStore(representativeGraph(20), crypto.randomUUID(), {
  id: () => crypto.randomUUID(),
  now: () => new Date().toISOString(),
  validate: validateDocument,
  validateShape: validateDocumentShape,
});
store.setState({ bootReady: true });
let lastFirstMessageMs = 0;
let mode: FixtureMode = 'production',
  workersCreated = 0,
  workersTerminated = 0,
  receiveMs = 0;
const worker = (): WorkerTransport => {
  const workerCreatedAt = performance.now();
  let firstMessage = true;
  workersCreated++;
  const actual =
    mode === 'production'
      ? createExecutionWorker()
      : mode === 'hang'
        ? new Worker(new URL('../workers/hang.ts', import.meta.url), { type: 'module' })
        : mode === 'blocked'
          ? new Worker(new URL('../workers/blocked.ts', import.meta.url), { type: 'module' })
          : mode === 'delay'
            ? new Worker(new URL('../workers/delay.ts', import.meta.url), { type: 'module' })
            : new Worker(new URL('../workers/crash.ts', import.meta.url), { type: 'module' });
  let terminated = false;
  const transport: WorkerTransport = {
    onmessage: null,
    onerror: null,
    onmessageerror: null,
    postMessage: (message) => actual.postMessage(message),
    terminate: () => {
      if (!terminated) {
        terminated = true;
        workersTerminated++;
        actual.onmessage = null;
        actual.onerror = null;
        actual.onmessageerror = null;
        actual.terminate();
      }
    },
  };
  actual.onmessage = (event: MessageEvent<unknown>) => {
    if (firstMessage) {
      firstMessage = false;
      lastFirstMessageMs = performance.now() - workerCreatedAt;
    }
    const started = performance.now();
    transport.onmessage?.(event);
    receiveMs += performance.now() - started;
  };
  actual.onerror = (event: ErrorEvent) => transport.onerror?.(event);
  actual.onmessageerror = (event: MessageEvent<unknown>) => transport.onmessageerror?.(event);
  return transport;
};
const coordinator = new RunCoordinator(store, {
  id: () => crypto.randomUUID(),
  now: () => performance.now(),
  worker,
});
function waitTerminal(): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const finish = () => {
      const result = store.getState().runtime.result;
      if (result) {
        clearTimeout(timer);
        off();
        resolve(result);
      }
    };
    const off = store.subscribe(finish),
      timer = setTimeout(() => {
        off();
        reject(new Error('Runtime harness deadline'));
      }, 35000);
    finish();
  });
}
const paint = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
const api = {
  prepareMemory: async (count: 20 | 100 | 300) => {
    mode = 'production';
    const graph = representativeGraph(count);
    store.getState().openDocument(graph, crypto.randomUUID(), null);
    const node = graph.nodes[0];
    if (!node) throw new Error('Memory fixture missing node');
    for (let index = 0; index < 100; index++) {
      const state = store.getState();
      const changed = state.dispatch(state.session.sessionId, {
        type: 'MoveNodes',
        moves: [{ nodeId: node.id, position: { x: index + 1, y: node.position.y } }],
      });
      if (!changed.ok) throw new Error('Memory fixture command failed');
    }
    for (let index = 0; index < 10; index++) {
      coordinator.run();
      if ((await waitTerminal()).status !== 'completed')
        throw new Error('Memory fixture run failed');
    }
    await paint();
    return {
      commands: 100,
      runs: 10,
      history: store.getState().history.undo.length,
      workersCreated,
      workersTerminated,
    };
  },
  replace: (count: 20 | 100 | 300) => {
    mode = 'production';
    const graph = representativeGraph(count);
    const result = store.getState().openDocument(graph, crypto.randomUUID(), null);
    if (!result.ok) throw new Error('Fixture failed');
    return canonicalDocument(graph);
  },
  measure: async (count: 20 | 100 | 300) => {
    mode = 'production';
    const graph = representativeGraph(count);
    store.getState().openDocument(graph, crypto.randomUUID(), null);
    const compileSamples: number[] = [],
      startupSamples: number[] = [],
      runs: number[] = [],
      overhead: number[] = [],
      compileWorker: number[] = [],
      render: number[] = [];
    for (let i = 0; i < 35; i++) {
      let started = performance.now();
      const compiled = compile(graph);
      const duration = performance.now() - started;
      if (!compiled.ok) throw new Error('Compile failed');
      coordinator.reset();
      receiveMs = 0;
      started = performance.now();
      coordinator.run();
      const result = await waitTerminal();
      const wall = performance.now() - started;
      if (result.status !== 'completed')
        throw new Error(`Execution ${result.error?.code ?? result.status}`);
      const renderStart = performance.now();
      await paint();
      const renderMs = performance.now() - renderStart;
      if (i >= 5) {
        compileSamples.push(duration);
        runs.push(wall);
        overhead.push(receiveMs);
        compileWorker.push(result.timings.compileMs);
        startupSamples.push(Math.max(0, lastFirstMessageMs - result.timings.compileMs));
        render.push(renderMs);
      }
    }
    return {
      canonical: canonicalDocument(graph),
      compileSamples,
      runs,
      overhead,
      compileWorker,
      startupSamples,
      render,
      workersCreated,
      workersTerminated,
    };
  },
  startFixture: (selected: FixtureMode) => {
    coordinator.reset();
    store.getState().openDocument(representativeGraph(20), crypto.randomUUID(), null);
    mode = selected;
    coordinator.run();
  },
  stop: async () => {
    const started = performance.now();
    coordinator.stop();
    const result = await waitTerminal();
    return {
      elapsedMs: performance.now() - started,
      status: result.status,
      workersCreated,
      workersTerminated,
    };
  },
  floodControls: () => {
    for (let index = 0; index < 40; index++) coordinator.pause();
  },
  terminal: waitTerminal,
  summary: () => ({
    status: store.getState().runtime.status,
    operations: [...store.getState().runtime.records.values()].filter(
      (r) => r.disposition === 'running' || r.disposition === 'completed',
    ).length,
    payloads: store.getState().runtime.payloads.size,
    events: store.getState().runtime.events.length,
    workersCreated,
    workersTerminated,
    error: store.getState().runtime.error?.code ?? null,
  }),
  reset: () => coordinator.reset(),
  cycles: async (count: number) => {
    for (let i = 0; i < count; i++) {
      mode = 'production';
      store.getState().openDocument(representativeGraph(20), crypto.randomUUID(), null);
      coordinator.run();
      if ((await waitTerminal()).status !== 'completed') throw new Error('Cycle failed');
      coordinator.reset();
    }
    await paint();
    return api.summary();
  },
  large: async () => {
    mode = 'production';
    const graph = representativeGraph(20);
    const payload = {
      a: 'x'.repeat(LIMITS.MAX_STRING_BYTES - 128),
      b: 'x'.repeat(LIMITS.MAX_STRING_BYTES - 128),
      c: 'x'.repeat(LIMITS.MAX_STRING_BYTES - 128),
      customer: { tier: 'gold' },
      reviewed: false,
      padding: 'x',
    };
    const modified = {
      ...graph,
      nodes: graph.nodes.map((n) =>
        n.type === 'manualTrigger' ? { ...n, config: { payload } } : n,
      ),
    };
    store.getState().openDocument(modified, crypto.randomUUID(), null);
    const start = performance.now();
    coordinator.run();
    const result = await waitTerminal();
    return {
      elapsedMs: performance.now() - start,
      status: result.status,
      events: store.getState().runtime.events.length,
    };
  },
};
declare global {
  interface Window {
    flowcanvasRuntime: typeof api;
  }
}
window.flowcanvasRuntime = api;
const root = document.getElementById('root');
if (!root) throw new Error('Harness root');
createRoot(root).render(
  <StoreProvider store={store}>
    <ExecutionProvider coordinator={coordinator}>
      <App />
    </ExecutionProvider>
  </StoreProvider>,
);
window.addEventListener('pagehide', () => coordinator.dispose(), { once: true });
