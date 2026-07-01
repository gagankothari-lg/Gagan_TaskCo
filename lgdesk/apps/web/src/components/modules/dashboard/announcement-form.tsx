'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Icon } from '../../ui/icon';
import { useCreateAnnouncement } from '../../../lib/api/dashboard';
import { apiErrorMessage } from '../../../lib/api/client';
import { Spinner } from '../../ui/spinner';
import { Form, FormControl, FormField, FormItem, FormMessage } from '../../ui/form';
import { announcementSchema, VISIBILITY, type AnnouncementFormValues } from './announcement-form.schema';

const fieldClass = 'bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] rounded-[8px] px-3 py-2 text-sm w-full focus:border-[var(--p)] focus:outline-none';

function plus7(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

export function AnnouncementForm() {
  const create = useCreateAnnouncement();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const form = useForm<AnnouncementFormValues>({
    resolver: zodResolver(announcementSchema),
    defaultValues: {
      title: '',
      content: '',
      startDate: new Date().toISOString().slice(0, 10),
      endDate: plus7(),
      visibility: 'Organisation',
    },
  });

  async function onSubmit(values: AnnouncementFormValues) {
    setError(null);
    setOk(false);
    try {
      await create.mutateAsync({
        title: values.title,
        content: values.content || undefined,
        startDate: values.startDate ? new Date(values.startDate).toISOString() : undefined,
        endDate: values.endDate ? new Date(values.endDate).toISOString() : undefined,
        visibility: values.visibility,
      });
      form.resetField('title');
      form.resetField('content');
      setOk(true);
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to post announcement'));
    }
  }

  return (
    <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-card">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 text-sm font-medium text-[var(--text)]">
        <Icon name="campaign" size={15} className="text-[var(--p)]" /> Post Announcement
        <span className="ml-auto text-[var(--muted)]">{open ? <Icon name="expand_more" size={16} /> : <Icon name="chevron_right" size={16} />}</span>
      </button>
      {open && (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-3 space-y-3">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormControl><input className={fieldClass} placeholder="Title" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormControl><textarea rows={2} className={`${fieldClass} resize-none`} placeholder="Content" {...field} /></FormControl>
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
                    <FormControl><input type="date" className={fieldClass} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endDate"
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
              name="visibility"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <select className={fieldClass} {...field}>
                      {VISIBILITY.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {error && <div className="rounded-[8px] border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">{error}</div>}
            {ok && <div className="rounded-[8px] border border-[var(--ok)]/40 bg-[var(--ok)]/10 px-3 py-2 text-sm text-[var(--ok)]">Announcement posted.</div>}
            <button type="submit" disabled={create.isPending} className="btn btn-primary disabled:opacity-60">
              {create.isPending && <Spinner size={14} />} Post
            </button>
          </form>
        </Form>
      )}
    </div>
  );
}

export default AnnouncementForm;
