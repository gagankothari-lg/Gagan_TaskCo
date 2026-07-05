'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '../../../components/ui/icon';
import { useAuth } from '../../../hooks/use-auth';
import { isAdmin, isManager } from '../../../lib/auth';
import { useCalendar } from '../../../lib/api/calendar';
import { useDeleteHoliday } from '../../../lib/api/leaves';
import { apiErrorMessage } from '../../../lib/api/client';
import { toast } from '../../../lib/toast';
import { HolidayModal } from '../../../components/modules/leaves/holiday-modal';
import { TaskDetailModal } from '../../../components/modules/tasks/task-detail-modal';
import { Spinner } from '../../../components/ui/spinner';
import { Popover, PopoverTrigger, PopoverContent } from '../../../components/ui/popover';
import { cn } from '../../../lib/utils';

const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// UTC-safe YYYY-MM-DD key so Date objects and ISO strings never mismatch.
const isoKey = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const dayKey = (iso: string) => iso.slice(0, 10);

// Event-category colours — reference/lgdesk-gas-source.html's dedicated calendar palette
// (.cal-fchip-*/.cal-ev-*, CSS lines 723-750), NOT the shared app tokens (except where the
// two coincide, e.g. meeting/deadline/holiday border-accent below). `text` is the outline
// chip's text colour; `solid` is the chip border/dot AND the on-grid event bar's solid fill
// (paired with white text) — reference uses the same hex for both roles in every category.
type Cat = 'task' | 'meeting' | 'deadline' | 'holiday' | 'leave';
const CAT: Record<Cat, { label: string; text: string; solid: string }> = {
  task:     { label: 'Task Due Dates',    text: '#1565c0', solid: '#1565c0' },
  meeting:  { label: 'Events & Meetings', text: '#00695c', solid: 'var(--accent)' },
  deadline: { label: 'Project Deadlines', text: '#b71c1c', solid: 'var(--danger)' },
  holiday:  { label: 'Holidays',          text: '#1b5e20', solid: 'var(--ok)' },
  leave:    { label: 'Leaves',            text: '#4a148c', solid: '#6a1b9a' },
};
const CAT_ORDER: Cat[] = ['task', 'meeting', 'deadline', 'holiday', 'leave'];
// reference/app.js.html:12230 `TYPE_ORDER = { holiday: 0, meeting: 1, task: 2, project: 3, leave: 4 }`
// — this is the stack/row-packing order for the on-grid event bars (distinct from CAT_ORDER,
// which is only the legend/filter-chip and day-popover grouping order). 'deadline' here is the
// reference's 'project' (Project Deadlines).
const STACK_ORDER: Cat[] = ['holiday', 'meeting', 'task', 'deadline', 'leave'];
// reference/app.js.html:12229,12281 `MAX_EV_ROWS = 4` — cap on visible stacked rows per week
// before the remainder collapses into a "+N more" overflow indicator.
const MAX_EV_ROWS = 4;

interface Bar { cat: Cat; label: string; id?: string; sub?: string }
// One event-bar placed on the week grid: colStart/colEnd are 1-based, inclusive day-of-week
// columns (colEnd > colStart only for a multi-day-spanning leave bar). `ds` is the date (within
// this week row) a click on the bar should open the day-detail popover for — reference/app.js.html:
// 12255,12315 (calDayClick(event, item.ds) for non task/meeting types).
interface GridItem { bar: Bar; colStart: number; colEnd: number; ds: string }
interface PlacedItem { item: GridItem; row: number }

export default function CalendarPage() {
  const router = useRouter();
  const { currentUser, tasks, projects, employees } = useAuth();
  const { data, isLoading } = useCalendar();
  const deleteHoliday = useDeleteHoliday();

  const [cursor, setCursor] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); });
  const [active, setActive] = useState<Record<Cat, boolean>>({ task: true, meeting: true, deadline: true, holiday: true, leave: true });
  const [team, setTeam] = useState<string>('Organisation');
  const [member, setMember] = useState<string>('ALL');
  const [holidayOpen, setHolidayOpen] = useState(false);
  const [holidayDefaultDate, setHolidayDefaultDate] = useState<string | undefined>(undefined);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const manager = !!currentUser && isManager(currentUser.role);
  const admin = !!currentUser && isAdmin(currentUser.role);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = (() => { const n = new Date(); return isoKey(n.getFullYear(), n.getMonth(), n.getDate()); })();

  const teams = useMemo(() => Array.from(new Set(employees.map((e) => e.team).filter(Boolean))) as string[], [employees]);
  const empTeam = useMemo(() => new Map(employees.map((e) => [e.empId, e.team])), [employees]);
  const teamMembers = useMemo(
    () => (team === 'Organisation' ? [] : employees.filter((e) => e.team === team)),
    [employees, team],
  );

  function onTeamChange(v: string) {
    setTeam(v);
    setMember('ALL');
  }

  // Team-then-member scoping. Holidays are org-wide and never filtered out.
  const inScope = (empIds: string[], teams: string[] = []): boolean => {
    if (team !== 'Organisation') {
      const teamMatch = teams.includes(team) || empIds.some((id) => empTeam.get(id) === team);
      if (!teamMatch) return false;
    }
    if (member !== 'ALL' && !empIds.includes(member)) return false;
    return true;
  };

  // Bucket every data source into a key -> Bar[] map, once per data/scope change.
  const barsByDay = useMemo(() => {
    const map = new Map<string, Bar[]>();
    const push = (key: string, bar: Bar) => { const a = map.get(key) ?? []; a.push(bar); map.set(key, a); };

    for (const t of tasks) {
      if (!t.dueDate || t.status === 'Done' || t.status === 'Cancelled') continue;
      if (!inScope([...t.assigneeIds, t.assignerId], t.assignedTeams)) continue;
      push(dayKey(t.dueDate), { cat: 'task', label: t.title, id: t.taskId });
    }
    for (const p of projects) {
      if (!p.deadline || p.status === 'Done' || p.status === 'Cancelled') continue;
      if (!inScope([...p.assigneeIds, ...p.ownerIds, p.assignerId], p.assignedTeams)) continue;
      push(dayKey(p.deadline), { cat: 'deadline', label: p.name });
    }
    for (const h of data?.holidays ?? []) {
      push(dayKey(h.date), { cat: 'holiday', label: h.name, id: h.id });
    }
    for (const l of data?.leaves ?? []) {
      if (!inScope([l.empId])) continue;
      // Span every day from start..end inclusive.
      const start = new Date(`${dayKey(l.startDate)}T00:00:00Z`);
      const end = new Date(`${dayKey(l.endDate)}T00:00:00Z`);
      for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
        // id is required for cross-day span detection below (buildWeekLayouts) — without it,
        // two different employees' same-typed leave on adjacent days would incorrectly merge
        // into one spanning bar.
        push(isoKey(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()), { cat: 'leave', label: l.leaveType, id: l.leaveId });
      }
    }
    for (const m of data?.meetings ?? []) {
      if (!inScope([m.organizerId, ...m.attendeeIds], m.attendeeTeams)) continue;
      push(dayKey(m.startTime), { cat: 'meeting', label: m.title, id: m.meetingId });
    }
    return map;
  }, [tasks, projects, data, team, member, empTeam]); // eslint-disable-line react-hooks/exhaustive-deps

  // Always a fixed 6-week (42-cell) grid, padded with blanks either side of the month.
  const cells = useMemo(() => {
    const arr: (number | null)[] = [];
    for (let i = 0; i < firstDow; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(d);
    while (arr.length < 42) arr.push(null);
    return arr;
  }, [firstDow, daysInMonth]);

  function onBarClick(b: Bar) {
    if (b.cat === 'task' && b.id) setSelectedTaskId(b.id);
    if (b.cat === 'meeting' && b.id) router.push(`/meetings?highlight=${b.id}`);
  }

  const groupedForDay = (key: string) => {
    const bars = (barsByDay.get(key) ?? []).filter((b) => active[b.cat]);
    const groups = new Map<Cat, Bar[]>();
    bars.forEach((b) => groups.set(b.cat, [...(groups.get(b.cat) ?? []), b]));
    return groups;
  };

  // 6 rows of 7 cells (day-of-month or null for out-of-month padding) — same shape as `cells`,
  // just chunked for per-week span/pack processing (reference/app.js.html:12226-12227, `weeks`).
  const weeks = useMemo(() => {
    const w: (number | null)[][] = [];
    for (let i = 0; i < 42; i += 7) w.push(cells.slice(i, i + 7));
    return w;
  }, [cells]);

  // Real multi-day-spanning event bars + row-packing, ported from reference/app.js.html:
  // renderCalendar (12232-12332). Per week row: (1) collect one item per event, with leave
  // events widened to a colStart..colEnd span covering every contiguous day within THIS week
  // row the same leave (by id) appears on; (2) sort longer spans first, then stack order, then
  // column; (3) greedily pack into rows (row 1 reserved for day numbers), capping at
  // MAX_EV_ROWS visible rows and counting the rest per affected column as overflow.
  const weekLayouts = useMemo(() => {
    return weeks.map((week) => {
      const items: GridItem[] = [];
      const seenLeaveIds = new Set<string>();

      week.forEach((d, ci) => {
        if (d === null) return;
        const key = isoKey(year, month, d);
        const col = ci + 1;
        const evs = (barsByDay.get(key) ?? [])
          .filter((b) => active[b.cat])
          .sort((a, b) => STACK_ORDER.indexOf(a.cat) - STACK_ORDER.indexOf(b.cat));

        evs.forEach((bar) => {
          if (bar.cat === 'leave' && bar.id) {
            if (seenLeaveIds.has(bar.id)) return;
            seenLeaveIds.add(bar.id);
            // Contiguous span of this same leave across the rest of this week row.
            let colEnd = ci;
            for (let fc = ci + 1; fc < 7; fc++) {
              const fd = week[fc];
              if (fd === null) break;
              const fkey = isoKey(year, month, fd);
              const found = (barsByDay.get(fkey) ?? []).some((fb) => fb.cat === 'leave' && fb.id === bar.id && active[fb.cat]);
              if (!found) break;
              colEnd = fc;
            }
            items.push({ bar, colStart: col, colEnd: colEnd + 1, ds: key });
          } else {
            items.push({ bar, colStart: col, colEnd: col, ds: key });
          }
        });
      });

      // Longer spans first, then stack order, then column (reference:12264-12270).
      items.sort((a, b) => {
        const spanDiff = (b.colEnd - b.colStart) - (a.colEnd - a.colStart);
        if (spanDiff) return spanDiff;
        const typeDiff = STACK_ORDER.indexOf(a.bar.cat) - STACK_ORDER.indexOf(b.bar.cat);
        if (typeDiff) return typeDiff;
        return a.colStart - b.colStart;
      });

      const colNext = [2, 2, 2, 2, 2, 2, 2]; // next free row per column; row 1 = day numbers
      const overflowCol = [0, 0, 0, 0, 0, 0, 0];
      const placed: PlacedItem[] = [];

      items.forEach((item) => {
        let row = 2;
        for (let c = item.colStart - 1; c < item.colEnd; c++) row = Math.max(row, colNext[c]);
        if (row > MAX_EV_ROWS + 1) {
          for (let c = item.colStart - 1; c < item.colEnd; c++) overflowCol[c]++;
          return;
        }
        for (let c = item.colStart - 1; c < item.colEnd; c++) colNext[c] = row + 1;
        placed.push({ item, row });
      });

      return { week, placed, overflowCol };
    });
  }, [weeks, barsByDay, active, year, month]);

  return (
    <div className="p-6">
      <div className="ph">
        <div className="ph-left">
          <div className="ph-title">Calendar</div>
          <div className="ph-sub">Tasks, deadlines, leaves &amp; holidays across the team</div>
        </div>
        {admin && (
          <div className="ph-actions">
            <button onClick={() => { setHolidayDefaultDate(undefined); setHolidayOpen(true); }} className="btn btn-primary">
              <Icon name="add" size={15} /> Add Holiday
            </button>
          </div>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button onClick={() => setCursor(new Date(year, month - 1, 1))} aria-label="Previous month" className="rounded-[8px] border border-border p-1.5 text-muted hover:bg-p3"><Icon name="chevron_left" size={16} /></button>
          <button onClick={() => { const n = new Date(); setCursor(new Date(n.getFullYear(), n.getMonth(), 1)); }} className="rounded-[8px] border border-border px-3 py-1.5 text-sm text-text hover:bg-p3">Today</button>
          <button onClick={() => setCursor(new Date(year, month + 1, 1))} aria-label="Next month" className="rounded-[8px] border border-border p-1.5 text-muted hover:bg-p3"><Icon name="chevron_right" size={16} /></button>
        </div>
        <div style={{ fontSize: 18, fontWeight: 700 }} className="text-p">
          {cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {CAT_ORDER.map((c) => {
            const on = active[c];
            return (
              <button
                key={c}
                onClick={() => setActive((s) => ({ ...s, [c]: !s[c] }))}
                aria-pressed={on}
                className="inline-flex items-center gap-1.5 rounded-[20px] border-[1.5px] px-2.5 py-1 text-xs font-semibold transition-[opacity,filter] duration-150"
                style={{
                  background: 'none',
                  borderColor: CAT[c].solid,
                  color: CAT[c].text,
                  opacity: on ? 1 : 0.35,
                  filter: on ? 'none' : 'grayscale(0.4)',
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: 2, background: CAT[c].solid, display: 'inline-block' }} />
                {CAT[c].label}
              </button>
            );
          })}
        </div>

        {/* Team + Member selects — managers/admins only (Part 37 Calendar Checklist). Reference
            renders both selects unconditionally (static "All Members" placeholder), so no team
            gate here. */}
        {manager && (
          <div className="ml-auto flex items-center gap-2">
            <select value={team} onChange={(e) => onTeamChange(e.target.value)} className="rounded-[8px] border border-border bg-surface px-3 py-1.5 text-sm text-text focus:border-p focus:outline-none">
              <option value="Organisation">Organisation</option>
              {teams.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={member} onChange={(e) => setMember(e.target.value)} className="rounded-[8px] border border-border bg-surface px-3 py-1.5 text-sm text-text focus:border-p focus:outline-none">
              <option value="ALL">All Members</option>
              {teamMembers.map((e) => <option key={e.empId} value={e.empId}>{e.firstName} {e.lastName}</option>)}
            </select>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted"><Spinner size={16} /> Loading calendar…</div>
      ) : (
        <div className="overflow-hidden rounded-[8px] border border-border">
          <div className="grid grid-cols-7">
            {DOW.map((d, di) => (
              <div
                key={d}
                className="border-b border-border bg-surface px-2 py-1.5 text-center text-[11px] font-medium tracking-[0.3px] text-muted"
                style={di === 0 ? { color: 'var(--danger)' } : undefined}
              >
                {d}
              </div>
            ))}
          </div>

          {/* One CSS-grid per week row: row 1 holds the day-number cells (each spanning all
              6 rows as a full-height background/click-target), rows 2-5 hold up to
              MAX_EV_ROWS stacked/spanning event bars, row 6 holds the "+N more" overflow
              indicator — mirrors reference/app.js.html:12300-12329's per-week grid-column/
              grid-row placement. */}
          {weekLayouts.map(({ week, placed, overflowCol }, wi) => (
            <div
              key={wi}
              className="grid grid-cols-7"
              style={{ gridTemplateRows: `minmax(30px,auto) repeat(${MAX_EV_ROWS}, minmax(15px,auto)) minmax(13px,auto)` }}
            >
              {week.map((d, ci) => {
                if (d === null) {
                  return <div key={`b-${wi}-${ci}`} style={{ gridColumn: ci + 1, gridRow: '1 / span 6' }} className="border-b border-r border-border bg-bg" />;
                }
                const key = isoKey(year, month, d);
                const isToday = key === todayKey;
                const bars = (barsByDay.get(key) ?? []).filter((b) => active[b.cat]);
                return (
                  <Popover key={key} open={openDay === key} onOpenChange={(o) => setOpenDay(o ? key : null)}>
                    <PopoverTrigger asChild>
                      <div
                        style={{ gridColumn: ci + 1, gridRow: '1 / span 6' }}
                        className={cn('cursor-pointer border-b border-r border-border p-1.5 align-top hover:bg-p3/40', isToday ? 'bg-p3' : 'bg-surface')}
                      >
                        <span className={cn('inline-flex h-6 w-6 items-center justify-center rounded-full text-xs', isToday ? 'bg-p font-semibold text-white' : 'text-text')}>{d}</span>
                      </div>
                    </PopoverTrigger>
                    <PopoverContent onClick={(e) => e.stopPropagation()}>
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm font-bold text-p">{new Date(`${key}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</p>
                      </div>
                      {bars.length === 0 ? (
                        <p className="text-sm text-muted">No events this day.</p>
                      ) : (
                        <div className="space-y-2">
                          {CAT_ORDER.filter((c) => groupedForDay(key).has(c)).map((c) => (
                            <div key={c}>
                              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">{CAT[c].label}</p>
                              {groupedForDay(key).get(c)!.map((b, bi) => (
                                <div key={bi} className="flex items-center justify-between gap-2 rounded-[6px] px-1.5 py-1 text-xs hover:bg-p3">
                                  <button
                                    type="button"
                                    onClick={() => onBarClick(b)}
                                    className={cn('truncate text-left', (b.cat === 'task' || b.cat === 'meeting') && 'cursor-pointer text-p underline-offset-2 hover:underline')}
                                    style={{ color: b.cat === 'task' || b.cat === 'meeting' ? 'var(--p)' : 'var(--text)' }}
                                  >
                                    {b.label}
                                  </button>
                                  {admin && c === 'holiday' && b.id && (
                                    <button
                                      type="button"
                                      aria-label="Delete holiday"
                                      onClick={async () => {
                                        try { await deleteHoliday.mutateAsync(b.id!); toast('Holiday deleted', 'success'); }
                                        catch (err) { toast(apiErrorMessage(err, 'Unable to delete holiday'), 'error'); }
                                      }}
                                      className="text-muted hover:text-danger"
                                    >
                                      <Icon name="delete" size={14} />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                      {admin && (
                        <button
                          type="button"
                          onClick={() => { setOpenDay(null); setHolidayDefaultDate(key); setHolidayOpen(true); }}
                          className="btn btn-primary btn-sm btn-full mt-3"
                        >
                          <Icon name="add" size={13} /> Add Holiday for this day
                        </button>
                      )}
                    </PopoverContent>
                  </Popover>
                );
              })}

              {/* Event bars — grid-column spans > 1 for multi-day leave bars, single column
                  otherwise. Rendered after the day cells so they paint on top (no z-index
                  needed: later same-stacking-context DOM siblings win). */}
              {placed.map(({ item, row }, pi) => {
                const clickable = (item.bar.cat === 'task' || item.bar.cat === 'meeting') && !!item.bar.id;
                const span = item.colEnd - item.colStart + 1;
                return (
                  <div
                    key={`ev-${wi}-${pi}`}
                    title={`${CAT[item.bar.cat].label}: ${item.bar.label}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (clickable) onBarClick(item.bar);
                      else setOpenDay(item.ds);
                    }}
                    className={cn('cursor-pointer truncate rounded-[3px] px-1 text-[10px]', clickable && 'hover:underline')}
                    style={{
                      gridColumn: `${item.colStart} / span ${span}`,
                      gridRow: row,
                      background: CAT[item.bar.cat].solid,
                      color: '#fff',
                    }}
                  >
                    {item.bar.label}
                  </div>
                );
              })}

              {/* Overflow "+N more" per column, beyond MAX_EV_ROWS visible bars. */}
              {overflowCol.map((n, ci) => {
                if (n <= 0 || week[ci] === null) return null;
                const key = isoKey(year, month, week[ci] as number);
                return (
                  <div
                    key={`ov-${wi}-${ci}`}
                    style={{ gridColumn: ci + 1, gridRow: MAX_EV_ROWS + 2 }}
                    onClick={(e) => { e.stopPropagation(); setOpenDay(key); }}
                    className="cursor-pointer px-1 text-[10px] text-muted hover:underline"
                  >
                    +{n} more
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      <HolidayModal open={holidayOpen} onClose={() => setHolidayOpen(false)} defaultDate={holidayDefaultDate} />
      <TaskDetailModal taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} />
    </div>
  );
}
