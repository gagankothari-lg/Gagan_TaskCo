'use client';

import { useMemo, useState } from 'react';
import { useAuth } from '../../../hooks/use-auth';
import { isManager as isMgr } from '../../../lib/auth';
import { useMyWorkLogs, useSubmitWorkLog } from '../../../hooks/use-work-log';
import { WorkRow } from '../../../components/modules/work-log/work-row';
import { WeeklySummaryModal } from '../../../components/modules/weekly-summary/weekly-summary-modal';
import { Icon } from '../../../components/ui/icon';
import { fmtDateRange, hms } from '../../../lib/utils';
import type { WorkLogEntry, WorkLogInput } from '../../../lib/types';

function mondayOf(d: Date): Date {
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const iso = (d: Date) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };

type Mode = 'week' | 'month';

export default function WorkLogPage() {
  const { currentUser, tasks, projects } = useAuth();
  const [mode, setMode] = useState<Mode>('week');
  const [anchor, setAnchor] = useState(() => new Date());
  const [summaryOpen, setSummaryOpen] = useState(false);
  const submit = useSubmitWorkLog();

  const isIntern = currentUser?.role === 'Intern';
  const isManager = currentUser ? isMgr(currentUser.role) : false;

  const { rangeStart, days } = useMemo(() => {
    if (mode === 'week') {
      const start = mondayOf(anchor);
      return { rangeStart: start, days: Array.from({ length: 7 }, (_, i) => addDays(start, i)) };
    }
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    const count = last.getDate();
    return { rangeStart: first, days: Array.from({ length: count }, (_, i) => addDays(first, i)) };
  }, [mode, anchor]);

  const rangeEnd = days[days.length - 1];
  const { data: logs, isLoading } = useMyWorkLogs(iso(rangeStart), iso(rangeEnd));

  const byDate = useMemo(() => {
    const m = new Map<string, WorkLogEntry>();
    (logs ?? []).forEach((l) => m.set(l.date.slice(0, 10), l));
    return m;
  }, [logs]);

  const pickerItems = useMemo(
    () => [
      ...tasks.map((t) => ({ type: 'task' as const, id: t.taskId, text: t.title })),
      ...projects.map((p) => ({ type: 'project' as const, id: p.projId, text: p.name })),
    ],
    [tasks, projects],
  );

  const save = (input: WorkLogInput) => submit.mutateAsync({ ...input, intern: isIntern });

  const shift = (delta: number) => setAnchor((a) => (mode === 'week' ? addDays(a, delta * 7) : new Date(a.getFullYear(), a.getMonth() + delta, 1)));
  const today = () => setAnchor(new Date());

  const label = mode === 'week'
    ? fmtDateRange(rangeStart, rangeEnd)
    : anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <div>
      <div className="ph">
        <div className="ph-left">
          <div className="ph-title">Work Log</div>
          <div className="ph-sub">{label}</div>
        </div>
        <div className="ph-actions">
          <div className="tl-tabs">
            <button className={`tl-tab${mode === 'week' ? ' active' : ''}`} onClick={() => setMode('week')}>Week</button>
            <button className={`tl-tab${mode === 'month' ? ' active' : ''}`} onClick={() => setMode('month')}>Month</button>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => shift(-1)} aria-label="Previous"><Icon name="chevron_left" size={16} /></button>
          <button className="btn btn-ghost btn-sm" onClick={today}>Today</button>
          <button className="btn btn-ghost btn-sm" onClick={() => shift(1)} aria-label="Next"><Icon name="chevron_right" size={16} /></button>
          <button className="btn btn-ghost btn-sm" onClick={() => setSummaryOpen(true)}>
            <Icon name="summarize" size={16} /> Weekly Summary
          </button>
        </div>
      </div>

      <WeeklySummaryModal open={summaryOpen} onClose={() => setSummaryOpen(false)} weekLabel={label} weekStart={iso(mondayOf(anchor))} />

      {isLoading ? (
        <div className="empty-state"><Icon name="hourglass_empty" size={40} className="ei" /><p>Loading…</p></div>
      ) : (
        <div className="tbl-wrap">
          <table className="wl-week-table">
            <thead>
              <tr>
                <th>Day</th>
                <th>Attendance</th>
                <th>Work Update — 1st Half</th>
                <th>Work Update — 2nd Half</th>
                <th>Extra Hrs</th>
                <th>Remark</th>
                <th>Status</th>
                <th>Comments</th>
                <th aria-label="Save" />
              </tr>
            </thead>
            <tbody>
              {days.map((d) => {
                const entry = byDate.get(iso(d));
                const locked = !isManager && iso(d) > iso(new Date());
                return (
                  <WorkRow
                    key={iso(d)}
                    date={d}
                    entry={entry}
                    isIntern={isIntern}
                    isManager={isManager}
                    locked={locked}
                    durationHms={entry?.workDuration != null ? hms(entry.workDuration * 60) : ''}
                    pickerItems={pickerItems}
                    onSave={save}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
