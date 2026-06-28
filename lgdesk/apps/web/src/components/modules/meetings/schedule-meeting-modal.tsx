'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { Icon } from '../../ui/icon';
import { useAuth } from '../../../hooks/use-auth';
import { useCreateMeeting } from '../../../hooks/use-meetings';
import { apiErrorMessage } from '../../../lib/api';
import { Spinner } from '../../ui/spinner';
import { EmployeeMultiSelect, fieldClass } from '../tasks/create-task-modal';

export function ScheduleMeetingModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { employees } = useAuth();
  const create = useCreateMeeting();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('10:00');
  const [durationMins, setDurationMins] = useState(30);
  const [meetType, setMeetType] = useState('personal');
  const [attendeeIds, setAttendeeIds] = useState<string[]>([]);
  const [teams, setTeams] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const allTeams = useMemo(() => Array.from(new Set(employees.map((e) => e.team).filter(Boolean))) as string[], [employees]);

  if (!open) return null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) return setError('Title is required');
    if (!date) return setError('Pick a date');
    try {
      await create.mutateAsync({
        title,
        description: description || undefined,
        startTime: new Date(`${date}T${time}`).toISOString(),
        durationMins,
        meetType,
        attendeeIds: meetType === 'custom' ? attendeeIds : undefined,
        attendeeTeams: meetType === 'custom' ? teams : undefined,
      });
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to schedule meeting'));
    }
  }

  const toggleTeam = (t: string) => setTeams((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8">
      <div className="max-h-full w-full max-w-[460px] overflow-y-auto rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-6 text-[var(--text)]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--text)]">Schedule Meeting</h2>
          <button onClick={onClose} aria-label="Close" className="text-[var(--muted)] hover:text-[var(--text)]"><Icon name="close" size={18} /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <input className={fieldClass} placeholder="Title *" value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea rows={2} className={`${fieldClass} resize-none`} placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <input type="date" className={fieldClass} value={date} onChange={(e) => setDate(e.target.value)} />
            <input type="time" className={fieldClass} value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-[var(--muted)]">Duration (mins)</label>
              <input type="number" min={1} className={fieldClass} value={durationMins} onChange={(e) => setDurationMins(Math.max(1, Number(e.target.value)))} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--muted)]">Type</label>
              <select className={fieldClass} value={meetType} onChange={(e) => setMeetType(e.target.value)}>
                <option value="personal">Personal</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          </div>
          {meetType === 'custom' && (
            <>
              <div>
                <label className="mb-1 block text-xs text-[var(--muted)]">Attendees</label>
                <EmployeeMultiSelect selected={attendeeIds} onChange={setAttendeeIds} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[var(--muted)]">Teams</label>
                <div className="flex flex-wrap gap-1.5">
                  {allTeams.map((t) => (
                    <button type="button" key={t} onClick={() => toggleTeam(t)} className={['rounded-[9999px] border px-2.5 py-1 text-xs', teams.includes(t) ? 'border-[var(--p)] bg-[var(--p3)] text-[var(--p)]' : 'border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]'].join(' ')}>{t}</button>
                  ))}
                </div>
              </div>
            </>
          )}
          {error && <div className="rounded-[8px] border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">{error}</div>}
          <button type="submit" disabled={create.isPending} className="btn btn-primary btn-full">
            {create.isPending && <Spinner size={14} />} Schedule
          </button>
        </form>
      </div>
    </div>
  );
}

export default ScheduleMeetingModal;
