import { useCallback, useSyncExternalStore } from 'react';
export function useMedia(query: string): boolean {
  const subscribe = useCallback(
    (listener: () => void) => {
      const media = matchMedia(query);
      media.addEventListener('change', listener);
      return () => {
        media.removeEventListener('change', listener);
      };
    },
    [query],
  );
  const getSnapshot = useCallback(() => matchMedia(query).matches, [query]);
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
