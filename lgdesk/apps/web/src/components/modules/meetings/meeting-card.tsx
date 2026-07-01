'use client';

import { forwardRef } from 'react';
import { Icon } from '../../ui/icon';
import { cn } from '../../../lib/utils';
import type { Meeting } from '../../../lib/types';

const TYPE_LABEL: Record<string, string> = { company: 'Company', team: 'Team', custom: 'Custom', personal: 'Custom' };

export const MeetingCard = forwardRef<HTMLDivElement, { meeting: Meeting; canCancel?: boolean; onCancel?: () => void; highlighted?: boolean }>(
  function MeetingCard({ meeting, canCancel, onCancel, highlighted }, ref) {
    const start = new Date(meeting.startTime);
    const durationMins = Math.round((new Date(meeting.endTime).getTime() - start.getTime()) / 60000);

    return (
      <div
        ref={ref}
        className={cn(
          'flex items-start gap-3 rounded-[8px] border bg-surface p-4 transition-shadow',
          highlighted ? 'border-p ring-2 ring-p2 ring-offset-1' : 'border-border',
        )}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-p3">
          <Icon name="video_call" size={16} className="text-p" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-text">{meeting.title}</p>
            <span className="shrink-0 rounded-[9999px] border border-border bg-bg px-2 py-0.5 text-[10px] text-muted">{TYPE_LABEL[meeting.meetType] ?? meeting.meetType}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <span>{start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
            <span>{start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <span className="inline-flex items-center gap-1"><Icon name="schedule" size={11} /> {durationMins}m</span>
            {(meeting.attendeeIds.length > 0 || meeting.attendeeTeams.length > 0) && (
              <span className="inline-flex items-center gap-1"><Icon name="groups" size={11} /> {meeting.attendeeIds.length + meeting.attendeeTeams.length} invited</span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {meeting.meetLink && (
            <a href={meeting.meetLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-[8px] border border-border px-2 py-1 text-xs text-p hover:bg-p3">
              <Icon name="video_call" size={12} /> Join
            </a>
          )}
          {meeting.calEventId && (
            <a
              href="https://calendar.google.com/calendar/r"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open calendar"
              className="inline-flex items-center gap-1 rounded-[8px] border border-border px-2 py-1 text-xs text-muted hover:bg-p3"
            >
              <Icon name="calendar_month" size={12} />
            </a>
          )}
          {canCancel && (
            <button onClick={onCancel} aria-label="Cancel meeting" className="text-muted hover:text-danger">
              <Icon name="close" size={16} />
            </button>
          )}
        </div>
      </div>
    );
  },
);

export default MeetingCard;
