'use client';

// NOTE: the modal component this file used to export (`CreateTaskModal`, a
// single-task "New Task" dialog) was retired in favor of the task-sheet's inline
// batch "Add Tasks" row (task-list-view.tsx's `TaskBatchAddRow`) — see that file's
// header comment. This file is kept around (not deleted) purely because
// `EmployeeMultiSelect` / `fieldClass` / the TASK_STATUSES/TASK_PRIORITIES
// re-exports below are still live dependencies of several other modals
// (create-function-modal, create-project-modal, function-detail-modal,
// project-detail-modal, task-edit-modal, task-detail-modal, holiday-modal,
// submit-leave-modal) — grepped with zero other importers of the component itself.
import { useMemo, useState } from 'react';
import { Icon } from '../../ui/icon';
import { useAuth } from '../../../hooks/use-auth';
import { TASK_PRIORITIES, TASK_STATUSES } from './create-task-modal.schema';

export { TASK_STATUSES, TASK_PRIORITIES };

export const fieldClass =
  'w-full bg-surface border border-border text-text rounded-[8px] px-3 py-2 text-sm focus:border-p2 focus:outline-none';

export function EmployeeMultiSelect({ selected, onChange }: { selected: string[]; onChange: (ids: string[]) => void }) {
  const { employees } = useAuth();
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const term = q.toLowerCase();
    return employees.filter((e) => `${e.firstName} ${e.lastName} ${e.team ?? ''}`.toLowerCase().includes(term));
  }, [employees, q]);

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  return (
    <div className="rounded-[8px] border border-border bg-surface">
      <div className="flex items-center gap-2 border-b border-border px-2.5 py-1.5">
        <Icon name="search" size={14} className="text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people…" className="w-full bg-transparent text-sm text-text placeholder:text-muted focus:outline-none" />
      </div>
      <div className="max-h-40 overflow-y-auto p-1">
        {filtered.length === 0 ? (
          <p className="px-2 py-2 text-xs text-muted">No matches</p>
        ) : (
          filtered.map((e) => (
            <label key={e.empId} className="flex cursor-pointer items-center gap-2 rounded-[8px] px-2 py-1.5 text-sm text-text hover:bg-p3">
              <input type="checkbox" checked={selected.includes(e.empId)} onChange={() => toggle(e.empId)} className="accent-p" />
              <span className="truncate">{e.firstName} {e.lastName}</span>
              {e.team && <span className="ml-auto truncate text-xs text-muted">{e.team}</span>}
            </label>
          ))
        )}
      </div>
    </div>
  );
}
