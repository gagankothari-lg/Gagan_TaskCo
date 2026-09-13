'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiError } from '../../lib/api';
import { useMe } from '../../lib/useMe';
import { isManager } from '../../lib/auth';
import { PortalShell } from '../../components/PortalShell';

interface ProfileUpdateRequest {
  reqId: string;
  empId: string;
  changes: string;
  status: string;
  createdAt: string;
}

const FIELD_LABELS: Record<string, string> = {
  firstName: 'First name',
  lastName: 'Last name',
  designation: 'Designation',
  team: 'Team',
  subDepartment: 'Sub-department',
  dob: 'Date of birth',
  newManagerEmail: 'New manager',
};

function parseChanges(raw: string): [string, string][] {
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    return Object.entries(obj).map(([k, v]) => [FIELD_LABELS[k] ?? k, String(v)]);
  } catch {
    return [];
  }
}

// P27: real UI (was plain text, Phase 5b), gated the same way as the registration
// approval screen -- see that page's header comment for the gating rationale.
export default function ProfileUpdatesApprovalPage() {
  const { me, loading } = useMe();
  const router = useRouter();

  useEffect(() => {
    if (!loading && me && !isManager(me.role)) router.replace('/dashboard');
  }, [loading, me, router]);

  if (loading || !me || !isManager(me.role)) return null;

  return (
    <PortalShell me={me} title="Profile Update Approvals">
      <ApprovalQueue />
    </PortalShell>
  );
}

function ApprovalQueue() {
  const [requests, setRequests] = useState<ProfileUpdateRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<ProfileUpdateRequest | null>(null);
  const [notes, setNotes] = useState('');

  async function load() {
    setError(null);
    try {
      setRequests(await apiFetch<ProfileUpdateRequest[]>('/profile-updates'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load requests');
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onApprove(r: ProfileUpdateRequest) {
    setBusyId(r.reqId);
    try {
      await apiFetch(`/profile-updates/${r.reqId}/approve`, { method: 'POST' });
      await load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Unable to approve');
    } finally {
      setBusyId(null);
    }
  }

  async function onConfirmReject() {
    if (!rejecting) return;
    setBusyId(rejecting.reqId);
    try {
      await apiFetch(`/profile-updates/${rejecting.reqId}/reject`, { method: 'POST', body: { notes: notes || undefined } });
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
      {!error && requests !== null && pending.length === 0 && <div className="empty-state">No pending profile-update requests.</div>}

      <div className="grid gap-3">
        {pending.map((r) => (
          <div key={r.reqId} className="card p-4">
            <div className="font-semibold text-text">{r.empId}</div>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              {parseChanges(r.changes).map(([label, value]) => (
                <div key={label} className="flex gap-1">
                  <dt className="text-muted">{label}:</dt>
                  <dd className="text-text font-medium">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="flex gap-2 mt-3">
              <button className="btn btn-accent" disabled={busyId === r.reqId} onClick={() => onApprove(r)}>Approve</button>
              <button className="btn btn-danger" disabled={busyId === r.reqId} onClick={() => { setNotes(''); setRejecting(r); }}>Reject</button>
            </div>
          </div>
        ))}
      </div>

      {rejecting && (
        <div className="modal-bg">
          <div className="modal">
            <div className="modal-hd">Reject change for {rejecting.empId}?</div>
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
              <button className="btn btn-danger" disabled={busyId === rejecting.reqId} onClick={onConfirmReject}>Reject</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
