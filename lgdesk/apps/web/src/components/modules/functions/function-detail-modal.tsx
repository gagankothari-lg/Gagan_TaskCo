'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Icon } from '../../ui/icon';
import { useAuth } from '../../../hooks/use-auth';
import { isAdmin } from '../../../lib/auth';
import { useFunction, useUpdateFunction, useDeleteFunction } from '../../../lib/api/functions';
import { useTasks } from '../../../lib/api/tasks';
import { apiErrorMessage } from '../../../lib/api/client';
import { Spinner } from '../../ui/spinner';
import { DdrModal } from '../tasks/ddr-modal';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../ui/form';
import { EmployeeMultiSelect, fieldClass, TASK_PRIORITIES } from '../tasks/create-task-modal';
import { PROJECT_STATUSES } from '../projects/create-project-modal';
import { updateFunctionSchema, type UpdateFunctionFormValues } from './function-detail-modal.schema';

export function FunctionDetailModal({ functionId, onClose }: { functionId: string | null; onClose: () => void }) {
  const { currentUser } = useAuth();
  const { data: fn, isLoading } = useFunction(functionId);
  const update = useUpdateFunction();
  const del = useDeleteFunction();
  const { data: tasks } = useTasks();

  const [error, setError] = useState<string | null>(null);
  const [ddrOpen, setDdrOpen] = useState(false);

  const form = useForm<UpdateFunctionFormValues>({
    resolver: zodResolver(updateFunctionSchema),
    defaultValues: {
      name: '',
      description: '',
      status: 'Not Started',
      priority: 'Medium',
      deadline: '',
      links: '',
      assigneeIds: [],
    },
  });

  useEffect(() => {
    if (fn) {
      form.reset({
        name: fn.name,
        description: fn.description ?? '',
        status: fn.status as UpdateFunctionFormValues['status'],
        priority: fn.priority as UpdateFunctionFormValues['priority'],
        deadline: fn.deadline ? fn.deadline.slice(0, 10) : '',
        links: (fn as { links?: string }).links ?? '',
        assigneeIds: fn.assigneeIds,
      });
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fn]);

  const linkedTasks = useMemo(() => (tasks ?? []).filter((t) => t.functionId === functionId), [tasks, functionId]);
  const admin = currentUser ? isAdmin(currentUser.role) : false;
  const notAssigner = fn && currentUser ? fn.assignerId !== currentUser.empId : false;

  if (!functionId) return null;

  async function onSubmit(values: UpdateFunctionFormValues) {
    setError(null);
    try {
      await update.mutateAsync({
        functionId: functionId!,
        dto: {
          name: values.name,
          description: values.description,
          status: values.status,
          priority: values.priority,
          deadline: values.deadline ? new Date(values.deadline).toISOString() : undefined,
          assigneeIds: values.assigneeIds,
          links: (values.links ?? '').split('\n').map((l) => l.trim()).filter(Boolean),
        },
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
            </Form>

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
