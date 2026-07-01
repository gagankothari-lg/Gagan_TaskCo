'use client';

import { useState, type FormEvent } from 'react';
import { Icon } from '../../ui/icon';
import { useAuth } from '../../../hooks/use-auth';
import { isManager } from '../../../lib/auth';
import { useCreateFunction, useFunctions } from '../../../lib/api/functions';
import { useProjects } from '../../../lib/api/projects';
import { apiErrorMessage } from '../../../lib/api/client';
import { Spinner } from '../../ui/spinner';
import { EmployeeMultiSelect, fieldClass, TASK_PRIORITIES } from '../tasks/create-task-modal';
import { PROJECT_STATUSES } from '../projects/create-project-modal';

interface CreateFunctionModalProps {
  open: boolean;
  onClose: () => void;
  defaultProjId?: string;
  defaultParentFnId?: string;
}

export function CreateFunctionModal({ open, onClose, defaultProjId, defaultParentFnId }: CreateFunctionModalProps) {
  const { currentUser } = useAuth();
  const create = useCreateFunction();
  const { data: functions } = useFunctions(defaultProjId);
  const { data: projects } = useProjects();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [projId, setProjId] = useState(defaultProjId ?? '');
  const [parentFnId, setParentFnId] = useState(defaultParentFnId ?? '');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [status, setStatus] = useState('Not Started');
  const [priority, setPriority] = useState('Medium');
  const [deadline, setDeadline] = useState('');
  const [error, setError] = useState<string | null>(null);

  const manager = currentUser ? isManager(currentUser.role) : false;

  if (!open) return null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError('Name is required');
    const finalAssignees = manager ? assigneeIds : currentUser ? [currentUser.empId] : [];
    try {
      await create.mutateAsync({
        name,
        description: description || undefined,
        projId: projId || undefined,
        parentFnId: parentFnId || undefined,
        assigneeIds: finalAssignees,
        status,
        priority,
        deadline: deadline ? new Date(deadline).toISOString() : undefined,
      });
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to create function'));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8">
      <div className="max-h-full w-full max-w-[500px] overflow-y-auto rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--text)]">New Function</h2>
          <button onClick={onClose} aria-label="Close" className="text-[var(--muted)] hover:text-[var(--text)]"><Icon name="close" size={18} /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <input className={fieldClass} placeholder="Function name *" value={name} onChange={(e) => setName(e.target.value)} />
          <textarea rows={2} className={`${fieldClass} resize-none`} placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <select className={fieldClass} value={projId} onChange={(e) => setProjId(e.target.value)}>
              <option value="">No project</option>
              {(projects ?? []).map((p) => <option key={p.projId} value={p.projId}>{p.projId} — {p.name}</option>)}
            </select>
            <select className={fieldClass} value={parentFnId} onChange={(e) => setParentFnId(e.target.value)}>
              <option value="">No parent function</option>
              {(functions ?? []).map((f) => <option key={f.functionId} value={f.functionId}>{f.functionId} — {f.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--muted)]">Assignees</label>
            {manager ? (
              <EmployeeMultiSelect selected={assigneeIds} onChange={setAssigneeIds} />
            ) : (
              <div className="flex items-center gap-2 rounded-[8px] border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--muted)]">
                <Icon name="info" size={14} className="text-[var(--warn)]" /> Assigned to you (members can only self-assign functions)
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <select className={fieldClass} value={status} onChange={(e) => setStatus(e.target.value)}>
              {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className={fieldClass} value={priority} onChange={(e) => setPriority(e.target.value)}>
              {TASK_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <input type="date" className={fieldClass} value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </div>
          {error && <div className="rounded-[8px] border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">{error}</div>}
          <button type="submit" disabled={create.isPending} className="btn btn-primary btn-full">
            {create.isPending && <Spinner size={14} />} Create function
          </button>
        </form>
      </div>
    </div>
  );
}

export default CreateFunctionModal;
