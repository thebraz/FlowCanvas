import { createContext, useContext, type ReactNode } from 'react';
import { useStore } from 'zustand';
import type { AppState, AppStore } from './store';
const StoreContext = createContext<AppStore | null>(null);
export function StoreProvider({
  store,
  children,
}: {
  readonly store: AppStore;
  readonly children: ReactNode;
}) {
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}
export function useAppStore<T>(selector: (state: AppState) => T): T {
  const store = useContext(StoreContext);
  if (!store) throw new Error('Application store is unavailable');
  return useStore(store, selector);
}
export function useStoreApi(): AppStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error('Application store is unavailable');
  return store;
}
