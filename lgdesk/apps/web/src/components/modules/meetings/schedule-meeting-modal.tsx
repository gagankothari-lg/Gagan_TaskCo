'use client';

// Reference (reference/lgdesk-gas-source.html #meet-schedule-form) implements
// scheduling as an inline expanding panel on the Meetings page itself — not a
// modal overlay — with a color-coded type-indicator bar, a single combined
// "Date & Time" field, and an inline success banner. This component mirrors
// that structure; the parent page (meetings/page.tsx) mounts/unmounts it
// inline rather than inside a Dialog.
import { useEffect, useMemo, useState } from 'react';
import { useForm, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Icon } from '../../ui/icon';
import { useAuth } from '../../../hooks/use-auth';
import { useCreateMeeting } from '../../../lib/api/meetings';
import { apiErrorMessage } from '../../../lib/api/client';
import { toast } from '../../../lib/toast';
import { Spinner } from '../../ui/spinner';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../ui/form';
import { CustomAttendeePicker } from './attendee-picker';
import { scheduleMeetingSchema, DURATION_OPTIONS, type ScheduleMeetingFormValues } from './schedule-meeting-modal.schema';

const TYPE_TITLE: Record<string, string> = { company: 'Company Meeting', team: 'Team Meeting', custom: 'Custom Meeting' };

const fieldClass =
  'w-full bg-surface border border-border text-text rounded-[8px] px-3 py-2 text-sm focus:border-p2 focus:outline-none';

function defaults(meetType: 'company' | 'team' | 'custom'): ScheduleMeetingFormValues {
  return { title: '', description: '', date: '', time: '10:00', durationMins: 30, meetType, attendeeIds: [], teams: [] };
}

/** Color-coded type-indicator bar — reference `.meet-form-type-{company,team,custom}`. Hidden for custom. */
function TypeBar({ meetType, team }: { meetType: 'company' | 'team' | 'custom'; team: string }) {
  if (meetType === 'custom') return null;
  const style =
    meetType === 'company'
      ? { background: '#e3f2fd', color: '#1565c0' }
      : { background: '#e8f5e9', color: '#2e7d32' };
  const icon = meetType === 'company' ? 'corporate_fare' : 'groups';
  const text =
    meetType === 'company'
      ? 'All active employees will be automatically invited.'
      : `All members of ${team || 'this team'} will be automatically invited.`;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, marginBottom: 14, fontSize: 12, fontWeight: 600, ...style }}>
      <Icon name={icon} size={15} /> {text}
    </div>
  );
}

export function ScheduleMeetingModal({
  onClose,
  initialMeetType = 'custom',
}: {
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
    form.reset({ ...defaults(meetType), teams: meetType === 'team' && currentUser?.team ? [currentUser.team] : [] });
    setError(null);
    setCreated(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetType]);

  const allTeams = useMemo(() => Array.from(new Set(employees.map((e) => e.team).filter(Boolean))) as string[], [employees]);
  const selectedTeam = form.watch('teams')?.[0] ?? currentUser?.team ?? '';
  const dateVal = form.watch('date');
  const timeVal = form.watch('time');
  const dateTimeValue = dateVal ? `${dateVal}T${timeVal || '00:00'}` : '';

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
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
      {created ? (
        // Inline success banner — reference `.meet-banner` / `.meet-banner-link`.
        <div style={{ padding: '16px 20px', borderRadius: 10, background: '#e8f5e9', border: '1px solid #a5d6a7' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, color: 'var(--ok)' }}>
            <Icon name="check_circle" size={18} /> Meeting scheduled successfully.
          </div>
          {created.meetLink && (
            <a
              href={created.meetLink}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontWeight: 600, color: 'var(--p)', textDecoration: 'none', fontSize: 15, display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 6 }}
            >
              <Icon name="video_call" size={16} /> {created.meetLink}
            </a>
          )}
          <div style={{ marginTop: 12 }}>
            <button type="button" onClick={onClose} className="btn btn-ghost btn-sm">Close</button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="event" size={18} /> Schedule {TYPE_TITLE[meetType]}
          </div>

          <TypeBar meetType={meetType} team={selectedTeam} />

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit, onInvalid)}>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="mb-1 block text-xs text-muted">Meeting Title *</FormLabel>
                      <FormControl><input className={fieldClass} placeholder="e.g. Weekly Sync" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Not a FormField/Controller — this single input writes to both the
                    `date` and `time` RHF fields, which stay exactly as defined in the
                    Zod schema; only the presentation merges them into one control. */}
                <div className="grid gap-2">
                  <label className="mb-1 block text-xs text-muted">Date &amp; Time *</label>
                  <input
                    type="datetime-local"
                    className={fieldClass}
                    value={dateTimeValue}
                    onChange={(e) => {
                      const [d, t] = e.target.value.split('T');
                      form.setValue('date', d ?? '', { shouldValidate: true });
                      form.setValue('time', t ?? '', { shouldValidate: true });
                    }}
                  />
                  {form.formState.errors.date && <p className="text-sm text-danger">{form.formState.errors.date.message}</p>}
                </div>

                <FormField
                  control={form.control}
                  name="durationMins"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="mb-1 block text-xs text-muted">Duration</FormLabel>
                      <FormControl>
                        <select className={fieldClass} value={field.value} onChange={(e) => field.onChange(Number(e.target.value))}>
                          {DURATION_OPTIONS.map((d) => <option key={d} value={d}>{d} minutes</option>)}
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Team selector — Team Meeting only; own team preselected. */}
                {meetType === 'team' && (
                  <FormField
                    control={form.control}
                    name="teams"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="mb-1 block text-xs text-muted">Team *</FormLabel>
                        <FormControl>
                          <select className={fieldClass} value={field.value?.[0] ?? ''} onChange={(e) => field.onChange(e.target.value ? [e.target.value] : [])}>
                            {allTeams.map((t) => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem style={{ gridColumn: '1/-1' }}>
                      <FormLabel className="mb-1 block text-xs text-muted">Description (optional)</FormLabel>
                      <FormControl><textarea rows={2} className={`${fieldClass} resize-none`} placeholder="Agenda or notes…" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Attendee pickers — Custom meetings only. Reads/writes the same
                    `teams` / `attendeeIds` RHF fields as the rest of the form. */}
                {meetType === 'custom' && (
                  <CustomAttendeePicker
                    selectedTeams={form.watch('teams') ?? []}
                    onTeamsChange={(next) => form.setValue('teams', next, { shouldValidate: true })}
                    selectedPeople={form.watch('attendeeIds') ?? []}
                    onPeopleChange={(next) => form.setValue('attendeeIds', next, { shouldValidate: true })}
                  />
                )}
              </div>

              {error && <div className="mt-3 rounded-[8px] border border-danger/40 bg-[#fce8e8] px-3 py-2 text-sm text-danger">{error}</div>}

              <div className="mt-4 flex justify-end gap-2">
                <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
                <button type="submit" disabled={create.isPending} className="btn btn-accent disabled:opacity-60">
                  {create.isPending ? <Spinner size={14} /> : <Icon name="video_call" size={15} />} Create Meeting
                </button>
              </div>
            </form>
          </Form>
        </>
      )}
    </div>
  );
}

export default ScheduleMeetingModal;
