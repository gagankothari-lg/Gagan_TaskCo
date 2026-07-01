'use client';

import { useEffect, useState } from 'react';
import { Icon } from '../../ui/icon';
import {
  useWorkDurationStatus,
  useClockIn,
  useClockOut,
  useStartBreak,
  useEndBreak,
  hmsFromMs,
  hmsFromMin,
} from '../../../lib/api/workDuration';
import { ChangeClockOutModal } from './change-clock-out-modal';

export function ClockWidget() {
  const { data } = useWorkDurationStatus();
  const clockIn = useClockIn();
  const clockOut = useClockOut();
  const startBreak = useStartBreak();
  const endBreak = useEndBreak();
  const [now, setNow] = useState(() => Date.now());
  const [menuOpen, setMenuOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);

  const status = data?.status ?? 'IDLE';
  useEffect(() => {
    if (status !== 'ACTIVE' && status !== 'ON_BREAK') return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [status]);

  const session = data?.session;
  const elapsed = session?.clockIn ? hmsFromMs(now - new Date(session.clockIn).getTime()) : '00:00:00';
  const openBreak = (data?.breaks ?? []).find((b) => !b.breakEnd);
  const breakElapsed = openBreak ? hmsFromMs(now - new Date(openBreak.breakStart).getTime()) : '00:00:00';

  if (status === 'IDLE') {
    return (
      <button onClick={() => clockIn.mutate()} disabled={clockIn.isPending} className="inline-flex items-center gap-1.5 rounded-[8px] bg-white/15 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/25 disabled:opacity-60">
        <Icon name="play_arrow" size={13} /> Clock In
      </button>
    );
  }

  if (status === 'ON_BREAK') {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 font-mono text-xs text-white"><Icon name="local_cafe" size={12} /> {breakElapsed}</span>
        <button onClick={() => endBreak.mutate()} disabled={endBreak.isPending} className="inline-flex items-center gap-1 rounded-[8px] border border-white/30 px-2.5 py-1.5 text-xs text-white hover:bg-white/15 disabled:opacity-60">
          <Icon name="play_arrow" size={12} /> Resume
        </button>
      </div>
    );
  }

  if (status === 'ACTIVE') {
    return (
      <div className="relative flex items-center gap-2">
        <span className="font-mono text-xs text-white">{elapsed}</span>
        <button onClick={() => startBreak.mutate()} disabled={startBreak.isPending} className="inline-flex items-center gap-1 rounded-[8px] border border-white/30 px-2 py-1.5 text-xs text-white/80 hover:bg-white/15 disabled:opacity-60">
          <Icon name="local_cafe" size={12} /> Break
        </button>
        <div className="flex items-stretch overflow-hidden rounded-[8px]">
          <button onClick={() => clockOut.mutate(undefined)} disabled={clockOut.isPending} className="inline-flex items-center gap-1 bg-white/15 px-2.5 py-1.5 text-xs text-white hover:bg-white/25 disabled:opacity-60">
            <Icon name="logout" size={12} /> Clock Out
          </button>
          <button onClick={() => setMenuOpen((o) => !o)} aria-label="Clock out options" className="border-l border-white/30 bg-white/15 px-1.5 hover:bg-white/25">
            <Icon name="expand_more" size={13} className="text-white/80" />
          </button>
        </div>
        {menuOpen && (
          <div className="absolute right-0 top-9 z-50 w-48 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-1 shadow-lg">
            <button onClick={() => { setMenuOpen(false); setCustomOpen(true); }} className="w-full rounded-[4px] px-2 py-1.5 text-left text-xs text-[var(--text)] hover:bg-[var(--p3)]">
              Clock out at specific time
            </button>
          </div>
        )}
        <ChangeClockOutModal open={customOpen} onClose={() => setCustomOpen(false)} clockInIso={session?.clockIn} />
      </div>
    );
  }

  // COMPLETED / AUTO_CLOSED
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-xs text-white">{hmsFromMin(session?.netMinutes ?? 0)}</span>
      <button onClick={() => clockIn.mutate()} disabled={clockIn.isPending} className="text-xs text-white hover:underline">
        Re-clock in?
      </button>
    </div>
  );
}

export default ClockWidget;
