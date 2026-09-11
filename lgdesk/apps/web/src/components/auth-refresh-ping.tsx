'use client';

import { useEffect } from 'react';
import { useAuth } from '../hooks/use-auth';

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

// Modeled on keep-alive-ping.tsx. Replaces the navbar Refresh button (P11) as the
// only remaining path that keeps the initial-payload badge counts (pending leave /
// pending DDR) and global tasks/projects/employees/functions lists from going stale
// — QueryClient has refetchOnWindowFocus disabled and this payload isn't a TanStack
// Query at all, so nothing else refetches it automatically. Unlike KeepAlivePing,
// this does NOT fire immediately on mount — AuthProvider's own bootstrap effect
// already just fetched this exact payload.
export function AuthRefreshPing() {
  const { refresh } = useAuth();

  useEffect(() => {
    const id = setInterval(() => {
      refresh().catch(() => {});
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
