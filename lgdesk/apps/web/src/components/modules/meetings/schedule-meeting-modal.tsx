'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Icon } from '../../ui/icon';
import { useAuth } from '../../../hooks/use-auth';
import { useCreateMeeting } from '../../../lib/api/meetings';
import { apiErrorMessage } from '../../../lib/api/client';
import { toast } from '../../../lib/toast';
import { Spinner } from '../../ui/spinner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../ui/form';
import { EmployeeMultiSelect, fieldClass } from '../tasks/create-task-modal';
import { scheduleMeetingSchema, DURATION_OPTIONS, type ScheduleMeetingFormValues } from './schedule-meeting-modal.schema';

const TYPE_TITLE: Record<string, string> = { company: 'Company Meeting', team: 'Team Meeting', custom: 'Custom Meeting' };

function defaults(meetType: 'company' | 'team' | 'custom'): ScheduleMeetingFormValues {
  return { title: '', description: '', date: '', time: '10:00', durationMins: 30, meetType, attendeeIds: [], teams: [] };
}

export function ScheduleMeetingModal({
  open,
  onClose,
  initialMeetType = 'custom',
}: {
  open: boolean;
  onClose: () => void;
  initialMeetType?: string;
}) {
  const { employees, currentUser } = useAuth();
  const create = useCreateMeeting();
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ meetLink?: string } | null>(null);

  const meetType: 'company' | 'team' | 'custom' = initialMeetType === 'company' || initialMeetType === 'team' ? initialMeetType : 'custom';

  const form = useForm<ScheduleMeetingFormValues>({
    resolver: zodResolver(scheduleMeetingSchema),
    defaultValues: defaults(meetType),
  });

  useEffect(() => {
    if (open) {
      form.reset({ ...defaults(meetType), teams: meetType === 'team' && currentUser?.team ? [currentUser.team] : [] });
      setError(null);
      setCreated(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, meetType]);

  const allTeams = useMemo(() => Array.from(new Set(employees.map((e) => e.team).filter(Boolean))) as string[], [employees]);
  const selectedTeam = form.watch('teams')?.[0] ?? currentUser?.team ?? '';

  if (!open) return null;

  async function onSubmit(values: ScheduleMeetingFormValues) {
    setError(null);
    try {
      const res = await create.mutateAsync({
        title: values.title,
        description: values.description || undefined,
        startTime: new Date(`${values.date}T${values.time}`).toISOString(),
        durationMins: values.durationMins,
        meetType: values.meetType,
        attendeeIds: values.meetType === 'custom' ? values.attendeeIds : undefined,
        attendeeTeams: values.meetType === 'custom' ? values.teams : values.meetType === 'team' ? (values.teams?.length ? values.teams : undefined) : undefined,
      });
      toast('Meeting scheduled!', 'success');
      setCreated({ meetLink: res.meetLink });
    } catch (err) {
      const msg = apiErrorMessage(err, 'Unable to schedule meeting');
      setError(msg);
      toast(msg, 'error');
    }
  }

  function onInvalid(errors: FieldErrors<ScheduleMeetingFormValues>) {
    const first = errors.title?.message ?? errors.date?.message;
    if (first) toast(first, 'error');
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{created ? 'Meeting Scheduled' : `Schedule ${TYPE_TITLE[meetType]}`}</DialogTitle>
        </DialogHeader>

        {created ? (
          <div className="space-y-3 px-5 py-4">
            <div className="flex items-center gap-2 rounded-[8px] border border-ok/40 bg-[#e8f5e9] px-3 py-2 text-sm text-ok">
              <Icon name="check_circle" size={16} />
              <span>Meeting scheduled successfully.</span>
            </div>
            {created.meetLink && (
              <a
                href={created.meetLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-[8px] border border-border bg-surface px-3 py-2 text-sm text-p hover:bg-p3"
              >
                <Icon name="video_call" size={16} /> {created.meetLink}
              </a>
            )}
            <div className="flex justify-end pt-2">
              <button type="button" onClick={onClose} className="btn btn-primary">Done</button>
            </div>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit, onInvalid)}>
              <div className="space-y-3 px-5 py-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl><input className={fieldClass} placeholder="e.g. Project Kickoff" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl><textarea rows={2} className={`${fieldClass} resize-none`} placeholder="Description (optional)" {...field} /></FormControl>
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
                <FormField
                  control={form.control}
                  name="durationMins"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="mb-1 block text-xs text-muted">Duration</FormLabel>
                      <FormControl>
                        <select
                          className={fieldClass}
                          value={field.value}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        >
                          {DURATION_OPTIONS.map((d) => <option key={d} value={d}>{d} minutes</option>)}
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Team row — Team Meeting only; own team preselected. */}
                {meetType === 'team' && (
                  <FormField
                    control={form.control}
                    name="teams"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="mb-1 block text-xs text-muted">Team</FormLabel>
                        <FormControl>
                          <select className={fieldClass} value={field.value?.[0] ?? ''} onChange={(e) => field.onChange(e.target.value ? [e.target.value] : [])}>
                            {allTeams.map((t) => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </FormControl>
                        <p className="text-xs text-muted">All members of {selectedTeam || 'this team'} will be invited automatically.</p>
                      </FormItem>
                    )}
                  />
                )}

                {meetType === 'company' && (
                  <p className="rounded-[8px] border border-border bg-bg px-3 py-2 text-xs text-muted">
                    All active employees will be invited automatically.
                  </p>
                )}

                {/* Attendee pickers (teams + people) — Custom only. */}
                {meetType === 'custom' && (
                  <>
                    <FormField
                      control={form.control}
                      name="attendeeIds"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="mb-1 block text-xs text-muted">People</FormLabel>
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
                            <FormLabel className="mb-1 block text-xs text-muted">Teams</FormLabel>
                            <FormControl>
                              <div className="flex flex-wrap gap-1.5">
                                {allTeams.map((t) => (
                                  <button
                                    type="button"
                                    key={t}
                                    onClick={() => toggleTeam(t)}
                                    className={['rounded-[9999px] border px-2.5 py-1 text-xs', selectedTeams.includes(t) ? 'border-p bg-p3 text-p' : 'border-border text-muted hover:text-text'].join(' ')}
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

                {error && <div className="rounded-[8px] border border-danger/40 bg-[#fce8e8] px-3 py-2 text-sm text-danger">{error}</div>}
              </div>
              <DialogFooter>
                <button type="submit" disabled={create.isPending} className="btn btn-primary disabled:opacity-60">
                  {create.isPending && <Spinner size={14} />} Schedule
                </button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default ScheduleMeetingModal;
