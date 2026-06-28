'use client';

import { useMemo, useState } from 'react';
import { Icon } from '../../../components/ui/icon';
import { useCalendar } from '../../../hooks/use-leaves';
import { Spinner } from '../../../components/ui/spinner';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export default function CalendarPage() {
  const { data, isLoading } = useCalendar();
  const [cursor, setCursor] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); });
  const [selected, setSelected] = useState<string | null>(null);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayIso = isoDay(new Date());

  const cells = useMemo(() => {
    const arr: (Date | null)[] = [];
    for (let i = 0; i < firstDow; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(new Date(Date.UTC(year, month, d)));
    return arr;
  }, [year, month, firstDow, daysInMonth]);

  function eventsFor(day: Date) {
    const key = isoDay(day);
    const holidays = (data?.holidays ?? []).filter((h) => h.date.slice(0, 10) === key);
    const leaves = (data?.leaves ?? []).filter((l) => key >= l.startDate.slice(0, 10) && key <= l.endDate.slice(0, 10));
    return { holidays, leaves };
  }

  const selectedEvents = selected ? eventsFor(new Date(selected)) : null;

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text)]">Calendar</h1>
          <p className="text-sm text-[var(--muted)]">{cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setCursor(new Date(year, month - 1, 1))} aria-label="Previous month" className="rounded-[8px] border border-[var(--border)] p-1.5 text-[var(--muted)] hover:bg-[var(--p3)]"><Icon name="chevron_left" size={16} /></button>
          <button onClick={() => { const n = new Date(); setCursor(new Date(n.getFullYear(), n.getMonth(), 1)); }} className="rounded-[8px] border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text)] hover:bg-[var(--p3)]">Today</button>
          <button onClick={() => setCursor(new Date(year, month + 1, 1))} aria-label="Next month" className="rounded-[8px] border border-[var(--border)] p-1.5 text-[var(--muted)] hover:bg-[var(--p3)]"><Icon name="chevron_right" size={16} /></button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-[var(--muted)]"><Spinner size={16} /> Loading…</div>
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {DOW.map((d) => <div key={d} className="px-2 py-1 text-center text-xs text-[var(--muted)]">{d}</div>)}
          {cells.map((day, i) => {
            if (!day) return <div key={`b-${i}`} />;
            const key = isoDay(day);
            const ev = eventsFor(day);
            const isToday = key === todayIso;
            return (
              <button key={key} onClick={() => setSelected(key)} className={['min-h-[88px] rounded-[8px] border bg-[var(--surface)] p-1.5 text-left align-top transition-colors hover:border-[var(--p)]', isToday ? 'border-[var(--p)]' : 'border-[var(--border)]'].join(' ')}>
                <span className={['text-xs', isToday ? 'font-semibold text-[var(--p)]' : 'text-[var(--muted)]'].join(' ')}>{day.getUTCDate()}</span>
                <div className="mt-1 space-y-0.5">
                  {ev.holidays.map((h) => <div key={h.id} className="truncate rounded-[3px] bg-[var(--p3)] px-1 text-[10px] text-[var(--p)]">{h.name}</div>)}
                  {ev.leaves.map((l) => <div key={l.leaveId} className="truncate rounded-[3px] bg-[var(--warn)]/15 px-1 text-[10px] text-[var(--warn)]">{l.leaveType}</div>)}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selected && selectedEvents && (
        <div className="mt-4 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="mb-2 text-sm font-medium text-[var(--text)]">{new Date(selected).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          {selectedEvents.holidays.length === 0 && selectedEvents.leaves.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No events.</p>
          ) : (
            <div className="space-y-1 text-sm">
              {selectedEvents.holidays.map((h) => <p key={h.id} className="text-[var(--p)]">Holiday: {h.name}</p>)}
              {selectedEvents.leaves.map((l) => <p key={l.leaveId} className="text-[var(--warn)]">Leave: {l.leaveType} ({l.days}d)</p>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
