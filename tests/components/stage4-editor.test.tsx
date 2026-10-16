// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { StoreProvider } from '../../src/state/context';
import { GraphList } from '../../src/features/editor/GraphList';
import { ConnectionDialog } from '../../src/features/editor/ConnectionDialog';
import { copyDocument } from '../../src/application/documents';
import { sampleId } from '../../src/application/sample';
import { makeStore } from '../fixtures/store';

describe('Stage 4 editor regressions', () => {
  for (const replacement of ['switch', 'delete'] as const)
    it(`given a ${replacement} removed the selection anchor, then Shift-click selects the current node`, () => {
      const store = makeStore();
      render(
        <StoreProvider store={store}>
          <GraphList />
        </StoreProvider>,
      );
      fireEvent.click(screen.getByRole('checkbox', { name: 'Select Manual Trigger' }));
      act(() => {
        const s = store.getState();
        if (replacement === 'delete') {
          expect(
            s.dispatch(s.session.sessionId, { type: 'DeleteNode', nodeId: sampleId(2) }).ok,
          ).toBe(true);
        } else {
          let next = 500;
          const copy = copyDocument(
            s.session.document,
            () => sampleId(next++),
            () => '2026-10-16T13:00:00.000Z',
          );
          if (!copy.ok) throw new Error('Synthetic copy failed');
          expect(s.openDocument(copy.value, sampleId(900), null).ok).toBe(true);
        }
      });
      fireEvent.click(screen.getByRole('checkbox', { name: 'Select Condition' }), {
        shiftKey: true,
      });
      const condition = store.getState().session.document.nodes.find((n) => n.type === 'condition');
      expect(condition).toBeDefined();
      expect(store.getState().selection.has(condition?.id ?? '')).toBe(true);
      expect(store.getState().selection.size).toBe(1);
    });

  it('given Condition is the first source, then its displayed default port creates a valid edge', async () => {
    const store = makeStore(),
      s = store.getState(),
      user = userEvent.setup();
    const condition = s.session.document.nodes.find((n) => n.type === 'condition');
    const output = s.session.document.nodes.find((n) => n.type === 'output');
    if (!condition || !output) throw new Error('Synthetic nodes missing');
    expect(
      s.openDocument(
        { ...s.session.document, nodes: [condition, output], edges: [] },
        sampleId(901),
        null,
      ).ok,
    ).toBe(true);
    render(
      <StoreProvider store={store}>
        <ConnectionDialog />
      </StoreProvider>,
    );
    expect(screen.getByLabelText('Source output')).toHaveValue('true');
    await user.selectOptions(screen.getByLabelText('Target node'), output.id);
    await user.click(screen.getByRole('button', { name: 'Connect' }));
    expect(store.getState().session.document.edges).toHaveLength(1);
    expect(store.getState().session.document.edges[0]?.source).toEqual({
      nodeId: condition.id,
      port: 'true',
    });
  });

  it('given a rejected connection, then focus reaches its error and the graph is unchanged', async () => {
    const store = makeStore(),
      before = store.getState().session.document,
      user = userEvent.setup();
    render(
      <StoreProvider store={store}>
        <ConnectionDialog />
      </StoreProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Connect' }));
    expect(screen.getByRole('alert')).toHaveFocus();
    expect(store.getState().session.document).toBe(before);
  });
});
