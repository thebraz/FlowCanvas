// @vitest-environment jsdom
import { render, screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { App } from '../../src/app/App';
import { StoreProvider, useAppStore } from '../../src/state/context';
import { makeStore } from '../fixtures/store';
import { sampleId } from '../../src/application/sample';
function mount() {
  const store = makeStore();
  store.getState().setView('list');
  render(
    <StoreProvider store={store}>
      <App />
    </StoreProvider>,
  );
  return store;
}
describe('Stage 2 observable editor', () => {
  it('given node-specific subscriptions, then a config edit renders its node while preserving unrelated subscriptions', () => {
    const store = makeStore(),
      counts = new Map<string, number>();
    function Probe({ id }: { readonly id: string }) {
      const node = useAppStore((s) => s.indexes.nodeById.get(id));
      counts.set(id, (counts.get(id) ?? 0) + 1);
      return <span>{node?.label}</span>;
    }
    render(
      <StoreProvider store={store}>
        <Probe id={sampleId(2)} />
        <Probe id={sampleId(3)} />
      </StoreProvider>,
    );
    const before = counts.get(sampleId(2));
    act(() => {
      const s = store.getState();
      s.dispatch(s.session.sessionId, {
        type: 'ChangeNodeConfig',
        nodeId: sampleId(3),
        config: { path: ['reviewed'], value: false },
      });
    });
    expect(counts.get(sampleId(2))).toBe(before);
    expect(counts.get(sampleId(3))).toBe(2);
  });
  it('given invalid config draft, then Apply is disabled, errors retain text and canonical config is isolated', async () => {
    const store = mount(),
      user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Inspect Set Field' }));
    const before = store.getState().session.document;
    await user.clear(screen.getByLabelText('Node configuration'));
    await user.type(screen.getByLabelText('Node configuration'), 'malformed');
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
    expect(store.getState().session.document).toBe(before);
    await user.click(screen.getByRole('button', { name: 'Inspect Condition' }));
    expect(screen.getByRole('dialog', { name: 'Unsaved inspector edits' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByLabelText('Node configuration')).toHaveValue('malformed');
    await user.click(screen.getByRole('button', { name: 'Cancel edits' }));
    expect(screen.getByLabelText('Node configuration')).toHaveValue(
      JSON.stringify(before.nodes[1]?.config, null, 2),
    );
  });
  it('given valid config and position edits, then Apply is one transaction and undo restores exact content', async () => {
    const store = mount(),
      user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Inspect Set Field' }));
    await user.clear(screen.getByLabelText('Position X'));
    await user.type(screen.getByLabelText('Position X'), '123');
    await user.clear(screen.getByLabelText('Node configuration'));
    await user.paste('{"path":["reviewed"],"value":false}');
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(store.getState().history.undo).toHaveLength(1);
    expect(store.getState().indexes.nodeById.get(sampleId(3))?.position.x).toBe(123);
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(store.getState().indexes.nodeById.get(sampleId(3))?.config).toEqual({
      path: ['reviewed'],
      value: true,
    });
  });
  it('given multi-selection, then bulk duplication and deletion are functional with undo', async () => {
    const store = mount(),
      user = userEvent.setup();
    await user.click(screen.getByRole('checkbox', { name: 'Select Manual Trigger' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select Set Field' }));
    await user.click(screen.getByRole('button', { name: 'Duplicate selected' }));
    expect(store.getState().session.document.nodes).toHaveLength(9);
    expect(store.getState().selection.size).toBe(2);
    await user.click(screen.getByRole('button', { name: 'Delete selected' }));
    expect(store.getState().session.document.nodes).toHaveLength(7);
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(store.getState().session.document.nodes).toHaveLength(9);
  });
  it('given a focused JSON editor, then undo, delete, arrows and command shortcuts remain native', async () => {
    const store = mount(),
      user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Inspect About this sample' }));
    const editor = screen.getByLabelText('Node configuration');
    await user.click(editor);
    const before = store.getState().session.document;
    await user.keyboard('{Control>}z{/Control}{ArrowLeft}{Delete}{Control>}k{/Control}');
    expect(store.getState().session.document).toBe(before);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('given connection dialog rejection, then the original graph remains visible and unchanged', async () => {
    const store = mount(),
      user = userEvent.setup(),
      before = store.getState().session.document;
    await user.click(screen.getByRole('button', { name: 'Connect nodes' }));
    const dialog = screen.getByRole('dialog', { name: 'Create connection' });
    await user.selectOptions(within(dialog).getByLabelText('Source node'), sampleId(2));
    await user.selectOptions(within(dialog).getByLabelText('Target node'), sampleId(3));
    await user.click(within(dialog).getByRole('button', { name: 'Connect' }));
    expect(within(dialog).getByRole('alert')).toBeVisible();
    expect(store.getState().session.document).toBe(before);
  });
});
