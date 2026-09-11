'use client';

import { useEffect } from 'react';
import { useAuth } from '../hooks/use-auth';

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

// Modeled on keep-alive-ping.tsx. Keeps the initial-payload badge counts (pending
// leave / pending DDR) and global tasks/projects/employees/functions lists from
// going stale — this payload is a plain useState in auth-context.tsx, not a
// TanStack Query, so it doesn't benefit from that QueryClient's
// refetchOnWindowFocus (P12 hotfix) and needs the same "silently re-check when you
// come back to this tab" behavior wired up by hand here.
//
// Two paths, same job:
//   1. tab/window regains focus -> refresh immediately (mirrors refetchOnWindowFocus)
//   2. tab stays focused/open for a long stretch -> a 5-minute interval backstop
// Unlike KeepAlivePing, neither path fires immediately on mount -- AuthProvider's
// own bootstrap effect already just fetched this exact payload, and this component
// only ever mounts post-login (inside the authenticated dashboard shell), so a
// valid token is always in scope for as long as it's alive.
export function AuthRefreshPing() {
  const { refresh } = useAuth();

  useEffect(() => {
    const silentRefresh = () => {
      refresh().catch(() => {});
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') silentRefresh();
    };

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', silentRefresh);
    const id = setInterval(silentRefresh, REFRESH_INTERVAL_MS);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', silentRefresh);
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
