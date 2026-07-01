'use client';

import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Icon } from '../../ui/icon';
import { useAuth } from '../../../hooks/use-auth';
import { useCreateMeeting } from '../../../lib/api/meetings';
import { apiErrorMessage } from '../../../lib/api/client';
import { Spinner } from '../../ui/spinner';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../ui/form';
import { EmployeeMultiSelect, fieldClass } from '../tasks/create-task-modal';
import { scheduleMeetingSchema, type ScheduleMeetingFormValues } from './schedule-meeting-modal.schema';

export function ScheduleMeetingModal({
  open,
  onClose,
  initialMeetType = 'personal',
}: {
  open: boolean;
  onClose: () => void;
  initialMeetType?: string;
}) {
  const { employees } = useAuth();
  const create = useCreateMeeting();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<ScheduleMeetingFormValues>({
    resolver: zodResolver(scheduleMeetingSchema),
    defaultValues: {
      title: '',
      description: '',
      date: '',
      time: '10:00',
      durationMins: 30,
      meetType: initialMeetType === 'custom' ? 'custom' : 'personal',
      attendeeIds: [],
      teams: [],
    },
  });

  const meetType = form.watch('meetType');
  const allTeams = useMemo(() => Array.from(new Set(employees.map((e) => e.team).filter(Boolean))) as string[], [employees]);

  if (!open) return null;

  async function onSubmit(values: ScheduleMeetingFormValues) {
    setError(null);
    try {
      await create.mutateAsync({
        title: values.title,
        description: values.description || undefined,
        startTime: new Date(`${values.date}T${values.time}`).toISOString(),
        durationMins: values.durationMins,
        meetType: values.meetType,
        attendeeIds: values.meetType === 'custom' ? values.attendeeIds : undefined,
        attendeeTeams: values.meetType === 'custom' ? values.teams : undefined,
      });
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to schedule meeting'));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8">
      <div className="max-h-full w-full max-w-[460px] overflow-y-auto rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-6 text-[var(--text)]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--text)]">Schedule Meeting</h2>
          <button onClick={onClose} aria-label="Close" className="text-[var(--muted)] hover:text-[var(--text)]"><Icon name="close" size={18} /></button>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormControl><input className={fieldClass} placeholder="Title *" {...field} /></FormControl>
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
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormControl><input type="date" className={fieldClass} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="time"
                render={({ field }) => (
                  <FormItem>
                    <FormControl><input type="time" className={fieldClass} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="durationMins"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="mb-1 block text-xs text-[var(--muted)]">Duration (mins)</FormLabel>
                    <FormControl>
                      <input
                        type="number"
                        min={1}
                        className={fieldClass}
                        name={field.name}
                        ref={field.ref}
                        value={field.value}
                        onBlur={field.onBlur}
                        onChange={(e) => field.onChange(Math.max(1, Number(e.target.value)))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="meetType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="mb-1 block text-xs text-[var(--muted)]">Type</FormLabel>
                    <FormControl>
                      <select className={fieldClass} {...field}>
                        <option value="personal">Personal</option>
                        <option value="custom">Custom</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {meetType === 'custom' && (
              <>
                <FormField
                  control={form.control}
                  name="attendeeIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="mb-1 block text-xs text-[var(--muted)]">Attendees</FormLabel>
                      <FormControl>
                        <EmployeeMultiSelect selected={field.value ?? []} onChange={field.onChange} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="teams"
                  render={({ field }) => {
                    const selectedTeams = field.value ?? [];
                    const toggleTeam = (t: string) =>
                      field.onChange(selectedTeams.includes(t) ? selectedTeams.filter((x) => x !== t) : [...selectedTeams, t]);
                    return (
                      <FormItem>
                        <FormLabel className="mb-1 block text-xs text-[var(--muted)]">Teams</FormLabel>
                        <FormControl>
                          <div className="flex flex-wrap gap-1.5">
                            {allTeams.map((t) => (
                              <button
                                type="button"
                                key={t}
                                onClick={() => toggleTeam(t)}
                                className={['rounded-[9999px] border px-2.5 py-1 text-xs', selectedTeams.includes(t) ? 'border-[var(--p)] bg-[var(--p3)] text-[var(--p)]' : 'border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]'].join(' ')}
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              </>
            )}
            {error && <div className="rounded-[8px] border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">{error}</div>}
            <button type="submit" disabled={create.isPending} className="btn btn-primary btn-full">
              {create.isPending && <Spinner size={14} />} Schedule
            </button>
          </form>
        </Form>
      </div>
    </div>
  );
}

export default ScheduleMeetingModal;
