'use client';

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

// Change-password retired from LGDesk in P21 (Phase 5b) -- Portal's POST /auth/
// change-password is now the only place this action exists.
