'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Icon } from '../../ui/icon';
import { useSubmitLeave } from '../../../lib/api/leaves';
import { apiErrorMessage } from '../../../lib/api/client';
import { Spinner } from '../../ui/spinner';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../ui/form';
import { LEAVE_TYPES } from '../../../lib/types';
import { submitLeaveSchema, type SubmitLeaveFormValues } from './submit-leave-modal.schema';

const fieldClass = 'bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] rounded-[8px] px-3 py-2 text-sm w-full focus:border-[var(--p)] focus:outline-none';

export function SubmitLeaveModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const submit = useSubmitLeave();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<SubmitLeaveFormValues>({
    resolver: zodResolver(submitLeaveSchema),
    defaultValues: {
      leaveType: 'Annual',
      startDate: '',
      endDate: '',
      reason: '',
    },
  });

  const leaveType = form.watch('leaveType');
  const startDate = form.watch('startDate');
  const endDate = form.watch('endDate');
  const isHalf = leaveType === 'Half Day';
  const days = isHalf
    ? 0.5
    : startDate && endDate
      ? Math.max(0, Math.floor((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1)
      : 0;

  if (!open) return null;

  function onStart(v: string) {
    form.setValue('startDate', v);
    if (isHalf) form.setValue('endDate', v);
  }
  function onType(v: string) {
    form.setValue('leaveType', v as SubmitLeaveFormValues['leaveType']);
    if (v === 'Half Day') form.setValue('endDate', startDate);
  }

  async function onSubmit(values: SubmitLeaveFormValues) {
    setError(null);
    try {
      await submit.mutateAsync({
        leaveType: values.leaveType,
        startDate: new Date(values.startDate).toISOString(),
        endDate: new Date(values.endDate).toISOString(),
        reason: values.reason || undefined,
      });
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to submit leave'));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-[420px] rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-6 text-[var(--text)]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--text)]">Request Leave</h2>
          <button onClick={onClose} aria-label="Close" className="text-[var(--muted)] hover:text-[var(--text)]"><Icon name="close" size={18} /></button>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <FormField
              control={form.control}
              name="leaveType"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <select
                      className={fieldClass}
                      name={field.name}
                      ref={field.ref}
                      value={field.value}
                      onBlur={field.onBlur}
                      onChange={(e) => onType(e.target.value)}
                    >
                      {LEAVE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="mb-1 block text-xs text-[var(--muted)]">Start date</FormLabel>
                    <FormControl>
                      <input
                        type="date"
                        className={fieldClass}
                        name={field.name}
                        ref={field.ref}
                        value={field.value}
                        onBlur={field.onBlur}
                        onChange={(e) => onStart(e.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="mb-1 block text-xs text-[var(--muted)]">End date</FormLabel>
                    <FormControl>
                      <input type="date" className={fieldClass} disabled={isHalf} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <p className="text-sm text-[var(--muted)]">Days: <span className="font-medium text-[var(--text)]">{days}</span></p>
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <textarea rows={2} className={`${fieldClass} resize-none`} placeholder="Reason (optional)" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {error && <div className="rounded-[8px] border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">{error}</div>}
            <button type="submit" disabled={submit.isPending} className="btn btn-primary btn-full">
              {submit.isPending && <Spinner size={14} />} Submit request
            </button>
          </form>
        </Form>
      </div>
    </div>
  );
}

export default SubmitLeaveModal;
