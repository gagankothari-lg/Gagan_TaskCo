'use client';

import { useMemo, useState } from 'react';
import { Icon } from '../../../../components/ui/icon';
import { usePlanWeek } from '../../../../lib/api/tasks';
import { TaskDetailModal } from '../../../../components/modules/tasks/task-detail-modal';
import { statusDotColor, isTaskOverdue } from '../../../../components/modules/tasks/task-row';
import { Spinner } from '../../../../components/ui/spinner';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function mondayUTC(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = (x.getUTCDay() + 6) % 7; // Monday = 0
  x.setUTCDate(x.getUTCDate() - dow);
  return x;
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function PlanWeekPage() {
  const [weekStart, setWeekStart] = useState<Date>(() => mondayUTC(new Date()));
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data: grouped, isLoading } = usePlanWeek(weekStart.toISOString());
  const todayKey = isoDay(new Date());

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setUTCDate(d.getUTCDate() + i);
        return d;
      }),
    [weekStart],
  );

  const shift = (delta: number) => {
    const d = new Date(weekStart);
    d.setUTCDate(d.getUTCDate() + delta);
    setWeekStart(d);
  };

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text)]">Plan My Week</h1>
          <p className="text-sm text-[var(--muted)]">
            Week of {weekStart.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => shift(-7)} aria-label="Previous week" className="rounded-[8px] border border-[var(--border)] p-1.5 text-[var(--muted)] hover:bg-[var(--p3)]"><Icon name="chevron_left" size={16} /></button>
          <button onClick={() => setWeekStart(mondayUTC(new Date()))} className="rounded-[8px] border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text)] hover:bg-[var(--p3)]">Today</button>
          <button onClick={() => shift(7)} aria-label="Next week" className="rounded-[8px] border border-[var(--border)] p-1.5 text-[var(--muted)] hover:bg-[var(--p3)]"><Icon name="chevron_right" size={16} /></button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-[var(--muted)]"><Spinner size={16} /> Loading…</div>
      ) : (
        <div className="grid grid-cols-7 gap-2">
          {days.map((d, i) => {
            const key = isoDay(d);
            const tasks = grouped?.[key] ?? [];
            const isToday = key === todayKey;
            return (
              <div key={key} className={['min-h-[200px] rounded-[8px] border bg-[var(--surface)] p-2', isToday ? 'border-[var(--p)]' : 'border-[var(--border)]'].join(' ')}>
                <div className="mb-2 px-1">
                  <p className="text-xs font-medium text-[var(--text)]">{DAY_NAMES[i]}</p>
                  <p className="text-xs text-[var(--muted)]">{d.getUTCDate()}</p>
                </div>
                <div className="space-y-1">
                  {tasks.map((t) => (
                    <button key={t.taskId} onClick={() => setDetailId(t.taskId)} className="flex w-full items-start gap-1.5 rounded-[8px] border border-[var(--border)] bg-[var(--bg)] p-1.5 text-left hover:bg-[var(--p3)]">
                      <span className="mt-1 h-[6px] w-[6px] shrink-0 rounded-full" style={{ backgroundColor: statusDotColor(t.status, isTaskOverdue(t)) }} />
                      <span className="line-clamp-2 text-xs text-[var(--text)]">{t.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <TaskDetailModal taskId={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}
