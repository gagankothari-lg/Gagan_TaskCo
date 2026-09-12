// Short-lived client-side handoff for the Google-assisted registration path (Phase 6 Part
// 2): when /auth/google returns NO_ACCOUNT, the login page stashes the already-verified ID
// token here (sessionStorage -- cleared on tab close, never sent anywhere but this app) and
// redirects to /register, which reads it once and clears it. A query param would work too
// but leaks into browser history/referrer headers; sessionStorage doesn't.
const PENDING_GOOGLE_TOKEN_KEY = 'portal_pending_google_id_token';

export const setPendingGoogleIdToken = (t: string) =>
  typeof window !== 'undefined' && sessionStorage.setItem(PENDING_GOOGLE_TOKEN_KEY, t);

export const takePendingGoogleIdToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  const v = sessionStorage.getItem(PENDING_GOOGLE_TOKEN_KEY);
  if (v) sessionStorage.removeItem(PENDING_GOOGLE_TOKEN_KEY);
  return v;
};

// Decodes a JWT's payload for prefill purposes ONLY -- no signature check, never trusted as
// proof of identity client-side. The server independently re-verifies the same raw token via
// GoogleVerifyService before ever acting on it (Phase 3/4a).
export function decodeJwtPayloadUnsafe(token: string): Record<string, unknown> | null {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(escape(atob(base64))));
  } catch {
    return null;
  }
}
