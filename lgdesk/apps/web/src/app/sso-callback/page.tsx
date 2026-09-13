'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { setToken } from '../../lib/auth';
import { redirectToPortalLogin } from '../../lib/portal';

// Portal SSO handoff landing page. Portal mints a JWT in the same shape LGDesk already
// issues and redirects here with ?token=<jwt>. This page just stores the token and
// forces a full navigation (not router.push) to /dashboard so AuthProvider's bootstrap
// effect (auth-context.tsx) re-mounts and picks it up from localStorage like any other
// session restore -- no separate validation logic needed here, and an invalid/expired
// token degrades exactly like an expired session already does (cleared, bounced back to
// Portal -- Phase 7b, LGDesk no longer has its own login) with zero special-casing.
function SsoCallbackInner() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      redirectToPortalLogin();
      return;
    }
    setToken(token);
    window.location.href = '/dashboard';
  }, [searchParams]);

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
