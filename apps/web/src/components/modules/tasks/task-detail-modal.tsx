'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Icon } from '../../ui/icon';
import { useAuth } from '../../../hooks/use-auth';
import { useTask, useUpdateTask, useProgressUpdates, useAddProgress } from '../../../hooks/use-tasks';
import { apiErrorMessage } from '../../../lib/api';
import { Spinner } from '../../ui/spinner';
import { DdrModal } from './ddr-modal';
import { EmployeeMultiSelect, TASK_STATUSES, TASK_PRIORITIES, fieldClass } from './create-task-modal';
import { statusDotColor, priorityColor, isTaskOverdue } from './task-row';

interface TaskDetailModalProps {
  taskId: string | null;
  onClose: () => void;
}

export function TaskDetailModal({ taskId, onClose }: TaskDetailModalProps) {
  const { currentUser, attCounts } = useAuth();
  const { data: task, isLoading } = useTask(taskId);
  const { data: progress } = useProgressUpdates(taskId);
  const update = useUpdateTask();
  const addProgress = useAddProgress();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('Not Started');
  const [priority, setPriority] = useState('Medium');
  const [dueDate, setDueDate] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [links, setLinks] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ddrOpen, setDdrOpen] = useState(false);

  const [pDesc, setPDesc] = useState('');
  const [pHours, setPHours] = useState('');
  const [pBlockers, setPBlockers] = useState('');

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? '');
      setStatus(task.status);
      setPriority(task.priority);
      setDueDate(task.dueDate ? task.dueDate.slice(0, 10) : '');
      setEstimatedHours(task.estimatedHours != null ? String(task.estimatedHours) : '');
      setLinks(task.links ?? '');
      setAssigneeIds(task.assigneeIds);
      setError(null);
    }
  }, [task]);

  if (!taskId) return null;

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await update.mutateAsync({
        taskId: taskId!,
        dto: {
          title,
          description,
          status,
          priority,
          dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
          estimatedHours: estimatedHours ? Number(estimatedHours) : undefined,
          links: links.split('\n').map((l) => l.trim()).filter(Boolean),
          assigneeIds,
        },
      });
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to save'));
    }
  }

  async function submitProgress(e: FormEvent) {
    e.preventDefault();
    if (!pDesc.trim()) return;
    try {
      await addProgress.mutateAsync({
        taskId: taskId!,
        description: pDesc,
        hoursLogged: pHours ? Number(pHours) : undefined,
        blockers: pBlockers || undefined,
      });
      setPDesc(''); setPHours(''); setPBlockers('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to add progress'));
    }
  }

  const overdue = task ? isTaskOverdue(task) : false;
  const notAssigner = task && currentUser ? task.assignerId !== currentUser.empId : false;
  const attCount = task ? attCounts[task.taskId] ?? 0 : 0;

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-40 bg-black/50" aria-hidden />
      <aside role="dialog" aria-label="Task detail" className="fixed right-0 top-0 z-50 flex h-full w-[520px] max-w-full flex-col border-l border-[var(--border)] bg-[var(--surface)] text-[var(--text)]">
        <div className="flex h-[52px] shrink-0 items-center justify-between border-b border-[var(--border)] px-5">
          <div className="flex items-center gap-2">
            <span className="h-[7px] w-[7px] rounded-full" style={{ backgroundColor: statusDotColor(status, overdue) }} />
            <span className="font-mono text-xs text-[var(--muted)]">{task?.taskId ?? taskId}</span>
            <span className="rounded-[9999px] border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--muted)]">{status}</span>
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: priorityColor(priority) }} title={priority} />
          </div>
          <button onClick={onClose} aria-label="Close" className="text-[var(--muted)] hover:text-[var(--text)]"><Icon name="close" size={18} /></button>
        </div>

        {isLoading || !task ? (
          <div className="flex flex-1 items-center justify-center text-[var(--p)]"><Spinner size={24} /></div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            <form onSubmit={save} className="space-y-3">
              <input className={`${fieldClass} text-base`} value={title} onChange={(e) => setTitle(e.target.value)} />
              <textarea rows={3} className={`${fieldClass} resize-none`} placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <select className={fieldClass} value={status} onChange={(e) => setStatus(e.target.value)}>
                  {TASK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <select className={fieldClass} value={priority} onChange={(e) => setPriority(e.target.value)}>
                  {TASK_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <input type="date" className={fieldClass} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                <input type="number" min={0} step="0.5" className={fieldClass} placeholder="Est. hours" value={estimatedHours} onChange={(e) => setEstimatedHours(e.target.value)} />
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
                <button type="submit" disabled={update.isPending} className="btn btn-primary disabled:opacity-60">
                  {update.isPending && <Spinner size={14} />} Save
                </button>
                {notAssigner && (
                  <button type="button" onClick={() => setDdrOpen(true)} className="btn btn-ghost">
                    <Icon name="edit_calendar" size={14} /> Request date change
                  </button>
                )}
                {attCount > 0 && (
                  <span className="ml-auto inline-flex items-center gap-1 rounded-[9999px] border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--muted)]">
                    <Icon name="attach_file" size={12} /> {attCount}
                  </span>
                )}
              </div>
            </form>

            <div className="border-t border-[var(--border)] pt-4">
              <p className="mb-2 text-xs uppercase tracking-wide text-[var(--muted)]">Progress</p>
              <form onSubmit={submitProgress} className="mb-4 space-y-2">
                <textarea rows={2} className={`${fieldClass} resize-none`} placeholder="What did you do?" value={pDesc} onChange={(e) => setPDesc(e.target.value)} />
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" min={0} step="0.5" className={fieldClass} placeholder="Hours" value={pHours} onChange={(e) => setPHours(e.target.value)} />
                  <input className={fieldClass} placeholder="Blockers (optional)" value={pBlockers} onChange={(e) => setPBlockers(e.target.value)} />
                </div>
                <button type="submit" disabled={addProgress.isPending} className="btn btn-ghost disabled:opacity-60">
                  {addProgress.isPending && <Spinner size={14} />} Add update
                </button>
              </form>
              <div className="space-y-2">
                {(progress ?? []).length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">No progress updates yet.</p>
                ) : (
                  (progress ?? []).map((u) => (
                    <div key={u.updateId} className="rounded-[8px] border border-[var(--border)] bg-[var(--bg)] p-3">
                      <div className="mb-1 flex items-center justify-between text-xs text-[var(--muted)]">
                        <span className="font-mono">{u.authorEmpId}</span>
                        <span>{new Date(u.date).toLocaleString()}</span>
                      </div>
                      <p className="text-sm text-[var(--text)]">{u.description}</p>
                      {(u.hoursLogged || u.blockers) && (
                        <div className="mt-1 flex gap-3 text-xs text-[var(--muted)]">
                          {u.hoursLogged ? <span>{u.hoursLogged}h logged</span> : null}
                          {u.blockers ? <span className="text-[var(--warn)]">Blocker: {u.blockers}</span> : null}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </aside>
      {task && <DdrModal open={ddrOpen} onClose={() => setDdrOpen(false)} entityType="Task" entityId={task.taskId} />}
    </>
  );
}

export default TaskDetailModal;
