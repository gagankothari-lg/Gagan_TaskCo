'use client';

import { useMemo, useState } from 'react';
import { Icon } from '../../../components/ui/icon';
import { useAuth } from '../../../hooks/use-auth';
import { isManager } from '../../../lib/auth';
import { useMyLeaves, useHolidays, useCancelLeave, usePendingLeaves, useReviewLeave } from '../../../lib/api/leaves';
import { apiErrorMessage } from '../../../lib/api/client';
import { toast } from '../../../lib/toast';
import { SubmitLeaveModal } from '../../../components/modules/leaves/submit-leave-modal';
import { LeaveStatusBadge } from '../../../components/modules/leaves/leave-status-badge';
import { LeaveTypePill } from '../../../components/modules/leaves/leave-type-pill';
import { Spinner } from '../../../components/ui/spinner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../components/ui/dialog';
import { usePageHeader } from '../../../components/layout/page-header-context';

const fmtLong = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const fmtShort = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });

// PMERGE-LEAVES-PAGES: was its own route ("My Leaves"), unconditional for every role --
// content/hooks unchanged, just no longer a standalone page.
function MyLeavesSection() {
  const { employees } = useAuth();
  const { data: leaves, isLoading } = useMyLeaves();
  const { data: holidays } = useHolidays();
  const cancel = useCancelLeave();
  const [open, setOpen] = useState(false);

  const nameByEmpId = useMemo(() => {
    const m = new Map<string, string>();
    employees.forEach((e) => m.set(e.empId, `${e.firstName} ${e.lastName}`));
    return m;
  }, [employees]);

  const upcoming = (holidays ?? []).filter((h) => new Date(h.date) >= new Date(new Date().setHours(0, 0, 0, 0)));

  async function onCancel(leaveId: string) {
    if (!confirm('Cancel this leave request?')) return;
    try {
      await cancel.mutateAsync(leaveId);
      toast('Leave request cancelled', 'success');
    } catch (err) {
      toast(apiErrorMessage(err, 'Unable to cancel leave'), 'error');
    }
  }

  usePageHeader({ title: 'My Leaves', subtitle: 'Your leave requests and their status' }, []);

  return (
    <div>
      <div className="ph-actions ph-actions-solo">
        <button onClick={() => setOpen(true)} className="btn btn-accent">
          + Request Leave
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted"><Spinner size={16} /> Loading…</div>
      ) : (leaves ?? []).length === 0 ? (
        <div className="empty-state">
          <Icon name="event_available" className="ei" />
          <p>No leave requests yet</p>
        </div>
      ) : (
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Type</th>
                <th>Start</th>
                <th>End</th>
                <th>Days</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Reviewed By</th>
                <th>Notes</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {(leaves ?? []).map((l) => (
                <tr key={l.leaveId}>
                  <td className="font-mono text-xs text-muted2">{l.leaveId}</td>
                  <td><LeaveTypePill type={l.leaveType} /></td>
                  <td className="text-muted">{fmtLong(l.startDate)}</td>
                  <td className="text-muted">{fmtLong(l.endDate)}</td>
                  <td className="text-muted">{l.days}</td>
                  <td className="text-muted">{l.reason || '—'}</td>
                  <td><LeaveStatusBadge status={l.status} /></td>
                  <td className="text-muted">{l.reviewedBy ? nameByEmpId.get(l.reviewedBy) ?? l.reviewedBy : '—'}</td>
                  <td className="text-muted">{l.reviewNotes ?? '—'}</td>
                  <td>
                    {l.status === 'Pending' && (
                      <button onClick={() => onCancel(l.leaveId)} disabled={cancel.isPending} className="btn btn-ghost btn-sm">
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6">
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-text"><Icon name="calendar_month" size={15} className="text-[var(--p-fg)]" /> Upcoming holidays</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted">No upcoming holidays.</p>
        ) : (
          <div>
            {upcoming.map((h) => (
              <div key={h.id} className="mb-2 flex items-center justify-between gap-2.5 rounded-[8px] bg-p3 px-3.5 py-2.5">
                <span className="min-w-[80px] text-[11px] font-bold text-p">{fmtLong(h.date)}</span>
                <span className="flex-1 text-[13px] font-semibold text-[var(--p)]">{h.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <SubmitLeaveModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

// PMERGE-LEAVES-PAGES: was its own isManager-gated route ("Leave Approvals") -- content/
// hooks unchanged. Split into its own component (rather than inlined in LeavesPage) so
// its hooks (usePendingLeaves/useReviewLeave) only ever run when this actually mounts --
// i.e. only for a manager, same as the old route-level gate achieved.
function LeaveApprovalsSection() {
  const { employees } = useAuth();
  const { data: leaves, isLoading } = usePendingLeaves();
  const review = useReviewLeave();
  const [rejecting, setRejecting] = useState<{ leaveId: string; name: string } | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const nameByEmpId = useMemo(() => {
    const m = new Map<string, string>();
    employees.forEach((e) => m.set(e.empId, `${e.firstName} ${e.lastName}`));
    return m;
  }, [employees]);

  async function approve(leaveId: string) {
    if (!confirm('Approve this leave request?')) return;
    setError(null);
    try { await review.mutateAsync({ leaveId, status: 'Approved' }); toast('Leave request approved', 'success'); } catch (e) { setError(apiErrorMessage(e, 'Unable to approve')); }
  }
  async function confirmReject() {
    if (!rejecting) return;
    setError(null);
    try { await review.mutateAsync({ leaveId: rejecting.leaveId, status: 'Rejected', notes: notes || undefined }); setRejecting(null); setNotes(''); toast('Leave request rejected', 'success'); }
    catch (e) { setError(apiErrorMessage(e, 'Unable to reject')); }
  }

  const rows = leaves ?? [];

  return (
    <div className="mt-8">
      <div className="ph">
        <div className="ph-left">
          <div className="ph-title">Leave Approvals</div>
          <div className="ph-sub">Pending leave requests from your team</div>
        </div>
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
                    <td><LeaveTypePill type={l.leaveType} /></td>
                    <td className="text-[var(--muted)]">{fmtShort(l.startDate)}</td>
                    <td className="text-[var(--muted)]">{fmtShort(l.endDate)}</td>
                    <td>{l.days}</td>
                    <td className="text-[var(--muted)]">{l.reason || '—'}</td>
                    <td className="text-[var(--muted)]">{fmtShort(l.createdAt)}</td>
                    <td>
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => approve(l.leaveId)} disabled={review.isPending} className="btn btn-accent btn-sm">Approve</button>
                        <button onClick={() => setRejecting({ leaveId: l.leaveId, name })} disabled={review.isPending} className="btn btn-danger btn-sm">Reject</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!rejecting} onOpenChange={(next) => { if (!next) { setRejecting(null); setNotes(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject {rejecting?.name}&apos;s leave?</DialogTitle>
          </DialogHeader>
          <div className="px-5 py-4">
            <p className="mb-3 text-xs text-[var(--muted)]">Add a reason for the rejection.</p>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Reason" className="w-full resize-none rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--muted2)] focus:border-[var(--p)] focus:outline-none" />
          </div>
          <DialogFooter>
            <button onClick={() => { setRejecting(null); setNotes(''); }} className="btn btn-ghost">Cancel</button>
            <button onClick={confirmReject} disabled={review.isPending} className="btn btn-danger">{review.isPending && <Spinner size={14} />} Reject</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function LeavesPage() {
  const { currentUser } = useAuth();
  const manager = !!currentUser && isManager(currentUser.role);

  return (
    <div className="p-6">
      <MyLeavesSection />
      {manager && <LeaveApprovalsSection />}
    </div>
  );
}
