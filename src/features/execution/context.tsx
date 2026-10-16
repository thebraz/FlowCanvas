import { createContext, useContext, useEffect, type ReactNode } from 'react';
import type { RunCoordinator } from '../../application/execution';
const ExecutionContext = createContext<RunCoordinator | null>(null);
export function ExecutionProvider({
  coordinator,
  children,
}: {
  readonly coordinator: RunCoordinator;
  readonly children: ReactNode;
}) {
  useEffect(() => {
    const visible = () => {
      if (document.visibilityState === 'visible') coordinator.checkDeadlines();
    };
    document.addEventListener('visibilitychange', visible);
    return () => document.removeEventListener('visibilitychange', visible);
  }, [coordinator]);
  return <ExecutionContext.Provider value={coordinator}>{children}</ExecutionContext.Provider>;
}
export const useExecution = () => useContext(ExecutionContext);
