'use client';

import type { DashboardData } from '../../../lib/types';

export function OnLeaveWidget({ onLeave }: { onLeave: DashboardData['onLeaveToday'] }) {
  return (
    <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-card">
      <h3 className="mb-3 text-sm font-medium text-[var(--text)]">On Leave Today</h3>
      {onLeave.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">Everyone&apos;s in today.</p>
      ) : (
        <div className="space-y-2">
          {onLeave.map((l) => {
            const initials = l.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
            return (
              <div key={l.empId} className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--p)] text-[10px] font-semibold text-white">{initials}</div>
                <span className="min-w-0 flex-1 truncate text-sm text-[var(--text)]">{l.name}</span>
                <span className="shrink-0 rounded-[9999px] bg-[var(--warn)]/15 px-2 py-0.5 text-xs text-[var(--warn)]">{l.leaveType}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default OnLeaveWidget;
