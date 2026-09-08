// Round6 #12: matches presence.gs:22's status vocabulary and the web's existing
// PresKey type (layout-client.tsx) exactly -- reused, not reinvented.
export const PRESENCE_STATUSES = ['online', 'away', 'dnd', 'offline'] as const;
export type PresenceStatus = (typeof PRESENCE_STATUSES)[number];

// Heartbeat cadence matches the reference exactly (presence.gs PRES_PING_MS / app.js.html
// PRES_PING_MS, both 3 min). Staleness window is 3x the heartbeat (9 min) rather than the
// ticket's suggested 2x floor -- close to the reference's own 10-min PRES_EXPIRE_MS, and
// comfortably above 2x so one delayed/throttled heartbeat tick (e.g. a backgrounded browser
// tab) doesn't flicker someone to "offline" while they're still genuinely present.
export const HEARTBEAT_MS = 3 * 60 * 1000;
export const STALE_MS = HEARTBEAT_MS * 3;
