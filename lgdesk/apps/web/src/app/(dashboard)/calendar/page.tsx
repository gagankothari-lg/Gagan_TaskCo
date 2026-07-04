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
// Master Reference Part 20 Event Types table: Holiday chips render first in a day's
// stack even though the general type order (CAT_ORDER, used for the legend/filter
// chips) lists Holiday fourth.
const STACK_ORDER: Cat[] = ['holiday', 'task', 'deadline', 'leave', 'meeting'];

interface Bar { cat: Cat; label: string; id?: string; sub?: string }

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
        push(isoKey(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()), { cat: 'leave', label: l.leaveType });
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
            {cells.map((d, i) => {
              if (d === null) return <div key={`b-${i}`} className="min-h-[90px] border-b border-r border-border bg-bg" />;
              const key = isoKey(year, month, d);
              const isToday = key === todayKey;
              const bars = (barsByDay.get(key) ?? []).filter((b) => active[b.cat]);
              const stacked = [...bars].sort((a, b) => STACK_ORDER.indexOf(a.cat) - STACK_ORDER.indexOf(b.cat));
              const shown = stacked.slice(0, 3);
              const extra = stacked.length - shown.length;
              return (
                <Popover key={key} open={openDay === key} onOpenChange={(o) => setOpenDay(o ? key : null)}>
                  <PopoverTrigger asChild>
                    <div className={cn('min-h-[90px] cursor-pointer border-b border-r border-border p-1.5 align-top hover:bg-p3/40', isToday ? 'bg-p3' : 'bg-surface')}>
                      <span className={cn('inline-flex h-6 w-6 items-center justify-center rounded-full text-xs', isToday ? 'bg-p font-semibold text-white' : 'text-text')}>{d}</span>
                      <div className="mt-1 space-y-0.5">
                        {shown.map((b, bi) => {
                          const clickable = (b.cat === 'task' || b.cat === 'meeting') && !!b.id;
                          return (
                            <div
                              key={bi}
                              title={`${CAT[b.cat].label}: ${b.label}`}
                              onClick={clickable ? (e) => { e.stopPropagation(); onBarClick(b); } : undefined}
                              className={cn('truncate rounded-[3px] px-1 text-[10px]', clickable && 'cursor-pointer hover:underline')}
                              style={{ background: CAT[b.cat].solid, color: '#fff' }}
                            >
                              {b.label}
                            </div>
                          );
                        })}
                        {extra > 0 && <div className="px-1 text-[10px] text-muted">+{extra} more</div>}
                      </div>
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
          </div>
        </div>
      )}

      <HolidayModal open={holidayOpen} onClose={() => setHolidayOpen(false)} defaultDate={holidayDefaultDate} />
      <TaskDetailModal taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} />
    </div>
  );
}
