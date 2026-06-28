'use client';

import { useMemo, useState } from 'react';
import { useAuth } from '../../../../hooks/use-auth';
import { isManager } from '../../../../lib/auth';
import { useTeamOverview } from '../../../../hooks/use-work-log';
import { MemberLogModal } from '../../../../components/modules/work-log/member-log-modal';
import { Spinner } from '../../../../components/ui/spinner';
import type { TeamOverviewRow } from '../../../../lib/types';

const BREAKDOWN: { key: keyof TeamOverviewRow; label: string }[] = [
  { key: 'P', label: 'P' }, { key: 'LF', label: 'LF' }, { key: 'LH', label: 'LH' },
  { key: 'H', label: 'H' }, { key: 'W', label: 'W' }, { key: 'AW', label: 'AW' },
  { key: 'EF', label: 'EF' }, { key: 'EH', label: 'EH' },
];

export default function TeamWorkLogPage() {
  const { currentUser } = useAuth();
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [member, setMember] = useState<{ empId: string; name: string } | null>(null);
  const { data: rows, isLoading } = useTeamOverview(month);

  const sorted = useMemo(() => [...(rows ?? [])].sort((a, b) => a.name.localeCompare(b.name)), [rows]);

  if (!currentUser) return null;
  if (!isManager(currentUser.role)) {
    return (
      <div className="p-6">
        <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--muted)]">You don&apos;t have access to this page.</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text)]">Team Work Logs</h1>
          <p className="text-sm text-[var(--muted)]">Monthly attendance overview</p>
        </div>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-sm text-[var(--text)] focus:border-[var(--p)] focus:outline-none" />
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-[var(--muted)]"><Spinner size={16} /> Loading…</div>
      ) : sorted.length === 0 ? (
        <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--muted)]">No team members.</div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((r) => (
            <button key={r.empId} onClick={() => setMember({ empId: r.empId, name: r.name })} className="flex flex-col gap-3 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 text-left transition-colors hover:border-[var(--p)]">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--text)]">{r.name}</p>
                  <p className="font-mono text-xs text-[var(--muted)]">{r.empId}</p>
                </div>
                {r.otHours > 0 && (
                  <span className="shrink-0 rounded-[9999px] bg-[var(--warn)]/20 px-2 py-0.5 text-xs text-[var(--warn)]">+{r.otHours} OT</span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {BREAKDOWN.map(({ key, label }) => (
                  <span key={label} className="inline-flex items-center gap-1 rounded-[8px] border border-[var(--border)] bg-[var(--bg)] px-1.5 py-0.5 text-xs text-[var(--muted)]">
                    {label} <span className="text-[var(--text)]">{r[key]}</span>
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      )}

      {member && <MemberLogModal empId={member.empId} empName={member.name} onClose={() => setMember(null)} />}
    </div>
  );
}
