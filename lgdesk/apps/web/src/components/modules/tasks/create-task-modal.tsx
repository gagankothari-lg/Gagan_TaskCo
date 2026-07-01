'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { Icon } from '../../ui/icon';
import { useAuth } from '../../../hooks/use-auth';
import { useCreateTask } from '../../../lib/api/tasks';
import { apiErrorMessage } from '../../../lib/api/client';
import { Spinner } from '../../ui/spinner';

export const TASK_STATUSES = ['Backlog', 'Not Started', 'WIP - 25%', 'WIP - 50%', 'WIP - 75%', 'Under Review', 'Done', 'Cancelled'];
export const TASK_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

export const fieldClass =
  'w-full bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] rounded-[8px] px-3 py-2 text-sm focus:border-[var(--p2)] focus:outline-none';

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
    <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)]">
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-2.5 py-1.5">
        <Icon name="search" size={14} className="text-[var(--muted)]" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people…" className="w-full bg-transparent text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none" />
      </div>
      <div className="max-h-40 overflow-y-auto p-1">
        {filtered.length === 0 ? (
          <p className="px-2 py-2 text-xs text-[var(--muted)]">No matches</p>
        ) : (
          filtered.map((e) => (
            <label key={e.empId} className="flex cursor-pointer items-center gap-2 rounded-[8px] px-2 py-1.5 text-sm text-[var(--text)] hover:bg-[var(--p3)]">
              <input type="checkbox" checked={selected.includes(e.empId)} onChange={() => toggle(e.empId)} className="accent-[var(--p)]" />
              <span className="truncate">{e.firstName} {e.lastName}</span>
              {e.team && <span className="ml-auto truncate text-xs text-[var(--muted)]">{e.team}</span>}
            </label>
          ))
        )}
      </div>
    </div>
  );
}

interface CreateTaskModalProps {
  open: boolean;
  onClose: () => void;
}

export function CreateTaskModal({ open, onClose }: CreateTaskModalProps) {
  const { employees } = useAuth();
  const create = useCreateTask();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projId, setProjId] = useState('');
  const [functionId, setFunctionId] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [team, setTeam] = useState('');
  const [status, setStatus] = useState('Not Started');
  const [priority, setPriority] = useState('Medium');
  const [dueDate, setDueDate] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [error, setError] = useState<string | null>(null);

  const teams = useMemo(() => Array.from(new Set(employees.map((e) => e.team).filter(Boolean))) as string[], [employees]);

  if (!open) return null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) return setError('Title is required');
    try {
      await create.mutateAsync({
        title,
        description: description || undefined,
        projId: projId || undefined,
        functionId: functionId || undefined,
        assigneeIds,
        assignedTeams: team ? [team] : undefined,
        status,
        priority,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        estimatedHours: estimatedHours ? Number(estimatedHours) : undefined,
      });
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to create task'));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8">
      <div className="max-h-full w-full max-w-[500px] overflow-y-auto rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--text)]">New Task</h2>
          <button onClick={onClose} aria-label="Close" className="text-[var(--muted)] hover:text-[var(--text)]"><Icon name="close" size={18} /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <input className={fieldClass} placeholder="Task title *" value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea rows={2} className={`${fieldClass} resize-none`} placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <input className={fieldClass} placeholder="Project ID (PRJ-…)" value={projId} onChange={(e) => setProjId(e.target.value)} />
            <input className={fieldClass} placeholder="Function ID (FN-…)" value={functionId} onChange={(e) => setFunctionId(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--muted)]">Assignees</label>
            <EmployeeMultiSelect selected={assigneeIds} onChange={setAssigneeIds} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <select className={fieldClass} value={team} onChange={(e) => setTeam(e.target.value)}>
              <option value="">No team</option>
              {teams.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select className={fieldClass} value={priority} onChange={(e) => setPriority(e.target.value)}>
              {TASK_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <select className={fieldClass} value={status} onChange={(e) => setStatus(e.target.value)}>
              {TASK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <input type="number" min={0} step="0.5" className={fieldClass} placeholder="Est. hours" value={estimatedHours} onChange={(e) => setEstimatedHours(e.target.value)} />
          </div>
          <input type="date" className={fieldClass} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          {error && <div className="rounded-[8px] border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">{error}</div>}
          <button type="submit" disabled={create.isPending} className="btn btn-primary w-full disabled:opacity-60">
            {create.isPending && <Spinner size={14} />} Create task
          </button>
        </form>
      </div>
    </div>
  );
}

export default CreateTaskModal;
