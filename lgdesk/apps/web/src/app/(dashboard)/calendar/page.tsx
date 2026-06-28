'use client';

import { useMemo, useState } from 'react';
import { Icon } from '../../../components/ui/icon';
import { useAuth } from '../../../hooks/use-auth';
import { useCalendar } from '../../../hooks/use-leaves';
import { HolidayModal } from '../../../components/modules/leaves/holiday-modal';
import { Spinner } from '../../../components/ui/spinner';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// UTC-safe YYYY-MM-DD key so Date objects and ISO strings never mismatch.
const isoKey = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const dayKey = (iso: string) => iso.slice(0, 10);

// Event-category colours (legend + bars).
type Cat = 'task' | 'meeting' | 'deadline' | 'holiday' | 'leave';
const CAT: Record<Cat, { label: string; color: string; bg: string }> = {
  task:     { label: 'Task Due Dates',    color: '#1a237e', bg: '#e8eaf6' },
  meeting:  { label: 'Events & Meetings', color: '#455a64', bg: '#eceff1' },
  deadline: { label: 'Project Deadlines', color: '#c62828', bg: '#fce8e8' },
  holiday:  { label: 'Holidays',          color: '#e65100', bg: '#fff3e0' },
  leave:    { label: 'Leaves',            color: '#ad1457', bg: '#fce4ec' },
};
const CAT_ORDER: Cat[] = ['task', 'meeting', 'deadline', 'holiday', 'leave'];

interface Bar { cat: Cat; label: string }

// Narrow an untyped /calendar meeting entry to a { date, title } we can place.
function meetingFields(m: unknown): { date: string; title: string } | null {
  if (!m || typeof m !== 'object') return null;
  const o = m as Record<string, unknown>;
  const date = o.startTime ?? o.start ?? o.date;
  if (typeof date !== 'string') return null;
  const title = typeof o.title === 'string' ? o.title : 'Meeting';
  return { date, title };
}

export default function CalendarPage() {
  const { tasks, projects } = useAuth();
  const { data, isLoading } = useCalendar();
  const [cursor, setCursor] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); });
  const [active, setActive] = useState<Record<Cat, boolean>>({ task: true, meeting: true, deadline: true, holiday: true, leave: true });
  const [scope, setScope] = useState('Organisation');
  const [holidayOpen, setHolidayOpen] = useState(false);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = (() => { const n = new Date(); return isoKey(n.getFullYear(), n.getMonth(), n.getDate()); })();

  // Bucket every data source into a key -> Bar[] map, once per data change.
  const barsByDay = useMemo(() => {
    const map = new Map<string, Bar[]>();
    const push = (key: string, bar: Bar) => { const a = map.get(key) ?? []; a.push(bar); map.set(key, a); };

    for (const t of tasks) {
      if (t.dueDate) push(dayKey(t.dueDate), { cat: 'task', label: t.title });
    }
    for (const p of projects) {
      if (p.deadline) push(dayKey(p.deadline), { cat: 'deadline', label: p.name });
    }
    for (const h of data?.holidays ?? []) {
      push(dayKey(h.date), { cat: 'holiday', label: h.name });
    }
    for (const l of data?.leaves ?? []) {
      // Span every day from start..end inclusive.
      const start = new Date(`${dayKey(l.startDate)}T00:00:00Z`);
      const end = new Date(`${dayKey(l.endDate)}T00:00:00Z`);
      for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
        push(isoKey(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()), { cat: 'leave', label: l.leaveType });
      }
    }
    for (const m of data?.meetings ?? []) {
      const f = meetingFields(m);
      if (f) push(dayKey(f.date), { cat: 'meeting', label: f.title });
    }
    return map;
  }, [tasks, projects, data]);

  const cells = useMemo(() => {
    const arr: (number | null)[] = [];
    for (let i = 0; i < firstDow; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(d);
    return arr;
  }, [firstDow, daysInMonth]);

  return (
    <div className="p-6">
      <div className="ph">
        <div className="ph-left">
          <div className="ph-title">Calendar</div>
          <div className="ph-sub">Tasks, deadlines, leaves &amp; holidays across the team</div>
        </div>
        <div className="ph-actions">
          <button onClick={() => setHolidayOpen(true)} className="btn btn-accent">
            <Icon name="add" size={15} /> Add Holiday
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button onClick={() => setCursor(new Date(year, month - 1, 1))} aria-label="Previous month" className="rounded-[8px] border border-[var(--border)] p-1.5 text-[var(--muted)] hover:bg-[var(--p3)]"><Icon name="chevron_left" size={16} /></button>
          <button onClick={() => { const n = new Date(); setCursor(new Date(n.getFullYear(), n.getMonth(), 1)); }} className="rounded-[8px] border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text)] hover:bg-[var(--p3)]">Today</button>
          <button onClick={() => setCursor(new Date(year, month + 1, 1))} aria-label="Next month" className="rounded-[8px] border border-[var(--border)] p-1.5 text-[var(--muted)] hover:bg-[var(--p3)]"><Icon name="chevron_right" size={16} /></button>
        </div>
        <div style={{ fontSize: 18, fontWeight: 700 }} className="text-[var(--text)]">
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
                className="inline-flex items-center gap-1.5 rounded-[12px] border px-2.5 py-1 text-xs font-medium"
                style={{ borderColor: 'var(--border)', background: on ? CAT[c].bg : 'transparent', color: on ? CAT[c].color : 'var(--muted2)', opacity: on ? 1 : 0.6 }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: CAT[c].color, display: 'inline-block' }} />
                {CAT[c].label}
              </button>
            );
          })}
        </div>

        <div className="ml-auto">
          <select value={scope} onChange={(e) => setScope(e.target.value)} className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text)] focus:border-[var(--p)] focus:outline-none">
            <option>Organisation</option>
            <option>My Team</option>
            <option>Mine</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-[var(--muted)]"><Spinner size={16} /> Loading…</div>
      ) : (
        <div className="overflow-hidden rounded-[8px] border border-[var(--border)]">
          <div className="grid grid-cols-7">
            {DOW.map((d) => (
              <div key={d} className="border-b border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">{d}</div>
            ))}
            {cells.map((d, i) => {
              if (d === null) return <div key={`b-${i}`} className="min-h-[90px] border-b border-r border-[var(--border)] bg-[var(--bg)]" />;
              const key = isoKey(year, month, d);
              const isToday = key === todayKey;
              const bars = (barsByDay.get(key) ?? []).filter((b) => active[b.cat]);
              const shown = bars.slice(0, 3);
              const extra = bars.length - shown.length;
              return (
                <div key={key} className="min-h-[90px] border-b border-r border-[var(--border)] bg-[var(--surface)] p-1.5 align-top">
                  <span className={['text-xs', isToday ? 'inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--p)] font-semibold text-white' : 'text-[var(--muted)]'].join(' ')}>{d}</span>
                  <div className="mt-1 space-y-0.5">
                    {shown.map((b, bi) => (
                      <div key={bi} title={`${CAT[b.cat].label}: ${b.label}`} className="truncate rounded-[3px] px-1 text-[10px]" style={{ background: CAT[b.cat].bg, color: CAT[b.cat].color }}>
                        {b.label}
                      </div>
                    ))}
                    {extra > 0 && <div className="px-1 text-[10px] text-[var(--muted)]">+{extra} more</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <HolidayModal open={holidayOpen} onClose={() => setHolidayOpen(false)} />
    </div>
  );
}
