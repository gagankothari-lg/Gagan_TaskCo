'use client';

import { useState, type FormEvent } from 'react';
import { Icon } from '../../ui/icon';
import { useSubmitLeave } from '../../../lib/api/leaves';
import { apiErrorMessage } from '../../../lib/api/client';
import { Spinner } from '../../ui/spinner';
import { LEAVE_TYPES } from '../../../lib/types';

const field = 'bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] rounded-[8px] px-3 py-2 text-sm w-full focus:border-[var(--p)] focus:outline-none';

export function SubmitLeaveModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const submit = useSubmitLeave();
  const [leaveType, setLeaveType] = useState('Annual');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isHalf = leaveType === 'Half Day';
  const days = isHalf
    ? 0.5
    : startDate && endDate
      ? Math.max(0, Math.floor((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1)
      : 0;

  if (!open) return null;

  function onStart(v: string) {
    setStartDate(v);
    if (isHalf) setEndDate(v);
  }
  function onType(v: string) {
    setLeaveType(v);
    if (v === 'Half Day') setEndDate(startDate);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!startDate || !endDate) return setError('Pick start and end dates');
    try {
      await submit.mutateAsync({ leaveType, startDate: new Date(startDate).toISOString(), endDate: new Date(endDate).toISOString(), reason: reason || undefined });
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to submit leave'));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-[420px] rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-6 text-[var(--text)]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--text)]">Request Leave</h2>
          <button onClick={onClose} aria-label="Close" className="text-[var(--muted)] hover:text-[var(--text)]"><Icon name="close" size={18} /></button>
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          <select className={field} value={leaveType} onChange={(e) => onType(e.target.value)}>
            {LEAVE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-[var(--muted)]">Start date</label>
              <input type="date" className={field} value={startDate} onChange={(e) => onStart(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--muted)]">End date</label>
              <input type="date" className={field} value={endDate} disabled={isHalf} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <p className="text-sm text-[var(--muted)]">Days: <span className="font-medium text-[var(--text)]">{days}</span></p>
          <textarea rows={2} className={`${field} resize-none`} placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
          {error && <div className="rounded-[8px] border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">{error}</div>}
          <button type="submit" disabled={submit.isPending} className="btn btn-primary btn-full">
            {submit.isPending && <Spinner size={14} />} Submit request
          </button>
        </form>
      </div>
    </div>
  );
}

export default SubmitLeaveModal;
