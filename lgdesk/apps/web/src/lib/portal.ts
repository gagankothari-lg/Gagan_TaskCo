// Portal Phase 7b: LGDesk no longer offers its own login — every unauthenticated visitor,
// every session-expiry, and every SSO-callback failure sends the user to Portal instead.
// Portal's login page is Portal's own app root ("/"), reached via a full page navigation
// (not router.push) since it's a different origin entirely.
export const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL || 'http://localhost:3003';

export function redirectToPortalLogin(): void {
  if (typeof window !== 'undefined') window.location.href = PORTAL_URL;
}
