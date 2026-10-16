import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  MiniMap,
  useReactFlow,
  SelectionMode,
  type Viewport,
  type OnMove,
  type NodeTypes,
  type NodeMouseHandler,
  type OnNodesChange,
} from '@xyflow/react';
import { useAppStore, useStoreApi } from '../../state/context';
import { NODE_TYPES } from '../../contracts/workflow';
import { useCanvasInteractions } from './useCanvasInteractions';
import { NODE_DRAG_TYPE, NODE_DRAG_PREFIX } from './placement';

import { errorMessage } from '../../ui/messages';
import { GEOMETRY, FIELDS } from '../../contracts/limits';
import { createProjection, type FlowNode } from '../../adapters/react-flow/projection';
import { WorkflowNodeView } from '../../adapters/react-flow/WorkflowNodeView';
import { CanvasControls } from './CanvasControls';
import { RuntimeEdge } from '../../adapters/react-flow/RuntimeEdge';
import { isActiveRun } from '../../contracts/execution';
const nodeTypes: NodeTypes = { workflow: WorkflowNodeView };
const edgeTypes = { runtime: RuntimeEdge };
const PAN_BUTTONS = [1];
const SNAP_GRID: [number, number] = [GEOMETRY.GRID, GEOMETRY.GRID];
const ARIA_LABELS = {
  'node.a11yDescription.default':
    'Use the graph list for keyboard editing, movement and connections.',
};
function CanvasView() {
  const store = useStoreApi(),
    flow = useReactFlow();
  const document = useAppStore((state) => state.session.document);
  const sessionId = useAppStore((state) => state.session.sessionId);
  const selection = useAppStore((state) => state.selection);
  const overlay = useAppStore((state) => state.viewportOverlay);
  const setOverlay = useAppStore((state) => state.overlayViewport);
  const dispatch = useAppStore((state) => state.dispatch);
  const setSelection = useAppStore((s) => s.setSelection),
    dragOverlay = useAppStore((s) => s.dragOverlay),
    minimap = useAppStore((s) => s.minimap);
  const grid = useAppStore((state) => state.grid);
  const locked = useAppStore((s) => isActiveRun(s.runtime.status));
  const projection = useMemo(() => createProjection(), []);
  const projected = useMemo(
    () => projection(document, selection, dragOverlay),
    [document, selection, projection, dragOverlay],
  );
  const frame = useRef<number | null>(null);
  const moveSession = useRef<string | null>(null),
    pointerFrame = useRef<number | null>(null);
  const pending = useRef<Viewport | null>(null);
  const [message, setMessage] = useState('');
  const dragFrame = useRef<number | null>(null),
    moves = useRef(new Map<string, { x: number; y: number }>()),
    cancelled = useRef(false);
  const cancelDrag = useCallback(() => {
    cancelled.current = true;
    moves.current.clear();
    if (dragFrame.current !== null) {
      cancelAnimationFrame(dragFrame.current);
      dragFrame.current = null;
    }
    store.getState().overlayDrag(new Map());
  }, [store]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancelDrag();
    };
    window.addEventListener('keydown', key);
    window.addEventListener('pointercancel', cancelDrag);
    window.addEventListener('blur', cancelDrag);
    return () => {
      window.removeEventListener('keydown', key);
      window.removeEventListener('pointercancel', cancelDrag);
      window.removeEventListener('blur', cancelDrag);
      cancelDrag();
    };
  }, [cancelDrag]);
  useEffect(() => {
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      if (pointerFrame.current !== null) cancelAnimationFrame(pointerFrame.current);
      setOverlay(null);
    };
  }, [setOverlay]);
  const onMove: OnMove = useCallback(
    (_event, viewport) => {
      // Controlled sync callbacks may carry a library object instead of a DOM gesture.
      if (_event && !(_event instanceof Event)) return;
      pending.current = viewport;
      if (frame.current === null)
        frame.current = requestAnimationFrame(() => {
          frame.current = null;
          setOverlay(pending.current);
        });
    },
    [setOverlay],
  );
  const onMoveEnd: OnMove = useCallback(
    (_event, viewport) => {
      if (_event && !(_event instanceof Event)) return;
      if (frame.current !== null) {
        cancelAnimationFrame(frame.current);
        frame.current = null;
      }
      const result = dispatch(moveSession.current ?? sessionId, { type: 'SetViewport', viewport });
      setOverlay(null);
      if (!result.ok) setMessage('The viewport change could not be applied.');
    },
    [dispatch, sessionId, setOverlay],
  );
  const viewport = overlay ?? document.viewport;
  const onNodeClick = useCallback<NodeMouseHandler<FlowNode>>(
    (event, node) => {
      if (!event.shiftKey) setSelection([node.id]);
    },
    [setSelection],
  );
  const onPaneClick = useCallback(() => {
    setSelection([]);
  }, [setSelection]);
  const onNodesChange = useCallback<OnNodesChange<FlowNode>>(
    (changes) => {
      const selected = new Set(store.getState().selection);
      for (const change of changes) {
        if (change.type === 'select') {
          if (change.selected) selected.add(change.id);
          else selected.delete(change.id);
        }
        if (
          change.type === 'position' &&
          change.position &&
          change.dragging &&
          !cancelled.current
        ) {
          moves.current.set(change.id, change.position);
          if (dragFrame.current === null)
            dragFrame.current = requestAnimationFrame(() => {
              dragFrame.current = null;
              store.getState().overlayDrag(new Map(moves.current));
            });
        }
      }
      setSelection([...selected]);
    },
    [setSelection, store],
  );
  const interactions = useCanvasInteractions(
    store,
    cancelDrag,
    moves,
    dragFrame,
    cancelled,
    moveSession,
    setMessage,
  );
  return (
    <section className="canvas-region" aria-labelledby="canvas-heading">
      <div className="region-heading">
        <h2 id="canvas-heading" tabIndex={-1}>
          Canvas
        </h2>
        <span>
          {document.nodes.length} nodes · {document.edges.length} connections
        </span>
      </div>
      <div
        className="canvas-frame"
        onPointerMove={(event) => {
          if (pointerFrame.current !== null) return;
          const point = { x: event.clientX, y: event.clientY };
          pointerFrame.current = requestAnimationFrame(() => {
            pointerFrame.current = null;
            store.setState({ canvasPoint: flow.screenToFlowPosition(point) });
          });
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
        }}
        onDrop={(event) => {
          event.preventDefault();
          if (locked) return;
          const text = event.dataTransfer.getData('text/plain');
          const type =
            event.dataTransfer.getData(NODE_DRAG_TYPE) ||
            (text.startsWith(NODE_DRAG_PREFIX) ? text.slice(NODE_DRAG_PREFIX.length) : '');
          const nodeType = NODE_TYPES.find((t) => t === type);
          if (!nodeType) return;
          const point = flow.screenToFlowPosition(
            { x: event.clientX, y: event.clientY },
            { snapToGrid: grid },
          );
          store.getState().request(() => {
            const result = dispatch(sessionId, { type: 'CreateNode', nodeType, position: point });
            if (!result.ok) setMessage(errorMessage(result.error));
          });
        }}
      >
        <ReactFlow
          nodes={projected.nodes}
          edges={projected.edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          viewport={viewport}
          onMove={onMove}

          onMoveEnd={onMoveEnd}
          minZoom={FIELDS.MIN_ZOOM}
          maxZoom={FIELDS.MAX_ZOOM}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onNodesChange={onNodesChange}
          onlyRenderVisibleElements
          nodesDraggable
          nodesConnectable={!locked}
          edgesReconnectable={!locked}
          snapToGrid={grid}
          snapGrid={SNAP_GRID}
          {...interactions}
          deleteKeyCode={null}
          panOnDrag={PAN_BUTTONS}
          panActivationKeyCode="Space"
          selectionOnDrag
          selectionKeyCode="Shift"
          multiSelectionKeyCode="Shift"
          selectionMode={SelectionMode.Partial}
          selectNodesOnDrag={false}
          disableKeyboardA11y
          ariaLabelConfig={ARIA_LABELS}
        >
          {grid && (
            <Background
              variant={BackgroundVariant.Dots}
              gap={GEOMETRY.GRID}
              size={1}
              color="var(--grid)"
            />
          )}
          {minimap && (
            <MiniMap
              pannable
              zoomable
              ariaLabel="Workflow minimap"
              nodeColor="var(--control-border)"
              maskColor="var(--surface-raised)"
              style={{ background: 'var(--surface)', bottom: 80 }}
            />
          )}
        </ReactFlow>
        <CanvasControls />
      </div>
      <p className="canvas-hint">
        Middle drag or Space + drag to pan · Shift + drag to select · Scroll to zoom
      </p>
      {message && <p role="alert">{message}</p>}
    </section>
  );
}
export function Canvas() {
  return (
    <ReactFlowProvider>
      <CanvasView />
    </ReactFlowProvider>
  );
}
