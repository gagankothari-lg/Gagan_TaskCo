'use client';

import { useMemo, useState } from 'react';
import { Icon } from '../../../../components/ui/icon';
import { useAuth } from '../../../../hooks/use-auth';
import { isAdmin, isManager } from '../../../../lib/auth';
import { usePendingLeaves, useReviewLeave } from '../../../../hooks/use-leaves';
import { HolidayModal } from '../../../../components/modules/leaves/holiday-modal';
import { apiErrorMessage } from '../../../../lib/api';
import { Spinner } from '../../../../components/ui/spinner';

const fmt = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export default function LeaveApprovalsPage() {
  const { currentUser, employees } = useAuth();
  const { data: leaves, isLoading } = usePendingLeaves();
  const review = useReviewLeave();
  const [rejecting, setRejecting] = useState<{ leaveId: string; name: string } | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [holidayOpen, setHolidayOpen] = useState(false);

  const nameByEmpId = useMemo(() => {
    const m = new Map<string, string>();
    employees.forEach((e) => m.set(e.empId, `${e.firstName} ${e.lastName}`));
    return m;
  }, [employees]);

  if (!currentUser) return null;
  if (!isManager(currentUser.role)) {
    return <div className="p-6"><div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--muted)]">You don&apos;t have access to this page.</div></div>;
  }

  async function approve(leaveId: string) {
    setError(null);
    try { await review.mutateAsync({ leaveId, status: 'Approved' }); } catch (e) { setError(apiErrorMessage(e, 'Unable to approve')); }
  }
  async function confirmReject() {
    if (!rejecting) return;
    setError(null);
    try { await review.mutateAsync({ leaveId: rejecting.leaveId, status: 'Rejected', notes: notes || undefined }); setRejecting(null); setNotes(''); }
    catch (e) { setError(apiErrorMessage(e, 'Unable to reject')); }
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[var(--text)]">Leave Approvals</h1>
        {isAdmin(currentUser.role) && (
          <button onClick={() => setHolidayOpen(true)} className="btn btn-ghost">
            <Icon name="add" size={15} /> Add Holiday
          </button>
        )}
      </div>

      {error && <div className="mb-4 rounded-[8px] border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">{error}</div>}

      {isLoading ? (
        <div className="flex items-center gap-2 text-[var(--muted)]"><Spinner size={16} /> Loading…</div>
      ) : (leaves ?? []).length === 0 ? (
        <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--muted)]">No pending leave requests.</div>
      ) : (
        <div className="tbl-wrap">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="px-3 py-2.5">Employee</th>
                <th className="px-3 py-2.5">Type</th>
                <th className="px-3 py-2.5">Dates</th>
                <th className="px-3 py-2.5">Days</th>
                <th className="px-3 py-2.5">Reason</th>
                <th className="px-3 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(leaves ?? []).map((l) => {
                const name = nameByEmpId.get(l.empId) ?? l.empId;
                return (
                  <tr key={l.leaveId}>
                    <td className="px-3 py-2.5 text-[var(--text)]">{name}</td>
                    <td className="px-3 py-2.5 text-[var(--muted)]">{l.leaveType}</td>
                    <td className="px-3 py-2.5 text-[var(--muted)]">{fmt(l.startDate)}{l.startDate !== l.endDate ? ` – ${fmt(l.endDate)}` : ''}</td>
                    <td className="px-3 py-2.5 text-[var(--muted)]">{l.days}</td>
                    <td className="px-3 py-2.5 text-[var(--muted)]">{l.reason || '—'}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => approve(l.leaveId)} disabled={review.isPending} className="btn btn-accent btn-sm"><Icon name="check" size={14} /> Approve</button>
                        <button onClick={() => setRejecting({ leaveId: l.leaveId, name })} className="btn btn-danger btn-sm"><Icon name="close" size={14} /> Reject</button>
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
          <div className="w-full max-w-[400px] rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-5 text-[var(--text)]">
            <h3 className="mb-1 text-sm font-semibold text-[var(--text)]">Reject {rejecting.name}&apos;s leave?</h3>
            <p className="mb-3 text-xs text-[var(--muted)]">Add a reason for the rejection.</p>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Reason" className="w-full resize-none rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--muted2)] focus:border-[var(--p)] focus:outline-none" />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => { setRejecting(null); setNotes(''); }} className="btn btn-ghost">Cancel</button>
              <button onClick={confirmReject} disabled={review.isPending} className="btn btn-danger">{review.isPending && <Spinner size={14} />} Reject</button>
            </div>
          </div>
        </div>
      )}

      <HolidayModal open={holidayOpen} onClose={() => setHolidayOpen(false)} />
    </div>
  );
}
