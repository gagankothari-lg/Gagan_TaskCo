'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiError, getToken, setToken } from '../lib/api';
import { setPendingGoogleIdToken } from '../lib/session';
import { GoogleSignInButton } from '../components/GoogleSignInButton';

// P26: forgot-password stayed on LGDesk (P25) rather than being rebuilt here -- Portal
// has no reset flow of its own yet, and the account being reset lives in the shared
// `users` table LGDesk owns. Renders nothing if unset (same convention as
// GoogleSignInButton's GOOGLE_OAUTH_CLIENT_ID gate) rather than link to a relative path
// that doesn't exist on this app. P27: restyled as part of the card (next to the
// Password label) instead of a stray link under the button, so the handoff into
// LGDesk's reset flow reads as one product, not an obvious jump to a different site.
const LGDESK_URL = process.env.NEXT_PUBLIC_LGDESK_URL;

// Portal's real front door (Phase 6) -- replaces the placeholder from Phase 2. Token
// storage mirrors LGDesk's apps/web/src/lib/auth.ts pattern exactly (localStorage, one
// key), just Portal's own key ('portal_token', set up back in Phase 4b's lib/api.ts).
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (getToken()) router.replace('/dashboard');
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { token } = await apiFetch<{ token: string }>('/auth/login', { method: 'POST', body: { email, password } });
      setToken(token);
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to sign in');
    } finally {
      setBusy(false);
    }
  }

  async function onGoogleCredential(idToken: string) {
    setError(null);
    try {
      const { token } = await apiFetch<{ token: string }>('/auth/google', { method: 'POST', body: { idToken } });
      setToken(token);
      router.replace('/dashboard');
    } catch (err) {
      if (err instanceof ApiError && err.status === 404 && err.code === 'NO_ACCOUNT') {
        // No existing account for this Google identity -- carry the already-verified token
        // through to registration so the person doesn't have to prove it twice.
        setPendingGoogleIdToken(idToken);
        router.push('/register');
        return;
      }
      setError(err instanceof ApiError ? err.message : 'Unable to sign in with Google');
    }
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg,#2D3E51 0%,#2F6E68 100%)' }}
    >
      <div className="card w-full max-w-sm p-8">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-p">Portal</h1>
          <p className="text-sm text-muted mt-1">Sign in to access LG Desk and other tools.</p>
        </div>

        <form onSubmit={onSubmit}>
          <div className="fg">
            <label>Email</label>
            <input className="fc" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="fg">
            <div className="flex items-center justify-between">
              <label>Password</label>
              {LGDESK_URL && (
                <a href={`${LGDESK_URL}/forgot-password`} className="text-[11px] font-semibold text-p2 hover:underline normal-case tracking-normal">
                  Forgot password?
                </a>
              )}
            </div>
            <input className="fc" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <p className="text-danger text-sm mb-3">{error}</p>}
          <button type="submit" disabled={busy} className="btn btn-primary btn-full">
            {busy && <span className="btn-spinner" />}
            {busy ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div className="flex items-center gap-2 my-4">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted2">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <GoogleSignInButton onCredential={onGoogleCredential} />

        <p className="text-sm text-muted mt-4 text-center">
          New here? <a href="/register" className="text-p font-semibold hover:underline">Register →</a>
        </p>
      </div>
    </main>
  );
}
