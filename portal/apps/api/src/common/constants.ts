// Ported from LGDesk's apps/api/src/common/constants.ts (only what Portal's registration
// flow needs) -- keep in lockstep if either ever changes.
export const ALL_ROLES = ['Super Admin', 'Admin', 'Team Captain', 'Team Facilitator', 'Team Member', 'Intern'] as const;

// Roles that type in who they report to on the registration form (Round4 S4) --
// every other role's manager is resolved exclusively via the team/sub-department lookup.
export const MANUAL_MANAGER_ROLES = ['Super Admin', 'Admin', 'Team Captain'] as const;
