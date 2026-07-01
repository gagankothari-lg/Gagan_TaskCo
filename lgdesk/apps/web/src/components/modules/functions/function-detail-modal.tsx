'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Icon } from '../../ui/icon';
import { useAuth } from '../../../hooks/use-auth';
import { isAdmin } from '../../../lib/auth';
import { useFunction, useUpdateFunction, useDeleteFunction } from '../../../lib/api/functions';
import { useTasks } from '../../../lib/api/tasks';
import { apiErrorMessage } from '../../../lib/api/client';
import { Spinner } from '../../ui/spinner';
import { DdrModal } from '../tasks/ddr-modal';
import { EmployeeMultiSelect, fieldClass, TASK_PRIORITIES } from '../tasks/create-task-modal';
import { PROJECT_STATUSES } from '../projects/create-project-modal';

export function FunctionDetailModal({ functionId, onClose }: { functionId: string | null; onClose: () => void }) {
  const { currentUser } = useAuth();
  const { data: fn, isLoading } = useFunction(functionId);
  const update = useUpdateFunction();
  const del = useDeleteFunction();
  const { data: tasks } = useTasks();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('Not Started');
  const [priority, setPriority] = useState('Medium');
  const [deadline, setDeadline] = useState('');
  const [links, setLinks] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ddrOpen, setDdrOpen] = useState(false);

  useEffect(() => {
    if (fn) {
      setName(fn.name);
      setDescription(fn.description ?? '');
      setStatus(fn.status);
      setPriority(fn.priority);
      setDeadline(fn.deadline ? fn.deadline.slice(0, 10) : '');
      setLinks((fn as { links?: string }).links ?? '');
      setAssigneeIds(fn.assigneeIds);
      setError(null);
    }
  }, [fn]);

  const linkedTasks = useMemo(() => (tasks ?? []).filter((t) => t.functionId === functionId), [tasks, functionId]);
  const admin = currentUser ? isAdmin(currentUser.role) : false;
  const notAssigner = fn && currentUser ? fn.assignerId !== currentUser.empId : false;

  if (!functionId) return null;

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await update.mutateAsync({
        functionId: functionId!,
        dto: { name, description, status, priority, deadline: deadline ? new Date(deadline).toISOString() : undefined, assigneeIds, links: links.split('\n').map((l) => l.trim()).filter(Boolean) },
      });
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to save'));
    }
  }

  async function remove() {
    if (!confirm('Delete this function and its sub-functions? Linked tasks will be unlinked.')) return;
    try {
      await del.mutateAsync(functionId!);
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to delete'));
    }
  }

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-40 bg-black/50" aria-hidden />
      <aside role="dialog" aria-label="Function detail" className="fixed right-0 top-0 z-50 flex h-full w-[520px] max-w-full flex-col border-l border-[var(--border)] bg-[var(--surface)]">
        <div className="flex h-[52px] shrink-0 items-center justify-between border-b border-[var(--border)] px-5">
          <span className="font-mono text-xs text-[var(--muted)]">{fn?.functionId ?? functionId}</span>
          <button onClick={onClose} aria-label="Close" className="text-[var(--muted)] hover:text-[var(--text)]"><Icon name="close" size={18} /></button>
        </div>
        {isLoading || !fn ? (
          <div className="flex flex-1 items-center justify-center text-[var(--p)]"><Spinner size={24} /></div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            <form onSubmit={save} className="space-y-3">
              <input className={`${fieldClass} text-base`} value={name} onChange={(e) => setName(e.target.value)} />
              <textarea rows={3} className={`${fieldClass} resize-none`} placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <select className={fieldClass} value={status} onChange={(e) => setStatus(e.target.value)}>
                  {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <select className={fieldClass} value={priority} onChange={(e) => setPriority(e.target.value)}>
                  {TASK_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <input type="date" className={fieldClass} value={deadline} onChange={(e) => setDeadline(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[var(--muted)]">Assignees</label>
                <EmployeeMultiSelect selected={assigneeIds} onChange={setAssigneeIds} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[var(--muted)]">Links (one per line)</label>
                <textarea rows={2} className={`${fieldClass} resize-none font-mono text-xs`} value={links} onChange={(e) => setLinks(e.target.value)} />
              </div>
              {error && <div className="rounded-[8px] border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">{error}</div>}
              <div className="flex items-center gap-2">
                <button type="submit" disabled={update.isPending} className="btn btn-primary">
                  {update.isPending && <Spinner size={14} />} Save
                </button>
                {notAssigner && (
                  <button type="button" onClick={() => setDdrOpen(true)} className="btn btn-ghost">
                    <Icon name="edit_calendar" size={14} /> Request date change
                  </button>
                )}
                {admin && (
                  <button type="button" onClick={remove} className="btn btn-danger ml-auto">
                    <Icon name="delete" size={14} /> Delete
                  </button>
                )}
              </div>
            </form>

            <div className="border-t border-[var(--border)] pt-4">
              <p className="mb-2 text-xs uppercase tracking-wide text-[var(--muted)]">Sub-functions ({fn.children.length})</p>
              <div className="space-y-1">
                {fn.children.map((c) => (
                  <div key={c.functionId} className="flex items-center gap-2 rounded-[8px] border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5">
                    <span className="font-mono text-xs text-[var(--muted)]">{c.functionId}</span>
                    <span className="truncate text-sm text-[var(--text)]">{c.name}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="border-t border-[var(--border)] pt-4">
              <p className="mb-2 text-xs uppercase tracking-wide text-[var(--muted)]">Tasks ({linkedTasks.length})</p>
              <div className="space-y-1">
                {linkedTasks.map((t) => (
                  <div key={t.taskId} className="flex items-center gap-2 rounded-[8px] border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5">
                    <span className="font-mono text-xs text-[var(--muted)]">{t.taskId}</span>
                    <span className="truncate text-sm text-[var(--text)]">{t.title}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </aside>
      {fn && <DdrModal open={ddrOpen} onClose={() => setDdrOpen(false)} entityType="Function" entityId={fn.functionId} />}
    </>
  );
}

export default FunctionDetailModal;
