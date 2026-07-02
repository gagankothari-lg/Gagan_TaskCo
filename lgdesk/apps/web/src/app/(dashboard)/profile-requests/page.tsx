'use client';

import { useMemo, useState } from 'react';
import { Icon } from '../../../components/ui/icon';
import { useAuth } from '../../../hooks/use-auth';
import {
  useProfileRequests,
  useUsers,
  useApproveProfileUpdate,
  useRejectProfileUpdate,
} from '../../../lib/api/teamMembers';
import { isManager } from '../../../lib/auth';
import { apiErrorMessage } from '../../../lib/api/client';
import { toast } from '../../../lib/toast';
import { Spinner } from '../../../components/ui/spinner';

const FIELD_LABELS: Record<string, string> = {
  firstName: 'First name',
  lastName: 'Last name',
  designation: 'Designation',
  team: 'Team',
  subDepartment: 'Sub-department',
  dob: 'Date of birth',
};

function describeChanges(raw: string): { label: string; value: string }[] {
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    return Object.entries(obj).map(([k, v]) => ({
      label: FIELD_LABELS[k] ?? k,
      value: String(v),
    }));
  } catch {
    return [];
  }
}

export default function ProfileRequestsPage() {
  const { currentUser } = useAuth();
  const { data: rows, isLoading, error } = useProfileRequests();
  const { data: users } = useUsers();
  const approve = useApproveProfileUpdate();
  const reject = useRejectProfileUpdate();

  const [rejecting, setRejecting] = useState<{ reqId: string; name: string } | null>(null);
  const [notes, setNotes] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const nameByEmpId = useMemo(() => {
    const map = new Map<string, string>();
    (users ?? []).forEach((u) => map.set(u.empId, `${u.firstName} ${u.lastName}`));
    return map;
  }, [users]);

  if (!currentUser) return null;
  if (!isManager(currentUser.role)) {
    return (
      <div className="p-6">
        <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--muted)]">
          You don&apos;t have access to this page.
        </div>
      </div>
    );
  }

  const pending = (rows ?? []).filter((r) => r.status === 'Pending');

  async function onApprove(reqId: string) {
    if (!confirm('Approve this profile change request?')) return;
    setActionError(null);
    try {
      await approve.mutateAsync(reqId);
      toast('Profile change approved', 'success');
    } catch (err) {
      setActionError(apiErrorMessage(err, 'Unable to approve'));
    }
  }

  async function onConfirmReject() {
    if (!rejecting) return;
    setActionError(null);
    try {
      await reject.mutateAsync({ reqId: rejecting.reqId, notes: notes || undefined });
      setRejecting(null);
      setNotes('');
      toast('Profile change rejected', 'success');
    } catch (err) {
      setActionError(apiErrorMessage(err, 'Unable to reject'));
    }
  }

  return (
    <div className="p-6">
      <h1 className="mb-1 text-xl font-semibold text-[var(--text)]">Profile Requests</h1>
      <p className="mb-5 text-sm text-[var(--muted)]">Approve or reject employee profile change requests.</p>

      {actionError && (
        <div className="mb-4 rounded-[8px] border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
          {actionError}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-[var(--muted)]"><Spinner size={16} /> Loading…</div>
      ) : error ? (
        <div className="text-sm text-[var(--danger)]">{apiErrorMessage(error, 'Failed to load profile requests')}</div>
      ) : pending.length === 0 ? (
        <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--muted)]">
          No pending profile requests.
        </div>
      ) : (
        <div className="overflow-hidden rounded-[8px] border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--surface)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
                <th className="px-3 py-2.5">Employee</th>
                <th className="px-3 py-2.5">Requested change</th>
                <th className="px-3 py-2.5">Date</th>
                <th className="px-3 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((r) => {
                const changes = describeChanges(r.changes);
                const empName = nameByEmpId.get(r.empId) ?? r.empId;
                return (
                  <tr key={r.reqId} className="border-t border-[var(--border)] bg-[var(--surface)] align-top">
                    <td className="px-3 py-2.5 text-[var(--text)]">
                      {empName}
                      <div className="font-mono text-xs text-[var(--muted)]">{r.empId}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-col gap-1">
                        {changes.length === 0 ? (
                          <span className="text-[var(--muted)]">—</span>
                        ) : (
                          changes.map((c) => (
                            <span key={c.label} className="text-[var(--muted)]">
                              <span className="text-[var(--text)]">{c.label}:</span> {c.value}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-[var(--muted)]">{new Date(r.createdAt).toLocaleDateString()}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => onApprove(r.reqId)}
                          disabled={approve.isPending}
                          className="inline-flex items-center gap-1 rounded-[8px] border border-[var(--ok)]/40 bg-[var(--ok)]/10 px-2.5 py-1 text-xs text-[var(--ok)] hover:bg-[var(--ok)]/20 disabled:opacity-60"
                        >
                          <Icon name="check" size={14} /> Approve
                        </button>
                        <button
                          onClick={() => setRejecting({ reqId: r.reqId, name: empName })}
                          className="inline-flex items-center gap-1 rounded-[8px] border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-2.5 py-1 text-xs text-[var(--danger)] hover:bg-[var(--danger)]/20"
                        >
                          <Icon name="close" size={14} /> Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {rejecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-[400px] rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-5">
            <h3 className="mb-1 text-sm font-semibold text-[var(--text)]">Reject change for {rejecting.name}?</h3>
            <p className="mb-3 text-xs text-[var(--muted)]">Optionally add a reason.</p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Reason (optional)"
              className="w-full resize-none rounded-[8px] border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:border-[var(--p)] focus:outline-none"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => { setRejecting(null); setNotes(''); }}
                className="btn btn-ghost btn-sm"
              >
                Cancel
              </button>
              <button
                onClick={onConfirmReject}
                disabled={reject.isPending}
                className="btn btn-danger btn-sm disabled:opacity-60"
              >
                {reject.isPending && <Spinner size={14} />}
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
