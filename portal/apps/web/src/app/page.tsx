'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiError, getToken, setToken } from '../lib/api';
import { setPendingGoogleIdToken } from '../lib/session';
import { GoogleSignInButton } from '../components/GoogleSignInButton';

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
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ width: 320, padding: 24, border: '1px solid #ddd', borderRadius: 8 }}>
        <h1 style={{ fontSize: 20, marginBottom: 4, color: '#1a237e' }}>Portal</h1>
        <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>Sign in to access LG Desk and other tools.</p>

        <form onSubmit={onSubmit}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: '100%', padding: 8, marginBottom: 8, boxSizing: 'border-box' }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: '100%', padding: 8, marginBottom: 12, boxSizing: 'border-box' }}
          />
          {error && <p style={{ color: '#c62828', fontSize: 13, marginBottom: 12 }}>{error}</p>}
          <button type="submit" disabled={busy} style={{ width: '100%', padding: 9, background: '#1a237e', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
            {busy ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '16px 0' }}>
          <div style={{ flex: 1, height: 1, background: '#eee' }} />
          <span style={{ fontSize: 12, color: '#999' }}>or</span>
          <div style={{ flex: 1, height: 1, background: '#eee' }} />
        </div>

        <GoogleSignInButton onCredential={onGoogleCredential} />

        <p style={{ fontSize: 13, color: '#666', marginTop: 16, textAlign: 'center' }}>
          New here? <a href="/register" style={{ color: '#1a237e' }}>Register →</a>
        </p>
      </div>
    </main>
  );
}
