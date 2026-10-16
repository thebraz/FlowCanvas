import { createRoot } from 'react-dom/client';
import '@xyflow/react/dist/style.css';
import '../../src/ui/styles.css';
import { App } from '../../src/app/App';
import { StoreProvider } from '../../src/state/context';
import { createAppStore } from '../../src/state/store';
import { validateDocument, validateDocumentShape } from '../../src/validation/codec';
import { validateStructure, readiness } from '../../src/domain/graph/invariants';
import { canonicalDocument } from '../../src/domain/json/canonical';
import { emptyDocument, representativeGraph } from '../fixtures/graphs';
import type { WorkflowDocument } from '../../src/contracts/workflow';
import { readTheme, applyTheme } from '../../src/ui/theme';

interface Metric {
  readonly samples: readonly number[];
  readonly errors: number;
}
declare global {
  interface Window {
    flowcanvasBenchmark: () => Promise<{
      readonly fixtures: readonly {
        readonly count: number;
        readonly canonical: string;
        readonly validation: Metric;
        readonly serialization: Metric;
        readonly sha256: Metric;
      }[];
    }>;
  }
}
function measure(
  document: WorkflowDocument,
  operation: (document: WorkflowDocument) => boolean,
): Metric {
  for (let i = 0; i < 5; i++) {
    if (!operation(document)) throw new Error('Benchmark warmup failed');
  }
  const samples: number[] = [];
  let errors = 0;
  for (let i = 0; i < 30; i++) {
    const start = performance.now();
    const success = operation(document);
    samples.push(performance.now() - start);
    if (!success) errors++;
  }
  return { samples, errors };
}
async function measureHash(document: WorkflowDocument): Promise<Metric> {
  const bytes = new TextEncoder().encode(canonicalDocument(document));
  const samples: number[] = [];
  for (let index = 0; index < 35; index++) {
    const start = performance.now();
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    if (digest.byteLength !== 32) throw new Error('Incomplete SHA-256 result');
    if (index >= 5) samples.push(performance.now() - start);
  }
  return { samples, errors: 0 };
}
window.flowcanvasBenchmark = async () => {
  const fixtures = [];
  for (const count of [20, 100, 300] as const) {
    const document = representativeGraph(count);
    const checked = validateDocument(document);
    if (!checked.ok) throw new Error('Invalid benchmark fixture');
    fixtures.push({
      count,
      canonical: canonicalDocument(checked.value),
      validation: measure(
        checked.value,
        (candidate) => validateStructure(candidate).total === 0 && readiness(candidate).ready,
      ),
      serialization: measure(
        checked.value,
        (candidate) => new TextEncoder().encode(canonicalDocument(candidate)).byteLength > 0,
      ),
      sha256: await measureHash(checked.value),
    });
  }
  return { fixtures };
};
const store = createAppStore(emptyDocument(), crypto.randomUUID(), {
  id: () => crypto.randomUUID(),
  now: () => new Date().toISOString(),
  validate: validateDocument,
  validateShape: validateDocumentShape,
});
store.getState().setTheme(readTheme());
store.setState({ bootReady: true });
applyTheme(store.getState().theme);
const root = document.getElementById('root');
if (!root) throw new Error('Missing benchmark root');
createRoot(root).render(
  <StoreProvider store={store}>
    <App />
  </StoreProvider>,
);
