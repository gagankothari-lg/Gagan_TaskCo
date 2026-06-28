'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../hooks/use-auth';
import { useTasks, type TaskScope } from '../../../hooks/use-tasks';
import { isManager } from '../../../lib/auth';
import { apiErrorMessage } from '../../../lib/api';
import { Icon } from '../../ui/icon';
import { avatarColor, pillClass, badgeClass, fmtDate } from '../../../lib/utils';
import { TaskRow, isTaskOverdue } from './task-row';
import { FilterBar, DEFAULT_COL_FILTER, applyColFilters } from './filter-bar';
import { CreateTaskModal } from './create-task-modal';
import { TaskDetailModal } from './task-detail-modal';
import type { Task } from '../../../lib/types';

type OwnershipTab = 'To Me' | 'By Me' | 'All';
type GroupMode = 'function' | 'date' | 'week';

interface TaskListViewProps {
  scope: TaskScope;
  title: string;
  subtitle?: string;
  showOwnershipTabs?: boolean;
  showTeamSelector?: boolean;
}

const COLS = ['Assigned date', 'Sub-function', 'Task', 'Assigned to', 'Assigned by', 'Recurring', 'Status', 'Priority', 'Due date', ''];

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function mondayOf(d: Date) { const x = startOfDay(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }

export function TaskListView({ scope, title, subtitle, showOwnershipTabs, showTeamSelector }: TaskListViewProps) {
  const { currentUser, employees, functions, projects } = useAuth();
  const { data: tasks, isLoading, error } = useTasks(scope);
  const [filter, setFilter] = useState(DEFAULT_COL_FILTER);
  const [tab, setTab] = useState<OwnershipTab>('All');
  const [team, setTeam] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [rawQuery, setRawQuery] = useState('');
  const [query, setQuery] = useState('');

  const grpKey = `lgd_grp_${scope === 'mine' ? 'my' : scope}`;
  const [grp, setGrp] = useState<GroupMode>('function');
  useEffect(() => {
    const v = typeof window !== 'undefined' ? localStorage.getItem(grpKey) : null;
    if (v === 'function' || v === 'date' || v === 'week') setGrp(v);
  }, [grpKey]);
  const setGroup = (m: GroupMode) => { setGrp(m); if (typeof window !== 'undefined') localStorage.setItem(grpKey, m); };

  // Debounced search (~220ms).
  useEffect(() => { const t = setTimeout(() => setQuery(rawQuery.trim().toLowerCase()), 220); return () => clearTimeout(t); }, [rawQuery]);

  const manager = currentUser ? isManager(currentUser.role) : false;
  const teams = useMemo(() => Array.from(new Set(employees.map((e) => e.team).filter(Boolean))) as string[], [employees]);
  const fnName = (id?: string | null) => functions.find((f) => f.functionId === id)?.name ?? 'No Function';
  const empName = (id: string) => { const u = employees.find((e) => e.empId === id); return u ? `${u.firstName} ${u.lastName}` : id; };

  const filtered = useMemo(() => {
    let list = tasks ?? [];
    if (showOwnershipTabs && currentUser) {
      if (tab === 'To Me') list = list.filter((t) => t.assigneeIds.includes(currentUser.empId));
      else if (tab === 'By Me') list = list.filter((t) => t.assignerId === currentUser.empId);
    }
    if (showTeamSelector && team) list = list.filter((t) => t.assignedTeams.includes(team));
    list = applyColFilters(list, filter);
    if (query) list = list.filter((t) => `${t.title} ${t.description ?? ''} ${t.taskId}`.toLowerCase().includes(query));
    return list;
  }, [tasks, showOwnershipTabs, tab, team, showTeamSelector, currentUser, filter, query]);

  // Date/Week buckets (open tasks only).
  const buckets = useMemo(() => {
    const open = filtered.filter((t) => !['Done', 'Cancelled'].includes(t.status));
    const today = startOfDay(new Date());
    const weekEnd = (() => { const m = mondayOf(today); m.setDate(m.getDate() + 6); return m; })();
    const nextEnd = (() => { const m = mondayOf(today); m.setDate(m.getDate() + 13); return m; })();
    const b = { overdue: [] as Task[], today: [] as Task[], thisWeek: [] as Task[], nextWeek: [] as Task[], later: [] as Task[], noDue: [] as Task[] };
    for (const t of open) {
      if (!t.dueDate) { b.noDue.push(t); continue; }
      const d = startOfDay(new Date(t.dueDate));
      if (d < today) b.overdue.push(t);
      else if (d.getTime() === today.getTime()) b.today.push(t);
      else if (d <= weekEnd) b.thisWeek.push(t);
      else if (d <= nextEnd) b.nextWeek.push(t);
      else b.later.push(t);
    }
    return b;
  }, [filtered]);

  const weekGroups = useMemo(() => {
    const open = filtered.filter((t) => !['Done', 'Cancelled'].includes(t.status) && t.dueDate);
    const today = startOfDay(new Date());
    const overdue = open.filter((t) => startOfDay(new Date(t.dueDate!)) < today);
    const byWeek = new Map<number, Task[]>();
    for (const t of open) {
      const d = startOfDay(new Date(t.dueDate!));
      if (d < today) continue;
      const wk = mondayOf(d).getTime();
      (byWeek.get(wk) ?? byWeek.set(wk, []).get(wk)!).push(t);
    }
    const weeks = Array.from(byWeek.entries()).sort((a, b) => a[0] - b[0]).map(([ts, list]) => ({ ts, label: `Week of ${fmtDate(new Date(ts), { month: 'short', day: 'numeric' })}`, list }));
    return { overdue, weeks, thisWeekTs: mondayOf(today).getTime() };
  }, [filtered]);

  const functionGroups = useMemo(() => {
    const m = new Map<string, Task[]>();
    for (const t of filtered) { const k = t.functionId ?? '__none'; (m.get(k) ?? m.set(k, []).get(k)!).push(t); }
    return Array.from(m.entries());
  }, [filtered]);

  const TaskCard = ({ t }: { t: Task }) => {
    const overdue = isTaskOverdue(t);
    return (
      <div className="task-card" style={{ cursor: 'pointer', marginBottom: 8 }} onClick={() => setDetailId(t.taskId)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ flex: 1, fontWeight: 600, fontSize: 13 }}>{t.title}</span>
          <span className={pillClass(t.status)}>{t.status}</span>
          <span className={badgeClass(t.priority)}>{t.priority}</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
          {fnName(t.functionId)} · by {empName(t.assignerId)} · <span style={{ fontFamily: 'monospace' }}>{t.taskId}</span>
          {t.dueDate && <span style={{ color: overdue ? 'var(--danger)' : 'var(--muted2)' }}> · {overdue ? 'Overdue ' : 'Due '}{fmtDate(t.dueDate, { month: 'short', day: 'numeric' })}</span>}
        </div>
      </div>
    );
  };

  const Bucket = ({ icon, color, label, list }: { icon: string; color: string; label: string; list: Task[] }) => {
    if (list.length === 0) return null;
    return (
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color, fontWeight: 700, fontSize: 13 }}>
          <Icon name={icon} size={18} /> {label} <span style={{ color: 'var(--muted2)', fontWeight: 400 }}>({list.length})</span>
        </div>
        {list.map((t) => <TaskCard key={t.taskId} t={t} />)}
      </div>
    );
  };

  return (
    <div>
      <div className="ph">
        <div className="ph-left">
          <div className="ph-title">{title}</div>
          {subtitle && <div className="ph-sub">{subtitle}</div>}
        </div>
        <div className="ph-actions">
          <div style={{ position: 'relative' }}>
            <Icon name="search" size={16} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted2)' }} />
            <input className="fc" placeholder="Search tasks…" value={rawQuery} onChange={(e) => setRawQuery(e.target.value)} style={{ paddingLeft: 30, width: 200 }} />
          </div>
          <div className="tl-tabs">
            <span style={{ fontSize: 12, color: 'var(--muted)', alignSelf: 'center', marginRight: 4 }}>Group by:</span>
            {(['function', 'date', 'week'] as GroupMode[]).map((m) => (
              <button key={m} className={`tl-tab${grp === m ? ' active' : ''}`} onClick={() => setGroup(m)} style={{ textTransform: 'capitalize' }}>{m}</button>
            ))}
          </div>
          {showTeamSelector && (
            <select className="fc" value={team} onChange={(e) => setTeam(e.target.value)} style={{ width: 'auto' }}>
              <option value="">All teams</option>
              {teams.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
          <button className="btn btn-primary btn-sm" onClick={() => setCreateOpen(true)}><Icon name="add" size={16} /> {manager ? 'New Task' : 'Self-assign'}</button>
        </div>
      </div>

      {showOwnershipTabs && (
        <div className="tl-tabs" style={{ marginBottom: 12 }}>
          {(['All', 'To Me', 'By Me'] as OwnershipTab[]).map((t) => (
            <button key={t} className={`tl-tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>{t}</button>
          ))}
        </div>
      )}

      <FilterBar value={filter} onChange={setFilter} employees={employees} projects={projects} functions={functions} />

      {isLoading ? (
        <div className="empty-state"><span className="ei material-symbols-outlined">hourglass_empty</span><p>Loading…</p></div>
      ) : error ? (
        <div style={{ color: 'var(--danger)', fontSize: 13 }}>{apiErrorMessage(error, 'Failed to load tasks')}</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state"><span className="ei material-symbols-outlined">checklist</span><p>No tasks match these filters</p></div>
      ) : grp === 'function' ? (
        <div className="tbl-wrap">
          <table>
            <thead><tr>{COLS.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
            <tbody>
              {functionGroups.map(([fid, list]) => (
                <FunctionGroup key={fid} name={fnName(fid === '__none' ? undefined : fid)} list={list} onOpen={setDetailId} />
              ))}
            </tbody>
          </table>
        </div>
      ) : grp === 'date' ? (
        <div>
          <Bucket icon="warning" color="var(--danger)" label="Overdue" list={buckets.overdue} />
          <Bucket icon="today" color="var(--warn)" label="Today" list={buckets.today} />
          <Bucket icon="date_range" color="#1565c0" label="This week" list={buckets.thisWeek} />
          <Bucket icon="calendar_month" color="var(--muted)" label="Next week" list={buckets.nextWeek} />
          <Bucket icon="schedule" color="var(--muted)" label="Later" list={buckets.later} />
          <Bucket icon="calendar_off" color="var(--muted2)" label="No due date" list={buckets.noDue} />
        </div>
      ) : (
        <div>
          <Bucket icon="warning" color="var(--danger)" label="Overdue" list={weekGroups.overdue} />
          {weekGroups.weeks.map((w) => (
            <Bucket key={w.ts} icon="date_range" color={w.ts === weekGroups.thisWeekTs ? 'var(--p)' : 'var(--muted)'} label={w.ts === weekGroups.thisWeekTs ? `${w.label} (this week)` : w.label} list={w.list} />
          ))}
        </div>
      )}

      <CreateTaskModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <TaskDetailModal taskId={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}

function FunctionGroup({ name, list, onOpen }: { name: string; list: Task[]; onOpen: (id: string) => void }) {
  return (
    <>
      <tr>
        <td colSpan={10} style={{ background: 'var(--p3)', fontWeight: 700, color: 'var(--p)', borderLeft: `3px solid ${avatarColor(name)}` }}>
          {name} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>({list.length})</span>
        </td>
      </tr>
      {list.map((t) => <TaskRow key={t.taskId} task={t} onOpen={onOpen} />)}
    </>
  );
}

export default TaskListView;
