'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '../../../components/ui/icon';
import { useAuth } from '../../../hooks/use-auth';
import { isAdmin, isManager } from '../../../lib/auth';
import { useDashboard } from '../../../hooks/use-dashboard';
import { useWorkDurationStatus, useClockIn } from '../../../hooks/use-work-duration';
import { useMyWorkLogs } from '../../../hooks/use-work-log';
import { TeamClockStatus } from '../../../components/modules/work-duration/team-clock-status';
import { AnnouncementForm } from '../../../components/modules/dashboard/announcement-form';
import { WL_ATTENDANCE_STYLES } from '../../../components/modules/work-log/work-row';
import { avatarColor } from '../../../lib/avatar-colors';
import { initials } from '../../../lib/utils';
import { toast } from '../../../lib/toast';
import type { Task } from '../../../lib/types';

const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };
const mondayOf = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const iso = (d: Date) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };
const effHours = (att: string, extra: number) => {
  const base = att === 'Present' || att === 'Extra Full Day' ? 9 : att === 'Extra Half Day' || att === 'Leave Half Day' ? 4 : 0;
  return base + (extra || 0);
};

function StatCard({ label, value, sub }: { label: string; value: number | string; sub: string }) {
  return (
    <div className="stat-card" style={{ padding: '16px 20px' }}>
      <div className="stat-label">{label}</div>
      <div className="stat-val" style={{ fontSize: 36, margin: '6px 0' }}>{value}</div>
      <div className="stat-sub">{sub}</div>
    </div>
  );
}

function Panel({ icon, title, action, children }: { icon: string; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 8, boxShadow: 'var(--sh)', padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Icon name={icon} size={18} style={{ color: 'var(--muted)' }} />
        <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{title}</span>
        {action}
      </div>
      {children}
    </div>
  );
}

const TROPHY = ['#f9a825', '#9e9e9e', '#a0522d'];

export default function DashboardPage() {
  const router = useRouter();
  const { currentUser, employees, tasks, projects } = useAuth();
  const { data, isLoading } = useDashboard();
  const { data: clock } = useWorkDurationStatus();
  const clockIn = useClockIn();

  const weekStart = useMemo(() => mondayOf(new Date()), []);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const { data: weekLogs } = useMyWorkLogs(iso(weekStart), iso(addDays(weekStart, 6)));

  const manager = isManager(currentUser?.role ?? '');
  const admin = isAdmin(currentUser?.role ?? '');
  const teamOf = (empId: string) => employees.find((e) => e.empId === empId)?.team ?? '—';

  const stats = useMemo(() => {
    const mine = (tasks ?? []).filter((t) => currentUser && t.assigneeIds.includes(currentUser.empId));
    return {
      total: mine.length,
      open: mine.filter((t) => !['Done', 'Cancelled'].includes(t.status)).length,
      inProgress: mine.filter((t) => t.status.startsWith('WIP')).length,
      underReview: mine.filter((t) => t.status === 'Under Review').length,
      done: mine.filter((t) => t.status === 'Done').length,
      projects: (projects ?? []).length,
    };
  }, [tasks, projects, currentUser]);

  const week = useMemo(() => {
    const byDate = new Map((weekLogs ?? []).map((l) => [l.date.slice(0, 10), l]));
    let hrs = 0; let logged = 0;
    const dots = weekDays.map((d) => {
      const l = byDate.get(iso(d));
      if (l) { logged++; hrs += effHours(l.attendance, l.extraHours); }
      const style = l ? WL_ATTENDANCE_STYLES[l.attendance] : undefined;
      return { abbr: style?.abbr ?? '·', bg: style?.bg ?? '#f5f5f5', fg: style?.fg ?? '#bdbdbd' };
    });
    return { dots, hrs: Math.round(hrs), logged };
  }, [weekLogs, weekDays]);

  const buckets: { key: string; label: string; color: string; bg: string; list: Task[]; empty: string }[] = data ? [
    { key: 'overdue', label: 'Overdue', color: '#c62828', bg: '#fce8e8', list: data.upcomingTasks.overdue, empty: 'No overdue tasks — all clear' },
    { key: 'today', label: 'Today', color: '#2e7d32', bg: '#e8f5e9', list: data.upcomingTasks.today, empty: 'All clear for today' },
    { key: 'thisWeek', label: 'This week', color: '#455a64', bg: '#eceff1', list: [...data.upcomingTasks.tomorrow, ...data.upcomingTasks.thisWeek], empty: 'No tasks in this period' },
    { key: 'nextWeek', label: 'Next week', color: '#455a64', bg: '#eceff1', list: data.upcomingTasks.nextWeek, empty: 'No tasks in this period' },
  ] : [];
  const openCount = buckets.reduce((a, b) => a + b.list.length, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Greeting + controls */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{greeting()}, {currentUser?.firstName}!</div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>{new Date().toLocaleDateString(undefined, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => toast('Forms module is not available yet', 'info')}><Icon name="description" size={16} /> Forms</button>
          <button className="btn btn-ghost btn-sm" onClick={() => clockIn.mutate()} disabled={clock?.status === 'ACTIVE'}><Icon name="schedule" size={16} /> {clock?.status === 'ACTIVE' ? 'Clocked In' : 'Clock in'}</button>
          <button className="btn btn-accent btn-sm" onClick={() => router.push('/work-log')}><Icon name="check" size={16} /> Log Today&apos;s Work</button>
          {/* Work-week mini widget */}
          <div style={{ background: 'var(--surface)', padding: '10px 14px', borderRadius: 8, boxShadow: 'var(--sh)', fontSize: 11 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {week.dots.map((d, i) => (
                <span key={i} title={d.abbr} style={{ width: 22, height: 22, borderRadius: '50%', background: d.bg, color: d.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700 }}>{d.abbr}</span>
              ))}
            </div>
            <div style={{ marginTop: 6, color: 'var(--muted)' }}>{week.hrs} hrs · {week.logged} days logged</div>
            <div style={{ color: 'var(--muted2)' }}>{weekStart.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })} – {addDays(weekStart, 6).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}</div>
          </div>
        </div>
      </div>

      {/* 6 stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="My Tasks" value={stats.total} sub="total assigned" />
        <StatCard label="Open" value={stats.open} sub="pending" />
        <StatCard label="In Progress" value={stats.inProgress} sub="active now" />
        <StatCard label="Under Review" value={stats.underReview} sub="awaiting approval" />
        <StatCard label="Done" value={stats.done} sub="finished" />
        <StatCard label="Projects" value={stats.projects} sub="involved in" />
      </div>

      {/* Notice board + On leave */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16 }} className="max-lg:!grid-cols-1">
        <Panel icon="notifications_none" title="Notice Board" action={admin ? <button className="btn btn-primary btn-sm" style={{ borderRadius: 20 }} onClick={() => document.getElementById('announce-form')?.scrollIntoView({ behavior: 'smooth' })}><Icon name="add" size={14} /> Post</button> : undefined}>
          {data && data.notices.announcements.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.notices.announcements.map((a) => (
                <div key={a.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{a.title}</div>
                  {a.content && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{a.content}</div>}
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state"><span className="ei material-symbols-outlined">notifications_none</span><p>No announcements right now</p></div>
          )}
        </Panel>
        <Panel icon="event_available" title="On Leave Today">
          {data && data.onLeaveToday.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {data.onLeaveToday.map((l) => (
                <div key={l.empId} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: avatarColor(l.empId), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{initials(l.name)}</div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{l.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{l.leaveType}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state"><span className="ei material-symbols-outlined">event_available</span><p>Everyone&apos;s in today</p></div>
          )}
        </Panel>
      </div>

      {/* Upcoming tasks */}
      <Panel icon="task_alt" title="My Upcoming Tasks" action={<a onClick={() => router.push('/tasks')} style={{ color: 'var(--p)', fontSize: 12, cursor: 'pointer' }}>View all</a>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {buckets.map((b) => (
            <div key={b.key}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: b.color, background: b.bg, padding: '5px 12px', borderRadius: 4 }}>
                {b.label} <span style={{ background: b.color, color: '#fff', borderRadius: 8, padding: '0 6px' }}>{b.list.length}</span>
              </div>
              {b.list.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--muted)', fontStyle: 'italic', padding: '6px 12px' }}>{b.empty}</div>
              ) : (
                <div style={{ padding: '4px 12px' }}>
                  {b.list.slice(0, 5).map((t) => (
                    <div key={t.taskId} onClick={() => router.push('/tasks')} style={{ fontSize: 13, padding: '3px 0', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{t.title}</span>
                      {t.dueDate && <span style={{ color: 'var(--muted2)' }}>{new Date(t.dueDate).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
            <span>{openCount} open</span>
            <a onClick={() => router.push('/tasks/plan-week')} style={{ color: 'var(--p)', cursor: 'pointer' }}>Open weekly plan</a>
          </div>
        </div>
      </Panel>

      {/* Scoreboard */}
      <Panel icon="leaderboard" title="Company Scoreboard">
        {isLoading || !data ? (
          <div className="empty-state"><span className="ei material-symbols-outlined">hourglass_empty</span><p>Loading…</p></div>
        ) : (
          <div className="tbl-wrap" style={{ boxShadow: 'none' }}>
            <table>
              <thead><tr><th>#</th><th>Employee</th><th>Team</th><th>Score</th><th>Done</th><th>Overdue</th><th>Logs (mo.)</th></tr></thead>
              <tbody>
                {data.scoreboard.map((r) => (
                  <tr key={r.empId}>
                    <td>{r.rank <= 3 ? <Icon name="trophy" size={18} style={{ color: TROPHY[r.rank - 1] }} /> : <span style={{ color: 'var(--muted)' }}>{r.rank}</span>}</td>
                    <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width: 28, height: 28, borderRadius: '50%', background: avatarColor(r.empId), color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{initials(r.name)}</span><span style={{ fontWeight: 600 }}>{r.name}</span></div></td>
                    <td style={{ color: 'var(--muted)' }}>{teamOf(r.empId)}</td>
                    <td style={{ fontSize: 18, fontWeight: 700, color: 'var(--p)' }}>{r.score}</td>
                    <td style={{ color: '#2e7d32', fontWeight: 600 }}>{r.done}</td>
                    <td style={{ color: r.overdue ? '#c62828' : 'var(--muted2)', fontWeight: 600 }}>{r.overdue}</td>
                    <td style={{ color: 'var(--muted)' }}>—</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Team clock status (managers) */}
      {manager && (
        <Panel icon="schedule" title="Team Clock Status">
          <TeamClockStatus />
        </Panel>
      )}

      {admin && <div id="announce-form"><AnnouncementForm /></div>}
    </div>
  );
}
