'use client';

import { useState, type FormEvent } from 'react';
import { Icon } from '../../ui/icon';
import { useAddHoliday } from '../../../lib/api/leaves';
import { apiErrorMessage } from '../../../lib/api/client';
import { Spinner } from '../../ui/spinner';

const field = 'bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] rounded-[8px] px-3 py-2 text-sm w-full focus:border-[var(--p)] focus:outline-none';

export function HolidayModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const add = useAddHoliday();
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !date) return setError('Name and date are required');
    try {
      await add.mutateAsync({ name, date: new Date(date).toISOString() });
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to add holiday'));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-[380px] rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-6 text-[var(--text)]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--text)]">Add Holiday</h2>
          <button onClick={onClose} aria-label="Close" className="text-[var(--muted)] hover:text-[var(--text)]"><Icon name="close" size={18} /></button>
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          <input className={field} placeholder="Holiday name" value={name} onChange={(e) => setName(e.target.value)} />
          <input type="date" className={field} value={date} onChange={(e) => setDate(e.target.value)} />
          {error && <div className="rounded-[8px] border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">{error}</div>}
          <button type="submit" disabled={add.isPending} className="btn btn-primary btn-full">
            {add.isPending && <Spinner size={14} />} Add holiday
          </button>
        </form>
      </div>
    </div>
  );
}

export default HolidayModal;
