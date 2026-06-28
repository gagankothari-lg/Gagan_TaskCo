'use client';

import { Icon } from '../../ui/icon';
import type { Meeting } from '../../../lib/types';

export function MeetingCard({ meeting, canCancel, onCancel }: { meeting: Meeting; canCancel?: boolean; onCancel?: () => void }) {
  const start = new Date(meeting.startTime);
  const durationMins = Math.round((new Date(meeting.endTime).getTime() - start.getTime()) / 60000);

  return (
    <div className="flex items-start gap-3 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-[var(--p3)]">
        <Icon name="video_call" size={16} className="text-[var(--p)]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-[var(--text)]">{meeting.title}</p>
          <span className="shrink-0 rounded-[9999px] border border-[var(--border)] bg-[var(--bg)] px-2 py-0.5 text-[10px] text-[var(--muted)]">{meeting.meetType}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
          <span>{start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
          <span>{start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          <span className="inline-flex items-center gap-1"><Icon name="schedule" size={11} /> {durationMins}m</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {meeting.meetLink && (
          <a href={meeting.meetLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-[8px] border border-[var(--border)] px-2 py-1 text-xs text-[var(--p)] hover:bg-[var(--p3)]">
            <Icon name="video_call" size={12} /> Join
          </a>
        )}
        {canCancel && (
          <button onClick={onCancel} aria-label="Cancel meeting" className="text-[var(--muted)] hover:text-[var(--danger)]">
            <Icon name="close" size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

export default MeetingCard;
