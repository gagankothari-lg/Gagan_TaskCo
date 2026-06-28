'use client';

import { Icon } from '../../ui/icon';
import type { DashboardData } from '../../../lib/types';

export function NoticeBoard({ notices }: { notices: DashboardData['notices'] }) {
  const { announcements, birthdays, onLeave, meetings } = notices;
  const empty = announcements.length === 0 && birthdays.length === 0 && onLeave.length === 0 && meetings.length === 0;

  return (
    <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-card">
      <h3 className="mb-3 text-sm font-medium text-[var(--text)]">Notice Board</h3>
      {empty ? (
        <p className="text-sm text-[var(--muted)]">Nothing new today.</p>
      ) : (
        <div className="space-y-2">
          {announcements.map((a) => (
            <div key={a.id} className="rounded-[8px] border border-[var(--border)] bg-[var(--bg)] p-3">
              <div className="flex items-center gap-2"><Icon name="campaign" size={14} className="text-[var(--p)]" /><p className="text-sm font-medium text-[var(--text)]">{a.title}</p></div>
              {a.content && <p className="mt-1 line-clamp-2 text-xs text-[var(--muted)]">{a.content}</p>}
            </div>
          ))}
          {birthdays.map((b) => (
            <div key={b.empId} className="flex items-center gap-2 rounded-[8px] border border-[var(--border)] bg-[var(--bg)] p-2.5">
              <Icon name="cake" size={14} className="text-[var(--warn)]" /><span className="text-sm text-[var(--text)]">{b.name}</span><span className="text-xs text-[var(--muted)]">— birthday today</span>
            </div>
          ))}
          {onLeave.map((l) => (
            <div key={l.empId} className="flex items-center gap-2 rounded-[8px] border border-[var(--border)] bg-[var(--bg)] p-2.5">
              <Icon name="flight" size={14} className="text-[var(--danger)]" /><span className="text-sm text-[var(--text)]">{l.name}</span><span className="text-xs text-[var(--muted)]">— {l.leaveType}</span>
            </div>
          ))}
          {meetings.map((m) => (
            <div key={m.meetingId} className="flex items-center gap-2 rounded-[8px] border border-[var(--border)] bg-[var(--bg)] p-2.5">
              <Icon name="videocam" size={14} className="text-[var(--p)]" /><span className="truncate text-sm text-[var(--text)]">{m.title}</span>
              <span className="ml-auto shrink-0 text-xs text-[var(--muted)]">{new Date(m.startTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default NoticeBoard;
