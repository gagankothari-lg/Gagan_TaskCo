import type { CSSProperties } from 'react';

// Leave-type display label + colour-coded pill — mirrors the reference's
// `.pill-Annual-Leave / .pill-Sick-Leave / .pill-Casual-Leave` (indigo),
// `.pill-Maternity-Leave / .pill-Paternity-Leave` (purple), and `.pill-Unpaid-Leave`
// (grey) rules (reference/lgdesk-gas-source.html lines 767-769).
//
// The stored/submitted value stays the short form from LEAVE_TYPES
// (apps/web/src/lib/types.ts, mirrored on the backend DTO validator in
// apps/api/src/common/constants.ts) — this is a presentation-only label + colour
// map, not a value rename. globals.css already owns the generic `.pill` shape/font
// rule; this module only supplies the per-type background/colour that file doesn't
// (yet) define, via inline style rather than editing globals.css.

const LEAVE_TYPE_LABELS: Record<string, string> = {
  Annual: 'Annual Leave',
  Sick: 'Sick Leave',
  Casual: 'Casual Leave',
  Maternity: 'Maternity Leave',
  Paternity: 'Paternity Leave',
};

const INDIGO: CSSProperties = { background: 'var(--p3)', color: 'var(--p)' };
const PURPLE: CSSProperties = { background: '#f3e5f5', color: '#6a1b9a' };
const GREY: CSSProperties = { background: '#f5f5f5', color: '#616161' };

const LEAVE_TYPE_STYLE: Record<string, CSSProperties> = {
  Annual: INDIGO,
  Sick: INDIGO,
  Casual: INDIGO,
  Maternity: PURPLE,
  Paternity: PURPLE,
  'Unpaid Leave': GREY,
};

/** Short stored value ("Annual") -> reference display label ("Annual Leave"). */
export function leaveTypeLabel(type: string): string {
  return LEAVE_TYPE_LABELS[type] ?? type;
}

export function LeaveTypePill({ type }: { type: string }) {
  return (
    <span className="pill" style={LEAVE_TYPE_STYLE[type]}>
      {leaveTypeLabel(type)}
    </span>
  );
}

export default LeaveTypePill;
