'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Icon } from '../../ui/icon';
import { useAuth } from '../../../hooks/use-auth';
import { isAdmin } from '../../../lib/auth';
import { useProject, useUpdateProject, useDeleteProject } from '../../../lib/api/projects';
import { useProjects } from '../../../lib/api/projects';
import { useFunctions } from '../../../lib/api/functions';
import { useTasks } from '../../../lib/api/tasks';
import { apiErrorMessage } from '../../../lib/api/client';
import { Spinner } from '../../ui/spinner';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../ui/form';
import { EmployeeMultiSelect, fieldClass, TASK_PRIORITIES } from '../tasks/create-task-modal';
import { PROJECT_STATUSES } from './create-project-modal';
import { updateProjectSchema, type UpdateProjectFormValues } from './project-detail-modal.schema';

export function ProjectDetailModal({ projId, onClose }: { projId: string | null; onClose: () => void }) {
  const { currentUser } = useAuth();
  const { data: project, isLoading } = useProject(projId);
  const update = useUpdateProject();
  const del = useDeleteProject();
  const { data: allProjects } = useProjects();
  const { data: functions } = useFunctions(projId ?? undefined);
  const { data: tasks } = useTasks();

  const [error, setError] = useState<string | null>(null);

  const form = useForm<UpdateProjectFormValues>({
    resolver: zodResolver(updateProjectSchema),
    defaultValues: {
      name: '',
      description: '',
      status: 'Not Started',
      priority: 'Medium',
      deadline: '',
      assigneeIds: [],
    },
  });

  useEffect(() => {
    if (project) {
      form.reset({
        name: project.name,
        description: project.description ?? '',
        status: project.status as UpdateProjectFormValues['status'],
        priority: project.priority as UpdateProjectFormValues['priority'],
        deadline: project.deadline ? project.deadline.slice(0, 10) : '',
        assigneeIds: project.assigneeIds,
      });
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  const subProjects = useMemo(() => (allProjects ?? []).filter((p) => p.parentProjId === projId), [allProjects, projId]);
  const linkedTasks = useMemo(() => (tasks ?? []).filter((t) => t.projId === projId), [tasks, projId]);
  const admin = currentUser ? isAdmin(currentUser.role) : false;

  if (!projId) return null;

  async function onSubmit(values: UpdateProjectFormValues) {
    setError(null);
    try {
      await update.mutateAsync({
        projId: projId!,
        dto: {
          name: values.name,
          description: values.description,
          status: values.status,
          priority: values.priority,
          deadline: values.deadline ? new Date(values.deadline).toISOString() : undefined,
          assigneeIds: values.assigneeIds,
        },
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
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl><input className={`${fieldClass} text-base`} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl><textarea rows={3} className={`${fieldClass} resize-none`} placeholder="Description" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <select className={fieldClass} {...field}>
                            {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <select className={fieldClass} {...field}>
                            {TASK_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="deadline"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl><input type="date" className={fieldClass} {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="assigneeIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="mb-1 block text-xs text-[var(--muted)]">Assignees</FormLabel>
                      <FormControl>
                        <EmployeeMultiSelect selected={field.value} onChange={field.onChange} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
            </Form>

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
