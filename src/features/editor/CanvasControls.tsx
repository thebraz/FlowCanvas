import { useEffect, useRef, useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useAppStore } from '../../state/context';
import { Button } from '../../ui/primitives';
export function CanvasControls() {
  const settled = useAppStore((state) => state.session.document.viewport);
  const overlay = useAppStore((state) => state.viewportOverlay);
  const viewport = overlay ?? settled;
  const flow = useReactFlow();
  const selection = useAppStore((s) => s.selection);
  const alive = useRef(true);
  const [message, setMessage] = useState('');
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const navigate = (operation: () => Promise<boolean>) => {
    setMessage('');
    // Zero-duration library operations finish immediately; unmount invalidates feedback.
    void operation()
      .then((success) => {
        if (alive.current && !success) setMessage('Canvas navigation is unavailable. Try again.');
      })
      .catch(() => {
        if (alive.current) setMessage('Canvas navigation failed. Your workflow is unchanged.');
      });
  };
  const actions = [
    { name: 'Zoom out', text: '−', run: () => flow.zoomOut({ duration: 0 }) },
    { name: 'Zoom in', text: '+', run: () => flow.zoomIn({ duration: 0 }) },
    { name: 'Fit view', text: 'Fit view', run: () => flow.fitView({ padding: 0.15, duration: 0 }) },
    {
      name: 'Center selected',
      text: 'Center selected',
      run: () =>
        flow.fitView({
          nodes: flow.getNodes().filter((n) => selection.has(n.id)),
          padding: 0.3,
          duration: 0,
        }),
    },
    {
      name: 'Pan left',
      text: '←',
      run: () => flow.setViewport({ ...viewport, x: viewport.x + 80 }, { duration: 0 }),
    },
    {
      name: 'Pan right',
      text: '→',
      run: () => flow.setViewport({ ...viewport, x: viewport.x - 80 }, { duration: 0 }),
    },
    {
      name: 'Pan up',
      text: '↑',
      run: () => flow.setViewport({ ...viewport, y: viewport.y + 80 }, { duration: 0 }),
    },
    {
      name: 'Pan down',
      text: '↓',
      run: () => flow.setViewport({ ...viewport, y: viewport.y - 80 }, { duration: 0 }),
    },
  ];
  return (
    <div className="canvas-controls" aria-label="Canvas navigation">
      <label>
        Zoom %
        <input
          aria-label="Numeric zoom"
          className="zoom-input"
          type="number"
          min={25}
          max={200}
          value={Math.round(viewport.zoom * 100)}
          onChange={(e) => {
            const zoom = Number(e.target.value) / 100;
            if (zoom >= 0.25 && zoom <= 2)
              navigate(() => flow.setViewport({ ...viewport, zoom }, { duration: 0 }));
          }}
        />
      </label>
      {actions.map((action, i) => (
        <span key={action.name} className="canvas-control-item">
          {i === 1 && <output aria-label="Canvas zoom">{Math.round(viewport.zoom * 100)}%</output>}
          <Button
            aria-label={action.name}
            onClick={() => {
              navigate(action.run);
            }}
          >
            {action.text}
          </Button>
        </span>
      ))}
      {message && <p role="alert">{message}</p>}
    </div>
  );
}
