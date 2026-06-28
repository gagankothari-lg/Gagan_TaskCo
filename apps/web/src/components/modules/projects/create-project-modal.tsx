'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { Icon } from '../../ui/icon';
import { useAuth } from '../../../hooks/use-auth';
import { useCreateProject, useProjects } from '../../../hooks/use-projects';
import { apiErrorMessage } from '../../../lib/api';
import { Spinner } from '../../ui/spinner';
import { EmployeeMultiSelect, fieldClass, TASK_PRIORITIES } from '../tasks/create-task-modal';

export const PROJECT_STATUSES = ['Not Started', 'Planning', 'WIP', 'Under Review', 'On Hold', 'Done', 'Cancelled'];

export function CreateProjectModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { employees } = useAuth();
  const create = useCreateProject();
  const { data: projects } = useProjects();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [team, setTeam] = useState('');
  const [status, setStatus] = useState('Not Started');
  const [priority, setPriority] = useState('Medium');
  const [deadline, setDeadline] = useState('');
  const [parentProjId, setParentProjId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const teams = useMemo(() => Array.from(new Set(employees.map((e) => e.team).filter(Boolean))) as string[], [employees]);

  if (!open) return null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError('Name is required');
    try {
      await create.mutateAsync({
        name,
        description: description || undefined,
        assigneeIds,
        assignedTeams: team ? [team] : undefined,
        status,
        priority,
        deadline: deadline ? new Date(deadline).toISOString() : undefined,
        parentProjId: parentProjId || undefined,
      });
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to create project'));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8">
      <div className="max-h-full w-full max-w-[500px] overflow-y-auto rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--text)]">New Project</h2>
          <button onClick={onClose} aria-label="Close" className="text-[var(--muted)] hover:text-[var(--text)]"><Icon name="close" size={18} /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <input className={fieldClass} placeholder="Project name *" value={name} onChange={(e) => setName(e.target.value)} />
          <textarea rows={2} className={`${fieldClass} resize-none`} placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
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
            <select className={fieldClass} value={status} onChange={(e) => setStatus(e.target.value)}>
              {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <input type="date" className={fieldClass} value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </div>
          <select className={fieldClass} value={parentProjId} onChange={(e) => setParentProjId(e.target.value)}>
            <option value="">No parent project</option>
            {(projects ?? []).map((p) => <option key={p.projId} value={p.projId}>{p.projId} — {p.name}</option>)}
          </select>
          {error && <div className="rounded-[8px] border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">{error}</div>}
          <button type="submit" disabled={create.isPending} className="btn btn-primary btn-full">
            {create.isPending && <Spinner size={14} />} Create project
          </button>
        </form>
      </div>
    </div>
  );
}

export default CreateProjectModal;
