'use client';

import { useMemo } from 'react';
import { Icon } from '../../ui/icon';
import { useMyWorkLogs } from '../../../lib/api/workLog';
import { isoDate } from '../../../lib/attendance';
import type { WorkLogEntry } from '../../../lib/types';

// Header "week-glance" pill — LGDesk_Master_Reference.md Part 45
// (`#wl-widget-container`): day-letter row + week nav + attendance summary,
// persists across all views. Wired to real data via `useMyWorkLogs` (GET
// /work-logs/mine) — no new endpoint needed, that hook already exists.
const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// Monday-of-week helper — deliberately duplicated (not shared via lib/) to match
// this codebase's existing convention: plan-week/page.tsx and work-log/page.tsx
// each keep their own local copy of the exact same Monday-start logic (rule #19:
// weekStart always normalized to Monday) rather than a shared util.
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

type DayVisual = 'ok' | 'warn' | 'danger' | 'off' | 'empty';

// Attendance -> semantic-color category, kept in lockstep by hand with
// attendance-chip.tsx's MAP (that module doesn't export its map, and this widget
// is the only file this phase touches): Present/Extra* -> ok (worked), Leave Half
// Day -> warn, Leave Full Day -> danger, Week Off/Alternate Week Off/Holiday ->
// off (an accounted-for, expected non-work day). The backend's ATTENDANCE_TYPES
// (apps/api/src/common/constants.ts) has no "Absent" value at all — a day with no
// saved attendance simply hasn't been logged, so it's never inferred as absent,
// only rendered neutral/'empty'.
function classify(attendance: string | null | undefined): DayVisual {
  switch (attendance) {
    case 'Present':
    case 'Extra Full Day':
    case 'Extra Half Day':
      return 'ok';
    case 'Leave Half Day':
      return 'warn';
    case 'Leave Full Day':
      return 'danger';
    case 'Week Off':
    case 'Alternate Week Off':
    case 'Holiday':
      return 'off';
    default:
      return 'empty';
  }
}

// var(--ok)/var(--warn)/var(--danger) — same tokens attendance-chip.tsx and
// status-styles.ts already use for these exact attendance/status meanings, not
// new hex values. 'off'/'empty' both stay neutral (this is a header pill on the
// dark --p header bg, not a white card), just at two dimness tiers so an
// accounted-for rest day (weekend/holiday) still reads as subtly distinct from a
// genuinely-blank/future day.
const VISUAL_CLASS: Record<DayVisual, string> = {
  ok: 'text-[var(--ok)]',
  warn: 'text-[var(--warn)]',
  danger: 'text-[var(--danger)]',
  off: 'text-white/45',
  empty: 'text-white/25',
};

export function WeekGlanceWidget() {
  const weekStart = useMemo(() => mondayOf(new Date()), []);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const weekEnd = weekDays[6];

  // Errors fall back to the same neutral appearance as loading — this is a small
  // header widget, not a page, so it never surfaces an error banner of its own.
  const { data: logs, isLoading, isError } = useMyWorkLogs(isoDate(weekStart), isoDate(weekEnd));

  const byDate = useMemo(() => {
    const m = new Map<string, WorkLogEntry>();
    (logs ?? []).forEach((l) => m.set(l.date.slice(0, 10), l));
    return m;
  }, [logs]);

  const showNeutral = isLoading || isError;
  const today = isoDate(new Date());

  const visuals = useMemo<DayVisual[]>(() => {
    if (showNeutral) return weekDays.map(() => 'empty');
    return weekDays.map((d) => {
      const key = isoDate(d);
      if (key > today) return 'empty'; // day hasn't happened yet this week
      return classify(byDate.get(key)?.attendance);
    });
  }, [weekDays, byDate, today, showNeutral]);

  // Sum workDuration (minutes, already scoped to this Mon–Sun by the query's
  // start/end params) -> hours to 1 decimal, formatted like task-detail-modal's
  // existing "Xh" convention ("12.5h estimated"/"Xh logged").
  const totalHrs = useMemo(() => {
    if (showNeutral) return null;
    const totalMins = (logs ?? []).reduce((sum, l) => sum + (l.workDuration ?? 0), 0);
    return Math.round((totalMins / 60) * 10) / 10;
  }, [logs, showNeutral]);

  const summaryLabel = totalHrs != null ? `${totalHrs}h this week` : 'This week';

  return (
    <div
      title="This week's attendance"
      className="hidden items-center gap-2 rounded-[14px] bg-white/[0.08] px-3 text-white sm:flex"
      style={{ height: 46 }}
    >
      <Icon name="calendar_view_week" size={15} className="opacity-70" />
      <div className="flex flex-col justify-center leading-tight">
        <div className={`flex gap-[3px] text-[9px] font-semibold tracking-wide${isLoading ? ' animate-pulse' : ''}`}>
          {DAY_LETTERS.map((d, i) => (
            <span key={i} className={`w-2.5 text-center ${VISUAL_CLASS[visuals[i]]}`}>{d}</span>
          ))}
        </div>
        <div className="text-[10px] text-white/80">{summaryLabel}</div>
      </div>
    </div>
  );
}

export default WeekGlanceWidget;
