'use client';

import { useMemo, useState } from 'react';
import { Icon } from '../../../components/ui/icon';
import { useAuth } from '../../../hooks/use-auth';
import { isAdmin } from '../../../lib/auth';
import { useMeetings, useCancelMeeting } from '../../../hooks/use-meetings';
import { MeetingCard } from '../../../components/modules/meetings/meeting-card';
import { ScheduleMeetingModal } from '../../../components/modules/meetings/schedule-meeting-modal';
import { Spinner } from '../../../components/ui/spinner';

export default function MeetingsPage() {
  const { currentUser } = useAuth();
  const { data: meetings, isLoading } = useMeetings();
  const cancel = useCancelMeeting();
  const [open, setOpen] = useState(false);
  const [showPast, setShowPast] = useState(false);

  const now = Date.now();
  const { upcoming, past } = useMemo(() => {
    const up = [], pa = [];
    for (const m of meetings ?? []) {
      if (new Date(m.startTime).getTime() > now) up.push(m);
      else pa.push(m);
    }
    pa.reverse();
    return { upcoming: up, past: pa };
  }, [meetings, now]);

  const canCancel = (organizerId: string) => !!currentUser && (organizerId === currentUser.empId || isAdmin(currentUser.role));

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[var(--text)]">Meetings</h1>
        <button onClick={() => setOpen(true)} className="btn btn-primary">
          <Icon name="add" size={15} /> Schedule Meeting
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-[var(--muted)]"><Spinner size={16} /> Loading…</div>
      ) : (
        <>
          <h2 className="mb-2 text-sm font-medium text-[var(--text)]">Upcoming</h2>
          {upcoming.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] py-10 text-center">
              <Icon name="video_call" size={26} className="text-[var(--muted)]" />
              <p className="text-sm text-[var(--muted)]">No upcoming meetings</p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcoming.map((m) => <MeetingCard key={m.meetingId} meeting={m} canCancel={canCancel(m.organizerId)} onCancel={() => cancel.mutate(m.meetingId)} />)}
            </div>
          )}

          {past.length > 0 && (
            <div className="mt-6">
              <button onClick={() => setShowPast((s) => !s)} className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-[var(--muted)] hover:text-[var(--text)]">
                {showPast ? <Icon name="expand_more" size={15} /> : <Icon name="chevron_right" size={15} />} Past meetings ({past.length})
              </button>
              {showPast && (
                <div className="space-y-2 opacity-70">
                  {past.map((m) => <MeetingCard key={m.meetingId} meeting={m} />)}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <ScheduleMeetingModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
