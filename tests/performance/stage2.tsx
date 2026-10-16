import { Profiler } from 'react';
import { createRoot } from 'react-dom/client';
import '@xyflow/react/dist/style.css';
import '../../src/ui/styles.css';
import { App } from '../../src/app/App';
import { StoreProvider } from '../../src/state/context';
import { createAppStore } from '../../src/state/store';
import { validateDocument, validateDocumentShape } from '../../src/validation/codec';
import { emptyDocument, representativeGraph } from '../fixtures/graphs';
import { PersistenceCoordinator } from '../../src/application/persistence';
import { PersistenceProvider } from '../../src/features/workflows/context';
import { editable } from '../../src/domain/graph/history';
import { canonicalDocument } from '../../src/domain/json/canonical';
import { sampleId } from '../../src/application/sample';
const store = createAppStore(emptyDocument(), crypto.randomUUID(), {
  id: () => crypto.randomUUID(),
  now: () => new Date().toISOString(),
  validate: validateDocument,
  validateShape: validateDocumentShape,
});
store.setState({ bootReady: true });
const coordinator = new PersistenceCoordinator(
  store,
  () => crypto.randomUUID(),
  () => new Date().toISOString(),
);
const commits: number[] = [];
const gestures: { kind: string; count: number; start: number; end: number }[] = [];
const root = document.getElementById('root');
if (!root) throw new Error('Benchmark root missing');
createRoot(root).render(
  <StoreProvider store={store}>
    <PersistenceProvider coordinator={coordinator}>
      <Profiler id="editor" onRender={(_id, _phase, duration) => commits.push(duration)}>
        <App />
      </Profiler>
    </PersistenceProvider>
  </StoreProvider>,
);
const paint = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
const nextPaint = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
async function pairedSamples(first: () => void, second: () => void) {
  const a: number[] = [],
    b: number[] = [];
  for (let i = 0; i < 35; i++) {
    let start = performance.now();
    first();
    await nextPaint();
    if (i >= 5) a.push(performance.now() - start);
    start = performance.now();
    second();
    await nextPaint();
    if (i >= 5) b.push(performance.now() - start);
  }
  return { first: a, second: b };
}
async function samples(operation: () => Promise<void>): Promise<number[]> {
  const values: number[] = [];
  for (let i = 0; i < 35; i++) {
    const start = performance.now();
    await operation();
    const ms = performance.now() - start;
    if (i >= 5) values.push(ms);
  }
  return values;
}
async function frames(kind: 'pan' | 'zoom' | 'drag'): Promise<number[]> {
  const start = performance.now();
  const state = store.getState(),
    initial = state.session.document.viewport,
    selected = state.session.document.nodes.slice(
      0,
      Math.max(1, Math.floor(state.session.document.nodes.length / 10)),
    ),
    values: number[] = [];
  const revision = state.session.documentRevision;
  let last = 0,
    first = 0;
  await new Promise<void>((resolve) => {
    const step = (time: number) => {
      if (!first) first = time;
      if (last) values.push(time - last);
      last = time;
      const progress = (time - first) / 5000;
      if (kind === 'drag')
        store
          .getState()
          .overlayDrag(
            new Map(
              selected.map((n) => [
                n.id,
                { x: n.position.x + progress * 200, y: n.position.y + progress * 100 },
              ]),
            ),
          );
      else
        store.getState().overlayViewport({
          ...initial,
          ...(kind === 'pan'
            ? { x: initial.x + progress * 200, y: initial.y + progress * 100 }
            : { zoom: 0.25 + progress * 0.5 }),
        });
      if (progress < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
  store.getState().overlayDrag(new Map());
  store.getState().overlayViewport(null);
  await paint();
  if (store.getState().session.documentRevision !== revision)
    throw new Error('Transient frame mutated canonical document');
  gestures.push({
    kind,
    count: state.session.document.nodes.length,
    start,
    end: performance.now(),
  });
  return values;
}
async function run() {
  await coordinator.start();
  store.setState({ modal: null });
  await paint();
  const storage = coordinator.storage;
  if (!storage) throw new Error('Storage unavailable');
  const results = [];
  for (const count of [20, 100, 300] as const) {
    coordinator.memoryOnly(); // Isolate synchronous editor samples from unrelated writes.
    const fixture = {
      ...representativeGraph(count),
      id: sampleId(900000 + count),
      viewport: { x: 10, y: 10, zoom: 0.25 },
    };
    const seeded = await storage.save(fixture, null);
    if (!seeded.ok) throw new Error('Seed failed');
    const profilingStart = commits.length;
    const open = await samples(async () => {
      const loaded = await storage.load(fixture.id);
      if (!loaded.ok) throw new Error('Open failed');
      store
        .getState()
        .openDocument(loaded.value.document, crypto.randomUUID(), loaded.value.storageRevision);
      await paint();
      if (
        store.getState().modal !== null ||
        store.getState().session.document.nodes.length !== count
      )
        throw new Error('Opened graph is not usable');
    });
    const firstRender = await samples(async () => {
      store.getState().openDocument(fixture, crypto.randomUUID(), seeded.value.storageRevision);
      await paint();
    });
    const target = fixture.nodes.find((n) => n.type === 'setField');
    if (!target) throw new Error('Set fixture missing');
    let configValue = false;
    const config = await samples(async () => {
      configValue = !configValue;
      const state = store.getState(),
        r = state.dispatch(state.session.sessionId, {
          type: 'ChangeNodeConfig',
          nodeId: target.id,
          config: { path: ['reviewed'], value: configValue },
        });
      if (!r.ok) throw new Error('Config failed');
      await nextPaint();
    });
    const selection = await pairedSamples(
      () => {
        store.getState().setSelection(fixture.nodes.slice(0, count / 10).map((n) => n.id));
      },
      () => {
        store.getState().setSelection([]);
      },
    );
    const before = editable(store.getState().session.document);
    const history = await pairedSamples(
      () => {
        const s = store.getState();
        const result = s.undo(s.session.sessionId);
        if (!result.ok || !result.value.changed) throw new Error('Undo failed');
      },
      () => {
        const s = store.getState(),
          result = s.redo(s.session.sessionId);
        if (!result.ok || !result.value.changed) throw new Error('Redo failed');
      },
    );
    if (JSON.stringify(before) !== JSON.stringify(editable(store.getState().session.document)))
      throw new Error('Undo mismatch');
    let revision = seeded.value.storageRevision;
    const save = await samples(async () => {
      const result = await storage.save(store.getState().session.document, revision);
      if (!result.ok) throw new Error('Save failed');
      revision = result.value.storageRevision;
    });
    const current = store.getState();
    current.acknowledgeSave(current.session.sessionId, current.session.documentRevision, revision);
    current.setSave('dirty');
    if (!(await coordinator.flush(true)).ok) throw new Error('Autosave setup failed');
    const autosave = await samples(async () => {
      const state = store.getState();
      const expected = state.session.documentRevision + 1;
      configValue = !configValue;
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          unsubscribe();
          reject(new Error('Autosave deadline exceeded'));
        }, 5000);
        const unsubscribe = store.subscribe((next) => {
          if (next.save.status === 'error' || next.save.status === 'conflict') {
            clearTimeout(timeout);
            unsubscribe();
            reject(new Error('Autosave failed'));
          } else if (next.session.savedDocumentRevision === expected) {
            clearTimeout(timeout);
            unsubscribe();
            resolve();
          }
        });
        const changed = state.dispatch(state.session.sessionId, {
          type: 'ChangeNodeConfig',
          nodeId: target.id,
          config: { path: ['reviewed'], value: configValue },
        });
        if (!changed.ok || !changed.value.changed) {
          clearTimeout(timeout);
          unsubscribe();
          reject(new Error('Autosave edit failed'));
        }
      });
      const persisted = await storage.load(fixture.id);
      if (
        !persisted.ok ||
        canonicalDocument(persisted.value.document) !==
          canonicalDocument(store.getState().session.document)
      )
        throw new Error('Autosave persisted revision mismatch');
    });
    coordinator.memoryOnly();
    const frameMetrics = {
      pan: await frames('pan'),
      zoom: await frames('zoom'),
      drag: await frames('drag'),
    };
    results.push({
      count,
      canonical: canonicalDocument(fixture),
      open,
      firstRender,
      config,
      select: selection.first,
      clear: selection.second,
      undo: history.first,
      redo: history.second,
      save,
      autosave,
      frames: frameMetrics,
      gestures: gestures.filter((g) => g.count === count),
      reactCommitDurations: commits.slice(profilingStart),
    });
  }
  coordinator.dispose();
  return results;
}
declare global {
  interface Window {
    stage2Benchmark: typeof run;
  }
}
window.stage2Benchmark = run;
async function profile() {
  const fixture = representativeGraph(300);
  store.getState().openDocument(fixture, crypto.randomUUID(), null);
  await paint();
  return { pan: await frames('pan'), zoom: await frames('zoom'), drag: await frames('drag') };
}
declare global {
  interface Window {
    stage2Profile: typeof profile;
  }
}
window.stage2Profile = profile;
