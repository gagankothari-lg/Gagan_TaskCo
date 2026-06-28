'use client';

import type { Task } from '../../../lib/types';
import { isTaskOverdue } from './task-row';

export type StatusFilter = 'All' | 'Active' | 'WIP' | 'Done' | 'Overdue';
export type PriorityFilter = 'All' | 'Critical' | 'High' | 'Medium' | 'Low';

export interface TaskFilterState {
  status: StatusFilter;
  priority: PriorityFilter;
  mineOnly: boolean;
}

export const DEFAULT_TASK_FILTER: TaskFilterState = { status: 'All', priority: 'All', mineOnly: false };

export function applyTaskFilters(tasks: Task[], f: TaskFilterState, callerEmpId?: string): Task[] {
  return tasks.filter((t) => {
    if (f.status === 'Active' && ['Done', 'Cancelled'].includes(t.status)) return false;
    if (f.status === 'WIP' && !t.status.startsWith('WIP')) return false;
    if (f.status === 'Done' && t.status !== 'Done') return false;
    if (f.status === 'Overdue' && !isTaskOverdue(t)) return false;
    if (f.priority !== 'All' && t.priority !== f.priority) return false;
    if (f.mineOnly && callerEmpId && !t.assigneeIds.includes(callerEmpId)) return false;
    return true;
  });
}

const STATUSES: StatusFilter[] = ['All', 'Active', 'WIP', 'Done', 'Overdue'];
const PRIORITIES: PriorityFilter[] = ['All', 'Critical', 'High', 'Medium', 'Low'];

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`tl-tab${active ? ' active' : ''}`}>{children}</button>
  );
}

export function TaskFilters({ value, onChange }: { value: TaskFilterState; onChange: (next: TaskFilterState) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, overflowX: 'auto', paddingBottom: 4 }}>
      <div className="tl-tabs">
        {STATUSES.map((s) => <Chip key={s} active={value.status === s} onClick={() => onChange({ ...value, status: s })}>{s}</Chip>)}
      </div>
      <div style={{ height: 16, width: 1, background: 'var(--border)', flexShrink: 0 }} />
      <div className="tl-tabs">
        {PRIORITIES.map((p) => <Chip key={p} active={value.priority === p} onClick={() => onChange({ ...value, priority: p })}>{p}</Chip>)}
      </div>
      <div style={{ height: 16, width: 1, background: 'var(--border)', flexShrink: 0 }} />
      <Chip active={value.mineOnly} onClick={() => onChange({ ...value, mineOnly: !value.mineOnly })}>Assigned to me</Chip>
    </div>
  );
}

export default TaskFilters;
