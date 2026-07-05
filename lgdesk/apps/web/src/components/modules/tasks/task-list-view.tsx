'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../../../hooks/use-auth';
import { useTasks, useCreateTasksBulk, type TaskScope, type BulkTaskResult } from '../../../lib/api/tasks';
import { apiErrorMessage } from '../../../lib/api/client';
import { toast } from '../../../lib/toast';
import { Icon } from '../../ui/icon';
import { Badge } from '../../ui/badge';
import { pillClass, badgeClass, fmtDate, isClosedTaskStatus } from '../../../lib/utils';
import { TaskRow, isTaskOverdue, COL_HIDE, actionsCellStyle } from './task-row';
import { FilterBar, DEFAULT_COL_FILTER, applyColFilters } from './filter-bar';
import { createTaskSchema, TASK_STATUSES, TASK_PRIORITIES } from './create-task-modal.schema';
import { CompactMultiSelect } from './compact-multi-select';
import { CreateFunctionModal } from '../functions/create-function-modal';
import { TaskDetailModal } from './task-detail-modal';
import { TaskEditModal } from './task-edit-modal';
import type { Task, WorkFunction, Project, User } from '../../../lib/types';

type OwnershipTab = 'To Me' | 'By Me' | 'All';
type TeamTab = 'To Team' | 'By Team' | 'All';
type GroupMode = 'function' | 'date' | 'week';

// Per-column sort keys — mirrors the reference's `_tskSortClick(scope, field)` header
// click handlers (task-sheet thead th onclick).
// FIX A (task-sheet rebuild): column set corrected to the reference's real 9-column
// `_TSK_COL_SPEC` (app.js.html:677-688) — 'function'/'project' removed (Function is a
// group header, not a column; there is no Project column), 'adate'/'recurring' added.
type SortField = 'adate' | 'subfn' | 'task' | 'assignee' | 'assigner' | 'recurring' | 'status' | 'priority' | 'due';

// Sortable header column defs — label + hide-class shared 1:1 with TaskRow's <td>s via
// COL_HIDE (single source of truth so header/filter row and body columns never drift).
const SORT_COLS: { key: SortField; label: string; hide: string }[] = [
  { key: 'adate', label: 'Assigned Date', hide: COL_HIDE.adate },
  { key: 'subfn', label: 'Sub-Function', hide: COL_HIDE.subFn },
  { key: 'task', label: 'Task', hide: COL_HIDE.task },
  { key: 'assignee', label: 'Assigned To', hide: COL_HIDE.assignee },
  { key: 'assigner', label: 'Assigned By', hide: COL_HIDE.assigner },
  { key: 'recurring', label: 'Recurring', hide: COL_HIDE.recurring },
  { key: 'status', label: 'Status', hide: COL_HIDE.status },
  { key: 'priority', label: 'Priority', hide: COL_HIDE.priority },
  { key: 'due', label: 'Due Date', hide: COL_HIDE.due },
];
const TOTAL_COLS = SORT_COLS.length + 1; // + actions (no priority-bar column — FIX B, nothing in the reference is a priority bar)

const PRIORITY_RANK: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };

function empNameOf(empId: string, employees: User[]): string {
  const u = employees.find((e) => e.empId === empId);
  return u ? `${u.firstName} ${u.lastName}` : empId;
}

// Comparable value for a task under a given sort field — used by each FunctionGroup to
// sort its own rows (FIX D: sort is per-group, so this is a plain module-level function
// taking functions/employees as params, not a component closure — FunctionGroup lives
// outside TaskListView so its render identity stays stable across parent re-renders).
function sortValue(t: Task, field: SortField, functions: WorkFunction[], employees: User[]): string | number {
  switch (field) {
    case 'adate': return new Date(t.createdAt).getTime();
    case 'subfn': return (functions.find((f) => f.functionId === t.subFnId)?.name ?? '').toLowerCase();
    case 'task': return t.title.toLowerCase();
    case 'assignee': return t.assigneeIds.length ? empNameOf(t.assigneeIds[0], employees).toLowerCase() : '￿';
    case 'assigner': return empNameOf(t.assignerId, employees).toLowerCase();
    case 'recurring': return t.recurring ? 0 : 1;
    case 'status': return t.status.toLowerCase();
    case 'priority': return PRIORITY_RANK[t.priority] ?? 99;
    case 'due': return t.dueDate ? new Date(t.dueDate).getTime() : Infinity;
    default: return '';
  }
}

// FIX C (task-sheet rebuild): NOT sticky — nothing in the live reference app is sticky
// (the static CSS's `position:sticky` rules, lgdesk-gas-source.html:319,371, are
// attached to the dead <thead> the JS deletes at runtime; the live per-group table CSS,
// `_tskGrpInjectCss`, app.js.html:5046-5101, has zero `position:sticky` rules).
const thStyle: CSSProperties = {
  background: '#f7f8fb', color: 'var(--muted)',
  textTransform: 'uppercase', letterSpacing: '.06em', fontSize: 10.5, fontWeight: 700,
  padding: '7px 8px', textAlign: 'left', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)',
};
const filterThStyle: CSSProperties = { padding: '4px 6px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' };
const filterSelectStyle: CSSProperties = { width: '100%', fontSize: 11, padding: '3px 4px' };

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function mondayOf(d: Date) { const x = startOfDay(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }

interface TaskListViewProps {
  scope: TaskScope;
  title: string;
  subtitle?: string;
  showOwnershipTabs?: boolean;
  showTeamSelector?: boolean;
  // Team Tasks (Master Reference Part 24): tabs read "All"/"To Team"/"By Team"
  // instead of My Tasks' "All"/"To Me"/"By Me" — mutually exclusive with
  // showOwnershipTabs.
  showTeamTabs?: boolean;
}

export function TaskListView({ scope, title, subtitle, showOwnershipTabs, showTeamSelector, showTeamTabs }: TaskListViewProps) {
  const { currentUser, employees, functions, projects } = useAuth();
  const { data: tasks, isLoading, error } = useTasks(scope);
  const [filter, setFilter] = useState(DEFAULT_COL_FILTER);
  const [tab, setTab] = useState<OwnershipTab>('All');
  const [teamTab, setTeamTab] = useState<TeamTab>('All');
  const [team, setTeam] = useState('');
  const [batchOpen, setBatchOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [rawQuery, setRawQuery] = useState('');
  const [query, setQuery] = useState('');
  // Per-column sort — FIX D (task-sheet rebuild): sort is per-function-group, not
  // global. `_tskGrpSetSort` (app.js.html:5463-5506) re-sorts one group's own rows; the
  // static header's global `_tskSortClick` (9345) is wired only to the dead header and
  // never runs. Keyed by function-group id (functionId, or '__none' for ungrouped) so
  // each collapsible group remembers its own last-clicked column + direction
  // independently. Clicking a column header cycles asc/desc for THAT group only.
  const [groupSort, setGroupSort] = useState<Record<string, { field: SortField; dir: 'asc' | 'desc' }>>({});
  const handleGroupSort = (fid: string, field: SortField) => {
    setGroupSort((prev) => {
      const cur = prev[fid];
      if (cur && cur.field === field) return { ...prev, [fid]: { field, dir: cur.dir === 'asc' ? 'desc' : 'asc' } };
      return { ...prev, [fid]: { field, dir: 'asc' } };
    });
  };
  // Lazy render (Part 13 FR-5 / Phase 6): first 80 rows render immediately; scrolling
  // within 300px of #main's bottom appends 80 more. Resets to 80 whenever the active
  // filter set changes, and the listener detaches once every row is rendered.
  const PAGE_SIZE = 80;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const grpKey = `lgd_grp_${scope === 'mine' ? 'my' : scope}`;
  const [grp, setGrp] = useState<GroupMode>('function');
  useEffect(() => {
    const v = typeof window !== 'undefined' ? localStorage.getItem(grpKey) : null;
    if (v === 'function' || v === 'date' || v === 'week') setGrp(v);
  }, [grpKey]);
  const setGroup = (m: GroupMode) => { setGrp(m); if (typeof window !== 'undefined') localStorage.setItem(grpKey, m); };

  // Debounced search (~220ms).
  useEffect(() => { const t = setTimeout(() => setQuery(rawQuery.trim().toLowerCase()), 220); return () => clearTimeout(t); }, [rawQuery]);

  const teams = useMemo(() => Array.from(new Set(employees.map((e) => e.team).filter(Boolean))) as string[], [employees]);
  const fnName = (id?: string | null) => functions.find((f) => f.functionId === id)?.name ?? 'No Function';
  const empName = (id: string) => { const u = employees.find((e) => e.empId === id); return u ? `${u.firstName} ${u.lastName}` : id; };
  const teamOf = (empId?: string | null) => (empId ? employees.find((e) => e.empId === empId)?.team : undefined);

  const filtered = useMemo(() => {
    let list = tasks ?? [];
    if (showOwnershipTabs && currentUser) {
      if (tab === 'To Me') list = list.filter((t) => t.assigneeIds.includes(currentUser.empId));
      else if (tab === 'By Me') list = list.filter((t) => t.assignerId === currentUser.empId);
    }
    if (showTeamTabs && currentUser?.team) {
      const myTeam = currentUser.team;
      if (teamTab === 'To Team') {
        list = list.filter(
          (t) => t.assignedTeams.includes(myTeam) || t.assigneeIds.some((a) => teamOf(a) === myTeam) || teamOf(t.assignerId) === myTeam,
        );
      } else if (teamTab === 'By Team') {
        list = list.filter((t) => teamOf(t.assignerId) === myTeam);
      }
    }
    if (showTeamSelector && team) list = list.filter((t) => t.assignedTeams.includes(team));
    list = applyColFilters(list, filter);
    if (query) list = list.filter((t) => `${t.title} ${t.description ?? ''} ${t.taskId}`.toLowerCase().includes(query));
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, showOwnershipTabs, tab, showTeamTabs, teamTab, team, showTeamSelector, currentUser, filter, query, employees]);

  // A change to any filter/tab/search/group re-pages from the top (Part 37:
  // "navigate away and back -> fresh first-page render", extended to cover any
  // re-filter within the same mount too, so a narrower result set never leaves stale
  // rows 81+ rendered from a previous, larger result set).
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [tab, teamTab, team, filter, query, grp]);

  // Scroll listener on the dashboard shell's #main container — appends 80 more rows
  // when within 300px of the bottom; detaches once every row is already rendered.
  useEffect(() => {
    if (grp !== 'function' || visibleCount >= filtered.length) return;
    const onScroll = () => {
      const main = document.getElementById('main');
      if (!main) return;
      const rect = main.getBoundingClientRect();
      if (rect.bottom - window.innerHeight < 300) setVisibleCount((v) => Math.min(v + PAGE_SIZE, filtered.length));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [grp, visibleCount, filtered.length]);

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

  // FIX D: group membership + group order only — NOT row order. Function is a group
  // header, not a sortable column (FIX A), so group order is always alphabetical. Row
  // order *within* each group is computed independently by FunctionGroup itself, using
  // that group's own entry in `groupSort` (see `sortValue` below).
  const functionGroups = useMemo(() => {
    const m = new Map<string, Task[]>();
    for (const t of filtered) { const k = t.functionId ?? '__none'; (m.get(k) ?? m.set(k, []).get(k)!).push(t); }
    const entries = Array.from(m.entries());
    entries.sort((a, b) => {
      const an = fnName(a[0] === '__none' ? undefined : a[0]);
      const bn = fnName(b[0] === '__none' ? undefined : b[0]);
      return an.localeCompare(bn);
    });
    return entries;
  }, [filtered]);

  // Lazy-render page: take the first `visibleCount` task rows in the already-sorted
  // group order, re-deriving the same [functionId, rows][] shape so partially-consumed
  // groups still render with a correct header + count.
  const pagedFunctionGroups = useMemo(() => {
    let remaining = visibleCount;
    const out: [string, Task[]][] = [];
    for (const [fid, list] of functionGroups) {
      if (remaining <= 0) break;
      const slice = list.slice(0, remaining);
      if (slice.length) out.push([fid, slice]);
      remaining -= slice.length;
    }
    return out;
  }, [functionGroups, visibleCount]);

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

  const openCount = (tasks ?? []).filter((t) => !isClosedTaskStatus(t.status)).length;

  return (
    <div>
      <div className="ph">
        <div className="ph-left">
          <div className="ph-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {title}
            {openCount > 0 && <Badge variant="secondary">{openCount} open</Badge>}
          </div>
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
        </div>
      </div>

      {showOwnershipTabs && (
        <div className="tl-tabs" style={{ marginBottom: 12 }}>
          {(['All', 'To Me', 'By Me'] as OwnershipTab[]).map((t) => (
            <button key={t} className={`tl-tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>{t}</button>
          ))}
        </div>
      )}

      {showTeamTabs && (
        <div className="tl-tabs" style={{ marginBottom: 12 }}>
          {(['All', 'To Team', 'By Team'] as TeamTab[]).map((t) => (
            <button key={t} className={`tl-tab${teamTab === t ? ' active' : ''}`} onClick={() => setTeamTab(t)}>{t}</button>
          ))}
        </div>
      )}

      <FilterBar value={filter} onChange={setFilter} employees={employees} projects={projects} functions={functions} />

      {isLoading ? (
        <div className="empty-state"><Icon name="hourglass_empty" size={40} className="ei" /><p>Loading…</p></div>
      ) : error ? (
        <div style={{ color: 'var(--danger)', fontSize: 13 }}>{apiErrorMessage(error, 'Failed to load tasks')}</div>
      ) : grp === 'function' ? (
        <div className="tbl-wrap">
          <table>
            <thead>
              {/* FIX D: the sortable column-header row moves into each FunctionGroup
                  (per-group sort state, not global — see groupSort/handleGroupSort
                  above and FunctionGroup below). This <thead> now hosts only the
                  per-column filter row (superseded by the consolidated filter bar in
                  FIX E, filter-bar.tsx). */}
              {/* Per-column filter row (reference: tr.ts-filter-row) — reuses the same
                  ColFilter state/applyColFilters as the standalone FilterBar above (kept
                  as-is; see decisions). Native <select>s to match the reference's exact
                  filter-row controls (single-value, not the multi-select widget). */}
              <tr>
                {/* Assigned-date filter cell — moved to the consolidated per-column
                    filter bar (FIX E, filter-bar.tsx); this table-level row no longer
                    hosts Function (removed as a column, FIX A) here. */}
                <th className={COL_HIDE.adate} style={filterThStyle} />
                <th className={COL_HIDE.subFn} style={filterThStyle}>
                  <select
                    className="fc" style={filterSelectStyle}
                    value={filter.subFunctions[0] ?? ''}
                    onChange={(e) => setFilter({ ...filter, subFunctions: e.target.value ? [e.target.value] : [] })}
                  >
                    <option value="">All Sub-Functions</option>
                    {functions.filter((f) => !!f.parentFnId).map((f) => <option key={f.functionId} value={f.functionId}>{f.name}</option>)}
                  </select>
                </th>
                <th className={COL_HIDE.task} style={filterThStyle}>
                  {/* Reference uses a "Task" <select>; we reuse the existing debounced
                      search box's state instead of adding a new filter field/select
                      populated from free-text task titles — see decisions. */}
                  <input
                    type="text" className="fc" style={filterSelectStyle}
                    placeholder="Search…" value={rawQuery} onChange={(e) => setRawQuery(e.target.value)}
                  />
                </th>
                <th className={COL_HIDE.assignee} style={filterThStyle}>
                  {/* My Tasks has no Assigned-To filter cell here (reference: blank <th>
                      for the "my" task-sheet instance) — Team/All Tasks get the select. */}
                  {scope !== 'mine' && (
                    <select
                      className="fc" style={filterSelectStyle}
                      value={filter.assignee[0] ?? ''}
                      onChange={(e) => setFilter({ ...filter, assignee: e.target.value ? [e.target.value] : [] })}
                    >
                      <option value="">All Assignees</option>
                      {employees.map((e) => <option key={e.empId} value={e.empId}>{e.firstName} {e.lastName}</option>)}
                    </select>
                  )}
                </th>
                <th className={COL_HIDE.assigner} style={filterThStyle}>
                  <select
                    className="fc" style={filterSelectStyle}
                    value={filter.assigner[0] ?? ''}
                    onChange={(e) => setFilter({ ...filter, assigner: e.target.value ? [e.target.value] : [] })}
                  >
                    <option value="">All Assigners</option>
                    {employees.map((e) => <option key={e.empId} value={e.empId}>{e.firstName} {e.lastName}</option>)}
                  </select>
                </th>
                {/* Recurring filter cell — moved to the consolidated per-column filter
                    bar (FIX E); Project (removed as a column, FIX A) no longer appears
                    here — it remains available only as a toolbar filter field. */}
                <th className={COL_HIDE.recurring} style={filterThStyle} />
                <th className={COL_HIDE.status} style={filterThStyle}>
                  <select
                    className="fc" style={filterSelectStyle}
                    value={filter.status[0] ?? ''}
                    onChange={(e) => setFilter({ ...filter, status: e.target.value ? [e.target.value] : [] })}
                  >
                    <option value="">All Statuses</option>
                    {TASK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </th>
                <th className={COL_HIDE.priority} style={filterThStyle}>
                  <select
                    className="fc" style={filterSelectStyle}
                    value={filter.priority[0] ?? ''}
                    onChange={(e) => setFilter({ ...filter, priority: e.target.value ? [e.target.value] : [] })}
                  >
                    <option value="">All</option>
                    {TASK_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </th>
                <th className={COL_HIDE.due} style={filterThStyle}>
                  <input
                    type="date" className="fc" style={filterSelectStyle}
                    value={filter.due} onChange={(e) => setFilter({ ...filter, due: e.target.value })}
                    title="Show tasks due by this date"
                  />
                </th>
                <th style={{ ...filterThStyle, ...actionsCellStyle('var(--surface)'), textAlign: 'center' }}>
                  <button
                    type="button" className="wl-save-btn" title="Clear all filters"
                    onClick={() => { setFilter(DEFAULT_COL_FILTER); setRawQuery(''); }}
                  >
                    <Icon name="filter_list" size={14} />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={TOTAL_COLS}>
                    <div className="empty-state"><Icon name="checklist" size={40} className="ei" /><p>No tasks match these filters</p></div>
                  </td>
                </tr>
              ) : (
                pagedFunctionGroups.map(([fid, list]) => (
                  <FunctionGroup
                    key={fid}
                    name={fnName(fid === '__none' ? undefined : fid)}
                    list={list}
                    sort={groupSort[fid]}
                    onSort={(field) => handleGroupSort(fid, field)}
                    onOpen={setDetailId}
                    onEdit={setEditId}
                  />
                ))
              )}
              {/* Inline batch "Add Tasks" row pinned at the bottom of the table
                  (reference: tr.ts-foot-trig / tr.ts-add-row) — wired to the bulk
                  useCreateTasksBulk mutation (one POST /tasks/bulk call for every row,
                  not one call per row) + the local batchRowSchema superset of
                  createTaskSchema. */}
              <TaskBatchAddRow
                open={batchOpen}
                onOpenChange={setBatchOpen}
                functions={functions}
                projects={projects}
                employees={employees}
                currentUserName={currentUser?.name ?? ''}
                currentUserEmpId={currentUser?.empId ?? ''}
              />
            </tbody>
          </table>
        </div>
      ) : grp === 'date' ? (
        filtered.length === 0 ? (
          <div className="empty-state"><Icon name="checklist" size={40} className="ei" /><p>No tasks match these filters</p></div>
        ) : (
          <div>
            <Bucket icon="warning" color="var(--danger)" label="Overdue" list={buckets.overdue} />
            <Bucket icon="today" color="var(--warn)" label="Today" list={buckets.today} />
            <Bucket icon="date_range" color="#1565c0" label="This week" list={buckets.thisWeek} />
            <Bucket icon="calendar_month" color="var(--muted)" label="Next week" list={buckets.nextWeek} />
            <Bucket icon="schedule" color="var(--muted)" label="Later" list={buckets.later} />
            <Bucket icon="calendar_off" color="var(--muted2)" label="No due date" list={buckets.noDue} />
          </div>
        )
      ) : (
        filtered.length === 0 ? (
          <div className="empty-state"><Icon name="checklist" size={40} className="ei" /><p>No tasks match these filters</p></div>
        ) : (
          <div>
            <Bucket icon="warning" color="var(--danger)" label="Overdue" list={weekGroups.overdue} />
            {weekGroups.weeks.map((w) => (
              <Bucket key={w.ts} icon="date_range" color={w.ts === weekGroups.thisWeekTs ? 'var(--p)' : 'var(--muted)'} label={w.ts === weekGroups.thisWeekTs ? `${w.label} (this week)` : w.label} list={w.list} />
            ))}
          </div>
        )
      )}

      <TaskDetailModal taskId={detailId} onClose={() => setDetailId(null)} />
      <TaskEditModal taskId={editId} onClose={() => setEditId(null)} />
    </div>
  );
}

// FIX D (task-sheet rebuild): each collapsible function-group owns its own sort state
// (`sort`, passed down from TaskListView's `groupSort` map keyed by function id) and its
// own sortable header row — clicking a column header here only re-sorts THIS group's
// rows, mirroring the reference's `_tskGrpSetSort` (app.js.html:5463-5506), not a single
// global sort applied to the whole page.
function FunctionGroup({ name, list, sort, onSort, onOpen, onEdit }: {
  name: string;
  list: Task[];
  sort?: { field: SortField; dir: 'asc' | 'desc' };
  onSort: (field: SortField) => void;
  onOpen: (id: string) => void;
  onEdit: (id: string) => void;
}) {
  const { functions, employees } = useAuth();
  const sorted = useMemo(() => {
    if (!sort) return list;
    return [...list].sort((a, b) => {
      const av = sortValue(a, sort.field, functions, employees);
      const bv = sortValue(b, sort.field, functions, employees);
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  }, [list, sort, functions, employees]);

  return (
    <>
      <tr>
        <td colSpan={TOTAL_COLS} style={{ background: '#f0f2f5', borderLeft: '4px solid #1a237e', padding: '10px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 9, color: '#9e9e9e', textTransform: 'uppercase', letterSpacing: 0.5 }}>Function</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--p)' }}>{name}</span>
            <span style={{ marginLeft: 'auto', background: '#e8eaf6', color: '#1a237e', fontSize: 11, padding: '2px 8px', borderRadius: 3 }}>{list.length}</span>
          </div>
        </td>
      </tr>
      <tr>
        {SORT_COLS.map((c) => (
          <th
            key={c.key}
            className={c.hide}
            style={{ ...thStyle, cursor: 'pointer' }}
            onClick={() => onSort(c.key)}
            title="Click to sort this group"
          >
            {c.label}
            {sort?.field === c.key && (
              <Icon name={sort.dir === 'asc' ? 'chevron_up' : 'chevron_down'} size={11} style={{ marginLeft: 3, verticalAlign: 'middle', opacity: 0.7 }} />
            )}
          </th>
        ))}
        <th style={{ ...thStyle, ...actionsCellStyle('#f7f8fb'), width: 34 }} />
      </tr>
      {sorted.map((t) => <TaskRow key={t.taskId} task={t} onOpen={onOpen} onEdit={onEdit} />)}
    </>
  );
}

// ─── Inline batch "Add Tasks" row (reference: ts-foot-trig / ts-add-row / ts-batch-panel) ──
// A top-level component (not a closure defined inside TaskListView) so its identity is
// stable across parent re-renders — an inline component using useForm/useFieldArray would
// otherwise remount (and lose in-progress input) on every keystroke elsewhere in the view.
//
// Local superset of createTaskSchema/CreateTaskFormValues: batch rows also carry a
// newline-delimited `links` textarea value that the single-task schema doesn't have (the
// backend DTO's `links` is string[]; the textarea is split into that array only at submit
// time, in onSubmit below).
const batchRowSchema = createTaskSchema.extend({ links: z.string().optional() });
type BatchRowValues = z.infer<typeof batchRowSchema>;

const defaultBatchRow = (currentUserEmpId?: string): BatchRowValues => ({
  title: '', description: '', projId: '', functionId: '', subFnId: '',
  assigneeIds: currentUserEmpId ? [currentUserEmpId] : [],
  team: '', status: 'Not Started', priority: 'Medium', dueDate: '', estimatedHours: '', links: '',
});

// True when a row is still exactly at its freshly-appended default — used by Cancel's
// discard-confirmation so the default-assignee pre-fill doesn't itself count as "the user
// typed something".
function isRowUntouched(row: BatchRowValues, defaults: BatchRowValues): boolean {
  return (
    row.title.trim() === '' &&
    !(row.description ?? '').trim() &&
    !(row.links ?? '').trim() &&
    row.projId === defaults.projId &&
    row.functionId === defaults.functionId &&
    row.subFnId === defaults.subFnId &&
    row.team === defaults.team &&
    row.assigneeIds.length === defaults.assigneeIds.length &&
    row.assigneeIds.every((id) => defaults.assigneeIds.includes(id)) &&
    row.status === defaults.status &&
    row.priority === defaults.priority &&
    !row.dueDate &&
    !row.estimatedHours
  );
}

function TaskBatchAddRow({ open, onOpenChange, functions, projects, employees, currentUserName, currentUserEmpId }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  functions: WorkFunction[];
  projects: Project[];
  employees: User[];
  currentUserName: string;
  currentUserEmpId: string;
}) {
  const { refresh } = useAuth();
  const bulkCreate = useCreateTasksBulk();
  const form = useForm<{ rows: BatchRowValues[] }>({
    resolver: zodResolver(z.object({ rows: z.array(batchRowSchema).min(1) })),
    defaultValues: { rows: [defaultBatchRow(currentUserEmpId)] },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'rows' });
  // Per-row error text, keyed by the field array's own stable `field.id` (NOT array
  // index) — indices shift once succeeded rows are spliced out on a partial failure, but
  // field.id stays attached to the same row so its error message survives the reindex.
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  // Row index whose Function/Sub-Function "+" quick-add modal is currently open.
  const [fnModalRow, setFnModalRow] = useState<number | null>(null);
  const [subFnModalRow, setSubFnModalRow] = useState<number | null>(null);

  const close = () => {
    onOpenChange(false);
    form.reset({ rows: [defaultBatchRow(currentUserEmpId)] });
    setRowErrors({});
  };

  const handleCancel = () => {
    const defaults = defaultBatchRow(currentUserEmpId);
    const untouched = form.getValues('rows').every((row) => isRowUntouched(row, defaults));
    if (!untouched && !window.confirm('Discard these unsaved tasks?')) return;
    close();
  };

  const onSubmit = form.handleSubmit(async (values) => {
    const rowIds = fields.map((f) => f.id); // snapshot — index-aligned with values.rows/the request array
    try {
      const payload = values.rows.map((row) => ({
        title: row.title,
        description: row.description || undefined,
        projId: row.projId || undefined,
        functionId: row.functionId || undefined,
        subFnId: row.subFnId || undefined,
        assigneeIds: row.assigneeIds,
        status: row.status,
        priority: row.priority,
        dueDate: row.dueDate ? new Date(row.dueDate).toISOString() : undefined,
        links: row.links ? row.links.split('\n').map((l) => l.trim()).filter(Boolean) : undefined,
      }));
      const results: BulkTaskResult[] = await bulkCreate.mutateAsync(payload);
      const succeededIdx = new Set<number>();
      const newErrors: Record<string, string> = {};
      results.forEach((r, idx) => {
        if (r.success) succeededIdx.add(idx);
        else newErrors[rowIds[idx]] = r.error;
      });
      const failedCount = results.length - succeededIdx.size;
      if (failedCount === 0) {
        toast(`${results.length} task${results.length > 1 ? 's' : ''} added`, 'success');
        close();
      } else {
        if (succeededIdx.size > 0) remove(Array.from(succeededIdx));
        setRowErrors(newErrors);
        toast(
          `${succeededIdx.size} of ${results.length} task${results.length > 1 ? 's' : ''} added — ${failedCount} failed, see below`,
          succeededIdx.size > 0 ? 'warn' : 'error',
        );
      }
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not save tasks'), 'error');
    }
  });

  if (!open) {
    return (
      <tr>
        <td colSpan={TOTAL_COLS} style={{ padding: 0 }}>
          <div
            onClick={() => onOpenChange(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '9px 14px', cursor: 'pointer', color: 'var(--p)', fontSize: 12, fontWeight: 600 }}
          >
            <Icon name="add" size={15} /> Add Tasks
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td colSpan={TOTAL_COLS} style={{ padding: 0 }}>
        <div style={{ background: 'var(--bg)', borderTop: '2px solid var(--p)', padding: '8px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--p)', flex: 1 }}>Add Tasks</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => append(defaultBatchRow(currentUserEmpId))}>
              <Icon name="add" size={13} /> Row
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {fields.map((field, i) => {
              const rowFunctionId = form.watch(`rows.${i}.functionId`);
              const subFnOpts = functions.filter((f) => f.parentFnId === rowFunctionId);
              const rowError = rowErrors[field.id];
              return (
                <div key={field.id} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div
                    style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.1fr 2fr 1.15fr 0.9fr 1fr 0.9fr 0.9fr 0.9fr auto', gap: 6, alignItems: 'start' }}
                  >
                    <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                      <select className="fc" style={{ fontSize: 12, flex: 1, minWidth: 0 }} {...form.register(`rows.${i}.functionId` as const)}>
                        <option value="">Function</option>
                        {functions.filter((f) => !f.parentFnId).map((f) => <option key={f.functionId} value={f.functionId}>{f.name}</option>)}
                      </select>
                      <button type="button" className="wl-save-btn" title="New function" onClick={() => setFnModalRow(i)}>
                        <Icon name="add" size={12} />
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                      <select className="fc" style={{ fontSize: 12, flex: 1, minWidth: 0 }} {...form.register(`rows.${i}.subFnId` as const)}>
                        <option value="">Sub-Function</option>
                        {subFnOpts.map((f) => <option key={f.functionId} value={f.functionId}>{f.name}</option>)}
                      </select>
                      <button
                        type="button" className="wl-save-btn"
                        title={rowFunctionId ? 'New sub-function' : 'Select a function first'}
                        disabled={!rowFunctionId}
                        onClick={() => setSubFnModalRow(i)}
                      >
                        <Icon name="add" size={12} />
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <input className="fc" style={{ fontSize: 12 }} placeholder="Task title *" {...form.register(`rows.${i}.title` as const)} />
                      <textarea rows={1} className="fc" style={{ fontSize: 11, resize: 'vertical' }} placeholder="Description" {...form.register(`rows.${i}.description` as const)} />
                      <textarea rows={1} className="fc" style={{ fontSize: 11, resize: 'vertical' }} placeholder="Links (one per line)" {...form.register(`rows.${i}.links` as const)} />
                    </div>
                    <CompactMultiSelect
                      options={employees.map((e) => ({ id: e.empId, label: `${e.firstName} ${e.lastName}` }))}
                      selectedIds={form.watch(`rows.${i}.assigneeIds`) ?? []}
                      onChange={(ids) => form.setValue(`rows.${i}.assigneeIds`, ids)}
                      placeholder="Assigned To"
                    />
                    <span
                      style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                      title="Assigned by (you)"
                    >
                      {currentUserName}
                    </span>
                    <select className="fc" style={{ fontSize: 12 }} {...form.register(`rows.${i}.projId` as const)}>
                      <option value="">Project</option>
                      {projects.map((p) => <option key={p.projId} value={p.projId}>{p.name}</option>)}
                    </select>
                    <select className="fc" style={{ fontSize: 12 }} {...form.register(`rows.${i}.status` as const)}>
                      {TASK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <select className="fc" style={{ fontSize: 12 }} {...form.register(`rows.${i}.priority` as const)}>
                      {TASK_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <input type="date" className="fc" style={{ fontSize: 12 }} {...form.register(`rows.${i}.dueDate` as const)} />
                    <button
                      type="button" className="wl-save-btn" title="Remove row"
                      onClick={() => fields.length > 1 && remove(i)} disabled={fields.length <= 1}
                    >
                      <Icon name="delete" size={14} />
                    </button>
                  </div>
                  {rowError && (
                    <div style={{ fontSize: 11, color: 'var(--danger)', paddingLeft: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Icon name="warning" size={11} />
                      {rowError}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={handleCancel}>Cancel</button>
            <button type="button" className="btn btn-primary btn-sm" disabled={bulkCreate.isPending} onClick={onSubmit}>
              {bulkCreate.isPending ? 'Saving…' : 'Save All'}
            </button>
          </div>
        </div>
        {/* Function/Sub-Function quick-add — one shared modal instance per kind, targeted
            at whichever row's "+" was last clicked (fnModalRow/subFnModalRow). Creating
            AuthContext's `functions` list comes from the one-shot initial-payload fetch
            (not the useFunctions() TanStack Query cache that CreateFunctionModal's own
            mutation invalidates), so the new option is picked up via refresh() —
            re-fetching that payload — rather than query invalidation. */}
        <CreateFunctionModal
          open={fnModalRow !== null}
          onClose={() => setFnModalRow(null)}
          onCreated={async (fn) => {
            const idx = fnModalRow;
            await refresh();
            if (idx !== null) form.setValue(`rows.${idx}.functionId`, fn.functionId);
            setFnModalRow(null);
          }}
        />
        <CreateFunctionModal
          open={subFnModalRow !== null}
          onClose={() => setSubFnModalRow(null)}
          defaultParentFnId={subFnModalRow !== null ? form.watch(`rows.${subFnModalRow}.functionId`) : undefined}
          onCreated={async (fn) => {
            const idx = subFnModalRow;
            await refresh();
            if (idx !== null) form.setValue(`rows.${idx}.subFnId`, fn.functionId);
            setSubFnModalRow(null);
          }}
        />
      </td>
    </tr>
  );
}

export default TaskListView;
