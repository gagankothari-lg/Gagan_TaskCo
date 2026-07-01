'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../ui/icon';
import { TASK_STATUSES, TASK_PRIORITIES as PRIORITIES } from './create-task-modal.schema';
import type { Task, User, Project, WorkFunction } from '../../../lib/types';

const LG_NAVY = '#2D3E51';
const LG_CRIMSON = '#E64D3D';

export interface Opt { value: string; label: string }

// ─── Portal multi-select (body-appended, z-index max, scroll-trap) ──────────
export function MultiSelect({ placeholder, options, selected, onChange, width = 170 }: {
  placeholder: string; options: Opt[]; selected: string[]; onChange: (next: string[]) => void; width?: number;
}) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [q, setQ] = useState('');
  const triggerRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (portalRef.current?.contains(t) || triggerRef.current?.contains(t)) return; // contains() check
      setOpen(false);
    };
    // Stay open when scrolling INSIDE the dropdown list; close on outside/page scroll.
    const onScroll = (e: Event) => {
      if (portalRef.current && portalRef.current.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', onScroll, true);
    return () => { document.removeEventListener('mousedown', onDown); window.removeEventListener('scroll', onScroll, true); };
  }, [open]);

  const toggle = (v: string) => onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  const openIt = () => { if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect()); setQ(''); setOpen((o) => !o); };

  const filtered = options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()));
  const single = selected.length === 1 ? (options.find((o) => o.value === selected[0])?.label ?? '1 selected') : null;

  return (
    <>
      <div
        ref={triggerRef} onClick={openIt}
        style={{ minWidth: width, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', fontSize: 12, cursor: 'pointer', color: selected.length ? 'var(--text)' : 'var(--muted2)' }}
      >
        {selected.length > 1 ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: LG_NAVY, color: '#fff', borderRadius: 10, padding: '1px 8px', fontWeight: 600 }}>
            {selected.length} selected
            <span onClick={(e) => { e.stopPropagation(); onChange([]); }} style={{ color: LG_CRIMSON, fontWeight: 700 }}>×</span>
          </span>
        ) : (
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{single ?? placeholder}</span>
        )}
        <Icon name="expand_more" size={16} style={{ marginLeft: 'auto', color: 'var(--muted)' }} />
      </div>

      {open && rect && typeof document !== 'undefined' && createPortal(
        <div
          ref={portalRef}
          style={{ position: 'fixed', top: rect.bottom + 4, left: rect.left, minWidth: Math.max(rect.width, 220), maxHeight: 300, overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', zIndex: 2147483647 }}
          onWheel={(e) => e.stopPropagation()}
        >
          <input className="fc" autoFocus placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} style={{ position: 'sticky', top: 0, borderRadius: 0, borderWidth: '0 0 1px 0' }} />
          {filtered.length === 0 && <div style={{ padding: 8, fontSize: 12, color: 'var(--muted)' }}>No options</div>}
          {filtered.map((o) => (
            <div key={o.value} onClick={() => toggle(o.value)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 12 }}>
              <span style={{ width: 16, height: 16, border: `1.5px solid ${LG_NAVY}`, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {selected.includes(o.value) && <Icon name="check" size={12} style={{ color: LG_NAVY }} />}
              </span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.label}</span>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}

// ─── Filter state + apply (cross-field AND, within-field OR) ────────────────
export interface ColFilter {
  functions: string[]; subFunctions: string[]; projects: string[]; assignee: string[]; assigner: string[];
  status: string[]; priority: string[]; recurring: 'all' | 'yes' | 'no';
  adateFrom: string; adateTo: string; due: string;
}
export const DEFAULT_COL_FILTER: ColFilter = {
  functions: [], subFunctions: [], projects: [], assignee: [], assigner: [], status: [], priority: [], recurring: 'all', adateFrom: '', adateTo: '', due: '',
};

export function applyColFilters(tasks: Task[], f: ColFilter): Task[] {
  return tasks.filter((t) => {
    if (f.functions.length && !(t.functionId && f.functions.includes(t.functionId))) return false;
    if (f.subFunctions.length && !(t.subFnId && f.subFunctions.includes(t.subFnId))) return false;
    if (f.projects.length && !(t.projId && f.projects.includes(t.projId))) return false;
    if (f.assignee.length && !t.assigneeIds.some((a) => f.assignee.includes(a))) return false;
    if (f.assigner.length && !f.assigner.includes(t.assignerId)) return false;
    if (f.status.length && !f.status.includes(t.status)) return false;
    if (f.priority.length && !f.priority.includes(t.priority)) return false;
    if (f.recurring === 'yes' && !t.recurring) return false;
    if (f.recurring === 'no' && t.recurring) return false;
    if (f.adateFrom && new Date(t.createdAt) < new Date(f.adateFrom)) return false;
    if (f.adateTo && new Date(t.createdAt) > new Date(`${f.adateTo}T23:59:59`)) return false;
    if (f.due && t.dueDate && new Date(t.dueDate) > new Date(`${f.due}T23:59:59`)) return false;
    return true;
  });
}

export function FilterBar({ value, onChange, employees, projects, functions }: {
  value: ColFilter; onChange: (next: ColFilter) => void;
  employees: User[]; projects: Project[]; functions: WorkFunction[];
}) {
  const set = (patch: Partial<ColFilter>) => onChange({ ...value, ...patch });

  const empName = (e: User) => `${e.firstName} ${e.lastName}`;
  // Assignee/Assigner options are the full employee list, A→Z, with no cascade
  // (Part 37: unlike Function/Sub-Function, these never narrow by Project/Function).
  const empOpts = useMemo<Opt[]>(
    () => employees.map((e) => ({ value: e.empId, label: empName(e) })).sort((a, b) => a.label.localeCompare(b.label)),
    [employees],
  );
  // Cascade: Functions narrowed to selected Projects.
  const fnOpts = useMemo<Opt[]>(
    () =>
      functions
        .filter((fn) => !fn.parentFnId)
        .filter((fn) => !value.projects.length || (fn.projId && value.projects.includes(fn.projId)))
        .map((fn) => ({ value: fn.functionId, label: fn.name })),
    [functions, value.projects],
  );
  // Cascade: Sub-Functions narrowed to selected Functions (and, failing that, Projects).
  const subFnOpts = useMemo<Opt[]>(
    () =>
      functions
        .filter((fn) => !!fn.parentFnId)
        .filter((fn) => (value.functions.length ? fn.parentFnId && value.functions.includes(fn.parentFnId) : true))
        .filter((fn) => !value.projects.length || (fn.projId && value.projects.includes(fn.projId)))
        .map((fn) => ({ value: fn.functionId, label: fn.name })),
    [functions, value.functions, value.projects],
  );
  const projOpts = useMemo<Opt[]>(() => projects.map((p) => ({ value: p.projId, label: p.name })), [projects]);
  const statusOpts = TASK_STATUSES.map((s) => ({ value: s, label: s }));
  const prioOpts = PRIORITIES.map((p) => ({ value: p, label: p }));

  // Selecting a broader filter (Project, then Function) prunes any narrower selection
  // that's fallen out of scope, instead of silently leaving an invisible/stale filter
  // active (Part 37: "previously-selected out-of-scope functions are pruned").
  const setProjects = (v: string[]) => {
    const nextProjects = v;
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
  const setFunctions = (v: string[]) => {
    const nextSubFunctions = value.subFunctions.filter((id) => {
      const fn = functions.find((f) => f.functionId === id);
      return !v.length || (fn?.parentFnId && v.includes(fn.parentFnId));
    });
    onChange({ ...value, functions: v, subFunctions: nextSubFunctions });
  };

  const dateInp = 'fc';
  const isFiltering = value.functions.length || value.subFunctions.length || value.projects.length || value.assignee.length || value.assigner.length || value.status.length || value.priority.length || value.recurring !== 'all' || value.adateFrom || value.adateTo || value.due;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
      {/* Secondary row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--muted)' }}>Filter:</span>
        <MultiSelect placeholder="All Projects" options={projOpts} selected={value.projects} onChange={setProjects} width={200} />
        <MultiSelect placeholder="All Functions" options={fnOpts} selected={value.functions} onChange={setFunctions} width={200} />
        <MultiSelect placeholder="All Sub-Functions" options={subFnOpts} selected={value.subFunctions} onChange={(v) => set({ subFunctions: v })} width={200} />
      </div>
      {/* Aligned column row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <input type="date" className={dateInp} title="Assigned from" value={value.adateFrom} onChange={(e) => set({ adateFrom: e.target.value })} style={{ width: 'auto', borderColor: LG_NAVY }} />
        <input type="date" className={dateInp} title="Assigned to" value={value.adateTo} onChange={(e) => set({ adateTo: e.target.value })} style={{ width: 'auto', borderColor: LG_NAVY }} />
        <MultiSelect placeholder="Assigned to" options={empOpts} selected={value.assignee} onChange={(v) => set({ assignee: v })} />
        <MultiSelect placeholder="Assigned by" options={empOpts} selected={value.assigner} onChange={(v) => set({ assigner: v })} />
        <select className="fc" value={value.recurring} onChange={(e) => set({ recurring: e.target.value as ColFilter['recurring'] })} style={{ width: 'auto' }}>
          <option value="all">Recurring: all</option>
          <option value="yes">Recurring</option>
          <option value="no">One-time</option>
        </select>
        <MultiSelect placeholder="Status" options={statusOpts} selected={value.status} onChange={(v) => set({ status: v })} />
        <MultiSelect placeholder="Priority" options={prioOpts} selected={value.priority} onChange={(v) => set({ priority: v })} width={130} />
        <input type="date" className={dateInp} title="Due by" value={value.due} onChange={(e) => set({ due: e.target.value })} style={{ width: 'auto' }} />
        {isFiltering ? (
          <button className="btn btn-ghost btn-sm" onClick={() => onChange(DEFAULT_COL_FILTER)}><Icon name="close" size={14} /> Clear</button>
        ) : null}
      </div>
    </div>
  );
}

export default FilterBar;
