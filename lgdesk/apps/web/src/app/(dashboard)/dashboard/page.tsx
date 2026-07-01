'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '../../../components/ui/icon';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { useAuth } from '../../../hooks/use-auth';
import { isAdmin, isManager } from '../../../lib/auth';
import { useDashboard, useDeleteAnnouncement } from '../../../lib/api/dashboard';
import { apiErrorMessage } from '../../../lib/api/client';
import { TeamClockStatus } from '../../../components/modules/work-duration/team-clock-status';
import { AnnouncementForm } from '../../../components/modules/dashboard/announcement-form';
import { MyProjects } from '../../../components/modules/dashboard/my-projects';
import { TaskDetailModal } from '../../../components/modules/tasks/task-detail-modal';
import { InlineStatusPill } from '../../../components/modules/tasks/inline-status-pill';
import { avatarColor } from '../../../lib/avatar-colors';
import { initials, fmtDate, isClosedTaskStatus } from '../../../lib/utils';
import { toast } from '../../../lib/toast';
import type { Task } from '../../../lib/types';

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}
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
const PRIORITY_ORDER: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };
const priBorder = (p: string) => (p === 'Critical' ? '#c62828' : p === 'High' ? '#e65100' : p === 'Medium' ? '#1a237e' : '#9e9e9e');
const priBadgeStyle = (p: string) =>
  p === 'Critical' ? { bg: '#fce8e8', c: '#c62828' } : p === 'High' ? { bg: '#fff3e0', c: '#e65100' } : p === 'Medium' ? { bg: '#e8eaf6', c: '#1a237e' } : { bg: '#f5f5f5', c: '#757575' };

function StatCard({ label, value, sub }: { label: string; value: number | string; sub: string }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="stat-label">{label}</div>
        <div className="stat-val" style={{ fontSize: 32, margin: '6px 0' }}>{value}</div>
        <div className="stat-sub">{sub}</div>
      </CardContent>
    </Card>
  );
}

/** Card header row with an icon + title on the left and optional action on the right —
 * plain flex (rather than the shadcn CardHeader's default grid) since these headers are
 * simple icon/title/action rows, not the title+description stack shadcn's grid targets. */
function PanelHeader({ icon, title, action }: { icon: string; title: string; action?: React.ReactNode }) {
  return (
    <CardHeader className="flex flex-row items-center gap-2 border-b border-border pb-4">
      <Icon name={icon} size={18} style={{ color: 'var(--muted)' }} />
      <CardTitle className="flex-1">{title}</CardTitle>
      {action}
    </CardHeader>
  );
}

const TROPHY = ['#f9a825', '#9e9e9e', '#a0522d'];

interface UpcomingBucket {
  key: string;
  label: string;
  color: string;
  bg: string;
  list: Task[];
  empty: string;
  defaultCollapsed: boolean;
}

type NoticeItem =
  | { kind: 'announcement'; key: string; id: string; title: string; content: string; visibility: string; expiresAt: string | null }
  | { kind: 'birthday'; key: string; title: string }
  | { kind: 'meeting'; key: string; title: string; startTime: string }
  | { kind: 'holiday'; key: string; title: string; date: string };

export default function DashboardPage() {
  const router = useRouter();
  const { currentUser, employees, tasks, projects } = useAuth();
  const { data, isLoading } = useDashboard();
  const deleteAnnouncement = useDeleteAnnouncement();

  const [showAllScores, setShowAllScores] = useState(false);
  const [postOpen, setPostOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ later: true, noDue: true });

  const manager = isManager(currentUser?.role ?? '');
  const admin = isAdmin(currentUser?.role ?? '');

  const stats = useMemo(() => {
    const mine = (tasks ?? []).filter((t) => currentUser && t.assigneeIds.includes(currentUser.empId));
    // "Projects" card = distinct projects derived from MY tasks, including parents of
    // any sub-project among them (Part 12 stats-card table) — not just "every project
    // I'm authorized to see", which is a broader (and here, unrelated) scope.
    const projectIds = new Set<string>();
    mine.forEach((t) => {
      if (!t.projId) return;
      projectIds.add(t.projId);
      const parent = (projects ?? []).find((p) => p.projId === t.projId)?.parentProjId;
      if (parent) projectIds.add(parent);
    });
    return {
      total: mine.length,
      open: mine.filter((t) => !isClosedTaskStatus(t.status)).length,
      inProgress: mine.filter((t) => t.status.startsWith('WIP')).length,
      // "Under Review" is this port's nearest equivalent of the legacy GAS "On Hold"
      // mismatch (Part 12) — this schema has no "On Hold" status at all, so counting
      // status === 'Under Review' literally IS the sane mapping here, not a bug to fix.
      underReview: mine.filter((t) => t.status === 'Under Review').length,
      done: mine.filter((t) => t.status === 'Done').length,
      projects: projectIds.size,
    };
  }, [tasks, projects, currentUser]);

  // "My Upcoming Tasks" — computed client-side from the already-loaded `tasks` (assignee
  // scope only, per Part 37's GAP note that this widget must NOT include assigner-only
  // tasks, unlike Plan My Week). The /dashboard API's own upcomingTasks bucket reuses
  // getAuthorizedTasks' role-based scope (all-company for Admins, team for managers) and
  // has no Later/No-due-date buckets, so it's not used here.
  const upcomingBuckets = useMemo<UpcomingBucket[]>(() => {
    if (!currentUser) return [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const weekStart = mondayOf(now);
    const weekEnd = addDays(weekStart, 6);
    const nextWeekEnd = addDays(weekStart, 13);

    const mine = tasks.filter((t) => t.assigneeIds.includes(currentUser.empId) && !isClosedTaskStatus(t.status));
    const overdue: Task[] = [];
    const todayList: Task[] = [];
    const thisWeek: Task[] = [];
    const nextWeek: Task[] = [];
    const later: Task[] = [];
    const noDue: Task[] = [];

    for (const t of mine) {
      if (!t.dueDate) {
        noDue.push(t);
        continue;
      }
      const due = new Date(t.dueDate);
      due.setHours(0, 0, 0, 0);
      if (due < now) overdue.push(t);
      else if (due.getTime() === now.getTime()) todayList.push(t);
      else if (due <= weekEnd) thisWeek.push(t);
      else if (due <= nextWeekEnd) nextWeek.push(t);
      else later.push(t);
    }
    const byDueThenPriority = (a: Task, b: Task) => {
      const pd = (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
      if (pd !== 0) return pd;
      return (a.dueDate ?? '').localeCompare(b.dueDate ?? '');
    };
    [overdue, todayList, thisWeek, nextWeek, later].forEach((l) => l.sort(byDueThenPriority));

    return [
      { key: 'overdue', label: 'Overdue', color: '#c62828', bg: '#fce8e8', list: overdue, empty: 'No overdue tasks — all clear', defaultCollapsed: false },
      { key: 'today', label: 'Today', color: '#2e7d32', bg: '#e8f5e9', list: todayList, empty: 'All clear for today', defaultCollapsed: false },
      { key: 'thisWeek', label: 'This week', color: '#455a64', bg: '#eceff1', list: thisWeek, empty: 'No tasks in this period', defaultCollapsed: false },
      { key: 'nextWeek', label: 'Next week', color: '#455a64', bg: '#eceff1', list: nextWeek, empty: 'No tasks in this period', defaultCollapsed: false },
      { key: 'later', label: 'Later', color: '#616161', bg: '#f5f5f5', list: later, empty: 'No tasks in this period', defaultCollapsed: true },
      { key: 'noDue', label: 'No due date', color: '#9e9e9e', bg: '#fafafa', list: noDue, empty: 'No tasks without a due date', defaultCollapsed: true },
    ];
  }, [tasks, currentUser]);

  const totalOpen = upcomingBuckets.reduce((a, b) => a + b.list.length, 0);
  const totalOverdue = upcomingBuckets.find((b) => b.key === 'overdue')?.list.length ?? 0;

  function toggleBucket(key: string) {
    setCollapsed((c) => ({ ...c, [key]: !c[key] }));
  }

  // Notices: merges all Part 27 sources the backend computes — Announcements,
  // Birthdays (today), Calendar Meetings (today..+30d) and Holidays (next 2 days).
  // Shared Forms is the one Part 27 source with no data behind it in this port —
  // the Forms module is out of scope per CLAUDE.md, so `forms` is always [].
  const notices = useMemo<NoticeItem[]>(() => {
    if (!data) return [];
    const items: NoticeItem[] = [];
    data.notices.announcements.forEach((a) => items.push({ kind: 'announcement', key: `a-${a.id}`, id: a.id, title: a.title, content: a.content, visibility: a.visibility, expiresAt: a.expiresAt }));
    data.notices.birthdays.forEach((b) => items.push({ kind: 'birthday', key: `b-${b.empId}`, title: `🎉 Happy Birthday, ${b.name}!` }));
    data.notices.meetings.forEach((m) => items.push({ kind: 'meeting', key: `m-${m.meetingId}`, title: m.title, startTime: m.startTime }));
    data.notices.holidays.forEach((h) => items.push({ kind: 'holiday', key: `h-${h.id}`, title: h.name, date: h.date }));
    return items;
  }, [data]);

  async function handleDeleteAnnouncement(id: string) {
    if (!confirm('Remove this announcement?')) return;
    try {
      await deleteAnnouncement.mutateAsync(id);
      toast('Announcement removed.', 'success');
    } catch (err) {
      toast(apiErrorMessage(err, 'Unable to remove announcement'), 'error');
    }
  }

  const myScore = data?.scoreboard.find((r) => r.empId === currentUser?.empId);
  const scoreboardTitle = admin ? 'Company Scoreboard' : manager ? 'Team Scoreboard' : 'Personal Scoreboard';

  return (
    <div className="flex flex-col gap-5">
      {/* Greeting */}
      <div id="dash-greeting">
        <div style={{ fontSize: 22, fontWeight: 700 }}>{greeting()}, {currentUser?.firstName}!</div>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
      </div>

      {/* 6 stat cards — hidden on mobile (<=768px) per Part 12's component table */}
      <div id="dash-stats" className="hidden gap-4 md:grid md:grid-cols-3 lg:grid-cols-6">
        <StatCard label="My Tasks" value={stats.total} sub="total assigned" />
        <StatCard label="Open" value={stats.open} sub="pending" />
        <StatCard label="In Progress" value={stats.inProgress} sub="active now" />
        <StatCard label="Under Review" value={stats.underReview} sub="awaiting approval" />
        <StatCard label="Done" value={stats.done} sub="finished" />
        <StatCard label="Projects" value={stats.projects} sub="involved in" />
      </div>

      {/* Notice board + On leave */}
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <Card id="dash-noticeboard">
          <PanelHeader
            icon="notifications_none"
            title="Notice Board"
            action={admin ? (
              <Button id="btn-nb-post" size="sm" onClick={() => setPostOpen((o) => !o)}>
                <Icon name="add" size={14} /> Post
              </Button>
            ) : undefined}
          />
          <CardContent className="flex flex-col gap-3 pb-5 pt-4">
            {isLoading ? (
              <p className="text-sm text-muted">Loading…</p>
            ) : notices.length === 0 ? (
              <div className="empty-state"><Icon name="notifications_none" size={40} className="ei" /><p>No announcements right now</p></div>
            ) : (
              <div className="flex flex-col gap-2">
                {notices.map((n) => {
                  if (n.kind === 'birthday') {
                    return (
                      <div key={n.key} className="flex items-center gap-2 rounded-[8px] border border-border p-2.5 text-sm">
                        <Icon name="cake" size={16} style={{ color: 'var(--accent)' }} />
                        <span>{n.title}</span>
                      </div>
                    );
                  }
                  if (n.kind === 'meeting') {
                    return (
                      <button
                        key={n.key}
                        onClick={() => router.push('/meetings')}
                        className="flex items-center gap-2 rounded-[8px] border border-border p-2.5 text-left text-sm hover:bg-[var(--p3)]"
                      >
                        <Icon name="video_call" size={16} style={{ color: 'var(--p)' }} />
                        <span className="flex-1">{n.title}</span>
                        <span className="text-xs text-muted">{fmtDate(n.startTime, { month: 'short', day: 'numeric' })}</span>
                      </button>
                    );
                  }
                  if (n.kind === 'holiday') {
                    return (
                      <div key={n.key} className="flex items-center gap-2 rounded-[8px] border border-border p-2.5 text-sm">
                        <Icon name="calendar_month" size={16} style={{ color: 'var(--ok)' }} />
                        <span className="flex-1">{n.title}</span>
                        <span className="text-xs text-muted">{fmtDate(n.date, { month: 'short', day: 'numeric' })}</span>
                      </div>
                    );
                  }
                  return (
                    <div key={n.key} className="rounded-[8px] border border-border p-2.5">
                      <div className="flex items-start gap-2">
                        <Icon name="campaign" size={16} style={{ color: 'var(--p)', marginTop: 2 }} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-sm font-semibold text-text">{n.title}</span>
                            {/* Part 27: non-Organisation-visibility notices get a badge pill so
                                restricted audiences are visually distinguishable from org-wide ones. */}
                            {n.visibility && n.visibility !== 'Organisation' && (
                              <Badge variant="secondary">{n.visibility}</Badge>
                            )}
                          </div>
                          {n.content && <div className="text-xs text-muted">{n.content}</div>}
                          {admin && n.expiresAt && <div className="mt-1 text-[11px] text-muted2">Expires {fmtDate(n.expiresAt)}</div>}
                        </div>
                        {admin && (
                          <button aria-label="Remove announcement" onClick={() => handleDeleteAnnouncement(n.id)} className="text-muted hover:text-danger">
                            <Icon name="close" size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {admin && postOpen && <AnnouncementForm onPosted={() => setPostOpen(false)} />}
          </CardContent>
        </Card>

        <Card id="dash-on-leave">
          <PanelHeader icon="event_available" title="On Leave Today" />
          <CardContent className="pb-5 pt-4">
            {data && data.onLeaveToday.length > 0 ? (
              <div className="flex flex-col gap-3">
                {data.onLeaveToday.map((l) => {
                  const team = employees.find((e) => e.empId === l.empId)?.team;
                  return (
                    <div key={l.empId} className="flex items-center gap-2">
                      <div style={{ width: 30, height: 30, borderRadius: '50%', background: avatarColor(l.empId), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{initials(l.name)}</div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-text">{l.name}</div>
                        <div className="text-xs text-muted">{l.leaveType}{team ? ` · ${team}` : ''}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-1.5 py-5 text-muted2">
                <Icon name="groups" size={32} />
                <div className="text-sm italic">Everyone is in today!</div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* My Projects */}
      <Card id="dash-proj-wrap">
        <PanelHeader icon="folder_open" title="My Projects" />
        <CardContent className="pb-5 pt-4"><MyProjects /></CardContent>
      </Card>

      {/* Upcoming tasks */}
      <Card id="dash-upcoming">
        <PanelHeader
          icon="task_alt"
          title="My Upcoming Tasks"
          action={(
            <div className="flex items-center gap-3 text-xs">
              <a onClick={() => router.push('/tasks/plan-week')} className="cursor-pointer text-p">View all</a>
              <a onClick={() => router.push('/tasks/plan-week')} className="cursor-pointer text-p">Open weekly plan</a>
            </div>
          )}
        />
        <CardContent className="flex flex-col gap-3 pb-5 pt-4">
          {upcomingBuckets.map((b) => {
            const isCollapsed = collapsed[b.key] ?? b.defaultCollapsed;
            return (
              <div key={b.key}>
                <button
                  onClick={() => toggleBucket(b.key)}
                  className="inline-flex items-center gap-1.5 rounded-[4px] px-3 py-1 text-[11px] font-bold uppercase"
                  style={{ color: b.color, background: b.bg }}
                >
                  <Icon name={isCollapsed ? 'chevron_right' : 'expand_more'} size={14} />
                  {b.label}
                  <span style={{ background: b.color, color: '#fff', borderRadius: 8, padding: '0 6px' }}>{b.list.length}</span>
                </button>
                {!isCollapsed && (
                  b.list.length === 0 ? (
                    <div className="px-3 py-1.5 text-sm italic text-muted">{b.empty}</div>
                  ) : (
                    <div className="pt-1">
                      {b.list.map((t) => {
                        const pb = priBadgeStyle(t.priority);
                        return (
                          <div
                            key={t.taskId}
                            onClick={() => setDetailId(t.taskId)}
                            className="mb-1.5 cursor-pointer rounded-[6px] bg-surface p-3 shadow-card"
                            style={{ borderLeft: `3px solid ${priBorder(t.priority)}` }}
                          >
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" style={{ background: pb.bg, color: pb.c, borderColor: 'transparent' }}>{t.priority}</Badge>
                              <span className="flex-1 text-sm font-semibold text-text">{t.title}</span>
                              <InlineStatusPill task={t} />
                              {t.dueDate && <span className="whitespace-nowrap text-xs text-muted2">{fmtDate(t.dueDate)}</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                )}
              </div>
            );
          })}
          <div className="mt-1 flex justify-between text-xs text-muted">
            <span>{totalOpen} open</span>
            {totalOverdue > 0 && <span className="font-semibold text-danger">{totalOverdue} overdue</span>}
          </div>
        </CardContent>
      </Card>

      {/* Scoreboard — hidden on mobile (<=768px) */}
      <Card id="dash-scoreboard-wrap" className="hidden md:flex">
        <PanelHeader icon="leaderboard" title={scoreboardTitle} />
        <CardContent className="pb-5 pt-4">
          {isLoading || !data ? (
            <div className="empty-state"><Icon name="hourglass_empty" size={40} className="ei" /><p>Loading…</p></div>
          ) : !manager && !admin ? (
            // Team Member: single-card personal view instead of a full table.
            <div className="rounded-[var(--r)] border border-border p-4">
              <div className="flex flex-wrap items-center gap-6">
                <div>
                  <div className="stat-label">Score</div>
                  <div className="text-3xl font-bold text-p">{myScore?.score ?? 0}</div>
                </div>
                <div>
                  <div className="stat-label">Tasks Done</div>
                  <div className="text-xl font-semibold text-ok">{myScore?.done ?? 0}</div>
                </div>
                <div>
                  <div className="stat-label">Overdue</div>
                  <div className="text-xl font-semibold text-danger">{myScore?.overdue ?? 0}</div>
                </div>
                <div>
                  <div className="stat-label">Logs This Month</div>
                  <div className="text-xl font-semibold text-muted2">0</div>
                </div>
              </div>
              <p className="mt-3 text-xs text-muted">Score = tasks done ×10 + in-progress ×3 − overdue ×5 (never below 0).</p>
            </div>
          ) : (
            <div className="tbl-wrap" style={{ boxShadow: 'none' }}>
              <table>
                <thead><tr><th>#</th><th>Employee</th><th>Team</th><th>Score</th><th>Done</th><th>Overdue</th><th>Logs (mo.)</th></tr></thead>
                <tbody>
                  {(showAllScores ? data.scoreboard : data.scoreboard.slice(0, 10)).map((r) => (
                    <tr key={r.empId}>
                      <td>{r.rank <= 3 ? <Icon name="trophy" size={18} style={{ color: TROPHY[r.rank - 1] }} /> : <span style={{ color: 'var(--muted)' }}>{r.rank}</span>}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <span style={{ width: 28, height: 28, borderRadius: '50%', background: avatarColor(r.empId), color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{initials(r.name)}</span>
                          <span style={{ fontWeight: 600 }}>{r.name}</span>
                          {r.empId === currentUser?.empId && <Badge variant="secondary">you</Badge>}
                        </div>
                      </td>
                      <td style={{ color: 'var(--muted)' }}>{employees.find((e) => e.empId === r.empId)?.team ?? '—'}</td>
                      <td style={{ fontSize: 18, fontWeight: 700, color: 'var(--p)' }}>{r.score}</td>
                      <td style={{ fontSize: 14, color: '#2e7d32', fontWeight: 600 }}>{r.done}</td>
                      <td style={{ fontSize: 14, color: r.overdue ? '#c62828' : '#9e9e9e', fontWeight: 600 }}>{r.overdue}</td>
                      <td style={{ color: 'var(--muted)', fontSize: 14 }}>0</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.scoreboard.length > 10 && (
                <div onClick={() => setShowAllScores((s) => !s)} style={{ color: 'var(--p)', fontSize: 12, textAlign: 'center', padding: '10px 0', borderTop: '1px solid #f0f0f0', cursor: 'pointer' }}>{showAllScores ? 'Show Top 10' : `Show All ${data.scoreboard.length} Members`}</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Team clock status — TC/TF/Admin only; internals owned by the Work Duration
          module (out of scope for this pass), container restyled only. */}
      {manager && (
        <Card id="dash-team-clock">
          <PanelHeader icon="schedule" title="Team Clock Status" />
          <CardContent className="pb-5 pt-4"><TeamClockStatus /></CardContent>
        </Card>
      )}

      <TaskDetailModal taskId={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}
