'use client';

import { useMemo, useState } from 'react';
import { useAuth } from '../../../../hooks/use-auth';
import { Icon } from '../../../../components/ui/icon';
import { Card, CardContent } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { Badge } from '../../../../components/ui/badge';
import { TaskDetailModal } from '../../../../components/modules/tasks/task-detail-modal';
import { InlineStatusPill } from '../../../../components/modules/tasks/inline-status-pill';
import { isClosedTaskStatus } from '../../../../lib/utils';
import type { Task } from '../../../../lib/types';

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const PRIORITY_ORDER: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };

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
function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function fmtDayMonth(d: Date): string {
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
const byPriority = (a: Task, b: Task) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);

/**
 * Plan My Week — a pure re-slice of the tasks already loaded into AuthContext at boot.
 * Part 37 checklist: "Plan My Week makes NO server call -> edits by others not
 * reflected until full payload refresh." (Previously this page called
 * GET /tasks/plan-week on every navigation; that endpoint also had no Overdue / No-due-
 * date buckets and dropped closed tasks inconsistently, so it's no longer used here.)
 */
export default function PlanWeekPage() {
  const { currentUser, tasks } = useAuth();
  const [weekStart, setWeekStart] = useState<Date>(() => mondayOf(new Date()));
  const [detailId, setDetailId] = useState<string | null>(null);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const { byDay, overdue, noDueDate } = useMemo(() => {
    const result = { byDay: days.map(() => [] as Task[]), overdue: [] as Task[], noDueDate: [] as Task[] };
    if (!currentUser) return result;
    // Assignee OR assigner, non-closed — deliberately broader than the Dashboard's
    // assignee-only "My Upcoming Tasks" widget (Part 37: "verify an assigner-only task
    // appears here, unlike dashboard upcoming").
    const mine = tasks.filter(
      (t) => (t.assigneeIds.includes(currentUser.empId) || t.assignerId === currentUser.empId) && !isClosedTaskStatus(t.status),
    );
    for (const t of mine) {
      if (!t.dueDate) {
        result.noDueDate.push(t);
        continue;
      }
      const due = new Date(t.dueDate);
      due.setHours(0, 0, 0, 0);
      // Overdue is WEEK-relative (before the displayed week's Monday), not "before
      // today" — navigating to a future week reclassifies earlier tasks as overdue.
      if (due < weekStart) {
        result.overdue.push(t);
        continue;
      }
      const dayIdx = days.findIndex((d) => isSameDay(d, due));
      if (dayIdx >= 0) result.byDay[dayIdx].push(t);
      // due date beyond this displayed week: belongs to a later week's row, not shown here.
    }
    result.overdue.sort(byPriority);
    result.noDueDate.sort(byPriority);
    result.byDay.forEach((list) => list.sort(byPriority));
    return result;
  }, [tasks, currentUser, days, weekStart]);

  const shift = (delta: number) => setWeekStart((d) => addDays(d, delta));
  const goToday = () => setWeekStart(mondayOf(new Date()));

  function TaskCard({ t }: { t: Task }) {
    return (
      <div onClick={() => setDetailId(t.taskId)} className="mb-1.5 cursor-pointer rounded-[6px] bg-surface p-2.5 shadow-card">
        <div className="flex items-start gap-2">
          <span className="flex-1 text-sm font-medium text-text">{t.title}</span>
          <InlineStatusPill task={t} />
        </div>
        <div className="mt-1 text-xs text-muted">{t.priority}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-text">Plan my week</h1>
          <p className="text-sm text-muted">Your tasks for the week, grouped by day</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-text">
            {fmtDayMonth(weekStart)} – {fmtDayMonth(addDays(weekStart, 6))} {addDays(weekStart, 6).getFullYear()}
          </span>
          <Button variant="outline" size="icon" aria-label="Previous week" onClick={() => shift(-7)}><Icon name="chevron_left" size={16} /></Button>
          <Button variant="outline" size="sm" onClick={goToday}>Today</Button>
          <Button variant="outline" size="icon" aria-label="Next week" onClick={() => shift(7)}><Icon name="chevron_right" size={16} /></Button>
        </div>
      </div>

      {/* Overdue (week-relative) */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-bold uppercase text-danger">
            <Icon name="warning" size={16} /> Overdue <Badge variant="destructive">{overdue.length}</Badge>
          </div>
          {overdue.length === 0 ? <p className="text-sm italic text-muted">No overdue tasks</p> : overdue.map((t) => <TaskCard key={t.taskId} t={t} />)}
        </CardContent>
      </Card>

      {/* Mon..Sun */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
        {days.map((d, i) => {
          const isToday = isSameDay(d, today);
          const isWeekend = i >= 5;
          const list = byDay[i];
          return (
            <Card key={d.toISOString()} className={isToday ? 'border-p bg-p3' : isWeekend ? 'opacity-70' : undefined}>
              <CardContent className="pt-3 pb-3">
                <div className="mb-2 flex items-center justify-between gap-1">
                  <div>
                    <div className="text-xs font-semibold text-text">{DAY_NAMES[i]}</div>
                    <div className="text-xs text-muted">{fmtDayMonth(d)}</div>
                  </div>
                  {isToday && <Badge>Today</Badge>}
                  {!isToday && isWeekend && <Badge variant="secondary">Weekend</Badge>}
                </div>
                {list.length === 0 ? (
                  <p className="text-xs italic text-muted">{isToday ? 'Nothing due today' : 'No tasks due'}</p>
                ) : (
                  list.map((t) => <TaskCard key={t.taskId} t={t} />)
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* No due date */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-bold uppercase text-muted">
            <Icon name="calendar_off" size={16} /> No due date <Badge variant="secondary">{noDueDate.length}</Badge>
          </div>
          {noDueDate.length === 0 ? <p className="text-sm italic text-muted">Nothing here</p> : noDueDate.map((t) => <TaskCard key={t.taskId} t={t} />)}
        </CardContent>
      </Card>

      <TaskDetailModal taskId={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}
