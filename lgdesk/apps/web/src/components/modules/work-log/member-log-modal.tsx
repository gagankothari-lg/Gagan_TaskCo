'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../../hooks/use-auth';
import { useMemberWorkLogs, useAdminSubmitWorkLog } from '../../../lib/api/workLog';
import { useHolidays } from '../../../lib/api/leaves';
import { WorkRow, type WorkRowHandle } from './work-row';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Icon } from '../../ui/icon';
import { Spinner } from '../../ui/spinner';
import { avatarColor } from '../../../lib/avatar-colors';
import { hms, initials as initialsOf } from '../../../lib/utils';
import { isoDate as iso } from '../../../lib/attendance';
import { apiErrorMessage } from '../../../lib/api/client';
import type { WorkLogEntry, WorkLogInput } from '../../../lib/types';

function mondayOf(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

// Part 16 lazy-load window, reused here for the modal's own week paging.
const WINDOW_WEEKS = 8;
function windowFor(anchor: Date) {
  return { start: mondayOf(addDays(anchor, -WINDOW_WEEKS * 7)), end: addDays(mondayOf(addDays(anchor, WINDOW_WEEKS * 7)), 6) };
}

export type TeamPeriod = 'day' | 'week' | 'month' | 'custom';

export interface MemberLogModalProps {
  empId: string;
  empName: string;
  onClose: () => void;
  /** Context inheritance (Part 17 Change #44): the team view's current period/anchor/range. */
  teamPeriod: TeamPeriod;
  teamAnchor: Date;
  teamRangeStart: Date;
  teamRangeEnd: Date;
}

export function MemberLogModal({ empId, empName, onClose, teamPeriod, teamAnchor, teamRangeStart, teamRangeEnd }: MemberLogModalProps) {
  const { employees, tasks, projects } = useAuth();
  const target = employees.find((e) => e.empId === empId);
  const isIntern = target?.role === 'Intern';

  const isCustomFixed = teamPeriod === 'custom';
  const isMonthFixed = teamPeriod === 'month';
  const showNav = teamPeriod === 'day' || teamPeriod === 'week';

  // Change #44: Month mode -> today's week if same month, else the target month's first
  // week; Day/Week mode -> the team view's own week. Custom shows its full range (below),
  // so it has no single "anchor week".
  const initialAnchor = useMemo(() => {
    if (isMonthFixed) {
      const today = new Date();
      const sameMonth = teamAnchor.getFullYear() === today.getFullYear() && teamAnchor.getMonth() === today.getMonth();
      return mondayOf(sameMonth ? today : new Date(teamAnchor.getFullYear(), teamAnchor.getMonth(), 1));
    }
    return mondayOf(teamAnchor);
  }, [isMonthFixed, teamAnchor]);

  const [weekAnchor, setWeekAnchor] = useState(initialAnchor);
  const [loadedWindow, setLoadedWindow] = useState(() => windowFor(initialAnchor));

  const days = useMemo(() => {
    if (isCustomFixed) {
      const out: Date[] = [];
      for (let d = new Date(teamRangeStart); d <= teamRangeEnd; d = addDays(d, 1)) out.push(new Date(d));
      return out;
    }
    return Array.from({ length: 7 }, (_, i) => addDays(weekAnchor, i));
  }, [isCustomFixed, teamRangeStart, teamRangeEnd, weekAnchor]);

  useEffect(() => {
    if (isCustomFixed) return;
    const s = days[0], e = days[days.length - 1];
    if (s.getTime() < loadedWindow.start.getTime() || e.getTime() > loadedWindow.end.getTime()) {
      setLoadedWindow(windowFor(weekAnchor));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, isCustomFixed]);

  const queryStart = isCustomFixed ? teamRangeStart : loadedWindow.start;
  const queryEnd = isCustomFixed ? teamRangeEnd : loadedWindow.end;

  const { data: logs, isLoading: logsLoading, isError, error, refetch } = useMemberWorkLogs(empId, iso(queryStart), iso(queryEnd));
  const { data: holidays, isLoading: holidaysLoading } = useHolidays();
  const adminSubmit = useAdminSubmitWorkLog();

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

  const saveFor = (input: WorkLogInput) => adminSubmit.mutateAsync({ ...input, targetEmpId: empId }).then(() => undefined);

  // Same flush-before-navigate contract as the personal grid (Part 16).
  const rowRefs = useRef(new Map<string, WorkRowHandle>());
  const registerRow = (key: string, el: WorkRowHandle | null) => { if (el) rowRefs.current.set(key, el); else rowRefs.current.delete(key); };
  const flushAll = () => rowRefs.current.forEach((r) => r.flush());

  const navWeek = (delta: number) => { flushAll(); setWeekAnchor((w) => addDays(w, delta * 7)); };
  // Custom mode already renders every day in one continuous table (nav arrows hidden —
  // there's nowhere to page to), so "Today" scrolls the already-loaded range to today's
  // row instead of changing the anchor (Part 37: "Today button still present").
  const goToday = () => {
    flushAll();
    if (isCustomFixed) {
      document.getElementById(`wl-save-btn-${iso(new Date())}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setWeekAnchor(mondayOf(new Date()));
  };
  const refresh = () => { flushAll(); void refetch(); };

  const isLoading = logsLoading || holidaysLoading;
  const rangeLabel = isCustomFixed
    ? `${days[0]?.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${days[days.length - 1]?.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
    : `${weekAnchor.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${addDays(weekAnchor, 6).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;

  // Closing the modal (X / backdrop / Esc) flushes pending edits first — same contract as
  // internal navigation, so a keystroke inside the debounce window is never silently lost.
  const closeWithFlush = () => { flushAll(); onClose(); };

  return (
    <Dialog open onOpenChange={(next) => { if (!next) closeWithFlush(); }}>
      <DialogContent size="xl" className="flex max-h-[90vh] flex-col gap-0 p-0">
        <DialogHeader>
          <span
            style={{ width: 32, height: 32, borderRadius: '50%', background: avatarColor(empId), color: '#fff', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            {initialsOf(empName)}
          </span>
          <div style={{ minWidth: 0 }}>
            <DialogTitle>{empName} — Work Log <span className="font-mono text-xs text-muted">{empId}</span></DialogTitle>
            <div className="text-xs text-muted">{rangeLabel}</div>
          </div>
          <div className="flex items-center gap-1">
            {showNav && <button className="btn btn-ghost btn-sm" aria-label="Previous week" onClick={() => navWeek(-1)}><Icon name="chevron_left" size={16} /></button>}
            <button className="btn btn-ghost btn-sm" onClick={goToday}>Today</button>
            {showNav && <button className="btn btn-ghost btn-sm" aria-label="Next week" onClick={() => navWeek(1)}><Icon name="chevron_right" size={16} /></button>}
          </div>
          <button className="btn btn-ghost btn-sm" aria-label="Refresh" onClick={refresh}><Icon name="refresh" size={16} /></button>
        </DialogHeader>
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16"><Spinner size={24} /></div>
          ) : isError ? (
            <div className="empty-state">
              <Icon name="error" className="ei" />
              <p>{apiErrorMessage(error, 'Unable to load this member’s work log.')}</p>
            </div>
          ) : (
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
                  return (
                    <WorkRow
                      key={key}
                      ref={(el) => registerRow(key, el)}
                      date={d}
                      entry={entry}
                      empId={empId}
                      isIntern={isIntern}
                      isManager
                      locked={false}
                      isHoliday={holidaySet.has(key)}
                      durationHms={entry?.workDuration != null ? hms(entry.workDuration * 60) : ''}
                      pickerItems={pickerItems}
                      onSave={saveFor}
                    />
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default MemberLogModal;
