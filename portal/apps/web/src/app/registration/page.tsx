'use client';

import { useEffect, useState } from 'react';
import { apiFetch, ApiError, getToken, setToken, clearToken } from '../../lib/api';

interface RegistrationRequest {
  regId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  team: string | null;
  subDepartment: string | null;
  designation: string | null;
  managerId: string | null;
  status: string;
  googleSub: string | null;
  googleEmail: string | null;
  createdAt: string;
}

// Functional, not polished (Phase 4b) -- the real login page is Phase 6. Logs in inline
// on this same page so a manager/admin can actually reach and use the approval queue today.
export default function RegistrationApprovalPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setLoggedIn(!!getToken());
    setChecked(true);
  }, []);

  if (!checked) return null;
  return loggedIn ? <ApprovalQueue onLogout={() => setLoggedIn(false)} /> : <LoginForm onLoggedIn={() => setLoggedIn(true)} />;
}

function LoginForm({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { token } = await apiFetch<{ token: string }>('/auth/login', { method: 'POST', body: { email, password } });
      setToken(token);
      onLoggedIn();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to sign in');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <form onSubmit={onSubmit} style={{ width: 320, padding: 24, border: '1px solid #ddd', borderRadius: 8 }}>
        <h1 style={{ fontSize: 18, marginBottom: 16 }}>Portal — Sign in</h1>
        <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>Manager/Admin sign-in to review registration requests.</p>
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
    </main>
  );
}

function ApprovalQueue({ onLogout }: { onLogout: () => void }) {
  const [requests, setRequests] = useState<RegistrationRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<RegistrationRequest | null>(null);
  const [notes, setNotes] = useState('');

  async function load() {
    setError(null);
    try {
      const data = await apiFetch<RegistrationRequest[]>('/registration');
      setRequests(data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearToken();
        onLogout();
        return;
      }
      setError(err instanceof ApiError ? err.message : 'Unable to load requests');
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onApprove(r: RegistrationRequest) {
    if (!confirm(`Approve ${r.firstName} ${r.lastName}'s registration and create their employee account?`)) return;
    setBusyId(r.regId);
    try {
      const { empId } = await apiFetch<{ empId: string }>(`/registration/${r.regId}/approve`, { method: 'POST' });
      alert(`Approved — Employee ID ${empId}`);
      await load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Unable to approve');
    } finally {
      setBusyId(null);
    }
  }

  async function onConfirmReject() {
    if (!rejecting) return;
    setBusyId(rejecting.regId);
    try {
      await apiFetch(`/registration/${rejecting.regId}/reject`, { method: 'POST', body: { notes: notes || undefined } });
      setRejecting(null);
      setNotes('');
      await load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Unable to reject');
    } finally {
      setBusyId(null);
    }
  }

  const pending = (requests ?? []).filter((r) => r.status === 'Pending');

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20 }}>Pending Registration Requests</h1>
        <button
          onClick={() => {
            clearToken();
            onLogout();
          }}
          style={{ fontSize: 13, background: 'none', border: '1px solid #ddd', borderRadius: 6, padding: '6px 12px', cursor: 'pointer' }}
        >
          Log out
        </button>
      </div>

      {error && <p style={{ color: '#c62828' }}>{error}</p>}
      {!error && requests === null && <p>Loading…</p>}
      {!error && requests !== null && pending.length === 0 && <p style={{ color: '#666' }}>No pending requests.</p>}

      {pending.map((r) => (
        <div key={r.regId} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 600 }}>
                {r.firstName} {r.lastName}
              </div>
              <div style={{ fontSize: 13, color: '#666' }}>{r.email}</div>
            </div>
            <span style={{ fontSize: 12, background: '#e8eaf6', color: '#1a237e', borderRadius: 12, padding: '2px 10px', height: 'fit-content' }}>{r.role}</span>
          </div>
          <div style={{ fontSize: 13, color: '#666', marginTop: 8 }}>
            {r.team ?? '—'}
            {r.subDepartment ? ` (${r.subDepartment})` : ''}
            {r.designation ? ` · ${r.designation}` : ''}
            {r.googleSub ? ' · Google-linked' : ''}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              onClick={() => onApprove(r)}
              disabled={busyId === r.regId}
              style={{ padding: '6px 14px', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
            >
              Approve
            </button>
            <button
              onClick={() => {
                setNotes('');
                setRejecting(r);
              }}
              disabled={busyId === r.regId}
              style={{ padding: '6px 14px', background: '#c62828', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
            >
              Reject
            </button>
          </div>
        </div>
      ))}

      {rejecting && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 8, padding: 20, width: 360 }}>
            <h3 style={{ marginBottom: 8 }}>
              Reject {rejecting.firstName} {rejecting.lastName}?
            </h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Reason (optional)"
              style={{ width: '100%', boxSizing: 'border-box', padding: 8, marginBottom: 12 }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setRejecting(null)} style={{ padding: '6px 14px', border: '1px solid #ddd', borderRadius: 6, background: 'none', cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                onClick={onConfirmReject}
                disabled={busyId === rejecting.regId}
                style={{ padding: '6px 14px', background: '#c62828', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
