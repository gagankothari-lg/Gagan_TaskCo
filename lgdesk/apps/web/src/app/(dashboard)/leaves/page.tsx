'use client';

import { useState } from 'react';
import { Icon } from '../../../components/ui/icon';
import { useMyLeaves, useHolidays } from '../../../lib/api/leaves';
import { SubmitLeaveModal } from '../../../components/modules/leaves/submit-leave-modal';
import { LeaveStatusBadge } from '../../../components/modules/leaves/leave-status-badge';
import { Spinner } from '../../../components/ui/spinner';

const fmt = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export default function MyLeavesPage() {
  const { data: leaves, isLoading } = useMyLeaves();
  const { data: holidays } = useHolidays();
  const [open, setOpen] = useState(false);

  const upcoming = (holidays ?? []).filter((h) => new Date(h.date) >= new Date(new Date().setHours(0, 0, 0, 0)));

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[var(--text)]">My Leaves</h1>
        <button onClick={() => setOpen(true)} className="btn btn-primary">
          <Icon name="add" size={15} /> Request Leave
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-[var(--muted)]"><Spinner size={16} /> Loading…</div>
      ) : (leaves ?? []).length === 0 ? (
        <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--muted)]">No leave requests yet.</div>
      ) : (
        <div className="tbl-wrap">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="px-3 py-2.5">Type</th>
                <th className="px-3 py-2.5">Dates</th>
                <th className="px-3 py-2.5">Days</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Notes</th>
              </tr>
            </thead>
            <tbody>
              {(leaves ?? []).map((l) => (
                <tr key={l.leaveId}>
                  <td className="px-3 py-2.5 text-[var(--text)]">{l.leaveType}</td>
                  <td className="px-3 py-2.5 text-[var(--muted)]">{fmt(l.startDate)}{l.startDate !== l.endDate ? ` – ${fmt(l.endDate)}` : ''}</td>
                  <td className="px-3 py-2.5 text-[var(--muted)]">{l.days}</td>
                  <td className="px-3 py-2.5"><LeaveStatusBadge status={l.status} /></td>
                  <td className="px-3 py-2.5 text-[var(--muted)]">{l.status === 'Rejected' ? l.reviewNotes ?? '—' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6">
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-[var(--text)]"><Icon name="calendar_month" size={15} className="text-[var(--p)]" /> Upcoming holidays</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No upcoming holidays.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {upcoming.map((h) => (
              <span key={h.id} className="inline-flex items-center gap-1.5 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs text-[var(--text)]">
                <span className="text-[var(--p)]">{fmt(h.date)}</span> {h.name}
              </span>
            ))}
          </div>
        )}
      </div>

      <SubmitLeaveModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
