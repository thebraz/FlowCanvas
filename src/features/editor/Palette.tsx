import { useState } from 'react';
import { NODE_REGISTRY, NODE_TYPES } from '../../contracts/workflow';
import { NODE_ICONS } from '../../ui/node-catalog';
import { Region, Button } from '../../ui/primitives';
import { useStoreApi, useAppStore } from '../../state/context';
import { isActiveRun } from '../../contracts/execution';
import { errorMessage } from '../../ui/messages';
import { nodePosition, NODE_DRAG_TYPE, NODE_DRAG_PREFIX } from './placement';
export function Palette() {
  const [search, setSearch] = useState('');
  const store = useStoreApi();
  const locked = useAppStore((s) => isActiveRun(s.runtime.status));
  const filtered = NODE_TYPES.filter((type) =>
    NODE_REGISTRY[type].title.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <Region title="Node palette" id="palette-heading" className="palette">
      <label htmlFor="palette-search">Find a node type</label>
      <input
        id="palette-search"
        type="search"
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
        }}
        placeholder="Search nodes…"
      />
      <ul className="catalog-list">
        {filtered.map((type) => {
          const Icon = NODE_ICONS[type];
          const entry = NODE_REGISTRY[type];
          return (
            <li key={type}>
              <span className="node-icon">
                <Icon size={18} aria-hidden="true" />
              </span>
              <div>
                <strong>{entry.title}</strong>
                <p>{entry.description}</p>
                <Button
                  disabled={locked && type !== 'note'}
                  title={
                    locked && type !== 'note'
                      ? 'Stop execution before adding executable nodes'
                      : undefined
                  }
                  draggable={!locked}
                  onDragStart={(event) => {
                    event.dataTransfer.setData(NODE_DRAG_TYPE, type);
                    event.dataTransfer.setData('text/plain', NODE_DRAG_PREFIX + type);
                    event.dataTransfer.effectAllowed = 'copy';
                  }}
                  onClick={() => {
                    store.getState().request(() => {
                      const s = store.getState();
                      const position = nodePosition(store);
                      const result = s.dispatch(s.session.sessionId, {
                        type: 'CreateNode',
                        nodeType: type,
                        position,
                      });
                      if (!result.ok) s.announce(errorMessage(result.error));
                      else document.getElementById('inspector-heading')?.focus();
                    });
                  }}
                >
                  Add {entry.title}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      {filtered.length === 0 && <p role="status">No matching node types.</p>}
      <p className="scope-note">Add a node or drag its Add button onto the canvas.</p>
    </Region>
  );
}
