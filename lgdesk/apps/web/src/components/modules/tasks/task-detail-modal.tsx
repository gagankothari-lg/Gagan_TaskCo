'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Icon } from '../../ui/icon';
import { useAuth } from '../../../hooks/use-auth';
import { useTask, useUpdateTask, useProgressUpdates, useAddProgress } from '../../../lib/api/tasks';
import { apiErrorMessage } from '../../../lib/api/client';
import { Spinner } from '../../ui/spinner';
import { DdrModal } from './ddr-modal';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../ui/form';
import { EmployeeMultiSelect, TASK_STATUSES, TASK_PRIORITIES, fieldClass } from './create-task-modal';
import { editTaskSchema, addProgressSchema, type EditTaskFormValues, type AddProgressFormValues } from './task-detail-modal.schema';
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

  const [error, setError] = useState<string | null>(null);
  const [ddrOpen, setDdrOpen] = useState(false);

  const form = useForm<EditTaskFormValues>({
    resolver: zodResolver(editTaskSchema),
    defaultValues: {
      title: '',
      description: '',
      status: 'Not Started',
      priority: 'Medium',
      dueDate: '',
      estimatedHours: '',
      links: '',
      assigneeIds: [],
    },
  });

  const progressForm = useForm<AddProgressFormValues>({
    resolver: zodResolver(addProgressSchema),
    defaultValues: {
      description: '',
      hoursLogged: '',
      blockers: '',
    },
  });

  useEffect(() => {
    if (task) {
      form.reset({
        title: task.title,
        description: task.description ?? '',
        status: task.status as EditTaskFormValues['status'],
        priority: task.priority as EditTaskFormValues['priority'],
        dueDate: task.dueDate ? task.dueDate.slice(0, 10) : '',
        estimatedHours: task.estimatedHours != null ? String(task.estimatedHours) : '',
        links: task.links ?? '',
        assigneeIds: task.assigneeIds,
      });
      setError(null);
    }
  }, [task, form]);

  const status = form.watch('status');
  const priority = form.watch('priority');

  if (!taskId) return null;

  async function onSubmit(values: EditTaskFormValues) {
    setError(null);
    try {
      await update.mutateAsync({
        taskId: taskId!,
        dto: {
          title: values.title,
          description: values.description,
          status: values.status,
          priority: values.priority,
          dueDate: values.dueDate ? new Date(values.dueDate).toISOString() : undefined,
          estimatedHours: values.estimatedHours ? Number(values.estimatedHours) : undefined,
          links: (values.links ?? '').split('\n').map((l) => l.trim()).filter(Boolean),
          assigneeIds: values.assigneeIds,
        },
      });
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to save'));
    }
  }

  async function onSubmitProgress(values: AddProgressFormValues) {
    try {
      await addProgress.mutateAsync({
        taskId: taskId!,
        description: values.description,
        hoursLogged: values.hoursLogged ? Number(values.hoursLogged) : undefined,
        blockers: values.blockers || undefined,
      });
      progressForm.reset();
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
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
                <FormField
                  control={form.control}
                  name="title"
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
                            {TASK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
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
                    name="dueDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl><input type="date" className={fieldClass} {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="estimatedHours"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <input type="number" min={0} step="0.5" className={fieldClass} placeholder="Est. hours" {...field} />
                        </FormControl>
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
                <FormField
                  control={form.control}
                  name="links"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="mb-1 block text-xs text-[var(--muted)]">Links (one per line)</FormLabel>
                      <FormControl>
                        <textarea rows={2} className={`${fieldClass} resize-none font-mono text-xs`} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
            </Form>

            <div className="border-t border-[var(--border)] pt-4">
              <p className="mb-2 text-xs uppercase tracking-wide text-[var(--muted)]">Progress</p>
              <Form {...progressForm}>
                <form onSubmit={progressForm.handleSubmit(onSubmitProgress)} className="mb-4 space-y-2">
                  <FormField
                    control={progressForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl><textarea rows={2} className={`${fieldClass} resize-none`} placeholder="What did you do?" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <FormField
                      control={progressForm.control}
                      name="hoursLogged"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl><input type="number" min={0} step="0.5" className={fieldClass} placeholder="Hours" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={progressForm.control}
                      name="blockers"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl><input className={fieldClass} placeholder="Blockers (optional)" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <button type="submit" disabled={addProgress.isPending} className="btn btn-ghost disabled:opacity-60">
                    {addProgress.isPending && <Spinner size={14} />} Add update
                  </button>
                </form>
              </Form>
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
