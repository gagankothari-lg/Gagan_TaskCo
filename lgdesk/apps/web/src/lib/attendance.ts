// Shared Work Log attendance helpers — Master Reference Part 29 "Attendance Deep Dive".
// Single source of truth for the default-pre-fill rule so the personal grid
// (work-row.tsx), the team member modal, and the team week/day cards
// (attendance-dot.tsx) never drift from each other.

/** True for the 1st/3rd/5th Saturday of `date`'s month (the "Alternate Week Off" Saturdays). */
export function isAlternateSaturday(date: Date): boolean {
  if (date.getDay() !== 6) return false;
  const weekOfMonth = Math.ceil(date.getDate() / 7);
  return weekOfMonth === 1 || weekOfMonth === 3 || weekOfMonth === 5;
}

/**
 * Default attendance for a day with no saved log (Part 29):
 * Sunday -> Week Off; 1st/3rd/5th Saturday -> Alternate Week Off; holiday -> Holiday;
 * everything else -> '' (no default).
 */
export function defaultAttendanceFor(date: Date, isHoliday: boolean): string {
  if (date.getDay() === 0) return 'Week Off';
  if (isAlternateSaturday(date)) return 'Alternate Week Off';
  if (isHoliday) return 'Holiday';
  return '';
}

// Intern free-text attendance: strings that count as an off/leave day.
// Mirrors apps/api/src/work-log/work-log.service.ts INTERN_OFF_PATTERNS exactly.
export const INTERN_OFF_PATTERN = /^\s*(holiday|leave|week.?off|off|absent|half.?day|sick|vacation|alt.?week)\s*$/i;

export function isInternOff(text: string): boolean {
  const t = text.trim();
  return !t || INTERN_OFF_PATTERN.test(t);
}

// Leave Type ("Purpose" column) + Leave Requested option lists — Part 37 checklist
// "Leave detail selects" (exact option text, blank first).
export const LEAVE_TYPE_OPTIONS = ['', 'Planned Leave', 'Sick Leave', 'Casual Leave', 'Emergency Leave', 'Other'];
export const LEAVE_REQUESTED_OPTIONS = ['', 'Same Day', 'One Day Before', 'Within Same Week', 'One Week Before'];

// Round4 F3: collapses a WFO/WFH-suffixed attendance value to its base category, for
// hours/OT comparisons that don't care which one it was — mirrors the reference's
// _attBaseCategory exactly (app.js.html:1870-1876). Single source of truth so
// work-row.tsx / day-member-card.tsx / week-member-card.tsx never drift from each other
// the same way defaultAttendanceFor() above already is for the off-day pre-fill rule.
export function attBaseCategory(att: string | undefined | null): string {
  if (!att) return att ?? '';
  if (att.startsWith('Present')) return 'Present';
  if (att.startsWith('Extra Full Day')) return 'Extra Full Day';
  if (att.startsWith('Extra Half Day')) return 'Extra Half Day';
  return att;
}

/** Local-time-safe ISO date string (avoids UTC-shift-by-one-day bugs). */
export function isoDate(d: Date): string {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 10);
}
