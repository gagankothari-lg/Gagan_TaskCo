'use client';

import { useMutation } from '@tanstack/react-query';
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
  team?: string;
  subDepartment?: string;
  designation?: string;
}

export function registerRequest(dto: RegisterRequestInput): Promise<void> {
  return apiFetch<void>('/auth/register/request', { method: 'POST', body: dto });
}

// ─── Mutations ──────────────────────────────────────
export function useChangePassword() {
  return useMutation({
    mutationFn: ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) =>
      apiFetch<void>('/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } }),
  });
}
