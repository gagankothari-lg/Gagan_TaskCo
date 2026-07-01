'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Icon } from '../../ui/icon';
import { useAuth } from '../../../hooks/use-auth';
import { isAdmin } from '../../../lib/auth';
import { canDeleteFunction, canEditFunction } from '../../../lib/rbac';
import { useFunction, useUpdateFunction, useDeleteFunction } from '../../../lib/api/functions';
import { useTasks } from '../../../lib/api/tasks';
import { apiErrorMessage } from '../../../lib/api/client';
import { toast } from '../../../lib/toast';
import { Spinner } from '../../ui/spinner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../ui/dialog';
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

  const linkedTasks = useMemo(() => (tasks ?? []).filter((t) => t.functionId === functionId || t.subFnId === functionId), [tasks, functionId]);
  const canEdit = fn ? canEditFunction(currentUser, fn) : false;
  const canDelete = fn ? canDeleteFunction(currentUser, fn) : false;
  const admin = currentUser ? isAdmin(currentUser.role) : false;
  const notAssigner = fn && currentUser ? fn.assignerId !== currentUser.empId : false;
  const showRequestChange = !admin && notAssigner;

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
      toast('Function updated', 'success');
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to save'));
    }
  }

  async function remove() {
    if (!confirm('Delete this function and its sub-functions? Linked tasks will be unlinked.')) return;
    try {
      await del.mutateAsync(functionId!);
      toast('Function deleted', 'success');
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to delete'));
    }
  }

  return (
    <>
      <Dialog open={!!functionId} onOpenChange={(next) => { if (!next) onClose(); }}>
        <DialogContent size="lg">
          <DialogHeader>
            <div className="min-w-0 flex-1">
              <DialogTitle className="truncate">{fn?.name ?? 'Function'}</DialogTitle>
              <p className="mt-0.5 text-xs text-muted">{fn?.parentFnId ? 'Sub-Function' : 'Function'} · {fn?.functionId ?? functionId}</p>
            </div>
          </DialogHeader>
          {isLoading || !fn ? (
            <div className="flex items-center justify-center px-5 py-10 text-p"><Spinner size={24} /></div>
          ) : (
            <div className="max-h-[70vh] space-y-5 overflow-y-auto px-5 py-4">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
                  <fieldset disabled={!canEdit} className="space-y-3 disabled:opacity-70">
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
                            <FormLabel className="mb-1 block text-xs text-muted">Status</FormLabel>
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
                            <FormLabel className="mb-1 block text-xs text-muted">Priority</FormLabel>
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
                            <FormLabel className="mb-1 block text-xs text-muted">Deadline</FormLabel>
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
                          <FormLabel className="mb-1 block text-xs text-muted">Assignees</FormLabel>
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
                          <FormLabel className="mb-1 block text-xs text-muted">Links (one per line)</FormLabel>
                          <FormControl>
                            <textarea rows={2} className={`${fieldClass} resize-none font-mono text-xs`} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </fieldset>
                  {error && <div className="rounded-[8px] border border-danger/40 bg-[#fce8e8] px-3 py-2 text-sm text-danger">{error}</div>}
                  {!canEdit && <p className="text-xs text-muted2">You don&apos;t have permission to edit this function.</p>}
                  <div className="flex items-center gap-2">
                    {canEdit && (
                      <button type="submit" disabled={update.isPending} className="btn btn-primary">
                        {update.isPending && <Spinner size={14} />} Save
                      </button>
                    )}
                    {showRequestChange && (
                      <button type="button" onClick={() => setDdrOpen(true)} className="btn btn-ghost">
                        <Icon name="edit_calendar" size={14} /> Request date change
                      </button>
                    )}
                    {canDelete && (
                      <button type="button" onClick={remove} className="btn btn-danger ml-auto">
                        <Icon name="delete" size={14} /> Delete
                      </button>
                    )}
                  </div>
                </form>
              </Form>

              <div className="border-t border-border pt-4">
                <p className="mb-2 text-xs uppercase tracking-wide text-muted">Sub-functions ({fn.children.length})</p>
                <div className="space-y-1">
                  {fn.children.length === 0 && <p className="text-sm text-muted2">None.</p>}
                  {fn.children.map((c) => (
                    <div key={c.functionId} className="flex items-center gap-2 rounded-[8px] border border-border bg-bg px-3 py-1.5">
                      <span className="font-mono text-xs text-muted">{c.functionId}</span>
                      <span className="truncate text-sm text-text">{c.name}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t border-border pt-4">
                <p className="mb-2 text-xs uppercase tracking-wide text-muted">Tasks ({linkedTasks.length})</p>
                <div className="space-y-1">
                  {linkedTasks.length === 0 && <p className="text-sm text-muted2">None.</p>}
                  {linkedTasks.map((t) => (
                    <div key={t.taskId} className="flex items-center gap-2 rounded-[8px] border border-border bg-bg px-3 py-1.5">
                      <span className="font-mono text-xs text-muted">{t.taskId}</span>
                      <span className="truncate text-sm text-text">{t.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {fn && <DdrModal open={ddrOpen} onClose={() => setDdrOpen(false)} entityType="Function" entityId={fn.functionId} />}
    </>
  );
}

export default FunctionDetailModal;
