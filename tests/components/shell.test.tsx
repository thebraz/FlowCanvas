// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../src/app/App';
import { StoreProvider, useAppStore } from '../../src/state/context';
import { makeStore } from '../fixtures/store';
import { sampleId } from '../../src/application/sample';
import { boundedPreview } from '../../src/features/editor/Inspector';
import { LIMITS } from '../../src/contracts/limits';
import { ErrorBoundary } from '../../src/ui/ErrorBoundary';
import { readTheme, THEME_KEY } from '../../src/ui/theme';

describe('initial shell contracts', () => {
  it('given a rendering exception, then recovery retains the canonical document', async () => {
    const store = makeStore();
    const before = store.getState().session.document;
    let fail = true;
    function RegionFailure() {
      if (fail) throw new Error('Synthetic render fault');
      return <p>Recovered region</p>;
    }
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      render(
        <StoreProvider store={store}>
          <ErrorBoundary>
            <RegionFailure />
          </ErrorBoundary>
        </StoreProvider>,
      );
      expect(screen.getByRole('alert')).toHaveTextContent('preserved');
      fail = false;
      await userEvent.click(screen.getByRole('button', { name: 'Restore view' }));
      expect(screen.getByText('Recovered region')).toBeVisible();
      expect(store.getState().session.document).toBe(before);
    } finally {
      error.mockRestore();
    }
  });
  it('given the shell, then accessible regions and explained future controls render', () => {
    const store = makeStore();
    store.getState().setView('list');
    render(
      <StoreProvider store={store}>
        <App />
      </StoreProvider>,
    );
    expect(screen.getByRole('heading', { name: 'FlowCanvas' })).toBeVisible();
    for (const name of ['Node palette', 'Graph list', 'Properties', 'Graph diagnostics'])
      expect(screen.getByRole('heading', { name })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Run' })).toBeDisabled();
    expect(screen.getByText('Sample · not saved')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Skip to editor' })).toHaveAttribute('href', '#editor');
  });
  it('given keyboard search/list selection, then filtering and inspector use canonical data', async () => {
    const user = userEvent.setup();
    const store = makeStore();
    store.getState().setView('list');
    render(
      <StoreProvider store={store}>
        <App />
      </StoreProvider>,
    );
    await user.type(screen.getByRole('searchbox', { name: 'Find a node type' }), 'condition');
    const palette = screen.getByRole('region', { name: 'Node palette' });
    expect(within(palette).getAllByRole('listitem')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Inspect Condition' }));
    const inspector = screen.getByRole('region', { name: 'Properties' });
    expect(within(inspector).getByText('Configured')).toBeVisible();
    expect(within(inspector).getByLabelText('Node configuration')).toHaveTextContent('gold');
    expect(store.getState().session.document.nodes[3]?.type).toBe('condition');
  });
  it('given theme/grid controls, then keyboard actions change preferences without graph revisions', async () => {
    localStorage.removeItem(THEME_KEY);
    expect(readTheme()).toBe('dark');
    localStorage.setItem(THEME_KEY, 'unsupported');
    expect(readTheme()).toBe('system');
    localStorage.removeItem(THEME_KEY);
    const user = userEvent.setup();
    const store = makeStore();
    store.getState().setView('list');
    render(
      <StoreProvider store={store}>
        <App />
      </StoreProvider>,
    );
    const before = store.getState().session;
    await user.selectOptions(screen.getByLabelText('Theme'), 'light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(store.getState().theme).toBe('light');
    expect(localStorage.getItem('flowcanvas.theme.v1')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Grid on' }));
    expect(screen.getByRole('button', { name: 'Grid off' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(store.getState().session).toBe(before);
  });
  it('given hostile labels and Note text, then no HTML is interpreted', () => {
    const store = makeStore();
    const state = store.getState();
    state.dispatch(state.session.sessionId, {
      type: 'RenameNode',
      nodeId: sampleId(8),
      label: '<img src=x onerror=alert(1)>',
    });
    state.dispatch(state.session.sessionId, {
      type: 'ChangeNodeConfig',
      nodeId: sampleId(8),
      config: { text: '<script>alert(1)</script>' },
    });
    state.setView('list');
    state.select(sampleId(8));
    render(
      <StoreProvider store={store}>
        <App />
      </StoreProvider>,
    );
    expect(
      screen.getByRole('button', { name: 'Inspect <img src=x onerror=alert(1)>' }),
    ).toBeVisible();
    expect(screen.getByLabelText('Node configuration')).toHaveTextContent(
      '<script>alert(1)</script>',
    );
    expect(document.querySelector('script, img')).toBeNull();
  });
  it('given a canvas shell, then real React Flow and navigation controls are mounted', () => {
    const store = makeStore();
    const { container } = render(
      <StoreProvider store={store}>
        <App />
      </StoreProvider>,
    );
    expect(screen.getByRole('heading', { name: 'Canvas' })).toBeVisible();
    expect(container.querySelector('.react-flow')).not.toBeNull();
    for (const name of [
      'Zoom in',
      'Zoom out',
      'Fit view',
      'Pan left',
      'Pan right',
      'Pan up',
      'Pan down',
    ])
      expect(screen.getByRole('button', { name })).toBeVisible();
  });
  it('given a node-specific selector, then unrelated state changes do not rerender it', () => {
    const store = makeStore();
    let renders = 0;
    function Probe() {
      const node = useAppStore((state) =>
        state.session.document.nodes.find((node) => node.id === sampleId(2)),
      );
      renders++;
      return <span>{node?.label}</span>;
    }
    render(
      <StoreProvider store={store}>
        <Probe />
      </StoreProvider>,
    );
    const before = renders;
    store.getState().setTheme('dark');
    store.getState().select(sampleId(3));
    expect(renders).toBe(before);
  });
  it('given a multibyte preview at its byte cap, then truncation never splits Unicode scalars', () => {
    const text = '😀'.repeat(LIMITS.MAX_INSPECTOR_PREVIEW_BYTES / 4);
    expect(boundedPreview(text)).toEqual({ text, truncated: false });
    expect(boundedPreview(text + 'x')).toEqual({ text, truncated: true });
  });
});
