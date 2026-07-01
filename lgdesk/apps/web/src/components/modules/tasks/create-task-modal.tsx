'use client';

import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Icon } from '../../ui/icon';
import { useAuth } from '../../../hooks/use-auth';
import { useCreateTask } from '../../../lib/api/tasks';
import { apiErrorMessage } from '../../../lib/api/client';
import { Spinner } from '../../ui/spinner';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../ui/form';
import { createTaskSchema, TASK_PRIORITIES, TASK_STATUSES, type CreateTaskFormValues } from './create-task-modal.schema';

export { TASK_STATUSES, TASK_PRIORITIES };

export const fieldClass =
  'w-full bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] rounded-[8px] px-3 py-2 text-sm focus:border-[var(--p2)] focus:outline-none';

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
    <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)]">
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-2.5 py-1.5">
        <Icon name="search" size={14} className="text-[var(--muted)]" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people…" className="w-full bg-transparent text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none" />
      </div>
      <div className="max-h-40 overflow-y-auto p-1">
        {filtered.length === 0 ? (
          <p className="px-2 py-2 text-xs text-[var(--muted)]">No matches</p>
        ) : (
          filtered.map((e) => (
            <label key={e.empId} className="flex cursor-pointer items-center gap-2 rounded-[8px] px-2 py-1.5 text-sm text-[var(--text)] hover:bg-[var(--p3)]">
              <input type="checkbox" checked={selected.includes(e.empId)} onChange={() => toggle(e.empId)} className="accent-[var(--p)]" />
              <span className="truncate">{e.firstName} {e.lastName}</span>
              {e.team && <span className="ml-auto truncate text-xs text-[var(--muted)]">{e.team}</span>}
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
}

export function CreateTaskModal({ open, onClose }: CreateTaskModalProps) {
  const { employees } = useAuth();
  const create = useCreateTask();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<CreateTaskFormValues>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      title: '',
      description: '',
      projId: '',
      functionId: '',
      assigneeIds: [],
      team: '',
      status: 'Not Started',
      priority: 'Medium',
      dueDate: '',
      estimatedHours: '',
    },
  });

  const teams = useMemo(() => Array.from(new Set(employees.map((e) => e.team).filter(Boolean))) as string[], [employees]);

  if (!open) return null;

  async function onSubmit(values: CreateTaskFormValues) {
    setError(null);
    try {
      await create.mutateAsync({
        title: values.title,
        description: values.description || undefined,
        projId: values.projId || undefined,
        functionId: values.functionId || undefined,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8">
      <div className="max-h-full w-full max-w-[500px] overflow-y-auto rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--text)]">New Task</h2>
          <button onClick={onClose} aria-label="Close" className="text-[var(--muted)] hover:text-[var(--text)]"><Icon name="close" size={18} /></button>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
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
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="projId"
                render={({ field }) => (
                  <FormItem>
                    <FormControl><input className={fieldClass} placeholder="Project ID (PRJ-…)" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="functionId"
                render={({ field }) => (
                  <FormItem>
                    <FormControl><input className={fieldClass} placeholder="Function ID (FN-…)" {...field} /></FormControl>
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
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="team"
                render={({ field }) => (
                  <FormItem>
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
              name="dueDate"
              render={({ field }) => (
                <FormItem>
                  <FormControl><input type="date" className={fieldClass} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {error && <div className="rounded-[8px] border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">{error}</div>}
            <button type="submit" disabled={create.isPending} className="btn btn-primary w-full disabled:opacity-60">
              {create.isPending && <Spinner size={14} />} Create task
            </button>
          </form>
        </Form>
      </div>
    </div>
  );
}

export default CreateTaskModal;
