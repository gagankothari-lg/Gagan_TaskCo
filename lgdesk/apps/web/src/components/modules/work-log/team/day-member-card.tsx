'use client';

import { avatarColor, initials } from '../../../../lib/utils';
import type { WorkLogEntry } from '../../../../lib/types';
import { Icon } from '../../../ui/icon';

// Base hours implied by the attendance type, plus any logged extra hours.
function effHours(att: string | undefined, extra: number): number {
  const base =
    att === 'Present' || att === 'Extra Full Day'
      ? 9
      : att === 'Extra Half Day' || att === 'Leave Half Day'
        ? 4
        : 0;
  return base + (extra || 0);
}

function snippet(entry: WorkLogEntry): string {
  return [entry.work1stHalf, entry.work2ndHalf]
    .map((s) => (s ?? '').replace(/\\n/g, ' ').trim())
    .filter(Boolean)
    .join(' · ');
}

export interface DayMemberCardProps {
  empId: string;
  name: string;
  team: string;
  entry?: WorkLogEntry;
  /** Omit for the By-Date view — those entries are read-only (Part 37: "clicking an entry does NOT open the member modal"). */
  onClick?: () => void;
}

export function DayMemberCard({ empId, name, team, entry, onClick }: DayMemberCardProps) {
  const done = !!entry && !!entry.attendance;
  const hrs = entry ? Math.round(effHours(entry.attendance, entry.extraHours) * 10) / 10 : 0;
  const work = entry ? snippet(entry) : '';

  return (
    <div className={`tlm-card${done ? '' : ' missing'}`} onClick={onClick} style={onClick ? undefined : { cursor: 'default' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span className="tlm-avatar" style={{ background: avatarColor(empId) }}>{initials(name)}</span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="tlm-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
          <div className="tlm-team">{team}</div>
        </div>
        {done ? (
          <span style={{ background: '#e8f5e9', color: '#2e7d32', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, flexShrink: 0 }}>Done</span>
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: '#fce8e8', color: '#c62828', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, flexShrink: 0 }}>
            <Icon name="close" size={11} /> Missing
          </span>
        )}
        {entry?.status === 'Tentative' && (
          <span style={{ background: 'var(--p3)', color: 'var(--p)', border: '1px dashed var(--p)', fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 10, flexShrink: 0 }}>Tentative</span>
        )}
      </div>

      {done ? (
        <>
          <div className="tlm-hours">{hrs} hrs</div>
          {work && (
            <div
              style={{
                fontSize: 12,
                color: 'var(--muted)',
                marginTop: 4,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {work}
            </div>
          )}
        </>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Click to add work log.</div>
      )}
    </div>
  );
}

export default DayMemberCard;
