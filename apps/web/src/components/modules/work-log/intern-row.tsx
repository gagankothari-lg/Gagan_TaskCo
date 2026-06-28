'use client';

import { useRef, useState } from 'react';
import { Icon } from '../../ui/icon';
import { WorkChipInput } from './work-chip-input';
import type { WorkLogEntry, WorkLogInput } from '../../../lib/types';

const fieldClass = 'bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] rounded-[8px] px-2 py-1.5 text-sm focus:border-[var(--p)] focus:outline-none';

export function InternRow({ date, entry, save, durationHms }: { date: Date; entry?: WorkLogEntry; save: (input: WorkLogInput) => Promise<void>; durationHms?: string }) {
  const iso = date.toISOString().slice(0, 10);
  const [form, setForm] = useState<WorkLogInput>({
    date: iso,
    attendance: entry?.attendance ?? 'Present',
    work1stHalf: entry?.work1stHalf ?? '',
    work2ndHalf: entry?.work2ndHalf ?? '',
    extraHours: entry?.extraHours ?? 0,
    remark: entry?.remark ?? '',
  });
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function update(patch: Partial<WorkLogInput>) {
    const next = { ...form, ...patch };
    setForm(next);
    if (timer.current) clearTimeout(timer.current);
    setState('saving');
    timer.current = setTimeout(async () => {
      try { await save(next); setState('saved'); } catch { setState('error'); }
    }, 500);
  }

  const isToday = date.toDateString() === new Date().toDateString();

  return (
    <tr className="border-b border-[var(--border)] bg-[var(--surface)] align-top">
      <td className="px-3 py-2.5 whitespace-nowrap">
        <span className={['text-sm', isToday ? 'font-semibold text-[var(--p)]' : 'text-[var(--text)]'].join(' ')}>{date.toLocaleDateString(undefined, { weekday: 'short' })}</span>
        <span className="ml-1 text-xs text-[var(--muted)]">{date.getDate()}</span>
      </td>
      <td className="px-3 py-2.5">
        <input className={`${fieldClass} w-32`} placeholder="Attendance" value={form.attendance ?? ''} onChange={(e) => update({ attendance: e.target.value })} />
      </td>
      <td className="px-3 py-2.5">
        <div className="space-y-1">
          <WorkChipInput value={form.work1stHalf ?? ''} onChange={(v) => update({ work1stHalf: v })} placeholder="1st half" />
          <WorkChipInput value={form.work2ndHalf ?? ''} onChange={(v) => update({ work2ndHalf: v })} placeholder="2nd half" />
        </div>
      </td>
      <td className="px-3 py-2.5">
        <input type="number" min={0} step="0.5" className={`${fieldClass} w-16`} value={form.extraHours ?? 0} onChange={(e) => update({ extraHours: Number(e.target.value) })} />
      </td>
      <td className="px-3 py-2.5">
        <input className={`${fieldClass} w-full`} placeholder="Remark" value={form.remark ?? ''} onChange={(e) => update({ remark: e.target.value })} />
      </td>
      {durationHms !== undefined && <td className="px-3 py-2.5 font-mono text-xs text-[var(--muted)]">{durationHms || '—'}</td>}
      <td className="px-3 py-2.5">
        {state === 'saving' && <span className="inline-flex items-center gap-1 text-xs text-[var(--muted)]"><Icon name="progress_activity" size={12} className="animate-spin" /> Saving…</span>}
        {state === 'saved' && <span className="inline-flex items-center gap-1 text-xs text-[var(--ok)]"><Icon name="check" size={12} /> Saved</span>}
        {state === 'error' && <span className="inline-flex items-center gap-1 text-xs text-[var(--danger)]"><Icon name="error" size={12} /> Failed</span>}
      </td>
    </tr>
  );
}

export default InternRow;
