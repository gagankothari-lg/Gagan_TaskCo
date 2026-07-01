'use client';

import { useState, type FormEvent } from 'react';
import { Icon } from '../../ui/icon';
import { useEditTime } from '../../../lib/api/workDuration';
import { apiErrorMessage } from '../../../lib/api/client';
import { Spinner } from '../../ui/spinner';
import { AnalogClock } from './change-clock-out-modal';

const field = 'bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] rounded-[8px] px-2 py-1.5 text-sm focus:border-[var(--p)] focus:outline-none';

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10));
  return (Number.isNaN(h) ? 0 : h) * 60 + (Number.isNaN(m) ? 0 : m);
}
const pad = (n: number) => String(n).padStart(2, '0');

export function EditDayModal({ open, onClose, initialStart, initialEnd, initialBreak }: { open: boolean; onClose: () => void; initialStart?: string; initialEnd?: string; initialBreak?: number }) {
  const editTime = useEditTime();
  const [start, setStart] = useState(initialStart ?? '09:00');
  const [end, setEnd] = useState(initialEnd ?? '');
  const [breakMins, setBreakMins] = useState(initialBreak ?? 0);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const net = end ? Math.max(0, toMinutes(end) - toMinutes(start) - breakMins) : null;
  const sh = toMinutes(start);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!reason.trim()) return setError('Reason is required');
    try {
      await editTime.mutateAsync({ startTime: start, endTime: end || undefined, breakMins, reason });
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to edit day'));
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4 py-8">
      <div className="max-h-full w-full max-w-[400px] overflow-y-auto rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--text)]">Edit work day</h3>
          <button onClick={onClose} aria-label="Close" className="text-[var(--muted)] hover:text-[var(--text)]"><Icon name="close" size={18} /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div className="flex items-center justify-center"><AnalogClock hour={Math.floor(sh / 60)} minute={sh % 60} size={96} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-[var(--muted)]">Start time</label>
              <input type="time" className={`${field} w-full`} value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--muted)]">End time</label>
              <input type="time" className={`${field} w-full`} value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--muted)]">Break minutes</label>
            <input type="number" min={0} className={`${field} w-full`} value={breakMins} onChange={(e) => setBreakMins(Math.max(0, Number(e.target.value)))} />
          </div>
          {net !== null && (
            <p className="text-sm text-[var(--muted)]">Net work time will be: <span className="font-mono text-[var(--ok)]">{pad(Math.floor(net / 60))}:{pad(net % 60)}</span></p>
          )}
          <textarea rows={2} className={`${field} w-full resize-none`} placeholder="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} />
          {error && <div className="rounded-[8px] border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">{error}</div>}
          <button type="submit" disabled={editTime.isPending} className="btn btn-primary btn-full disabled:opacity-60">
            {editTime.isPending && <Spinner size={14} />} Save day
          </button>
        </form>
      </div>
    </div>
  );
}

export default EditDayModal;
