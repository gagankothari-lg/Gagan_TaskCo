'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Icon } from '../../ui/icon';
import { useEditTime } from '../../../lib/api/workDuration';
import { apiErrorMessage } from '../../../lib/api/client';
import { Spinner } from '../../ui/spinner';
import { AnalogClock } from './change-clock-out-modal';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../ui/form';
import { editDaySchema, type EditDayFormValues } from './edit-day-modal.schema';

const field = 'bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] rounded-[8px] px-2 py-1.5 text-sm focus:border-[var(--p)] focus:outline-none';

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10));
  return (Number.isNaN(h) ? 0 : h) * 60 + (Number.isNaN(m) ? 0 : m);
}
const pad = (n: number) => String(n).padStart(2, '0');

export function EditDayModal({ open, onClose, initialStart, initialEnd, initialBreak }: { open: boolean; onClose: () => void; initialStart?: string; initialEnd?: string; initialBreak?: number }) {
  const editTime = useEditTime();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<EditDayFormValues>({
    resolver: zodResolver(editDaySchema),
    defaultValues: {
      startTime: initialStart ?? '09:00',
      endTime: initialEnd ?? '',
      breakMins: initialBreak ?? 0,
      reason: '',
    },
  });

  const start = form.watch('startTime');
  const end = form.watch('endTime');
  const breakMins = form.watch('breakMins');

  if (!open) return null;

  const net = end ? Math.max(0, toMinutes(end) - toMinutes(start) - (breakMins ?? 0)) : null;
  const sh = toMinutes(start);

  async function onSubmit(values: EditDayFormValues) {
    setError(null);
    try {
      await editTime.mutateAsync({ startTime: values.startTime, endTime: values.endTime || undefined, breakMins: values.breakMins, reason: values.reason });
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to edit day'));
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4 py-8">
      <div className="max-h-full w-full max-w-[400px] overflow-y-auto rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--text)]">Edit work day</h3>
          <button onClick={onClose} aria-label="Close" className="text-[var(--muted)] hover:text-[var(--text)]"><Icon name="close" size={18} /></button>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <div className="flex items-center justify-center"><AnalogClock hour={Math.floor(sh / 60)} minute={sh % 60} size={96} /></div>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="startTime"
                render={({ field: startField }) => (
                  <FormItem>
                    <FormLabel className="mb-1 block text-xs text-[var(--muted)]">Start time</FormLabel>
                    <FormControl>
                      <input type="time" className={`${field} w-full`} {...startField} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endTime"
                render={({ field: endField }) => (
                  <FormItem>
                    <FormLabel className="mb-1 block text-xs text-[var(--muted)]">End time</FormLabel>
                    <FormControl>
                      <input type="time" className={`${field} w-full`} {...endField} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="breakMins"
              render={({ field: breakField }) => (
                <FormItem>
                  <FormLabel className="mb-1 block text-xs text-[var(--muted)]">Break minutes</FormLabel>
                  <FormControl>
                    <input
                      type="number"
                      min={0}
                      className={`${field} w-full`}
                      name={breakField.name}
                      ref={breakField.ref}
                      onBlur={breakField.onBlur}
                      value={breakField.value}
                      onChange={(e) => breakField.onChange(Math.max(0, Number(e.target.value)))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {net !== null && (
              <p className="text-sm text-[var(--muted)]">Net work time will be: <span className="font-mono text-[var(--ok)]">{pad(Math.floor(net / 60))}:{pad(net % 60)}</span></p>
            )}
            <FormField
              control={form.control}
              name="reason"
              render={({ field: reasonField }) => (
                <FormItem>
                  <FormControl>
                    <textarea rows={2} className={`${field} w-full resize-none`} placeholder="Reason (required)" {...reasonField} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {error && <div className="rounded-[8px] border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">{error}</div>}
            <button type="submit" disabled={editTime.isPending} className="btn btn-primary btn-full disabled:opacity-60">
              {editTime.isPending && <Spinner size={14} />} Save day
            </button>
          </form>
        </Form>
      </div>
    </div>
  );
}

export default EditDayModal;
