import { useEffect, useState } from 'react';
import type { RunStatus } from '../../contracts/session';
const ROUTINE_ANNOUNCEMENT_MS = 1000; // docs/ACCESSIBILITY.md: at most one routine announcement per second.
export function RunAnnouncement({ status }: { readonly status: RunStatus }) {
  const [routine, setRoutine] = useState(status);
  const immediate = ['idle', 'completed', 'failed', 'cancelled'].includes(status);
  useEffect(() => {
    if (immediate) return;
    const timer = setTimeout(() => setRoutine(status), ROUTINE_ANNOUNCEMENT_MS);
    return () => clearTimeout(timer);
  }, [status, immediate]);
  return (
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      Execution {immediate ? status : routine}
    </div>
  );
}
