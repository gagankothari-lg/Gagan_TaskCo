'use client';

import { avatarColor, initials } from '../../../../lib/utils';
import { AttendanceDot } from './attendance-dot';
import type { WorkLogEntry } from '../../../../lib/types';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function effHours(att: string | undefined, extra: number): number {
  const base =
    att === 'Present' || att === 'Extra Full Day'
      ? 9
      : att === 'Extra Half Day' || att === 'Leave Half Day'
        ? 4
        : 0;
  return base + (extra || 0);
}

export interface WeekMemberCardProps {
  empId: string;
  name: string;
  team: string;
  /** Exactly 7 entries (Mon→Sun); undefined for an un-logged day. */
  week: (WorkLogEntry | undefined)[];
  onClick: () => void;
}

export function WeekMemberCard({ empId, name, team, week, onClick }: WeekMemberCardProps) {
  let hrs = 0;
  let logged = 0;
  week.forEach((e) => {
    if (e && e.attendance) {
      logged++;
      hrs += effHours(e.attendance, e.extraHours);
    }
  });
  const totalHrs = Math.round(hrs * 10) / 10;

  return (
    <div className="tlm-card" onClick={onClick}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span className="tlm-avatar" style={{ background: avatarColor(empId) }}>{initials(name)}</span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="tlm-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
          <div className="tlm-team">{team}</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4, marginBottom: 8 }}>
        {DAY_LABELS.map((lbl, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <span style={{ fontSize: 10, color: 'var(--muted)' }}>{lbl}</span>
            <AttendanceDot attendance={week[i]?.attendance} />
          </div>
        ))}
      </div>

      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{totalHrs} hrs · {logged} days logged</div>
    </div>
  );
}

export default WeekMemberCard;
