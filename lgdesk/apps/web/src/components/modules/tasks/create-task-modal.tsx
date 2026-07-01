'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Icon } from '../../ui/icon';
import { useAuth } from '../../../hooks/use-auth';
import { useCreateTask } from '../../../lib/api/tasks';
import { apiErrorMessage } from '../../../lib/api/client';
import { Spinner } from '../../ui/spinner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../ui/form';
import { createTaskSchema, TASK_PRIORITIES, TASK_STATUSES, type CreateTaskFormValues } from './create-task-modal.schema';

export { TASK_STATUSES, TASK_PRIORITIES };

export const fieldClass =
  'w-full bg-surface border border-border text-text rounded-[8px] px-3 py-2 text-sm focus:border-p2 focus:outline-none';

export function EmployeeMultiSelect({ selected, onChange }: { selected: string[]; onChange: (ids: string[]) => void }) {
  const { employees } = useAuth();
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const term = q.toLowerCase();
    return employees.filter((e) => `${e.firstName} ${e.lastName} ${e.team ?? ''}`.toLowerCase().includes(term));
  }, [employees, q]);

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  return (
    <div className="rounded-[8px] border border-border bg-surface">
      <div className="flex items-center gap-2 border-b border-border px-2.5 py-1.5">
        <Icon name="search" size={14} className="text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people…" className="w-full bg-transparent text-sm text-text placeholder:text-muted focus:outline-none" />
      </div>
      <div className="max-h-40 overflow-y-auto p-1">
        {filtered.length === 0 ? (
          <p className="px-2 py-2 text-xs text-muted">No matches</p>
        ) : (
          filtered.map((e) => (
            <label key={e.empId} className="flex cursor-pointer items-center gap-2 rounded-[8px] px-2 py-1.5 text-sm text-text hover:bg-p3">
              <input type="checkbox" checked={selected.includes(e.empId)} onChange={() => toggle(e.empId)} className="accent-p" />
              <span className="truncate">{e.firstName} {e.lastName}</span>
              {e.team && <span className="ml-auto truncate text-xs text-muted">{e.team}</span>}
            </label>
          ))
        )}
      </div>
    </div>
  );
}

interface CreateTaskModalProps {
  open: boolean;
  onClose: () => void;
  /** Pre-selects a function (e.g. "New Task" launched from a function's detail view). */
  defaultFunctionId?: string;
  defaultProjId?: string;
}

export function CreateTaskModal({ open, onClose, defaultFunctionId, defaultProjId }: CreateTaskModalProps) {
  const { employees, functions, projects } = useAuth();
  const create = useCreateTask();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<CreateTaskFormValues>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      title: '',
      description: '',
      projId: defaultProjId ?? '',
      functionId: defaultFunctionId ?? '',
      subFnId: '',
      assigneeIds: [],
      team: '',
      status: 'Not Started',
      priority: 'Medium',
      dueDate: '',
      estimatedHours: '',
    },
  });

  // Reset to defaults each time the modal is (re)opened, so state from a previous
  // task doesn't leak into the next one.
  useEffect(() => {
    if (open) {
      form.reset({
        title: '',
        description: '',
        projId: defaultProjId ?? '',
        functionId: defaultFunctionId ?? '',
        subFnId: '',
        assigneeIds: [],
        team: '',
        status: 'Not Started',
        priority: 'Medium',
        dueDate: '',
        estimatedHours: '',
      });
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultFunctionId, defaultProjId]);

  const teams = useMemo(() => Array.from(new Set(employees.map((e) => e.team).filter(Boolean))) as string[], [employees]);
  const projId = form.watch('projId');
  const functionId = form.watch('functionId');
  // Function options: when a project is selected, narrow to that project's top-level
  // functions; with no project, show every top-level function (Part 13 edit-modal rule).
  const fnOpts = useMemo(
    () => functions.filter((f) => !f.parentFnId && (!projId || f.projId === projId)),
    [functions, projId],
  );
  // Sub-Function options: WorkFunction rows whose Parent_Fn_ID points at the selected
  // top-level Function (Part 14 — Functions & Sub-Functions share one table).
  const subFnOpts = useMemo(() => functions.filter((f) => f.parentFnId === functionId), [functions, functionId]);
  useEffect(() => {
    const current = form.getValues('functionId');
    if (current && !fnOpts.some((f) => f.functionId === current)) form.setValue('functionId', '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projId]);
  useEffect(() => {
    const current = form.getValues('subFnId');
    if (current && !subFnOpts.some((f) => f.functionId === current)) form.setValue('subFnId', '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [functionId]);

  async function onSubmit(values: CreateTaskFormValues) {
    setError(null);
    try {
      await create.mutateAsync({
        title: values.title,
        description: values.description || undefined,
        projId: values.projId || undefined,
        functionId: values.functionId || undefined,
        subFnId: values.subFnId || undefined,
        assigneeIds: values.assigneeIds,
        assignedTeams: values.team ? [values.team] : undefined,
        status: values.status,
        priority: values.priority,
        dueDate: values.dueDate ? new Date(values.dueDate).toISOString() : undefined,
        estimatedHours: values.estimatedHours ? Number(values.estimatedHours) : undefined,
      });
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to create task'));
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>New Task</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="space-y-3 px-5 py-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormControl><input className={fieldClass} placeholder="Task title *" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormControl><textarea rows={2} className={`${fieldClass} resize-none`} placeholder="Description" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-3 gap-3">
                <FormField
                  control={form.control}
                  name="projId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="mb-1 block text-xs text-muted">Project</FormLabel>
                      <FormControl>
                        <select className={fieldClass} {...field}>
                          <option value="">No project</option>
                          {projects.map((p) => <option key={p.projId} value={p.projId}>{p.name}</option>)}
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="team"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="mb-1 block text-xs text-muted">Team</FormLabel>
                      <FormControl>
                        <select className={fieldClass} {...field}>
                          <option value="">No team</option>
                          {teams.map((t) => <option key={t} value={t}>{t}</option>)}
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
              </div>
              <div className="grid grid-cols-3 gap-3">
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
                  name="dueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="mb-1 block text-xs text-muted">Due date</FormLabel>
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
                      <FormLabel className="mb-1 block text-xs text-muted">Est. hours</FormLabel>
                      <FormControl>
                        <input type="number" min={0} step="0.5" className={fieldClass} placeholder="0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              {error && <div className="rounded-[8px] border border-danger/40 bg-[#fce8e8] px-3 py-2 text-sm text-danger">{error}</div>}
            </div>
            <DialogFooter>
              <button type="submit" disabled={create.isPending} className="btn btn-primary disabled:opacity-60">
                {create.isPending && <Spinner size={14} />} Create task
              </button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default CreateTaskModal;
