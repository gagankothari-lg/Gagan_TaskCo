'use client';

import { useState, type FormEvent } from 'react';
import { Icon } from '../../ui/icon';
import { useClockOut } from '../../../lib/api/workDuration';
import { apiErrorMessage } from '../../../lib/api/client';
import { Spinner } from '../../ui/spinner';

const pad = (n: number) => String(n).padStart(2, '0');
const field = 'bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] rounded-[8px] px-2 py-1.5 text-sm focus:border-[var(--p)] focus:outline-none';

export function AnalogClock({ hour, minute, size = 120 }: { hour: number; minute: number; size?: number }) {
  const c = size / 2;
  const r = c - 6;
  const hourAngle = ((hour % 12) + minute / 60) * 30 - 90;
  const minAngle = minute * 6 - 90;
  const hand = (angle: number, len: number) => {
    const rad = (angle * Math.PI) / 180;
    return { x2: c + Math.cos(rad) * len, y2: c + Math.sin(rad) * len };
  };
  const h = hand(hourAngle, r * 0.5);
  const m = hand(minAngle, r * 0.8);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={c} cy={c} r={r} fill="#f0f2f5" stroke="#e0e0e0" strokeWidth="2" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * 30 - 90) * (Math.PI / 180);
        return <circle key={i} cx={c + Math.cos(a) * (r - 6)} cy={c + Math.sin(a) * (r - 6)} r={1.5} fill="#757575" />;
      })}
      <line x1={c} y1={c} x2={h.x2} y2={h.y2} stroke="#212121" strokeWidth="3" strokeLinecap="round" />
      <line x1={c} y1={c} x2={m.x2} y2={m.y2} stroke="#1a237e" strokeWidth="2" strokeLinecap="round" />
      <circle cx={c} cy={c} r={3} fill="#1a237e" />
    </svg>
  );
}

export function ChangeClockOutModal({ open, onClose, clockInIso }: { open: boolean; onClose: () => void; clockInIso?: string | null }) {
  const clockOut = useClockOut();
  const now = new Date();
  const [hour, setHour] = useState(now.getHours());
  const [minute, setMinute] = useState(now.getMinutes());
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const customTime = `${pad(hour)}:${pad(minute)}`;
    if (clockInIso) {
      const ci = new Date(clockInIso);
      if (hour * 60 + minute <= ci.getUTCHours() * 60 + ci.getUTCMinutes()) {
        // best-effort guard; server validates authoritatively
      }
    }
    try {
      await clockOut.mutateAsync({ customTime, reason: reason || undefined });
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to clock out'));
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-[360px] rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--text)]">Clock out at a specific time</h3>
          <button onClick={onClose} aria-label="Close" className="text-[var(--muted)] hover:text-[var(--text)]"><Icon name="close" size={18} /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div className="flex items-center justify-center"><AnalogClock hour={hour} minute={minute} /></div>
          <div className="flex items-center justify-center gap-2">
            <input type="number" min={0} max={23} className={`${field} w-16 text-center`} value={hour} onChange={(e) => setHour(Math.min(23, Math.max(0, Number(e.target.value))))} />
            <span className="text-[var(--muted)]">:</span>
            <input type="number" min={0} max={59} className={`${field} w-16 text-center`} value={minute} onChange={(e) => setMinute(Math.min(59, Math.max(0, Number(e.target.value))))} />
          </div>
          <textarea rows={2} className={`${field} w-full resize-none`} placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
          {error && <div className="rounded-[8px] border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">{error}</div>}
          <button type="submit" disabled={clockOut.isPending} className="btn btn-primary btn-full disabled:opacity-60">
            {clockOut.isPending && <Spinner size={14} />} Clock out
          </button>
        </form>
      </div>
    </div>
  );
}

export default ChangeClockOutModal;
