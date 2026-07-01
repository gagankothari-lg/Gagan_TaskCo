'use client';

import { useState } from 'react';
import { useForm, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCreateAnnouncement } from '../../../lib/api/dashboard';
import { apiErrorMessage } from '../../../lib/api/client';
import { toast } from '../../../lib/toast';
import { Spinner } from '../../ui/spinner';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../ui/form';
import { announcementSchema, VISIBILITY, type AnnouncementFormValues } from './announcement-form.schema';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
function plusDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function defaults(): AnnouncementFormValues {
  return { title: '', content: '', startDate: today(), endDate: plusDays(7), visibility: 'Organisation' };
}

interface Template {
  label: string;
  visibility: (typeof VISIBILITY)[number];
  endInDays: number;
}

// Part 12 "Quick-fill templates": Org-wide (+7d), TCs & TFs (+14d), TCs Only (+30d).
// The legacy GAS form also flips a Priority select per template (Normal/High/High) —
// this NestJS port's Announcement model has no priority column (see
// apps/api/src/dashboard/dto/create-announcement.dto.ts), so that half of each
// template is a pre-existing backend gap, not reproduced here.
const TEMPLATES: Template[] = [
  { label: '🏢 Org-wide', visibility: 'Organisation', endInDays: 7 },
  { label: '👥 TCs & TFs', visibility: 'TCs & TFs', endInDays: 14 },
  { label: '⭐ TCs Only', visibility: 'TCs Only', endInDays: 30 },
];

/** Inline "Post Announcement" panel — visibility is controlled by the caller (the
 * Notice Board card's "Post" button), matching Part 37's "Post button -> nb-post-panel
 * un-hides; nb-title focused" flow instead of a separate self-toggling widget. */
export function AnnouncementForm({ onPosted }: { onPosted?: () => void }) {
  const create = useCreateAnnouncement();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<AnnouncementFormValues>({
    resolver: zodResolver(announcementSchema),
    defaultValues: defaults(),
  });

  async function onSubmit(values: AnnouncementFormValues) {
    setError(null);
    try {
      await create.mutateAsync({
        title: values.title,
        content: values.content || undefined,
        startDate: values.startDate ? new Date(values.startDate).toISOString() : undefined,
        endDate: values.endDate ? new Date(values.endDate).toISOString() : undefined,
        visibility: values.visibility,
      });
      toast('Announcement posted!', 'success');
      form.reset(defaults());
      onPosted?.();
    } catch (err) {
      const msg = apiErrorMessage(err, 'Unable to post announcement');
      setError(msg);
      toast(msg, 'error');
    }
  }

  function onInvalid(errors: FieldErrors<AnnouncementFormValues>) {
    const first = errors.title?.message ?? errors.endDate?.message ?? errors.startDate?.message;
    if (first) toast(first, 'error');
  }

  function applyTemplate(t: Template) {
    form.setValue('visibility', t.visibility);
    form.setValue('startDate', today());
    form.setValue('endDate', plusDays(t.endInDays));
  }

  return (
    <div id="nb-post-panel" className="rounded-[var(--r)] border border-border bg-bg p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {TEMPLATES.map((t) => (
          <button
            key={t.label}
            type="button"
            onClick={() => applyTemplate(t)}
            className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-text hover:bg-[var(--p3)]"
          >
            {t.label}
          </button>
        ))}
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-3">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="nb-title">Title</FormLabel>
                <FormControl><Input id="nb-title" placeholder="Title" autoFocus {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="content"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Content</FormLabel>
                <FormControl><Textarea rows={2} className="resize-none" placeholder="Content" {...field} /></FormControl>
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
                  <FormLabel>From</FormLabel>
                  <FormControl><Input id="ann-start-date" type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="endDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>To</FormLabel>
                  <FormControl><Input id="ann-end-date" type="date" {...field} /></FormControl>
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
                <FormLabel htmlFor="nb-visibility">Visibility</FormLabel>
                <FormControl>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="nb-visibility" className="w-full">
                      <SelectValue placeholder="Select visibility" />
                    </SelectTrigger>
                    <SelectContent>
                      {VISIBILITY.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {error && <div className="rounded-[8px] border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>}
          <Button type="submit" disabled={create.isPending}>
            {create.isPending && <Spinner size={14} />} {create.isPending ? 'Posting…' : 'Post Announcement'}
          </Button>
        </form>
      </Form>
    </div>
  );
}

export default AnnouncementForm;
