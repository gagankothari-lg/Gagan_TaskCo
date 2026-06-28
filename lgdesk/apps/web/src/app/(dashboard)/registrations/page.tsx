'use client';

import { Fragment, useState } from 'react';
import { Icon } from '../../../components/ui/icon';
import { useAuth } from '../../../hooks/use-auth';
import { useRegistrations, useApproveRegistration, useRejectRegistration } from '../../../hooks/use-users';
import { isManager } from '../../../lib/auth';
import { apiErrorMessage } from '../../../lib/api';
import { Spinner } from '../../../components/ui/spinner';
import { RoleBadge } from '../../../components/ui/role-badge';

export default function RegistrationsPage() {
  const { currentUser } = useAuth();
  const { data: rows, isLoading, error } = useRegistrations();
  const approve = useApproveRegistration();
  const reject = useRejectRegistration();

  const [expanded, setExpanded] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<{ reqId: string; name: string } | null>(null);
  const [notes, setNotes] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

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
    setActionError(null);
    try {
      await approve.mutateAsync(reqId);
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
    } catch (err) {
      setActionError(apiErrorMessage(err, 'Unable to reject'));
    }
  }

  return (
    <div className="p-6">
      <h1 className="mb-1 text-xl font-semibold text-[var(--text)]">Registrations</h1>
      <p className="mb-5 text-sm text-[var(--muted)]">Review and approve people requesting access.</p>

      {actionError && (
        <div className="mb-4 rounded-[8px] border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
          {actionError}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-[var(--muted)]"><Spinner size={16} /> Loading…</div>
      ) : error ? (
        <div className="text-sm text-[var(--danger)]">{apiErrorMessage(error, 'Failed to load registrations')}</div>
      ) : pending.length === 0 ? (
        <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--muted)]">
          No pending registrations.
        </div>
      ) : (
        <div className="overflow-hidden rounded-[8px] border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--surface)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
                <th className="w-8 px-3 py-2.5" />
                <th className="px-3 py-2.5">Name</th>
                <th className="px-3 py-2.5">Email</th>
                <th className="px-3 py-2.5">Team</th>
                <th className="px-3 py-2.5">Designation</th>
                <th className="px-3 py-2.5">Date</th>
                <th className="px-3 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((r) => {
                const name = `${r.firstName} ${r.lastName}`;
                const isOpen = expanded === r.regId;
                return (
                  <Fragment key={r.regId}>
                    <tr className="border-t border-[var(--border)] bg-[var(--surface)]">
                      <td className="px-3 py-2.5">
                        <button
                          onClick={() => setExpanded(isOpen ? null : r.regId)}
                          aria-label={isOpen ? 'Collapse' : 'Expand'}
                          className="text-[var(--muted)] hover:text-[var(--text)]"
                        >
                          {isOpen ? <Icon name="expand_more" size={16} /> : <Icon name="chevron_right" size={16} />}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 text-[var(--text)]">{name}</td>
                      <td className="px-3 py-2.5 text-[var(--muted)]">{r.email}</td>
                      <td className="px-3 py-2.5 text-[var(--muted)]">{r.team ?? '—'}</td>
                      <td className="px-3 py-2.5 text-[var(--muted)]">{r.designation ?? '—'}</td>
                      <td className="px-3 py-2.5 text-[var(--muted)]">{new Date(r.createdAt).toLocaleDateString()}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => onApprove(r.regId)}
                            disabled={approve.isPending}
                            className="inline-flex items-center gap-1 rounded-[8px] border border-[var(--ok)]/40 bg-[var(--ok)]/10 px-2.5 py-1 text-xs text-[var(--ok)] hover:bg-[var(--ok)]/20 disabled:opacity-60"
                          >
                            <Icon name="check" size={14} /> Approve
                          </button>
                          <button
                            onClick={() => setRejecting({ reqId: r.regId, name })}
                            className="inline-flex items-center gap-1 rounded-[8px] border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-2.5 py-1 text-xs text-[var(--danger)] hover:bg-[var(--danger)]/20"
                          >
                            <Icon name="close" size={14} /> Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="border-t border-[var(--border)] bg-[var(--bg)]">
                        <td />
                        <td colSpan={6} className="px-3 py-3 text-xs text-[var(--muted)]">
                          <div className="flex flex-wrap gap-x-8 gap-y-1">
                            <span>Request ID: <span className="font-mono text-[var(--muted)]">{r.regId}</span></span>
                            <span>Sub-department: {r.subDepartment ?? '—'}</span>
                            <span>Resolved manager: {r.managerId ?? '—'}</span>
                            <span className="inline-flex items-center gap-1">Default role: <RoleBadge role={r.role} /></span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Reject reason modal */}
      {rejecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-[400px] rounded-[10px] border border-[#30363D] bg-[#161B22] p-5">
            <h3 className="mb-1 text-sm font-semibold text-[#E6EDF3]">Reject {rejecting.name}?</h3>
            <p className="mb-3 text-xs text-[#8B949E]">Optionally add a reason for the rejection.</p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Reason (optional)"
              className="w-full resize-none rounded-[6px] border border-[#30363D] bg-[#0D1117] px-3 py-2 text-sm text-[#E6EDF3] placeholder:text-[#8B949E] focus:border-[#58A6FF] focus:outline-none"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => { setRejecting(null); setNotes(''); }}
                className="rounded-[6px] border border-[#30363D] px-3 py-1.5 text-sm text-[#E6EDF3] hover:bg-[#21262D]"
              >
                Cancel
              </button>
              <button
                onClick={onConfirmReject}
                disabled={reject.isPending}
                className="inline-flex items-center gap-2 rounded-[6px] bg-[#F85149] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#ff6a61] disabled:opacity-60"
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
