'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Icon } from '../../ui/icon';
import { useAuth } from '../../../hooks/use-auth';
import { isAdmin } from '../../../lib/auth';
import { useProject, useUpdateProject, useDeleteProject } from '../../../lib/api/projects';
import { useProjects } from '../../../lib/api/projects';
import { useFunctions } from '../../../lib/api/functions';
import { useTasks } from '../../../lib/api/tasks';
import { apiErrorMessage } from '../../../lib/api/client';
import { Spinner } from '../../ui/spinner';
import { EmployeeMultiSelect, fieldClass, TASK_PRIORITIES } from '../tasks/create-task-modal';
import { PROJECT_STATUSES } from './create-project-modal';

export function ProjectDetailModal({ projId, onClose }: { projId: string | null; onClose: () => void }) {
  const { currentUser } = useAuth();
  const { data: project, isLoading } = useProject(projId);
  const update = useUpdateProject();
  const del = useDeleteProject();
  const { data: allProjects } = useProjects();
  const { data: functions } = useFunctions(projId ?? undefined);
  const { data: tasks } = useTasks();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('Not Started');
  const [priority, setPriority] = useState('Medium');
  const [deadline, setDeadline] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (project) {
      setName(project.name);
      setDescription(project.description ?? '');
      setStatus(project.status);
      setPriority(project.priority);
      setDeadline(project.deadline ? project.deadline.slice(0, 10) : '');
      setAssigneeIds(project.assigneeIds);
      setError(null);
    }
  }, [project]);

  const subProjects = useMemo(() => (allProjects ?? []).filter((p) => p.parentProjId === projId), [allProjects, projId]);
  const linkedTasks = useMemo(() => (tasks ?? []).filter((t) => t.projId === projId), [tasks, projId]);
  const admin = currentUser ? isAdmin(currentUser.role) : false;

  if (!projId) return null;

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await update.mutateAsync({
        projId: projId!,
        dto: { name, description, status, priority, deadline: deadline ? new Date(deadline).toISOString() : undefined, assigneeIds },
      });
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to save'));
    }
  }

  async function remove() {
    if (!confirm('Delete this project?')) return;
    try {
      await del.mutateAsync(projId!);
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to delete'));
    }
  }

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-40 bg-black/50" aria-hidden />
      <aside role="dialog" aria-label="Project detail" className="fixed right-0 top-0 z-50 flex h-full w-[520px] max-w-full flex-col border-l border-[var(--border)] bg-[var(--surface)]">
        <div className="flex h-[52px] shrink-0 items-center justify-between border-b border-[var(--border)] px-5">
          <span className="font-mono text-xs text-[var(--muted)]">{project?.projId ?? projId}</span>
          <button onClick={onClose} aria-label="Close" className="text-[var(--muted)] hover:text-[var(--text)]"><Icon name="close" size={18} /></button>
        </div>

        {isLoading || !project ? (
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
              {error && <div className="rounded-[8px] border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">{error}</div>}
              <div className="flex items-center gap-2">
                <button type="submit" disabled={update.isPending} className="btn btn-primary">
                  {update.isPending && <Spinner size={14} />} Save
                </button>
                {admin && (
                  <button type="button" onClick={remove} className="btn btn-danger ml-auto">
                    <Icon name="delete" size={14} /> Delete
                  </button>
                )}
              </div>
            </form>

            <Section title={`Sub-projects (${subProjects.length})`}>
              {subProjects.map((p) => <Row key={p.projId} id={p.projId} label={p.name} />)}
            </Section>
            <Section title={`Functions (${functions?.length ?? 0})`}>
              {(functions ?? []).map((f) => <Row key={f.functionId} id={f.functionId} label={f.name} />)}
            </Section>
            <Section title={`Tasks (${linkedTasks.length})`}>
              {linkedTasks.map((t) => <Row key={t.taskId} id={t.taskId} label={t.title} />)}
            </Section>
          </div>
        )}
      </aside>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-[var(--border)] pt-4">
      <p className="mb-2 text-xs uppercase tracking-wide text-[var(--muted)]">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({ id, label }: { id: string; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-[8px] border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5">
      <span className="font-mono text-xs text-[var(--muted)]">{id}</span>
      <span className="truncate text-sm text-[var(--text)]">{label}</span>
    </div>
  );
}

export default ProjectDetailModal;
