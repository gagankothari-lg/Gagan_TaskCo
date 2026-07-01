'use client';

import { useEffect, useState } from 'react';
import { useForm, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSubmitLeave } from '../../../lib/api/leaves';
import { apiErrorMessage } from '../../../lib/api/client';
import { toast } from '../../../lib/toast';
import { Spinner } from '../../ui/spinner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../ui/form';
import { fieldClass } from '../tasks/create-task-modal';
import { LEAVE_TYPES } from '../../../lib/types';
import { submitLeaveSchema, type SubmitLeaveFormValues } from './submit-leave-modal.schema';

const todayISO = () => new Date().toISOString().slice(0, 10);

function defaults(): SubmitLeaveFormValues {
  return { leaveType: '', startDate: todayISO(), endDate: todayISO(), reason: '' };
}

export function SubmitLeaveModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const submit = useSubmitLeave();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<SubmitLeaveFormValues>({
    resolver: zodResolver(submitLeaveSchema),
    defaultValues: defaults(),
  });

  // Reset each time the modal (re)opens so a prior request doesn't leak into the next one.
  useEffect(() => {
    if (open) { form.reset(defaults()); setError(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const leaveType = form.watch('leaveType');
  const startDate = form.watch('startDate');
  const endDate = form.watch('endDate');
  const isHalf = leaveType === 'Half Day';

  // (GAP, Master Reference Part 23 BR-4 / Part 37 My Leaves Checklist) Days info is
  // ALWAYS the plain date-diff formula — it never special-cases Half Day to 0.5. This
  // is an intentional legacy-parity gap: the backend still books 0.5 days correctly.
  const rawDiff = startDate && endDate ? Math.floor((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1 : 0;
  const days = Math.max(0, rawDiff);
  const endBeforeStart = !!startDate && !!endDate && endDate < startDate;

  function onStart(v: string) {
    form.setValue('startDate', v);
    if (isHalf) form.setValue('endDate', v);
  }
  function onType(v: string) {
    form.setValue('leaveType', v as SubmitLeaveFormValues['leaveType']);
    if (v === 'Half Day') form.setValue('endDate', form.getValues('startDate'));
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
      toast('Leave request submitted! Your manager will review it.', 'success');
      onClose();
    } catch (err) {
      const msg = apiErrorMessage(err, 'Unable to submit leave');
      setError(msg);
      toast(msg, 'error');
    }
  }

  function onInvalid(errors: FieldErrors<SubmitLeaveFormValues>) {
    const first = errors.leaveType?.message ?? errors.startDate?.message ?? errors.endDate?.message;
    if (first) toast(first, 'error');
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request Leave</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit, onInvalid)}>
            <div className="space-y-3 px-5 py-4">
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
                        <option value="">— Select Type —</option>
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
                      <FormLabel className="mb-1 block text-xs text-muted">Start date</FormLabel>
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
                      <FormLabel className="mb-1 block text-xs text-muted">End date</FormLabel>
                      <FormControl>
                        <input type="date" className={fieldClass} disabled={isHalf} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <p className="text-sm text-muted">Days: <span className="font-medium text-text">{days} {days === 1 ? 'day' : 'days'}</span></p>
              {endBeforeStart && (
                <p className="text-sm text-danger">⚠ End date must be on or after start date</p>
              )}
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
              {error && <div className="rounded-[8px] border border-danger/40 bg-[#fce8e8] px-3 py-2 text-sm text-danger">{error}</div>}
            </div>
            <DialogFooter>
              <button type="submit" disabled={submit.isPending} className="btn btn-primary disabled:opacity-60">
                {submit.isPending && <Spinner size={14} />} Submit request
              </button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default SubmitLeaveModal;
