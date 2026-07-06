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
  istHHMM,
} from '../../../lib/api/workDuration';
import { apiErrorMessage } from '../../../lib/api/client';
import { toast } from '../../../lib/toast';
import { ChangeClockOutModal } from './change-clock-out-modal';
import { EditDayModal } from './edit-day-modal';

// PFIX-CLOCK-IN-OUT: rebuilt to match reference/app.js.html's _wdRenderStatus() +
// _wdUpdateHeaderBtn() (the collapsed `wd-hdr-btn` + expandable `wd-popup`/`wd-widget`
// pattern), confirmed from source rather than the earlier flattened-inline-bar design:
//   - Collapsed pill: status dot + live content per status (net-elapsed ticking while
//     ACTIVE, break-duration ticking while ON_BREAK, static final total once COMPLETED) —
//     this "ticking number, not a raw timestamp" behavior IS the reference's own design
//     (_wdHdrTimerText: elapsed − breakMs), not a rebuild deviation.
//   - Expanded popup: status dot + label + "|" + timer, a separate Break-duration row,
//     and Pause/Clock-out as the two primary actions (ON_BREAK now also exposes
//     Clock-out directly, matching the reference — previously missing entirely here).
//   - Edit pencils in the popup open the SAME EditDayModal used elsewhere: the
//     reference's own `_wdShowEditForm(field)` comment says it was "Replaced by the
//     'Edit working day' modal which handles both Clock_In and Clock_Out" — i.e. the
//     reference itself already consolidated per-field inline edit forms into one modal,
//     so EditDayModal is the correct match, not a deviation to "fix away".
const DOT_CLASS: Record<string, string> = {
  IDLE: 'bg-white/40',
  ACTIVE: 'bg-[#43a047] shadow-[0_0_0_2px_rgba(67,160,71,.35)]',
  ON_BREAK: 'bg-[#fb8c00] shadow-[0_0_0_2px_rgba(251,140,0,.35)]',
  // Indigo/primary, matching the popup's own dot color for this status exactly
  // (previously plain white here — a leftover placeholder, live-verified as a
  // visible mismatch: a white dot on the indigo header bar).
  COMPLETED: 'bg-[var(--p)]',
  AUTO_CLOSED: 'bg-[var(--p)]',
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Clocked in',
  ON_BREAK: 'On break',
  COMPLETED: 'Clocked out',
  AUTO_CLOSED: 'Clocked out',
};

export function ClockWidget() {
  const { data } = useWorkDurationStatus();
  const clockIn = useClockIn();
  const clockOut = useClockOut();
  const startBreak = useStartBreak();
  const endBreak = useEndBreak();
  const [now, setNow] = useState(() => Date.now());
  const [popupOpen, setPopupOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const status = data?.status ?? 'IDLE';
  useEffect(() => {
    if (status !== 'ACTIVE' && status !== 'ON_BREAK') return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [status]);

  // Closing the popup also closes its nested clock-out-options menu, so re-opening
  // never shows a stale sub-menu state.
  useEffect(() => {
    if (!popupOpen) setMenuOpen(false);
  }, [popupOpen]);

  const session = data?.session;
  const openBreak = (data?.breaks ?? []).find((b) => !b.breakEnd);
  const clockInMs = session?.clockIn ? new Date(session.clockIn).getTime() : null;
  const closedBreakMs = (session?.totalBreakMins ?? 0) * 60000;

  // Net elapsed = gross elapsed − accumulated break time, ticking live — matches
  // reference's _wdHdrTimerText() exactly (elapsed − breakMs), not a raw clock-in time.
  const netElapsed = clockInMs != null ? hmsFromMs(now - clockInMs - closedBreakMs) : '00:00:00';

  // "Break duration" is always the CUMULATIVE total for the day — all previously-closed
  // breaks plus the currently-open one's running elapsed, if any — matching reference's
  // _wdBreakMsFromTimestamps(), not just the current break's own elapsed time.
  const openBreakElapsedMs = openBreak ? now - new Date(openBreak.breakStart).getTime() : 0;
  const breakTotal = hmsFromMs(closedBreakMs + openBreakElapsedMs);

  // The work timer FREEZES the instant a break starts and does not resume ticking until
  // Resume — reference's own comment: "ACTIVE: work timer ticks... ON_BREAK: work timer
  // FROZEN, break duration ticks live" (app.js.html:15673-15674).
  const frozenNetAtBreakStart =
    openBreak && clockInMs != null
      ? hmsFromMs(new Date(openBreak.breakStart).getTime() - clockInMs - closedBreakMs)
      : '00:00:00';

  const collapsedContent =
    status === 'ACTIVE' ? netElapsed : status === 'ON_BREAK' ? breakTotal : hmsFromMin(session?.netMinutes ?? 0);

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
    if (!window.confirm('Clock out now? This will close your current work session.')) return;
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

  // The clock-out split-button + its "Change clock-out time"/"Edit today's times" menu —
  // shared between ACTIVE and ON_BREAK (reference exposes clock-out in both states;
  // previously ON_BREAK had no way to clock out at all without first clicking Resume).
  function ClockOutSplitButton() {
    return (
      <div className="relative flex items-stretch overflow-hidden rounded-[8px]" style={{ border: '1px solid var(--border)' }}>
        <button
          onClick={doClockOutNow}
          disabled={clockOut.isPending}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold hover:opacity-90 disabled:opacity-60"
          style={{ background: '#00897b', color: '#fff' }}
        >
          <Icon name="logout" size={14} /> Clock out
        </button>
        <button
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Clock out options"
          className="border-l px-1.5 hover:opacity-90"
          style={{ background: '#00897b', color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }}
        >
          <Icon name="expand_more" size={14} />
        </button>
        {menuOpen && (
          <div
            className="absolute right-0 top-full z-10 mt-1 w-52 rounded-[8px] p-1 shadow-lg"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <button onClick={() => { setMenuOpen(false); setCustomOpen(true); }} className="w-full rounded-[4px] px-2 py-1.5 text-left text-xs hover:bg-[var(--p3)]" style={{ color: 'var(--text)' }}>
              Change clock-out time
            </button>
            <button onClick={() => { setMenuOpen(false); setEditOpen(true); }} className="w-full rounded-[4px] px-2 py-1.5 text-left text-xs hover:bg-[var(--p3)]" style={{ color: 'var(--text)' }}>
              Edit today&apos;s times
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setPopupOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-[8px] bg-white/15 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/25"
      >
        <span className={`h-2 w-2 flex-shrink-0 rounded-full ${DOT_CLASS[status]}`} />
        <span className="font-mono">{collapsedContent}</span>
        <Icon name="expand_more" size={14} className={`text-white/70 transition-transform ${popupOpen ? 'rotate-180' : ''}`} />
      </button>

      {popupOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setPopupOpen(false)} />
          <div
            className="absolute right-0 top-full z-50 mt-2 w-[340px] rounded-[14px] p-5 shadow-2xl"
            style={{ background: 'var(--surface)', color: 'var(--text)' }}
          >
            {/* Status row: dot + label + "|" + timer (+ Clock-In edit pencil, ACTIVE/ON_BREAK only) */}
            <div className="mb-3.5 flex items-center gap-2.5">
              <span
                className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                style={{
                  background: status === 'ACTIVE' ? '#43a047' : status === 'ON_BREAK' ? '#fb8c00' : 'var(--p)',
                  boxShadow: status === 'ACTIVE' ? '0 0 0 3px rgba(67,160,71,.25)' : status === 'ON_BREAK' ? '0 0 0 3px rgba(251,140,0,.25)' : undefined,
                }}
              />
              <span className="text-[15px] font-semibold">{STATUS_LABEL[status]}</span>
              <span style={{ color: 'var(--border)', fontWeight: 300, fontSize: 18 }}>|</span>
              <span className="font-mono text-[22px] font-bold tracking-tight" style={{ color: 'var(--p)' }}>
                {status === 'ON_BREAK' ? frozenNetAtBreakStart : status === 'ACTIVE' ? netElapsed : hmsFromMin(session?.netMinutes ?? 0)}
              </span>
              {(status === 'ACTIVE' || status === 'ON_BREAK') && (
                <button onClick={() => setEditOpen(true)} title="Edit clock-in time" className="text-[var(--muted)] hover:text-[var(--p)]">
                  <Icon name="edit" size={14} />
                </button>
              )}
            </div>

            {/* COMPLETED: separate In:/Out: row, both independently editable */}
            {(status === 'COMPLETED' || status === 'AUTO_CLOSED') && session?.clockIn && (
              <div className="mb-3 flex gap-4 px-0.5 text-[13px]" style={{ color: 'var(--muted)' }}>
                <span>
                  In: <strong style={{ color: 'var(--text)' }}>{istHHMM(session.clockIn)}</strong>{' '}
                  <button onClick={() => setEditOpen(true)} title="Edit clock-in time" className="align-middle hover:text-[var(--p)]" style={{ color: 'var(--muted)' }}>
                    <Icon name="edit" size={12} />
                  </button>
                </span>
                {session.clockOut && (
                  <span>
                    Out: <strong style={{ color: 'var(--text)' }}>{istHHMM(session.clockOut)}</strong>{' '}
                    <button onClick={() => setEditOpen(true)} title="Edit clock-out time" className="align-middle hover:text-[var(--p)]" style={{ color: 'var(--muted)' }}>
                      <Icon name="edit" size={12} />
                    </button>
                  </span>
                )}
              </div>
            )}

            {/* Break duration row */}
            <div className="mb-5 flex items-center gap-2 rounded-[8px] px-3.5 py-2.5 text-sm" style={{ background: 'var(--bg)', color: 'var(--muted)' }}>
              <Icon name="local_cafe" size={16} style={{ color: 'var(--muted)' }} />
              <span>Break duration:</span>
              <span className="font-mono font-bold" style={{ color: 'var(--text)' }}>
                {status === 'ON_BREAK' ? breakTotal : hmsFromMin(session?.totalBreakMins ?? 0)}
              </span>
              <button onClick={() => setEditOpen(true)} title="Edit break duration" className="ml-auto hover:text-[var(--p)]" style={{ color: 'var(--muted)' }}>
                <Icon name="edit" size={14} />
              </button>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2.5">
              {status === 'ACTIVE' && (
                <>
                  <button
                    onClick={doStartBreak}
                    disabled={startBreak.isPending}
                    className="inline-flex items-center gap-1.5 rounded-[8px] px-4 py-2.5 text-sm font-semibold hover:bg-[var(--p3)] disabled:opacity-60"
                    style={{ border: '1.5px solid var(--border)', color: 'var(--text)' }}
                  >
                    <Icon name="pause" size={16} /> Pause
                  </button>
                  <ClockOutSplitButton />
                </>
              )}
              {status === 'ON_BREAK' && (
                <>
                  <button
                    onClick={doEndBreak}
                    disabled={endBreak.isPending}
                    className="inline-flex items-center gap-1.5 rounded-[8px] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
                    style={{ background: '#43a047' }}
                  >
                    <Icon name="play_arrow" size={16} /> Resume
                  </button>
                  <ClockOutSplitButton />
                </>
              )}
              {(status === 'COMPLETED' || status === 'AUTO_CLOSED') && (
                <button
                  onClick={doClockIn}
                  disabled={clockIn.isPending}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-[8px] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
                  style={{ background: 'var(--p)' }}
                >
                  <Icon name="login" size={16} /> Clock in again
                </button>
              )}
            </div>
          </div>
        </>
      )}

      <ChangeClockOutModal open={customOpen} onClose={() => setCustomOpen(false)} />
      <EditDayModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        initialStart={session?.clockIn ? istHHMM(session.clockIn) : undefined}
        initialEnd={session?.clockOut ? istHHMM(session.clockOut) : undefined}
        initialBreak={session?.totalBreakMins}
      />
    </div>
  );
}

export default ClockWidget;
