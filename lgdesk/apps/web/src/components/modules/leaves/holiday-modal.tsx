'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAddHoliday } from '../../../lib/api/leaves';
import { apiErrorMessage } from '../../../lib/api/client';
import { toast } from '../../../lib/toast';
import { Spinner } from '../../ui/spinner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../ui/dialog';
import { Form, FormControl, FormField, FormItem, FormMessage } from '../../ui/form';
import { fieldClass } from '../tasks/create-task-modal';
import { holidaySchema, type HolidayFormValues } from './holiday-modal.schema';

export function HolidayModal({ open, onClose, defaultDate }: { open: boolean; onClose: () => void; defaultDate?: string }) {
  const add = useAddHoliday();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<HolidayFormValues>({
    resolver: zodResolver(holidaySchema),
    defaultValues: { name: '', date: defaultDate ?? '' },
  });

  useEffect(() => {
    if (open) { form.reset({ name: '', date: defaultDate ?? '' }); setError(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultDate]);

  async function onSubmit(values: HolidayFormValues) {
    setError(null);
    try {
      await add.mutateAsync({ name: values.name, date: new Date(values.date).toISOString() });
      toast('Holiday added', 'success');
      onClose();
    } catch (err) {
      const msg = apiErrorMessage(err, 'Unable to add holiday');
      setError(msg);
      toast(msg, 'error');
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Holiday</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="space-y-3 px-5 py-4">
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
              {error && <div className="rounded-[8px] border border-danger/40 bg-[#fce8e8] px-3 py-2 text-sm text-danger">{error}</div>}
            </div>
            <DialogFooter>
              <button type="submit" disabled={add.isPending} className="btn btn-primary disabled:opacity-60">
                {add.isPending && <Spinner size={14} />} Add holiday
              </button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default HolidayModal;
