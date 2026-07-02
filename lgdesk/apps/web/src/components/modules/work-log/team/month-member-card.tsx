'use client';

import { avatarColor, initials } from '../../../../lib/utils';
import type { TeamOverviewRow } from '../../../../lib/types';

// Attendance breakdown mini-badge palette (month/custom view).
// Order per Master Reference Part 17 FR-2: P -> EF -> EH -> LF -> LH -> AW -> W -> H.
const BREAKDOWN: { key: keyof TeamOverviewRow; label: string; bg: string; fg: string }[] = [
  { key: 'P', label: 'P', bg: '#e8f5e9', fg: '#2e7d32' },
  { key: 'EF', label: 'EF', bg: '#e0f2f1', fg: '#00695c' },
  { key: 'EH', label: 'EH', bg: '#e0f7fa', fg: '#00838f' },
  { key: 'LF', label: 'LF', bg: '#fff3e0', fg: '#e65100' },
  { key: 'LH', label: 'LH', bg: '#fff8e1', fg: '#f57f17' },
  { key: 'AW', label: 'AW', bg: '#fafafa', fg: '#9e9e9e' },
  { key: 'W', label: 'W', bg: '#f5f5f5', fg: '#757575' },
  { key: 'H', label: 'H', bg: '#e3f2fd', fg: '#1565c0' },
];

export interface MonthMemberCardProps {
  row: TeamOverviewRow;
  team: string;
  /** Total calendar days in the displayed month/custom range — used for the workDays %. */
  periodDays: number;
  onClick: () => void;
}

export function MonthMemberCard({ row, team, periodDays, onClick }: MonthMemberCardProps) {
  // otHours from the API already includes EF×9 + EH×4 (Master Reference Part 17 Change
  // #46: Σ(Extra Hours) + EF×9 + EH×4). Adding EF*9/EH*4 again here double-counts them —
  // total hrs is base-attendance hours (Present + the worked half of Leave Half Day) plus
  // that single OT figure.
  const ot = row.otHours;
  const totalHrs = Math.round((row.P * 9 + row.LH * 4 + ot) * 10) / 10;

  // workDays = calendar days in the period minus the days already logged as an off type
  // (Week Off / Alternate Week Off / Holiday); submitted = days logged with any other
  // (non-off) attendance. Using periodDays instead of the row's own totals keeps this a
  // real "how much of the expected period is submitted" percentage instead of always 100%.
  const offDays = row.W + row.AW + row.H;
  const workDays = Math.max(0, periodDays - offDays);
  const submitted = row.P + row.EF + row.EH + row.LF + row.LH;
  const pct = workDays > 0 ? Math.round((submitted / workDays) * 100) : 0;
  const barColor = pct >= 80 ? '#2e7d32' : pct >= 50 ? '#e65100' : '#c62828';

  return (
    <div className="tlm-card" onClick={onClick}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span className="tlm-avatar" style={{ background: avatarColor(row.empId) }}>{initials(row.name)}</span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="tlm-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}</div>
          <div className="tlm-team">{team}</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--p)' }}>{totalHrs} hrs</span>
        {ot > 0 && (
          <span style={{ background: '#fff3e0', color: '#e65100', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 9999 }}>+{ot} OT</span>
        )}
      </div>

      <div className="tlm-month-bar">
        <div className="tlm-month-bar-fill" style={{ width: `${Math.min(100, pct)}%`, background: barColor }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>
        <span>{submitted}/{workDays} work days</span>
        <span style={{ color: barColor, fontWeight: 600 }}>{pct}%</span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {BREAKDOWN.map(({ key, label, bg, fg }) => (
          <span key={label} style={{ background: bg, color: fg, fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 8 }}>
            {label}: {row[key]}
          </span>
        ))}
      </div>
    </div>
  );
}

export default MonthMemberCard;
