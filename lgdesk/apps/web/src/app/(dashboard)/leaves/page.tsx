'use client';

import { useMemo, useState } from 'react';
import { Icon } from '../../../components/ui/icon';
import { useAuth } from '../../../hooks/use-auth';
import { useMyLeaves, useHolidays, useCancelLeave } from '../../../lib/api/leaves';
import { apiErrorMessage } from '../../../lib/api/client';
import { toast } from '../../../lib/toast';
import { SubmitLeaveModal } from '../../../components/modules/leaves/submit-leave-modal';
import { LeaveStatusBadge } from '../../../components/modules/leaves/leave-status-badge';
import { Spinner } from '../../../components/ui/spinner';

const fmt = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export default function MyLeavesPage() {
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

  return (
    <div className="p-6">
      <div className="ph">
        <div className="ph-left">
          <div className="ph-title">My Leaves</div>
          <div className="ph-sub">Submit and track your leave requests</div>
        </div>
        <div className="ph-actions">
          <button onClick={() => setOpen(true)} className="btn btn-primary">
            <Icon name="add" size={15} /> Request Leave
          </button>
        </div>
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
                  <td className="text-text">{l.leaveType}</td>
                  <td className="text-muted">{fmt(l.startDate)}</td>
                  <td className="text-muted">{fmt(l.endDate)}</td>
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
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-text"><Icon name="calendar_month" size={15} className="text-p" /> Upcoming holidays</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted">No upcoming holidays.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {upcoming.map((h) => (
              <span key={h.id} className="inline-flex items-center gap-1.5 rounded-[8px] border border-border bg-surface px-2.5 py-1 text-xs text-text">
                <span className="text-p">{fmt(h.date)}</span> {h.name}
              </span>
            ))}
          </div>
        )}
      </div>

      <SubmitLeaveModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
