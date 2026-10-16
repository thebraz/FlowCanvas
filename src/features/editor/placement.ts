import type { AppStore } from '../../state/store';
import { GEOMETRY } from '../../contracts/limits';
// EDITOR_INTERACTIONS: WebKit may discard custom drag MIME types across native drag transport.
export const NODE_DRAG_TYPE = 'application/flowcanvas-node';
export const NODE_DRAG_PREFIX = 'flowcanvas-node:';
export function editorPoint(store: AppStore) {
  const s = store.getState();
  if (s.canvasPoint) return s.canvasPoint;
  const frame = document.querySelector('.canvas-frame')?.getBoundingClientRect(),
    v = s.viewportOverlay ?? s.session.document.viewport;
  return {
    x: ((frame?.width ?? 600) / 2 - v.x) / v.zoom,
    y: ((frame?.height ?? 400) / 2 - v.y) / v.zoom,
  };
}
export function nodePosition(store: AppStore) {
  const p = editorPoint(store);
  return store.getState().grid
    ? {
        x: Math.round(p.x / GEOMETRY.GRID) * GEOMETRY.GRID,
        y: Math.round(p.y / GEOMETRY.GRID) * GEOMETRY.GRID,
      }
    : p;
}
