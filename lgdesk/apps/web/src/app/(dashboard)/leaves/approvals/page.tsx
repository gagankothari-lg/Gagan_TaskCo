'use client';

import { useMemo, useState } from 'react';
import { Icon } from '../../../../components/ui/icon';
import { useAuth } from '../../../../hooks/use-auth';
import { isAdmin, isManager } from '../../../../lib/auth';
import { usePendingLeaves, useReviewLeave } from '../../../../hooks/use-leaves';
import { HolidayModal } from '../../../../components/modules/leaves/holiday-modal';
import { apiErrorMessage } from '../../../../lib/api';
import { Spinner } from '../../../../components/ui/spinner';
import { pillClass } from '../../../../lib/utils';

const fmt = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });

const approveBtn: React.CSSProperties = { background: '#00897b', color: '#fff', padding: '4px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, border: 'none', cursor: 'pointer' };
const rejectBtn: React.CSSProperties = { background: '#c62828', color: '#fff', padding: '4px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, border: 'none', cursor: 'pointer' };

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

  const rows = leaves ?? [];

  return (
    <div className="p-6">
      <div className="ph">
        <div className="ph-left">
          <div className="ph-title">Leave Approvals</div>
          <div className="ph-sub">Pending leave requests from your team</div>
        </div>
        {isAdmin(currentUser.role) && (
          <div className="ph-actions">
            <button onClick={() => setHolidayOpen(true)} className="btn btn-ghost">
              <Icon name="add" size={15} /> Add Holiday
            </button>
          </div>
        )}
      </div>

      {error && <div className="mb-4 rounded-[8px] border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">{error}</div>}

      {isLoading ? (
        <div className="flex items-center gap-2 text-[var(--muted)]"><Spinner size={16} /> Loading…</div>
      ) : rows.length === 0 ? (
        <div className="empty-state">
          <Icon name="event_available" className="ei" />
          <p className="font-medium text-[var(--text)]">No pending leave requests</p>
          <p className="text-[var(--muted)]">All caught up!</p>
        </div>
      ) : (
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Type</th>
                <th>Start</th>
                <th>End</th>
                <th>Days</th>
                <th>Reason</th>
                <th>Requested</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => {
                const name = nameByEmpId.get(l.empId) ?? l.empId;
                return (
                  <tr key={l.leaveId}>
                    <td style={{ fontWeight: 600 }}>{name}</td>
                    <td><span className={pillClass(l.leaveType)}>{l.leaveType}</span></td>
                    <td className="text-[var(--muted)]">{fmt(l.startDate)}</td>
                    <td className="text-[var(--muted)]">{fmt(l.endDate)}</td>
                    <td>{l.days}</td>
                    <td className="text-[var(--muted)]">{l.reason || '—'}</td>
                    <td className="text-[var(--muted)]">{fmt(l.createdAt)}</td>
                    <td>
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => approve(l.leaveId)} disabled={review.isPending} style={approveBtn}>Approve</button>
                        <button onClick={() => setRejecting({ leaveId: l.leaveId, name })} disabled={review.isPending} style={rejectBtn}>Reject</button>
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
