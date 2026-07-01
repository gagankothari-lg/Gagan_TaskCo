'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Icon } from '../../ui/icon';
import { useAddHoliday } from '../../../lib/api/leaves';
import { apiErrorMessage } from '../../../lib/api/client';
import { Spinner } from '../../ui/spinner';
import { Form, FormControl, FormField, FormItem, FormMessage } from '../../ui/form';
import { holidaySchema, type HolidayFormValues } from './holiday-modal.schema';

const fieldClass = 'bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] rounded-[8px] px-3 py-2 text-sm w-full focus:border-[var(--p)] focus:outline-none';

export function HolidayModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const add = useAddHoliday();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<HolidayFormValues>({
    resolver: zodResolver(holidaySchema),
    defaultValues: { name: '', date: '' },
  });

  if (!open) return null;

  async function onSubmit(values: HolidayFormValues) {
    setError(null);
    try {
      await add.mutateAsync({ name: values.name, date: new Date(values.date).toISOString() });
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to add holiday'));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-[380px] rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-6 text-[var(--text)]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--text)]">Add Holiday</h2>
          <button onClick={onClose} aria-label="Close" className="text-[var(--muted)] hover:text-[var(--text)]"><Icon name="close" size={18} /></button>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormControl><input className={fieldClass} placeholder="Holiday name" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormControl><input type="date" className={fieldClass} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {error && <div className="rounded-[8px] border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">{error}</div>}
            <button type="submit" disabled={add.isPending} className="btn btn-primary btn-full">
              {add.isPending && <Spinner size={14} />} Add holiday
            </button>
          </form>
        </Form>
      </div>
    </div>
  );
}

export default HolidayModal;
