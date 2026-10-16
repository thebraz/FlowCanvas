import { useMemo, useRef, type RefObject } from 'react';
import type { ReactFlowProps } from '@xyflow/react';
import type { AppStore } from '../../state/store';
import type { FlowNode } from '../../adapters/react-flow/projection';
import type { Position } from '../../contracts/workflow';
import { edgeSchema } from '../../validation/schemas';
import { validateConnection } from '../../domain/graph/invariants';
import { errorMessage } from '../../ui/messages';
export function useCanvasInteractions(
  store: AppStore,
  cancelDrag: () => void,
  moves: RefObject<Map<string, Position>>,
  dragFrame: RefObject<number | null>,
  cancelled: RefObject<boolean>,
  moveSession: RefObject<string | null>,
  setMessage: (message: string) => void,
) {
  const gestureSession = useRef<string | null>(null),
    connectionSession = useRef<string | null>(null),
    reconnectingEdge = useRef<string | null>(null),
    reconnectStart = useRef(false),
    reason = useRef('');
  return useMemo<Partial<ReactFlowProps<FlowNode>>>(
    () => ({
      onMoveStart: (event) => {
        if (event && !(event instanceof Event)) return;
        moveSession.current = store.getState().session.sessionId;
      },
      onNodeDragStart: () => {
        const s = store.getState();
        gestureSession.current = s.session.sessionId;
        moves.current.clear();
        cancelled.current = false;
        if (s.draft.dirty) {
          cancelDrag();
          s.announce('Apply or cancel inspector edits before dragging.');
        }
      },
      onNodeDragStop: (_event, _node, nodes) => {
        if (dragFrame.current !== null) {
          cancelAnimationFrame(dragFrame.current);
          dragFrame.current = null;
        }
        if (cancelled.current) {
          cancelDrag();
          return;
        }
        const s = store.getState();
        s.overlayDrag(new Map(nodes.map((n) => [n.id, n.position])));
        const result = s.commitDrag(gestureSession.current ?? s.session.sessionId);
        moves.current.clear();
        if (!result.ok) setMessage(errorMessage(result.error));
      },
      onEdgesChange: (changes) => {
        const s = store.getState(),
          ids = new Set(s.selection);
        for (const c of changes)
          if (c.type === 'select') {
            if (c.selected) ids.add(c.id);
            else ids.delete(c.id);
          }
        s.setSelection([...ids]);
      },
      onConnect: (connection) => {
        const s = store.getState(),
          result = s.dispatch(connectionSession.current ?? s.session.sessionId, {
            type: 'CreateEdge',
            source: { nodeId: connection.source, port: connection.sourceHandle },
            target: { nodeId: connection.target, port: connection.targetHandle },
          });
        setMessage(result.ok ? 'Connection created.' : errorMessage(result.error));
      },
      onReconnect: (edge, connection) => {
        const s = store.getState(),
          result = s.dispatch(connectionSession.current ?? s.session.sessionId, {
            type: 'ReconnectEdge',
            edgeId: edge.id,
            source: { nodeId: connection.source, port: connection.sourceHandle },
            target: { nodeId: connection.target, port: connection.targetHandle },
          });
        setMessage(result.ok ? 'Connection updated.' : errorMessage(result.error));
      },
      isValidConnection: (connection) => {
        const parsed = edgeSchema.safeParse({
          id: 'ffffffff-ffff-4fff-8fff-fffffffffff0',
          source: { nodeId: connection.source, port: connection.sourceHandle },
          target: { nodeId: connection.target, port: connection.targetHandle },
        });
        if (!parsed.success) {
          reason.current = 'Choose a valid source output and target input.';
          return false;
        }
        const result = validateConnection(
          store.getState().session.document,
          parsed.data,
          reconnectingEdge.current ?? ('id' in connection ? connection.id : undefined),
        );
        reason.current = result.ok ? '' : errorMessage(result.error);
        return result.ok;
      },
      onConnectStart: () => {
        if (!reconnectStart.current) reconnectingEdge.current = null;
        reconnectStart.current = false;
        connectionSession.current = store.getState().session.sessionId;
      },
      onReconnectStart: (_event, edge) => {
        reconnectStart.current = true;
        reconnectingEdge.current = edge.id;
        connectionSession.current = store.getState().session.sessionId;
      },
      onReconnectEnd: () => {
        reconnectingEdge.current = null;
        reconnectStart.current = false;
      },
      onConnectEnd: (_event, state) => {
        if (!state.isValid && reason.current) setMessage(reason.current);
      },
      onNodeContextMenu: (event, node) => {
        event.preventDefault();
        const s = store.getState();
        s.request(() => {
          s.setSelection([node.id]);
          s.showMenu({ x: event.clientX, y: event.clientY, entityId: node.id });
        });
      },
      onEdgeContextMenu: (event, edge) => {
        event.preventDefault();
        const s = store.getState();
        s.request(() => {
          s.setSelection([edge.id]);
          s.showMenu({ x: event.clientX, y: event.clientY, entityId: edge.id });
        });
      },
      onPaneContextMenu: (event) => {
        event.preventDefault();
        const s = store.getState();
        s.request(() => {
          s.setSelection([]);
          s.showMenu({ x: event.clientX, y: event.clientY, entityId: null });
        });
      },
    }),
    [store, cancelDrag, moves, dragFrame, cancelled, moveSession, setMessage],
  );
}
