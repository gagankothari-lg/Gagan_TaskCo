'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '../../../components/ui/icon';
import { useAuth } from '../../../hooks/use-auth';
import { isAdmin, isManager } from '../../../lib/auth';
import { useDashboard } from '../../../lib/api/dashboard';
import { useWorkDurationStatus, useClockIn } from '../../../lib/api/workDuration';
import { useMyWorkLogs } from '../../../lib/api/workLog';
import { TeamClockStatus } from '../../../components/modules/work-duration/team-clock-status';
import { AnnouncementForm } from '../../../components/modules/dashboard/announcement-form';
import { MyProjects } from '../../../components/modules/dashboard/my-projects';
import { WL_ATTENDANCE_STYLES } from '../../../components/modules/work-log/work-row';
import { avatarColor } from '../../../lib/avatar-colors';
import { initials } from '../../../lib/utils';
import { statusPillStyle } from '../../../lib/status-styles';
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
  const { currentUser, employees, tasks, projects, functions } = useAuth();
  const { data, isLoading } = useDashboard();
  const { data: clock } = useWorkDurationStatus();
  const clockIn = useClockIn();
  const [showAllScores, setShowAllScores] = useState(false);

  const weekStart = useMemo(() => mondayOf(new Date()), []);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const { data: weekLogs } = useMyWorkLogs(iso(weekStart), iso(addDays(weekStart, 6)));

  const manager = isManager(currentUser?.role ?? '');
  const admin = isAdmin(currentUser?.role ?? '');
  const teamOf = (empId: string) => employees.find((e) => e.empId === empId)?.team ?? '—';
  const empName = (id: string) => { const e = employees.find((x) => x.empId === id); return e ? `${e.firstName} ${e.lastName}` : id; };
  const fnName = (id?: string | null) => functions.find((f) => f.functionId === id)?.name;
  const pctOf = (s: string) => (s === 'Done' ? 100 : s === 'WIP - 75%' ? 75 : s === 'WIP - 50%' ? 50 : s === 'WIP - 25%' ? 25 : 0);
  const priBorder = (p: string) => (p === 'Critical' ? '#c62828' : p === 'High' ? '#e65100' : p === 'Medium' ? '#1a237e' : '#9e9e9e');
  const priBadge = (p: string) => (p === 'Critical' ? { bg: '#fce8e8', c: '#c62828' } : p === 'High' ? { bg: '#fff3e0', c: '#e65100' } : p === 'Medium' ? { bg: '#e8eaf6', c: '#1a237e' } : { bg: '#f5f5f5', c: '#757575' });
  const isOverdue = (t: Task) => !!t.dueDate && !['Done', 'Cancelled'].includes(t.status) && new Date(t.dueDate) < new Date(new Date().toDateString());

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
            <div style={{ display: 'flex', gap: 4, marginBottom: 2 }}>
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (<span key={i} style={{ width: 18, textAlign: 'center', fontSize: 10, color: 'var(--muted2)' }}>{d}</span>))}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {week.dots.map((d, i) => (
                <span key={i} title={d.abbr} style={{ width: 18, height: 18, borderRadius: '50%', background: d.bg, color: d.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700 }}>{d.abbr}</span>
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
            <div className="empty-state"><Icon name="notifications_none" size={40} className="ei" /><p>No announcements right now</p></div>
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
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, color: 'var(--muted2)' }}>
              <Icon name="groups" size={32} />
              <div style={{ fontSize: 13, fontStyle: 'italic', marginTop: 6 }}>Everyone is in today!</div>
            </div>
          )}
        </Panel>
      </div>

      {/* My Projects */}
      <Panel icon="folder_open" title="My Projects"><MyProjects /></Panel>

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
                <div style={{ padding: '4px 0' }}>
                  {b.list.slice(0, 5).map((t) => {
                    const sp = statusPillStyle(t.status); const pb = priBadge(t.priority); const od = isOverdue(t);
                    return (
                      <div key={t.taskId} onClick={() => router.push('/tasks')} style={{ background: '#fff', borderRadius: 6, borderLeft: `3px solid ${priBorder(t.priority)}`, padding: '10px 14px', marginBottom: 6, cursor: 'pointer', boxShadow: 'var(--sh)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ background: pb.bg, color: pb.c, fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 3 }}>{t.priority}</span>
                          <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{t.title}</span>
                          <span className="pill" style={{ background: sp.bg, color: sp.color }}>{t.status}</span>
                          {t.dueDate && <span style={{ fontSize: 12, color: od ? '#c62828' : 'var(--muted2)', whiteSpace: 'nowrap' }}>{new Date(t.dueDate).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}</span>}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{fnName(t.functionId) ?? '—'} · by {empName(t.assignerId)}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                          <div style={{ flex: 1, height: 4, background: '#e0e0e0', borderRadius: 2 }}><div style={{ width: `${pctOf(t.status)}%`, height: '100%', background: priBorder(t.priority), borderRadius: 2 }} /></div>
                          <span style={{ fontSize: 11, color: 'var(--muted)' }}>{pctOf(t.status)}% · {t.status}</span>
                        </div>
                      </div>
                    );
                  })}
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
          <div className="empty-state"><Icon name="hourglass_empty" size={40} className="ei" /><p>Loading…</p></div>
        ) : (
          <div className="tbl-wrap" style={{ boxShadow: 'none' }}>
            <table>
              <thead><tr><th>#</th><th>Employee</th><th>Team</th><th>Score</th><th>Done</th><th>Overdue</th><th>Logs (mo.)</th></tr></thead>
              <tbody>
                {(showAllScores ? data.scoreboard : data.scoreboard.slice(0, 10)).map((r) => (
                  <tr key={r.empId}>
                    <td>{r.rank <= 3 ? <Icon name="trophy" size={18} style={{ color: TROPHY[r.rank - 1] }} /> : <span style={{ color: 'var(--muted)' }}>{r.rank}</span>}</td>
                    <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width: 28, height: 28, borderRadius: '50%', background: avatarColor(r.empId), color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{initials(r.name)}</span><span style={{ fontWeight: 600 }}>{r.name}</span>{r.empId === currentUser?.empId && <span style={{ background: '#e8eaf6', color: '#1a237e', fontSize: 10, padding: '1px 6px', borderRadius: 3, marginLeft: 6, fontWeight: 600 }}>you</span>}</div></td>
                    <td style={{ color: 'var(--muted)' }}>{teamOf(r.empId)}</td>
                    <td style={{ fontSize: 18, fontWeight: 700, color: 'var(--p)' }}>{r.score}</td>
                    <td style={{ fontSize: 14, color: '#2e7d32', fontWeight: 600 }}>{r.done}</td>
                    <td style={{ fontSize: 14, color: r.overdue ? '#c62828' : '#9e9e9e', fontWeight: 600 }}>{r.overdue}</td>
                    <td style={{ color: 'var(--muted)', fontSize: 14 }}>—</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.scoreboard.length > 10 && (
              <div onClick={() => setShowAllScores((s) => !s)} style={{ color: 'var(--p)', fontSize: 12, textAlign: 'center', padding: '10px 0', borderTop: '1px solid #f0f0f0', cursor: 'pointer' }}>{showAllScores ? 'Show less' : `Show All ${data.scoreboard.length} Members`}</div>
            )}
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
