'use client';

import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Icon } from '../../ui/icon';
import { useAuth } from '../../../hooks/use-auth';
import { useCreateProject, useProjects } from '../../../lib/api/projects';
import { apiErrorMessage } from '../../../lib/api/client';
import { Spinner } from '../../ui/spinner';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../ui/form';
import { EmployeeMultiSelect, fieldClass, TASK_PRIORITIES } from '../tasks/create-task-modal';
import { createProjectSchema, PROJECT_STATUSES, type CreateProjectFormValues } from './create-project-modal.schema';

export { PROJECT_STATUSES };

export function CreateProjectModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { employees } = useAuth();
  const create = useCreateProject();
  const { data: projects } = useProjects();

  const [error, setError] = useState<string | null>(null);

  const form = useForm<CreateProjectFormValues>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      name: '',
      description: '',
      assigneeIds: [],
      team: '',
      status: 'Not Started',
      priority: 'Medium',
      deadline: '',
      parentProjId: '',
    },
  });

  const teams = useMemo(() => Array.from(new Set(employees.map((e) => e.team).filter(Boolean))) as string[], [employees]);

  if (!open) return null;

  async function onSubmit(values: CreateProjectFormValues) {
    setError(null);
    try {
      await create.mutateAsync({
        name: values.name,
        description: values.description || undefined,
        assigneeIds: values.assigneeIds,
        assignedTeams: values.team ? [values.team] : undefined,
        status: values.status,
        priority: values.priority,
        deadline: values.deadline ? new Date(values.deadline).toISOString() : undefined,
        parentProjId: values.parentProjId || undefined,
      });
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to create project'));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8">
      <div className="max-h-full w-full max-w-[500px] overflow-y-auto rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--text)]">New Project</h2>
          <button onClick={onClose} aria-label="Close" className="text-[var(--muted)] hover:text-[var(--text)]"><Icon name="close" size={18} /></button>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormControl><input className={fieldClass} placeholder="Project name *" {...field} /></FormControl>
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
              name="parentProjId"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <select className={fieldClass} {...field}>
                      <option value="">No parent project</option>
                      {(projects ?? []).map((p) => <option key={p.projId} value={p.projId}>{p.projId} — {p.name}</option>)}
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {error && <div className="rounded-[8px] border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">{error}</div>}
            <button type="submit" disabled={create.isPending} className="btn btn-primary btn-full">
              {create.isPending && <Spinner size={14} />} Create project
            </button>
          </form>
        </Form>
      </div>
    </div>
  );
}

export default CreateProjectModal;
