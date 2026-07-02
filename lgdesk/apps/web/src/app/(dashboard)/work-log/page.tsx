'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../../hooks/use-auth';
import { isManager as isMgr } from '../../../lib/auth';
import { useMyWorkLogs, useSubmitWorkLog } from '../../../lib/api/workLog';
import { useHolidays } from '../../../lib/api/leaves';
import { WorkRow, type WorkRowHandle } from '../../../components/modules/work-log/work-row';
import { WeeklySummaryModal } from '../../../components/modules/weekly-summary/weekly-summary-modal';
import { Icon } from '../../../components/ui/icon';
import { fmtDateRange, hms } from '../../../lib/utils';
import { isoDate as iso } from '../../../lib/attendance';
import type { WorkLogEntry, WorkLogInput } from '../../../lib/types';

function mondayOf(d: Date): Date {
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

type Mode = 'week' | 'month';

// Part 16 "Date range / lazy load": ±8-week window around the anchor. Navigating
// within this window renders from the already-fetched cache (same TanStack Query
// key => no network call); navigating outside it re-centres the window and re-fetches.
const WINDOW_WEEKS = 8;
function windowFor(anchor: Date): { start: Date; end: Date } {
  return { start: mondayOf(addDays(anchor, -WINDOW_WEEKS * 7)), end: addDays(mondayOf(addDays(anchor, WINDOW_WEEKS * 7)), 6) };
}

export default function WorkLogPage() {
  const { currentUser, tasks, projects } = useAuth();
  const [mode, setMode] = useState<Mode>('week');
  const [anchor, setAnchor] = useState(() => new Date());
  const [summaryOpen, setSummaryOpen] = useState(false);
  const submit = useSubmitWorkLog();
  const { data: holidays, isLoading: holidaysLoading } = useHolidays();

  const isIntern = currentUser?.role === 'Intern';
  const isManager = currentUser ? isMgr(currentUser.role) : false;
  const empId = currentUser?.empId ?? '';

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

  // ±8-week loaded window (Part 16 lazy-load). Re-centres only when the visible
  // range falls outside it — this is what makes the query key (and therefore the
  // network call) stay the same across in-window navigation.
  const [loadedWindow, setLoadedWindow] = useState(() => windowFor(anchor));
  useEffect(() => {
    if (rangeStart.getTime() < loadedWindow.start.getTime() || rangeEnd.getTime() > loadedWindow.end.getTime()) {
      setLoadedWindow(windowFor(anchor));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeStart, rangeEnd]);

  const { data: logs, isLoading: logsLoading, refetch } = useMyWorkLogs(iso(loadedWindow.start), iso(loadedWindow.end));
  const isLoading = logsLoading || holidaysLoading;

  const byDate = useMemo(() => {
    const m = new Map<string, WorkLogEntry>();
    (logs ?? []).forEach((l) => m.set(l.date.slice(0, 10), l));
    return m;
  }, [logs]);

  const holidaySet = useMemo(() => new Set((holidays ?? []).map((h) => h.date.slice(0, 10))), [holidays]);

  const pickerItems = useMemo(
    () => [
      ...tasks.map((t) => ({ type: 'task' as const, id: t.taskId, text: t.title })),
      ...projects.map((p) => ({ type: 'project' as const, id: p.projId, text: p.name })),
    ],
    [tasks, projects],
  );

  const save = (input: WorkLogInput) => submit.mutateAsync({ ...input, intern: isIntern });

  // Flush any pending row edits (uncommitted textarea drafts, in-flight debounce)
  // before a navigation unmounts the currently-visible rows (Part 16 "_wlCommitAllTextareas").
  const rowRefs = useRef(new Map<string, WorkRowHandle>());
  const registerRow = (key: string, el: WorkRowHandle | null) => {
    if (el) rowRefs.current.set(key, el);
    else rowRefs.current.delete(key);
  };
  const flushAll = () => rowRefs.current.forEach((r) => r.flush());

  const shift = (delta: number) => { flushAll(); setAnchor((a) => (mode === 'week' ? addDays(a, delta * 7) : new Date(a.getFullYear(), a.getMonth() + delta, 1))); };
  const goToday = () => { flushAll(); setAnchor(new Date()); };
  const changeMode = (m: Mode) => { flushAll(); setMode(m); };

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
            <button className={`tl-tab${mode === 'week' ? ' active' : ''}`} onClick={() => changeMode('week')}>Week</button>
            <button className={`tl-tab${mode === 'month' ? ' active' : ''}`} onClick={() => changeMode('month')}>Month</button>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => shift(-1)} aria-label="Previous"><Icon name="chevron_left" size={16} /></button>
          <button className="btn btn-ghost btn-sm" onClick={goToday}>Today</button>
          <button className="btn btn-ghost btn-sm" onClick={() => shift(1)} aria-label="Next"><Icon name="chevron_right" size={16} /></button>
          <button className="btn btn-ghost btn-sm" aria-label="Refresh" onClick={() => void refetch()}><Icon name="refresh" size={16} /></button>
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
                const key = iso(d);
                const entry = byDate.get(key);
                const locked = !isManager && key > iso(new Date());
                return (
                  <WorkRow
                    key={key}
                    ref={(el) => registerRow(key, el)}
                    date={d}
                    entry={entry}
                    empId={empId}
                    isIntern={isIntern}
                    isManager={isManager}
                    locked={locked}
                    isHoliday={holidaySet.has(key)}
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
