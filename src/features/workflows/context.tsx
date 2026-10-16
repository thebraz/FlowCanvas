import { createContext, useContext, type ReactNode } from 'react';
import type { PersistenceCoordinator } from '../../application/persistence';
const Context = createContext<PersistenceCoordinator | null>(null);
export function PersistenceProvider({
  coordinator,
  children,
}: {
  readonly coordinator: PersistenceCoordinator;
  readonly children: ReactNode;
}) {
  return <Context.Provider value={coordinator}>{children}</Context.Provider>;
}
export function usePersistence() {
  return useContext(Context);
}
