'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { apiFetch } from './client';
import type { InitialPayload, LoginResponse } from '../types';

// ─── Fetchers ───────────────────────────────────────
// Consumed directly by AuthContext (login/session bootstrap live outside
// react-query — they drive context state, not a cached query).

export function login(email: string, password: string): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/auth/login', { method: 'POST', body: { email, password } });
}

export function logout(): Promise<void> {
  return apiFetch<void>('/auth/logout', { method: 'POST' });
}

/** Bootstrap payload for the signed-in user: profile + tasks/projects/functions/etc. */
export function fetchMe(): Promise<InitialPayload> {
  return apiFetch<InitialPayload>('/auth/me');
}

export function requestPasswordReset(email: string): Promise<void> {
  return apiFetch<void>('/auth/password-reset/request', { method: 'POST', body: { email } });
}

export interface ConfirmPasswordResetInput {
  email: string;
  otp: string;
  newPassword: string;
}

export function confirmPasswordReset(dto: ConfirmPasswordResetInput): Promise<void> {
  return apiFetch<void>('/auth/password-reset/confirm', { method: 'POST', body: dto });
}

export interface RegisterRequestInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: string;
  team?: string;
  subDepartment?: string;
  designation?: string;
  // Round4 S4: only honored server-side for Super Admin/Admin/Team Captain applicants
  // (MANUAL_MANAGER_ROLES) -- see register-request.dto.ts / users.service.ts.
  managerEmail?: string;
}

export function registerRequest(dto: RegisterRequestInput): Promise<void> {
  return apiFetch<void>('/auth/register/request', { method: 'POST', body: dto });
}

export interface TeamCaptain {
  email: string;
  name: string;
}

/**
 * Resolves the manager who will review a registration request for a given Team Division
 * (+ optional Sub-Department) — mirrors reference/auth.gs's getTeamCaptainByTeam (public,
 * no auth required, since this is called before the applicant has an account): sub-dept
 * Team Captain -> team-wide Team Captain -> any active Super Admin -> any active Admin ->
 * null (nobody found at all).
 */
export function getTeamCaptain(team: string, subDept?: string): Promise<TeamCaptain | null> {
  return apiFetch<TeamCaptain | null>('/auth/team-captain', { params: { team, subDept } });
}

/** Auto-fill lookup for the Registration form's Manager's Email field (TM/TF/Intern roles only). */
export function useTeamCaptain(team: string, subDept: string, enabled: boolean) {
  return useQuery({
    queryKey: ['team-captain', team, subDept],
    queryFn: () => getTeamCaptain(team, subDept),
    enabled: enabled && !!team,
    staleTime: 30_000,
  });
}

// ─── Mutations ──────────────────────────────────────
export function useChangePassword() {
  return useMutation({
    mutationFn: ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) =>
      apiFetch<void>('/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } }),
  });
}
