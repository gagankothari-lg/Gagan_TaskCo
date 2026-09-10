'use client';

// FIX E (PVERIFY-FULL-APP-PARITY Part B, task-sheet rebuild): the reference has exactly
// 2 filter mechanisms (`_tskBuildFilterBar`, app.js.html:5643-5647,5649-5723), both built
// outside the <table> element, not inside a <thead>:
//   (a) a small 2-control "Filter:" toolbar — Function + Project only, plain <select>s.
//   (b) ONE per-column filter bar (Assigned-date range, Sub-Function, Task search,
//       Assignee, Assigner, Recurring, Status, Priority, Due date, + Clear) using rich
//       checkbox/chip multi-select widgets (`_ssInitMulti`), not plain <select>s.
// This file used to also host a portal-based `MultiSelect` widget for a similar-but-
// duplicate row-1/row-2 layout; that's replaced here by `CompactMultiSelect`
// (compact-multi-select.tsx, already built for the Add-Tasks batch row's Assigned To
// field) per the ground rule to reuse/extend rather than build a parallel widget. The
// third overlapping mechanism (a per-column filter row baked into the table's own
// <thead>) has been removed entirely from task-list-view.tsx.
//
// PTASK-FILTERBAR-REDESIGN: the (a)/(b) split above no longer maps 1:1 to the rendered
// rows -- all the same controls (same fields, same cascading/hide behavior) are now
// grouped into labeled clusters (Classification/People/Status/Dates/Search) inside one
// bordered card. Purely visual; `ColFilter`/`applyColFilters`/the cascade logic below are
// unchanged.
import { useMemo, type ReactNode } from 'react';
import { Icon } from '../../ui/icon';
import { CompactMultiSelect } from './compact-multi-select';
import { TASK_STATUSES, TASK_PRIORITIES as PRIORITIES } from './create-task-modal.schema';
import type { Task, User, Project, WorkFunction } from '../../../lib/types';

export interface Opt { value: string; label: string }

// ─── Filter state + apply (cross-field AND, within-field OR) ────────────────
export interface ColFilter {
  functions: string[]; subFunctions: string[]; projects: string[]; assignee: string[]; assigner: string[];
  status: string[]; priority: string[]; recurring: string[]; // subset of ['yes','no']
  adateFrom: string; adateTo: string; due: string;
}
export const DEFAULT_COL_FILTER: ColFilter = {
  functions: [], subFunctions: [], projects: [], assignee: [], assigner: [], status: [], priority: [], recurring: [], adateFrom: '', adateTo: '', due: '',
};

export function applyColFilters(tasks: Task[], f: ColFilter): Task[] {
  // A single-value recurring filter derived from the multi-select's array: selecting
  // just one of "Recurring"/"One-time" narrows to that boolean; selecting both (or
  // neither) applies no filter at all.
  const recurringOnly = f.recurring.length === 1 ? f.recurring[0] : null;
  return tasks.filter((t) => {
    if (f.functions.length && !(t.functionId && f.functions.includes(t.functionId))) return false;
    if (f.subFunctions.length && !(t.subFnId && f.subFunctions.includes(t.subFnId))) return false;
    if (f.projects.length && !(t.projId && f.projects.includes(t.projId))) return false;
    if (f.assignee.length && !t.assigneeIds.some((a) => f.assignee.includes(a))) return false;
    if (f.assigner.length && !f.assigner.includes(t.assignerId)) return false;
    if (f.status.length && !f.status.includes(t.status)) return false;
    if (f.priority.length && !f.priority.includes(t.priority)) return false;
    // Round4 checklist#1: "recurring" here means recurrencePattern !== 'One Time'
    // (the real 5-value cadence), not the legacy boolean.
    if (recurringOnly === 'yes' && t.recurrencePattern === 'One Time') return false;
    if (recurringOnly === 'no' && t.recurrencePattern !== 'One Time') return false;
    if (f.adateFrom && new Date(t.createdAt) < new Date(f.adateFrom)) return false;
    if (f.adateTo && new Date(t.createdAt) > new Date(`${f.adateTo}T23:59:59`)) return false;
    // A "due by" filter excludes tasks with no due date at all, not just those due later.
    if (f.due && (!t.dueDate || new Date(t.dueDate) > new Date(`${f.due}T23:59:59`))) return false;
    return true;
  });
}

const RECURRING_OPTS = [
  { id: 'yes', label: 'Recurring' },
  { id: 'no', label: 'One-time' },
];

// PTASK-FILTERBAR-REDESIGN: pure layout, no behavior change -- groups the same controls
// into labeled clusters inside a bordered card instead of two unlabeled flex-wrap rows.
function FilterCluster({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--muted)' }}>{label}</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>
    </div>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 10, color: 'var(--muted2)' }}>{label}</span>
      <input type="date" className="fc" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export function FilterBar({ value, onChange, employees, projects, functions, scope, taskQuery, onTaskQueryChange }: {
  value: ColFilter; onChange: (next: ColFilter) => void;
  employees: User[]; projects: Project[]; functions: WorkFunction[];
  // Hides the Assignee filter for the "mine" scope (every task is already the current
  // user's), matching the reference's blank filter cell for that task-sheet instance.
  scope?: string;
  taskQuery: string; onTaskQueryChange: (q: string) => void;
}) {
  const set = (patch: Partial<ColFilter>) => onChange({ ...value, ...patch });

  const empName = (e: User) => `${e.firstName} ${e.lastName}`;
  // Assignee/Assigner options are the full employee list, A→Z, with no cascade
  // (Part 37: unlike Function/Sub-Function, these never narrow by Project/Function).
  const empOpts = useMemo(
    () => employees.map((e) => ({ id: e.empId, label: empName(e) })).sort((a, b) => a.label.localeCompare(b.label)),
    [employees],
  );
  // Cascade: Functions narrowed to selected Project.
  const fnOpts = useMemo<Opt[]>(
    () =>
      functions
        .filter((fn) => !fn.parentFnId)
        .filter((fn) => !value.projects.length || (fn.projId && value.projects.includes(fn.projId)))
        .map((fn) => ({ value: fn.functionId, label: fn.name })),
    [functions, value.projects],
  );
  // Cascade: Sub-Functions narrowed to selected Function (and, failing that, Project).
  const subFnOpts = useMemo(
    () =>
      functions
        .filter((fn) => !!fn.parentFnId)
        .filter((fn) => (value.functions.length ? fn.parentFnId && value.functions.includes(fn.parentFnId) : true))
        .filter((fn) => !value.projects.length || (fn.projId && value.projects.includes(fn.projId)))
        .map((fn) => ({ id: fn.functionId, label: fn.name })),
    [functions, value.functions, value.projects],
  );
  const projOpts = useMemo<Opt[]>(() => projects.map((p) => ({ value: p.projId, label: p.name })), [projects]);
  const statusOpts = useMemo(() => TASK_STATUSES.map((s) => ({ id: s, label: s })), []);
  const prioOpts = useMemo(() => PRIORITIES.map((p) => ({ id: p, label: p })), []);

  // Selecting a broader filter (Project, then Function) prunes any narrower selection
  // that's fallen out of scope, instead of silently leaving an invisible/stale filter
  // active (Part 37: "previously-selected out-of-scope functions are pruned").
  const setProject = (v: string) => {
    const nextProjects = v ? [v] : [];
    const nextFunctions = value.functions.filter((id) => {
      const fn = functions.find((f) => f.functionId === id);
      return !nextProjects.length || (fn?.projId && nextProjects.includes(fn.projId));
    });
    const nextSubFunctions = value.subFunctions.filter((id) => {
      const fn = functions.find((f) => f.functionId === id);
      const parentOk = nextFunctions.length ? fn?.parentFnId && nextFunctions.includes(fn.parentFnId) : true;
      const projOk = !nextProjects.length || (fn?.projId && nextProjects.includes(fn.projId));
      return parentOk && projOk;
    });
    onChange({ ...value, projects: nextProjects, functions: nextFunctions, subFunctions: nextSubFunctions });
  };
  const setFunction = (v: string) => {
    const nextFunctions = v ? [v] : [];
    const nextSubFunctions = value.subFunctions.filter((id) => {
      const fn = functions.find((f) => f.functionId === id);
      return !nextFunctions.length || (fn?.parentFnId && nextFunctions.includes(fn.parentFnId));
    });
    onChange({ ...value, functions: nextFunctions, subFunctions: nextSubFunctions });
  };

  const isFiltering =
    value.functions.length || value.subFunctions.length || value.projects.length || value.assignee.length ||
    value.assigner.length || value.status.length || value.priority.length || value.recurring.length ||
    value.adateFrom || value.adateTo || value.due || taskQuery;

  const clearAll = () => { onChange(DEFAULT_COL_FILTER); onTaskQueryChange(''); };

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r)', background: 'var(--surface)', padding: '12px 14px', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--muted)' }}>Filters</span>
        {isFiltering ? (
          <button className="btn btn-ghost btn-sm" onClick={clearAll}><Icon name="close" size={14} /> Clear</button>
        ) : null}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
        {/* Function + Sub-Function + Project — same cascading Project → Function →
            Sub-Function pruning as before (`setProject`/`setFunction` above); Project is
            available ONLY here, never as a table column (FIX A). */}
        <FilterCluster label="Classification">
          <select className="fc" value={value.functions[0] ?? ''} onChange={(e) => setFunction(e.target.value)}>
            <option value="">All Functions</option>
            {fnOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <CompactMultiSelect placeholder="Sub-Function" options={subFnOpts} selectedIds={value.subFunctions} onChange={(v) => set({ subFunctions: v })} />
          <select className="fc" value={value.projects[0] ?? ''} onChange={(e) => setProject(e.target.value)}>
            <option value="">All Projects</option>
            {projOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </FilterCluster>

        <FilterCluster label="People">
          {scope !== 'mine' && (
            <CompactMultiSelect placeholder="Assigned To" options={empOpts} selectedIds={value.assignee} onChange={(v) => set({ assignee: v })} />
          )}
          <CompactMultiSelect placeholder="Assigned By" options={empOpts} selectedIds={value.assigner} onChange={(v) => set({ assigner: v })} />
        </FilterCluster>

        <FilterCluster label="Status">
          <CompactMultiSelect placeholder="Status" options={statusOpts} selectedIds={value.status} onChange={(v) => set({ status: v })} />
          <CompactMultiSelect placeholder="Priority" options={prioOpts} selectedIds={value.priority} onChange={(v) => set({ priority: v })} />
          <CompactMultiSelect placeholder="Recurring" options={RECURRING_OPTS} selectedIds={value.recurring} onChange={(v) => set({ recurring: v })} />
        </FilterCluster>

        <FilterCluster label="Dates">
          <DateField label="Assigned from" value={value.adateFrom} onChange={(v) => set({ adateFrom: v })} />
          <DateField label="Assigned to" value={value.adateTo} onChange={(v) => set({ adateTo: v })} />
          <DateField label="Due by" value={value.due} onChange={(v) => set({ due: v })} />
        </FilterCluster>

        <FilterCluster label="Search">
          <input type="text" className="fc" placeholder="Search task…" value={taskQuery} onChange={(e) => onTaskQueryChange(e.target.value)} />
        </FilterCluster>
      </div>
    </div>
  );
}

export default FilterBar;
