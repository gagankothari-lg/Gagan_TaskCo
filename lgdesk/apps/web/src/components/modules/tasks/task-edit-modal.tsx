'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Icon } from '../../ui/icon';
import { useAuth } from '../../../hooks/use-auth';
import { isAdmin } from '../../../lib/auth';
import { useTask, useUpdateTask } from '../../../lib/api/tasks';
import { apiErrorMessage } from '../../../lib/api/client';
import { Spinner } from '../../ui/spinner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../ui/form';
import { DdrModal } from './ddr-modal';
import { EmployeeMultiSelect, TASK_STATUSES, TASK_PRIORITIES, fieldClass } from './create-task-modal';
import { editTaskSchema, type EditTaskFormValues } from './task-detail-modal.schema';

/**
 * Task EDIT modal — Part 13's "Task edit modal" checklist item, split out from the
 * (now read-only) Task Detail modal so the two stay independently testable: Detail =
 * view + progress log, Edit = the RHF+Zod form. Both share the same taskId prop shape
 * so a caller can chain "open detail -> click pencil -> open edit" trivially.
 */
export function TaskEditModal({ taskId, onClose }: { taskId: string | null; onClose: () => void }) {
  const { currentUser, functions, employees } = useAuth();
  const { data: task } = useTask(taskId);
  const update = useUpdateTask();
  const [error, setError] = useState<string | null>(null);
  const [ddrOpen, setDdrOpen] = useState(false);

  const form = useForm<EditTaskFormValues>({
    resolver: zodResolver(editTaskSchema),
    defaultValues: {
      title: '', description: '', functionId: '', subFnId: '', status: 'Not Started',
      priority: 'Medium', dueDate: '', estimatedHours: '', links: '', assigneeIds: [],
    },
  });

  useEffect(() => {
    if (task) {
      form.reset({
        title: task.title,
        description: task.description ?? '',
        functionId: task.functionId ?? '',
        subFnId: task.subFnId ?? '',
        status: task.status as EditTaskFormValues['status'],
        priority: task.priority as EditTaskFormValues['priority'],
        dueDate: task.dueDate ? task.dueDate.slice(0, 10) : '',
        estimatedHours: task.estimatedHours != null ? String(task.estimatedHours) : '',
        links: task.links ?? '',
        assigneeIds: task.assigneeIds,
      });
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task]);

  const functionId = form.watch('functionId');
  // Function options read from APP-loaded `functions` synchronously (Part 13
  // checklist: "no async GAS call"); when the task has no project, every top-level
  // Function is offered — when it belongs to a project, options narrow to that
  // project's Functions (Project isn't itself editable here, so this reads the
  // task's existing `projId` rather than a form field).
  const fnOpts = useMemo(
    () => functions.filter((f) => !f.parentFnId && (!task?.projId || f.projId === task.projId)),
    [functions, task?.projId],
  );
  // Sub-Function options cascade from the selected Function.
  const subFnOpts = useMemo(() => functions.filter((f) => f.parentFnId === functionId), [functions, functionId]);
  useEffect(() => {
    const current = form.getValues('subFnId');
    if (current && !subFnOpts.some((f) => f.functionId === current)) form.setValue('subFnId', '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [functionId]);

  const teams = useMemo(() => Array.from(new Set(employees.map((e) => e.team).filter(Boolean))) as string[], [employees]);

  // Due date may only be changed directly by an Admin or the task's own Assigner
  // (Part 13 DDR flow, step 1); everyone else gets a disabled field + a Request
  // Due Date Change action instead.
  const canChangeDueDateDirectly =
    !!currentUser && !!task && (isAdmin(currentUser.role) || task.assignerId === currentUser.empId);

  if (!taskId) return null;

  async function onSubmit(values: EditTaskFormValues) {
    setError(null);
    try {
      await update.mutateAsync({
        taskId: taskId!,
        dto: {
          title: values.title,
          description: values.description,
          functionId: values.functionId || undefined,
          subFnId: values.subFnId || undefined,
          status: values.status,
          priority: values.priority,
          dueDate: canChangeDueDateDirectly && values.dueDate ? new Date(values.dueDate).toISOString() : undefined,
          estimatedHours: values.estimatedHours ? Number(values.estimatedHours) : undefined,
          links: (values.links ?? '').split('\n').map((l) => l.trim()).filter(Boolean),
          assigneeIds: values.assigneeIds,
        },
      });
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to save'));
    }
  }

  return (
    <>
      <Dialog open={!!taskId} onOpenChange={(next) => { if (!next) onClose(); }}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Edit task</DialogTitle>
          </DialogHeader>
          {!task ? (
            <div className="flex items-center justify-center px-5 py-10 text-p"><Spinner size={24} /></div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)}>
                <div className="space-y-3 px-5 py-4">
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
                      name="functionId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="mb-1 block text-xs text-muted">Function</FormLabel>
                          <FormControl>
                            <select className={fieldClass} {...field}>
                              <option value="">No function</option>
                              {fnOpts.map((f) => <option key={f.functionId} value={f.functionId}>{f.name}</option>)}
                            </select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="subFnId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="mb-1 block text-xs text-muted">Sub-function</FormLabel>
                          <FormControl>
                            <select className={fieldClass} disabled={!functionId} {...field}>
                              <option value="">No sub-function</option>
                              {subFnOpts.map((f) => <option key={f.functionId} value={f.functionId}>{f.name}</option>)}
                            </select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="mb-1 block text-xs text-muted">Status</FormLabel>
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
                      name="dueDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="mb-1 block text-xs text-muted">Due date</FormLabel>
                          <FormControl>
                            <input
                              type="date"
                              className={`${fieldClass} disabled:cursor-not-allowed disabled:opacity-60`}
                              disabled={!canChangeDueDateDirectly}
                              title={canChangeDueDateDirectly ? undefined : 'Only the assigner or an admin can change the due date. Submit a request below.'}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="estimatedHours"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="mb-1 block text-xs text-muted">Est. hours</FormLabel>
                          <FormControl>
                            <input type="number" min={0} step="0.5" className={fieldClass} placeholder="0" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  {!canChangeDueDateDirectly && (
                    <button type="button" onClick={() => setDdrOpen(true)} className="btn btn-ghost btn-sm">
                      <Icon name="edit_calendar" size={14} /> Request Due Date Change
                    </button>
                  )}
                  <FormField
                    control={form.control}
                    name="assigneeIds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="mb-1 block text-xs text-muted">Assign To — people</FormLabel>
                        <FormControl>
                          <EmployeeMultiSelect selected={field.value} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {teams.length > 0 && (
                    <div>
                      <label className="mb-1 block text-xs text-muted">Assign To — team (adds every team member)</label>
                      <select
                        className={fieldClass}
                        defaultValue=""
                        onChange={(e) => {
                          const team = e.target.value;
                          if (!team) return;
                          const ids = employees.filter((emp) => emp.team === team).map((emp) => emp.empId);
                          const current = new Set(form.getValues('assigneeIds'));
                          ids.forEach((id) => current.add(id));
                          form.setValue('assigneeIds', Array.from(current));
                          e.target.value = '';
                        }}
                      >
                        <option value="">Add a team…</option>
                        {teams.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  )}
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
                  {error && <div className="rounded-[8px] border border-danger/40 bg-[#fce8e8] px-3 py-2 text-sm text-danger">{error}</div>}
                </div>
                <DialogFooter>
                  <button type="submit" disabled={update.isPending} className="btn btn-primary disabled:opacity-60">
                    {update.isPending && <Spinner size={14} />} Save
                  </button>
                </DialogFooter>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>
      {task && <DdrModal open={ddrOpen} onClose={() => setDdrOpen(false)} entityType="Task" entityId={task.taskId} />}
    </>
  );
}

export default TaskEditModal;
