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
import { apiErrorMessage } from '../../../lib/api/client';
import { toast } from '../../../lib/toast';
import { ChangeClockOutModal } from './change-clock-out-modal';
import { EditDayModal } from './edit-day-modal';

export function ClockWidget() {
  const { data } = useWorkDurationStatus();
  const clockIn = useClockIn();
  const clockOut = useClockOut();
  const startBreak = useStartBreak();
  const endBreak = useEndBreak();
  const [now, setNow] = useState(() => Date.now());
  const [menuOpen, setMenuOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

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

  function doClockIn() {
    const resuming = status === 'COMPLETED' || status === 'AUTO_CLOSED';
    clockIn.mutate(undefined, {
      onSuccess: () => toast(resuming ? 'Resumed!' : 'Clocked in!', 'success'),
      onError: (err) => toast(apiErrorMessage(err, 'Unable to clock in'), 'error'),
    });
  }

  function doStartBreak() {
    startBreak.mutate(undefined, {
      onError: (err) => toast(apiErrorMessage(err, 'Unable to start break'), 'error'),
    });
  }

  function doEndBreak() {
    const mins = openBreak ? Math.max(1, Math.round((Date.now() - new Date(openBreak.breakStart).getTime()) / 60000)) : 0;
    endBreak.mutate(undefined, {
      onSuccess: () => toast(`Break ended — ${mins} min`, 'info'),
      onError: (err) => toast(apiErrorMessage(err, 'Unable to end break'), 'error'),
    });
  }

  function doClockOutNow() {
    if (!window.confirm('Clock out now?')) return;
    clockOut.mutate(undefined, {
      onSuccess: (result) => {
        const worked = result?.session?.netMinutes != null ? hmsFromMin(result.session.netMinutes) : '';
        toast(worked ? `Clocked out. Worked: ${worked}` : 'Clocked out.', 'success');
      },
      onError: (err) => toast(apiErrorMessage(err, 'Unable to clock out'), 'error'),
    });
  }

  if (status === 'IDLE') {
    return (
      <button onClick={doClockIn} disabled={clockIn.isPending} className="inline-flex items-center gap-1.5 rounded-[8px] bg-white/15 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/25 disabled:opacity-60">
        <Icon name="play_arrow" size={13} /> Clock In
      </button>
    );
  }

  if (status === 'ON_BREAK') {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 font-mono text-xs text-white"><Icon name="local_cafe" size={12} /> {breakElapsed}</span>
        <button onClick={doEndBreak} disabled={endBreak.isPending} className="inline-flex items-center gap-1 rounded-[8px] border border-white/30 px-2.5 py-1.5 text-xs text-white hover:bg-white/15 disabled:opacity-60">
          <Icon name="play_arrow" size={12} /> Resume
        </button>
      </div>
    );
  }

  if (status === 'ACTIVE') {
    return (
      <div className="relative flex items-center gap-2">
        <span id="wd-timer" className="font-mono text-xs text-white">{elapsed}</span>
        <button onClick={doStartBreak} disabled={startBreak.isPending} className="inline-flex items-center gap-1 rounded-[8px] border border-white/30 px-2 py-1.5 text-xs text-white/80 hover:bg-white/15 disabled:opacity-60">
          <Icon name="local_cafe" size={12} /> Break
        </button>
        <div className="flex items-stretch overflow-hidden rounded-[8px]">
          <button onClick={doClockOutNow} disabled={clockOut.isPending} className="inline-flex items-center gap-1 bg-white/15 px-2.5 py-1.5 text-xs text-white hover:bg-white/25 disabled:opacity-60">
            <Icon name="logout" size={12} /> Clock Out
          </button>
          <button onClick={() => setMenuOpen((o) => !o)} aria-label="Clock out options" className="border-l border-white/30 bg-white/15 px-1.5 hover:bg-white/25">
            <Icon name="expand_more" size={13} className="text-white/80" />
          </button>
        </div>
        {menuOpen && (
          <>
            {/* Click-outside-to-close backdrop (Part 37 known picker gap — kept fixed here). */}
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-9 z-50 w-52 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-1 shadow-lg">
              <button onClick={() => { setMenuOpen(false); setCustomOpen(true); }} className="w-full rounded-[4px] px-2 py-1.5 text-left text-xs text-[var(--text)] hover:bg-[var(--p3)]">
                Change clock-out time
              </button>
              <button onClick={() => { setMenuOpen(false); setEditOpen(true); }} className="w-full rounded-[4px] px-2 py-1.5 text-left text-xs text-[var(--text)] hover:bg-[var(--p3)]">
                Edit today&apos;s times
              </button>
            </div>
          </>
        )}
        <ChangeClockOutModal open={customOpen} onClose={() => setCustomOpen(false)} clockInIso={session?.clockIn} />
        <EditDayModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          initialStart={session?.clockIn ? new Date(session.clockIn).toISOString().slice(11, 16) : undefined}
          initialEnd={session?.clockOut ? new Date(session.clockOut).toISOString().slice(11, 16) : undefined}
          initialBreak={session?.totalBreakMins}
        />
      </div>
    );
  }

  // COMPLETED / AUTO_CLOSED
  return (
    <div className="flex items-center gap-2">
      <span id="wd-timer" className="font-mono text-xs text-white">{hmsFromMin(session?.netMinutes ?? 0)}</span>
      <button onClick={() => setEditOpen(true)} aria-label="Edit today's times" className="text-white/70 hover:text-white">
        <Icon name="edit" size={14} />
      </button>
      <button onClick={doClockIn} disabled={clockIn.isPending} className="text-xs text-white hover:underline">
        Re-clock in?
      </button>
      <EditDayModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        initialStart={session?.clockIn ? new Date(session.clockIn).toISOString().slice(11, 16) : undefined}
        initialEnd={session?.clockOut ? new Date(session.clockOut).toISOString().slice(11, 16) : undefined}
        initialBreak={session?.totalBreakMins}
      />
    </div>
  );
}

export default ClockWidget;
