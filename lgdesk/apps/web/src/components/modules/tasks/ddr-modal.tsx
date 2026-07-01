'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Icon } from '../../ui/icon';
import { useCreateDdr } from '../../../lib/api/dueDateRequests';
import { apiErrorMessage } from '../../../lib/api/client';
import { Spinner } from '../../ui/spinner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../ui/form';
import { ddrSchema, type DdrFormValues } from './ddr-modal.schema';

interface DdrModalProps {
  open: boolean;
  onClose: () => void;
  entityType: 'Task' | 'Project' | 'Function';
  entityId: string;
}

const inputClass =
  'w-full bg-surface border border-border text-text rounded-[8px] px-3 py-2 text-sm focus:border-p2 focus:outline-none';

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

  function handleOpenChange(next: boolean) {
    if (!next) {
      onClose();
      setDone(false);
      form.reset();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request date change</DialogTitle>
        </DialogHeader>
        {done ? (
          <div className="flex flex-col items-center gap-2 px-5 py-8 text-center">
            <Icon name="check_circle" size={36} className="text-ok" />
            <p className="text-sm text-text">Request submitted for approval.</p>
            <button onClick={() => handleOpenChange(false)} className="btn btn-ghost mt-2">Done</button>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <div className="space-y-3 px-5 py-4">
                <FormField
                  control={form.control}
                  name="newDueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="mb-1 block text-xs text-muted">New due date</FormLabel>
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
                      <FormLabel className="mb-1 block text-xs text-muted">Reason</FormLabel>
                      <FormControl>
                        <textarea rows={3} className={`${inputClass} resize-none`} placeholder="Why does the date need to change?" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {error && <div className="rounded-[8px] border border-danger/40 bg-[#fce8e8] px-3 py-2 text-sm text-danger">{error}</div>}
              </div>
              <DialogFooter>
                <button type="submit" disabled={create.isPending} className="btn btn-primary disabled:opacity-60">
                  {create.isPending && <Spinner size={14} />} Submit request
                </button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default DdrModal;
