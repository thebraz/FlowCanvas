import { SquaresFour, List, Graph } from '@phosphor-icons/react';
import { useAppStore } from '../state/context';
import { Canvas } from '../features/editor/Canvas';
import { Palette } from '../features/editor/Palette';
import { Inspector } from '../features/editor/Inspector';
import { GraphList } from '../features/editor/GraphList';
import { Diagnostics } from '../features/editor/Diagnostics';
import { ThemeControl } from '../ui/ThemeControl';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { Button } from '../ui/primitives';
import { useEffect, type CSSProperties } from 'react';
import { useMedia } from '../ui/useMedia';
import { Overlays } from '../features/editor/Overlays';
import { useShortcuts } from '../features/editor/useShortcuts';
import { SaveControls, SaveRecovery } from '../features/workflows/SaveControls';
import { ExecutionControls } from '../features/execution/Controls';
import { ExecutionPanel } from '../features/execution/Panel';
import { isActiveRun } from '../contracts/execution';
export function App() {
  useShortcuts();
  const bootReady = useAppStore((s) => s.bootReady);
  useEffect(() => {
    let second: number | undefined;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        performance.mark('flowcanvas-shell-ready');
      });
    });
    return () => {
      cancelAnimationFrame(first);
      if (second !== undefined) cancelAnimationFrame(second);
    };
  }, []);
  const title = useAppStore((state) => state.session.document.metadata.title);
  const view = useAppStore((state) => state.view);
  const setView = useAppStore((state) => state.setView);
  const grid = useAppStore((state) => state.grid);
  const toggleGrid = useAppStore((state) => state.toggleGrid);
  const medium = useMedia('(min-width: 1024px) and (max-width: 1279px)');
  const history = useAppStore((s) => s.history),
    undo = useAppStore((s) => s.undo),
    redo = useAppStore((s) => s.redo),
    sessionId = useAppStore((s) => s.session.sessionId),
    showModal = useAppStore((s) => s.showModal),
    minimap = useAppStore((s) => s.minimap),
    toggleMinimap = useAppStore((s) => s.toggleMinimap),
    message = useAppStore((s) => s.message),
    leftWidth = useAppStore((s) => s.leftWidth),
    rightWidth = useAppStore((s) => s.rightWidth),
    resize = useAppStore((s) => s.resizePanel),
    request = useAppStore((s) => s.request);
  const panelStyle: CSSProperties & { '--left-width': string; '--right-width': string } = {
    '--left-width': `${leftWidth}px`,
    '--right-width': `${rightWidth}px`,
  };
  const locked = useAppStore((s) => isActiveRun(s.runtime.status));
  return (
    <div className="app-shell" data-storage-ready={bootReady} inert={!bootReady}>
      <a className="skip-link" href="#editor" tabIndex={0}>
        Skip to editor
      </a>
      <header className="toolbar" tabIndex={-1}>
        <div className="brand">
          <SquaresFour size={24} weight="duotone" aria-hidden="true" />
          <h1>FlowCanvas</h1>
          <span className="stage-label">Beta</span>
        </div>
        <div className="workflow-title">
          <strong>{title}</strong>
          <Button onClick={() => showModal('workflows')}>Workflows</Button>
          <Button onClick={() => showModal('rename')}>Rename</Button>
        </div>
        <SaveControls />
        <Button
          disabled={!history.undo.length || (locked && history.undo.at(-1)?.semantic)}
          title={
            locked
              ? 'Stop execution before semantic undo'
              : !history.undo.length
                ? 'No command to undo'
                : undefined
          }
          onClick={() =>
            request(() => {
              undo(sessionId);
            })
          }
        >
          Undo
        </Button>
        <Button
          disabled={!history.redo.length || (locked && history.redo.at(-1)?.semantic)}
          title={
            locked
              ? 'Stop execution before semantic redo'
              : !history.redo.length
                ? 'No command to redo'
                : undefined
          }
          onClick={() =>
            request(() => {
              redo(sessionId);
            })
          }
        >
          Redo
        </Button>
        <Button onClick={() => showModal('commands')}>Commands</Button>
        <Button onClick={() => showModal('help')}>Help</Button>
        <ThemeControl />
        <ExecutionControls actions={['run']} />
      </header>
      <div className="foundation-banner" role="region" aria-label="Application status">
        <span className="status-dot" aria-hidden="true" />
        Local visual editor
        <span id="run-reason">Local storage · Deterministic execution.</span>
      </div>
      <SaveRecovery />
      <div className="editor-status">{message}</div>
      <div className="workspace" style={panelStyle}>
        <aside className="left-rail" aria-label="Node catalog">
          {medium ? (
            <details className="palette-drawer">
              <summary>Node palette</summary>
              <Palette />
            </details>
          ) : (
            <Palette />
          )}
          <div className="action-row">
            <Button aria-label="Narrow node palette" onClick={() => resize('left', -20)}>
              −
            </Button>
            <Button aria-label="Widen node palette" onClick={() => resize('left', 20)}>
              +
            </Button>
          </div>
        </aside>
        <main id="editor" tabIndex={-1} className="editor">
          <nav className="editor-toolbar" aria-label="Editor views">
            <div className="view-toggle">
              <Button
                aria-pressed={view === 'canvas'}
                onClick={() => {
                  setView('canvas');
                }}
              >
                <Graph size={16} aria-hidden="true" />
                Canvas
              </Button>
              <Button
                aria-pressed={view === 'list'}
                onClick={() => {
                  setView('list');
                }}
              >
                <List size={16} aria-hidden="true" />
                Graph list
              </Button>
            </div>
            <Button aria-pressed={grid} onClick={toggleGrid}>
              Grid {grid ? 'on' : 'off'}
            </Button>
            <Button aria-pressed={minimap} onClick={toggleMinimap}>
              Minimap {minimap ? 'on' : 'off'}
            </Button>
            <Button
              disabled={locked}
              title={locked ? 'Stop execution before editing connections' : undefined}
              onClick={() => showModal('connection')}
            >
              Connect nodes
            </Button>
          </nav>
          <ErrorBoundary>{view === 'canvas' ? <Canvas /> : <GraphList />}</ErrorBoundary>
        </main>
        <aside aria-label="Node properties">
          <ErrorBoundary>
            <Inspector />
          </ErrorBoundary>
          <div className="action-row">
            <Button aria-label="Narrow properties panel" onClick={() => resize('right', -20)}>
              −
            </Button>
            <Button aria-label="Widen properties panel" onClick={() => resize('right', 20)}>
              +
            </Button>
          </div>
        </aside>
      </div>
      <Diagnostics />
      <ExecutionPanel />
      <footer className="app-footer">
        <span>Local-first visual editor</span>
        <span>Canonical schema v1 · Isolated worker execution</span>
      </footer>
      <Overlays />
    </div>
  );
}
