'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Icon } from '../../ui/icon';
import { useAuth } from '../../../hooks/use-auth';
import { isManager } from '../../../lib/auth';
import { useCreateFunction, useFunctions } from '../../../lib/api/functions';
import { useProjects } from '../../../lib/api/projects';
import { apiErrorMessage } from '../../../lib/api/client';
import { Spinner } from '../../ui/spinner';
import { Form, FormControl, FormField, FormItem, FormMessage } from '../../ui/form';
import { EmployeeMultiSelect, fieldClass, TASK_PRIORITIES } from '../tasks/create-task-modal';
import { PROJECT_STATUSES } from '../projects/create-project-modal';
import { createFunctionSchema, type CreateFunctionFormValues } from './create-function-modal.schema';

interface CreateFunctionModalProps {
  open: boolean;
  onClose: () => void;
  defaultProjId?: string;
  defaultParentFnId?: string;
}

export function CreateFunctionModal({ open, onClose, defaultProjId, defaultParentFnId }: CreateFunctionModalProps) {
  const { currentUser } = useAuth();
  const create = useCreateFunction();
  const { data: functions } = useFunctions(defaultProjId);
  const { data: projects } = useProjects();

  const [error, setError] = useState<string | null>(null);

  const form = useForm<CreateFunctionFormValues>({
    resolver: zodResolver(createFunctionSchema),
    defaultValues: {
      name: '',
      description: '',
      projId: defaultProjId ?? '',
      parentFnId: defaultParentFnId ?? '',
      assigneeIds: [],
      status: 'Not Started',
      priority: 'Medium',
      deadline: '',
    },
  });

  const manager = currentUser ? isManager(currentUser.role) : false;

  if (!open) return null;

  async function onSubmit(values: CreateFunctionFormValues) {
    setError(null);
    const finalAssignees = manager ? values.assigneeIds : currentUser ? [currentUser.empId] : [];
    try {
      await create.mutateAsync({
        name: values.name,
        description: values.description || undefined,
        projId: values.projId || undefined,
        parentFnId: values.parentFnId || undefined,
        assigneeIds: finalAssignees,
        status: values.status,
        priority: values.priority,
        deadline: values.deadline ? new Date(values.deadline).toISOString() : undefined,
      });
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to create function'));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8">
      <div className="max-h-full w-full max-w-[500px] overflow-y-auto rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--text)]">New Function</h2>
          <button onClick={onClose} aria-label="Close" className="text-[var(--muted)] hover:text-[var(--text)]"><Icon name="close" size={18} /></button>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormControl><input className={fieldClass} placeholder="Function name *" {...field} /></FormControl>
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
                    <FormControl>
                      <select className={fieldClass} {...field}>
                        <option value="">No project</option>
                        {(projects ?? []).map((p) => <option key={p.projId} value={p.projId}>{p.projId} — {p.name}</option>)}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="parentFnId"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <select className={fieldClass} {...field}>
                        <option value="">No parent function</option>
                        {(functions ?? []).map((f) => <option key={f.functionId} value={f.functionId}>{f.functionId} — {f.name}</option>)}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--muted)]">Assignees</label>
              {manager ? (
                <FormField
                  control={form.control}
                  name="assigneeIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <EmployeeMultiSelect selected={field.value} onChange={field.onChange} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <div className="flex items-center gap-2 rounded-[8px] border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--muted)]">
                  <Icon name="info" size={14} className="text-[var(--warn)]" /> Assigned to you (members can only self-assign functions)
                </div>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
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
            {error && <div className="rounded-[8px] border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">{error}</div>}
            <button type="submit" disabled={create.isPending} className="btn btn-primary btn-full">
              {create.isPending && <Spinner size={14} />} Create function
            </button>
          </form>
        </Form>
      </div>
    </div>
  );
}

export default CreateFunctionModal;
