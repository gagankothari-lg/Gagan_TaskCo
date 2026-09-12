'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { setToken } from '../../lib/auth';

// Portal Phase 1 SSO handoff landing page. Portal (once it exists) mints a JWT in the
// same shape LGDesk already issues and redirects here with ?token=<jwt>. This page just
// stores the token and forces a full navigation (not router.push) to /dashboard so
// AuthProvider's bootstrap effect (auth-context.tsx) re-mounts and picks it up from
// localStorage like any other session restore -- no separate validation logic needed
// here, and an invalid/expired token degrades exactly like an expired session already
// does (cleared, bounced to /login) with zero special-casing.
function SsoCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      router.replace('/login');
      return;
    }
    setToken(token);
    window.location.href = '/dashboard';
  }, [searchParams, router]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="btn-spinner-dark" style={{ width: 28, height: 28 }} />
    </div>
  );
}

export default function SsoCallbackPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="btn-spinner-dark" style={{ width: 28, height: 28 }} />
        </div>
      }
    >
      <SsoCallbackInner />
    </Suspense>
  );
}
