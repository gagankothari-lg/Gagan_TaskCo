'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiError } from '../../lib/api';
import { useMe } from '../../lib/useMe';
import { isManager } from '../../lib/auth';
import { PortalShell } from '../../components/PortalShell';

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

// P27: real UI (was plain text, Phase 4b), and gated -- a non-manager is redirected
// straight to /dashboard rather than seeing this page at all. The API itself already
// enforces this (MANAGER_ROLES route guard, Phase 4b) -- this is the frontend catching
// up so the experience matches, not a new authorization boundary.
export default function RegistrationApprovalPage() {
  const { me, loading } = useMe();
  const router = useRouter();

  useEffect(() => {
    if (!loading && me && !isManager(me.role)) router.replace('/dashboard');
  }, [loading, me, router]);

  if (loading || !me || !isManager(me.role)) return null;

  return (
    <PortalShell me={me} title="Registration Approvals">
      <ApprovalQueue />
    </PortalShell>
  );
}

function ApprovalQueue() {
  const [requests, setRequests] = useState<RegistrationRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<RegistrationRequest | null>(null);
  const [notes, setNotes] = useState('');

  async function load() {
    setError(null);
    try {
      setRequests(await apiFetch<RegistrationRequest[]>('/registration'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load requests');
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onApprove(r: RegistrationRequest) {
    setBusyId(r.regId);
    try {
      await apiFetch<{ empId: string }>(`/registration/${r.regId}/approve`, { method: 'POST' });
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
    <>
      {error && <p className="text-danger text-sm mb-4">{error}</p>}
      {!error && requests === null && <p className="text-muted text-sm">Loading…</p>}
      {!error && requests !== null && pending.length === 0 && <div className="empty-state">No pending registration requests.</div>}

      <div className="grid gap-3">
        {pending.map((r) => (
          <div key={r.regId} className="card p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-semibold text-text">{r.firstName} {r.lastName}</div>
                <div className="text-sm text-muted">{r.email}</div>
              </div>
              <span className={`pill pill-${r.role.replace(/ /g, '-')}`}>{r.role}</span>
            </div>
            <div className="text-sm text-muted mt-2">
              {r.team ?? '—'}
              {r.subDepartment ? ` (${r.subDepartment})` : ''}
              {r.designation ? ` · ${r.designation}` : ''}
              {r.googleSub ? ' · Google-linked' : ''}
            </div>
            <div className="flex gap-2 mt-3">
              <button className="btn btn-accent" disabled={busyId === r.regId} onClick={() => onApprove(r)}>Approve</button>
              <button className="btn btn-danger" disabled={busyId === r.regId} onClick={() => { setNotes(''); setRejecting(r); }}>Reject</button>
            </div>
          </div>
        ))}
      </div>

      {rejecting && (
        <div className="modal-bg">
          <div className="modal">
            <div className="modal-hd">Reject {rejecting.firstName} {rejecting.lastName}?</div>
            <div className="modal-bd">
              <textarea
                className="fc"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Reason (optional)"
              />
            </div>
            <div className="modal-ft">
              <button className="btn btn-ghost" onClick={() => setRejecting(null)}>Cancel</button>
              <button className="btn btn-danger" disabled={busyId === rejecting.regId} onClick={onConfirmReject}>Reject</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
