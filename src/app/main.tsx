import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@xyflow/react/dist/style.css';
import '../ui/styles.css';
import { createSample } from '../application/sample';
import { createAppStore } from '../state/store';
import { validateDocument, validateDocumentShape } from '../validation/codec';
import { StoreProvider } from '../state/context';
import { App } from './App';
import { readTheme } from '../ui/theme';
import { PersistenceCoordinator } from '../application/persistence';
import { PersistenceProvider } from '../features/workflows/context';
import { RunCoordinator } from '../application/execution';
import { ExecutionProvider } from '../features/execution/context';
const root = document.getElementById('root');
if (!root) throw new Error('Application root is unavailable');
const supported =
  isSecureContext &&
  typeof crypto.randomUUID === 'function' &&
  typeof structuredClone === 'function' &&
  typeof Worker === 'function' &&
  typeof crypto.subtle !== 'undefined';
if (supported) {
  const store = createAppStore(createSample(), crypto.randomUUID(), {
    id: () => crypto.randomUUID(),
    now: () => new Date().toISOString(),
    validate: validateDocument,
    validateShape: validateDocumentShape,
  });
  store.getState().setTheme(readTheme());
  if (matchMedia('(max-width: 1023px)').matches) store.getState().setView('list');
  const coordinator = new PersistenceCoordinator(
    store,
    () => crypto.randomUUID(),
    () => new Date().toISOString(),
  );
  const execution = new RunCoordinator(store);
  createRoot(root).render(
    <StrictMode>
      <StoreProvider store={store}>
        <PersistenceProvider coordinator={coordinator}>
          <ExecutionProvider coordinator={execution}>
            <App />
          </ExecutionProvider>
        </PersistenceProvider>
      </StoreProvider>
    </StrictMode>,
  );
  void coordinator.start().catch(() => {
    store.setState({ bootReady: true });
    store.getState().setSave('error', {
      code: 'STORAGE_UNAVAILABLE',
      category: 'persistence',
      severity: 'error',
      messageKey: 'STORAGE_UNAVAILABLE',
      recoverable: true,
      context: {},
    });
  });
  const dispose = () => {
    execution.dispose();
    coordinator.dispose();
  };
  const pageHide = (event: PageTransitionEvent) => {
    if (event.persisted) execution.suspend();
    else dispose();
  };
  window.addEventListener('pagehide', pageHide);
  if (import.meta.hot)
    import.meta.hot.dispose(() => {
      window.removeEventListener('pagehide', pageHide);
      dispose();
    });
} else {
  createRoot(root).render(
    <main className="render-error">
      <h1>FlowCanvas</h1>
      <p role="alert">
        This browser is missing required capabilities. Use a supported desktop browser on HTTPS or
        localhost.
      </p>
      <p>No workflow has been opened or changed.</p>
    </main>,
  );
}
