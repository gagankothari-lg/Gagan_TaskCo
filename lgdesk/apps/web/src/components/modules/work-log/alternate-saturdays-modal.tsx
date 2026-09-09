'use client';

import { useEffect, useState } from 'react';
import { Icon } from '../../ui/icon';
import { Spinner } from '../../ui/spinner';
import { useAlternateSaturdays, useSetAlternateSaturdays } from '../../../lib/api/workLog';
import { apiErrorMessage } from '../../../lib/api/client';
import { toast } from '../../../lib/toast';

function currentMonth(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function dayLabel(iso: string): string {
  const [, , d] = iso.split('-');
  return `${new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })}, ${Number(d)}`;
}

// Daily check-in brief Feature 3: pick any 2 Saturdays per month as this employee's
// Alternate Week Off days. No time restriction -- editable for any month, past or future
// (a past-month change retroactively re-runs the attendance classifier server-side).
export function AlternateSaturdaysModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [month, setMonth] = useState(currentMonth);
  const { data, isLoading } = useAlternateSaturdays(month);
  const setAlt = useSetAlternateSaturdays();
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (data) setSelected(data.offDates);
  }, [data]);

  if (!open) return null;

  function toggle(iso: string) {
    setSelected((prev) => {
      if (prev.includes(iso)) return prev.filter((x) => x !== iso);
      if (prev.length >= 2) return [prev[1], iso]; // keep it to 2 -- drop the oldest pick
      return [...prev, iso];
    });
  }

  async function save() {
    setError(null);
    if (selected.length !== 2) {
      setError('Pick exactly 2 Saturdays.');
      return;
    }
    try {
      await setAlt.mutateAsync({ month, offDates: [selected[0], selected[1]] });
      toast('Alternate Saturdays saved', 'success');
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to save'));
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-[420px] rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--text)]">Alternate Saturdays</h3>
          <button onClick={onClose} aria-label="Close" className="text-[var(--muted)] hover:text-[var(--text)]">
            <Icon name="close" size={18} />
          </button>
        </div>
        <p className="mb-4 text-xs" style={{ color: 'var(--muted)' }}>
          Pick the 2 Saturdays that are your Week Off each month. Defaults to the 1st and 3rd Saturday until you choose.
        </p>

        <div className="mb-4 flex items-center justify-between">
          <button className="tl-nav-btn" onClick={() => setMonth((m) => shiftMonth(m, -1))} aria-label="Previous month">
            <Icon name="chevron_left" size={16} />
          </button>
          <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{monthLabel(month)}</span>
          <button className="tl-nav-btn" onClick={() => setMonth((m) => shiftMonth(m, 1))} aria-label="Next month">
            <Icon name="chevron_right" size={16} />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-6"><Spinner size={20} /></div>
        ) : (
          <div className="mb-4 grid grid-cols-2 gap-2">
            {(data?.saturdays ?? []).map((iso) => {
              const checked = selected.includes(iso);
              return (
                <label
                  key={iso}
                  className="flex cursor-pointer items-center gap-2 rounded-[8px] border px-3 py-2 text-sm"
                  style={{
                    borderColor: checked ? 'var(--p)' : 'var(--border)',
                    background: checked ? 'var(--p3)' : 'transparent',
                    color: 'var(--text)',
                  }}
                >
                  <input type="checkbox" checked={checked} onChange={() => toggle(iso)} />
                  {dayLabel(iso)}
                </label>
              );
            })}
          </div>
        )}

        {error && (
          <div className="mb-3 rounded-[8px] border px-3 py-2 text-sm" style={{ borderColor: 'rgba(198,40,40,.4)', background: 'rgba(198,40,40,.1)', color: 'var(--danger)' }}>
            {error}
          </div>
        )}

        <button onClick={save} disabled={setAlt.isPending} className="btn btn-primary btn-full disabled:opacity-60">
          {setAlt.isPending && <Spinner size={14} />} Save
        </button>
      </div>
    </div>
  );
}

export default AlternateSaturdaysModal;
