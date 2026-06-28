export const getToken = () =>
  typeof window !== 'undefined' ? localStorage.getItem('lgdesk_token') : null;

export const setToken = (token: string) =>
  typeof window !== 'undefined' && localStorage.setItem('lgdesk_token', token);

export const removeToken = () =>
  typeof window !== 'undefined' && localStorage.removeItem('lgdesk_token');

export interface AuthUser {
  empId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  team?: string;
}

// ─── Role helpers (mirror of apps/api/src/common/constants.ts) ──────────────
export const ADMIN_ROLES = ['Super Admin', 'Admin'] as const;
export const MANAGER_ROLES = ['Super Admin', 'Admin', 'Team Captain', 'Team Facilitator'] as const;

export const isAdmin = (role?: string | null): boolean =>
  !!role && (ADMIN_ROLES as readonly string[]).includes(role);

export const isManager = (role?: string | null): boolean =>
  !!role && (MANAGER_ROLES as readonly string[]).includes(role);
