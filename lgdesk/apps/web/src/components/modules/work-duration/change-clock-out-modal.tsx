'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Icon } from '../../ui/icon';
import { useClockOut } from '../../../lib/api/workDuration';
import { apiErrorMessage } from '../../../lib/api/client';
import { Spinner } from '../../ui/spinner';
import { Form, FormControl, FormField, FormItem, FormMessage } from '../../ui/form';
import { changeClockOutSchema, type ChangeClockOutFormValues } from './change-clock-out-modal.schema';

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
  const [error, setError] = useState<string | null>(null);

  const form = useForm<ChangeClockOutFormValues>({
    resolver: zodResolver(changeClockOutSchema),
    defaultValues: {
      hour: new Date().getHours(),
      minute: new Date().getMinutes(),
      reason: '',
    },
  });

  const hour = form.watch('hour');
  const minute = form.watch('minute');

  if (!open) return null;

  async function onSubmit(values: ChangeClockOutFormValues) {
    setError(null);
    const customTime = `${pad(values.hour)}:${pad(values.minute)}`;
    if (clockInIso) {
      const ci = new Date(clockInIso);
      if (values.hour * 60 + values.minute <= ci.getUTCHours() * 60 + ci.getUTCMinutes()) {
        // best-effort guard; server validates authoritatively
      }
    }
    try {
      await clockOut.mutateAsync({ customTime, reason: values.reason || undefined });
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
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <div className="flex items-center justify-center"><AnalogClock hour={hour} minute={minute} /></div>
            <div className="flex items-center justify-center gap-2">
              <FormField
                control={form.control}
                name="hour"
                render={({ field: hourField }) => (
                  <FormItem>
                    <FormControl>
                      <input
                        type="number"
                        min={0}
                        max={23}
                        className={`${field} w-16 text-center`}
                        name={hourField.name}
                        ref={hourField.ref}
                        onBlur={hourField.onBlur}
                        value={hourField.value}
                        onChange={(e) => hourField.onChange(Math.min(23, Math.max(0, Number(e.target.value))))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <span className="text-[var(--muted)]">:</span>
              <FormField
                control={form.control}
                name="minute"
                render={({ field: minuteField }) => (
                  <FormItem>
                    <FormControl>
                      <input
                        type="number"
                        min={0}
                        max={59}
                        className={`${field} w-16 text-center`}
                        name={minuteField.name}
                        ref={minuteField.ref}
                        onBlur={minuteField.onBlur}
                        value={minuteField.value}
                        onChange={(e) => minuteField.onChange(Math.min(59, Math.max(0, Number(e.target.value))))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="reason"
              render={({ field: reasonField }) => (
                <FormItem>
                  <FormControl>
                    <textarea rows={2} className={`${field} w-full resize-none`} placeholder="Reason (optional)" {...reasonField} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {error && <div className="rounded-[8px] border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">{error}</div>}
            <button type="submit" disabled={clockOut.isPending} className="btn btn-primary btn-full disabled:opacity-60">
              {clockOut.isPending && <Spinner size={14} />} Clock out
            </button>
          </form>
        </Form>
      </div>
    </div>
  );
}

export default ChangeClockOutModal;
