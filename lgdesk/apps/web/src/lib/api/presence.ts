'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';

export type PresenceStatus = 'online' | 'away' | 'dnd' | 'offline';
export type PresenceMap = Record<string, PresenceStatus>;

// Round6 #12. Kept in lockstep with apps/api/src/presence/presence.constants.ts --
// heartbeat cadence matches the reference (presence.gs / app.js.html PRES_PING_MS,
// both 3 min) exactly; idle-to-away also matches the reference's PRES_IDLE_MS (5 min).
export const HEARTBEAT_MS = 3 * 60 * 1000;
export const IDLE_MS = 5 * 60 * 1000;
// How often the Directory page re-polls everyone else's presence -- faster than the
// reference's 60s refresh (app.js.html's _PRES_REF_IV) for a livelier feel; well under
// the backend's 9-min staleness window so a real status change reliably shows up long
// before staleness would ever kick in on its own.
export const PRESENCE_POLL_MS = 30_000;

/** Poll everyone's current presence (staleness-adjusted server-side). */
export function usePresenceMap(enabled = true) {
  return useQuery({
    queryKey: ['presence'],
    queryFn: () => apiFetch<PresenceMap>('/presence'),
    enabled,
    refetchInterval: PRESENCE_POLL_MS,
    staleTime: PRESENCE_POLL_MS,
  });
}

/** Bare call (no status) = heartbeat only. With `status` = explicit user-picked change. */
export function useSetPresence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (status?: PresenceStatus) =>
      apiFetch<{ status: PresenceStatus; updatedAt: string }>('/presence', {
        method: 'PATCH',
        body: status ? { status } : undefined,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['presence'] }),
  });
}
