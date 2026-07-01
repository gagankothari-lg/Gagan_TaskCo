'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Icon } from '../../ui/icon';
import { useCreateDdr } from '../../../lib/api/dueDateRequests';
import { apiErrorMessage } from '../../../lib/api/client';
import { Spinner } from '../../ui/spinner';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../ui/form';
import { ddrSchema, type DdrFormValues } from './ddr-modal.schema';

interface DdrModalProps {
  open: boolean;
  onClose: () => void;
  entityType: 'Task' | 'Project' | 'Function';
  entityId: string;
}

const inputClass =
  'w-full bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] rounded-[8px] px-3 py-2 text-sm focus:border-[var(--p2)] focus:outline-none';

export function DdrModal({ open, onClose, entityType, entityId }: DdrModalProps) {
  const create = useCreateDdr();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const form = useForm<DdrFormValues>({
    resolver: zodResolver(ddrSchema),
    defaultValues: {
      newDueDate: '',
      reason: '',
    },
  });

  if (!open) return null;

  async function onSubmit(values: DdrFormValues) {
    setError(null);
    try {
      await create.mutateAsync({
        entityType,
        entityId,
        newDueDate: new Date(values.newDueDate).toISOString(),
        reason: values.reason,
      });
      setDone(true);
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to submit request'));
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-[380px] rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--text)]">Request date change</h3>
          <button onClick={onClose} aria-label="Close" className="text-[var(--muted)] hover:text-[var(--text)]"><Icon name="close" size={18} /></button>
        </div>
        {done ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <Icon name="check_circle" size={36} className="text-[var(--ok)]" />
            <p className="text-sm text-[var(--text)]">Request submitted for approval.</p>
            <button onClick={onClose} className="btn btn-ghost mt-2">Done</button>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              <FormField
                control={form.control}
                name="newDueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="mb-1 block text-xs text-[var(--muted)]">New due date</FormLabel>
                    <FormControl><input type="date" className={inputClass} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="mb-1 block text-xs text-[var(--muted)]">Reason</FormLabel>
                    <FormControl>
                      <textarea rows={3} className={`${inputClass} resize-none`} placeholder="Why does the date need to change?" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {error && <div className="rounded-[8px] border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">{error}</div>}
              <button type="submit" disabled={create.isPending} className="btn btn-primary w-full disabled:opacity-60">
                {create.isPending && <Spinner size={14} />} Submit request
              </button>
            </form>
          </Form>
        )}
      </div>
    </div>
  );
}

export default DdrModal;
