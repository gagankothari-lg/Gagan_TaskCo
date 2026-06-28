'use client';

import type { DashboardData } from '../../../lib/types';

const BUCKETS: { key: keyof DashboardData['upcomingTasks']; label: string; color: string }[] = [
  { key: 'overdue', label: 'Overdue', color: 'var(--danger)' },
  { key: 'today', label: 'Today', color: 'var(--warn)' },
  { key: 'tomorrow', label: 'Tomorrow', color: 'var(--p)' },
  { key: 'thisWeek', label: 'This Week', color: 'var(--muted)' },
  { key: 'nextWeek', label: 'Next Week', color: 'var(--muted)' },
];

export function UpcomingTasksWidget({ buckets }: { buckets: DashboardData['upcomingTasks'] }) {
  return (
    <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-card">
      <h3 className="mb-3 text-sm font-medium text-[var(--text)]">Upcoming Tasks</h3>
      <div className="space-y-3">
        {BUCKETS.map(({ key, label, color }) => {
          const tasks = buckets[key];
          return (
            <div key={key}>
              <div className="mb-1 flex items-center gap-2">
                <span className="h-[7px] w-[7px] rounded-full" style={{ backgroundColor: color }} />
                <span className="text-xs font-medium" style={{ color }}>{label}</span>
                <span className="rounded-[9999px] bg-[var(--p3)] px-1.5 text-[10px] text-[var(--muted)]">{tasks.length}</span>
              </div>
              <div className="space-y-0.5 pl-4">
                {tasks.slice(0, 3).map((t) => (
                  <p key={t.taskId} className="truncate text-xs text-[var(--muted)]">{t.title}</p>
                ))}
                {tasks.length === 0 && <p className="text-xs text-[var(--muted)]/60">—</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default UpcomingTasksWidget;
