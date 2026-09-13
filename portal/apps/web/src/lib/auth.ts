// Same role tiers as LGDesk's apps/web/src/lib/auth.ts and both apps' backend
// common/constants.ts -- one source of truth for the tier names, copied (not imported;
// Portal and LGDesk are separate standalone apps with no shared package).
export const MANAGER_ROLES = ['Super Admin', 'Admin', 'Team Captain', 'Team Facilitator'] as const;

export const isManager = (role?: string | null): boolean =>
  !!role && (MANAGER_ROLES as readonly string[]).includes(role);
