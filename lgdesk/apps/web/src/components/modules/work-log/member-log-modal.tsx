'use client';

import { useMemo, useState } from 'react';
import { Icon } from '../../ui/icon';
import { useMemberWorkLogs, useAdminSubmitWorkLog } from '../../../lib/api/workLog';
import { WeekRow } from './week-row';
import { Spinner } from '../../ui/spinner';
import type { WorkLogInput, WorkLogEntry } from '../../../lib/types';

function mondayOf(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
const iso = (d: Date) => d.toISOString().slice(0, 10);

export function MemberLogModal({ empId, empName, onClose }: { empId: string; empName: string; onClose: () => void }) {
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const { data: logs, isLoading } = useMemberWorkLogs(empId, iso(weekStart), iso(addDays(weekStart, 6)));
  const adminSubmit = useAdminSubmitWorkLog();

  const byDate = useMemo(() => {
    const m = new Map<string, WorkLogEntry>();
    (logs ?? []).forEach((l) => m.set(l.date.slice(0, 10), l));
    return m;
  }, [logs]);

  const saveFor = (input: WorkLogInput) => adminSubmit.mutateAsync({ ...input, targetEmpId: empId }).then(() => undefined);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8">
      <div className="flex max-h-full w-full max-w-[860px] flex-col overflow-hidden rounded-[8px] border border-[var(--border)] bg-[var(--surface)]">
        <div className="flex h-[52px] shrink-0 items-center justify-between border-b border-[var(--border)] px-5">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-[var(--text)]">{empName}</h2>
            <span className="font-mono text-xs text-[var(--muted)]">{empId}</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setWeekStart((w) => addDays(w, -7))} aria-label="Previous week" className="rounded-[8px] border border-[var(--border)] p-1.5 text-[var(--muted)] hover:bg-[var(--p3)]"><Icon name="chevron_left" size={15} /></button>
            <button onClick={() => setWeekStart(mondayOf(new Date()))} className="rounded-[8px] border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--text)] hover:bg-[var(--p3)]">This week</button>
            <button onClick={() => setWeekStart((w) => addDays(w, 7))} aria-label="Next week" className="rounded-[8px] border border-[var(--border)] p-1.5 text-[var(--muted)] hover:bg-[var(--p3)]"><Icon name="chevron_right" size={15} /></button>
            <button onClick={onClose} aria-label="Close" className="ml-2 text-[var(--muted)] hover:text-[var(--text)]"><Icon name="close" size={18} /></button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-[var(--p)]"><Spinner size={24} /></div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-[var(--muted)]">
                  <th className="px-3 py-2">Day</th>
                  <th className="px-3 py-2">Attendance</th>
                  <th className="px-3 py-2">Work</th>
                  <th className="px-3 py-2">OT hrs</th>
                  <th className="px-3 py-2">Remark</th>
                  <th className="px-3 py-2">Status / Comment</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {days.map((d) => (
                  <WeekRow key={iso(d)} date={d} entry={byDate.get(iso(d))} save={saveFor} showStatusComment />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default MemberLogModal;
