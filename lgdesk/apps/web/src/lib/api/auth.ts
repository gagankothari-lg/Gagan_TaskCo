'use client';

import { apiFetch } from './client';
import type { InitialPayload } from '../types';

// ─── Fetchers ───────────────────────────────────────
// Consumed directly by AuthContext (session bootstrap lives outside react-query — it
// drives context state, not a cached query). Login itself is Portal's job now (Phase
// 7b) -- a session only ever starts here via /sso-callback picking up a token Portal
// minted.

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
