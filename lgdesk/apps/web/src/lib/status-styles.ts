// Exact GAS status pill + priority styles (PMASTER-UI §16).

export interface PillStyle { bg: string; color: string }

// UXL Club palette (design.md): Done/Completed and the WIP/"in progress" family
// and Yet-to-Start/Backlog ("todo" family) and Cancelled map to the 4 approved
// task-status colors. Review/Planning/On Hold/Pending/Approved/Rejected are
// leave/project-approval states outside the original 4-state mapping — each
// reuses whichever approved accent pair its OLD color already mirrored
// (Planning mirrored old --p/--p3 exactly; Approved mirrored old Done's green;
// Pending/Review shared one amber; Rejected mirrored old Cancelled's red), so
// none of these introduce a new color outside the approved palette.
const STATUS_STYLES: Record<string, PillStyle> = {
  Done: { bg: 'rgba(62, 122, 52, 0.12)', color: '#3E7A34' },
  Completed: { bg: 'rgba(62, 122, 52, 0.12)', color: '#3E7A34' },
  'WIP (0-25%)': { bg: 'rgba(47, 110, 104, 0.12)', color: '#2F6E68' },
  'WIP (25-50%)': { bg: 'rgba(47, 110, 104, 0.12)', color: '#2F6E68' },
  'WIP (50-75%)': { bg: 'rgba(47, 110, 104, 0.12)', color: '#2F6E68' },
  'WIP (75-100%)': { bg: 'rgba(47, 110, 104, 0.12)', color: '#2F6E68' },
  // P00 task statuses (our schema) mapped to the same "in progress" turquoise:
  'WIP - 25%': { bg: 'rgba(47, 110, 104, 0.12)', color: '#2F6E68' },
  'WIP - 50%': { bg: 'rgba(47, 110, 104, 0.12)', color: '#2F6E68' },
  'WIP - 75%': { bg: 'rgba(47, 110, 104, 0.12)', color: '#2F6E68' },
  WIP: { bg: 'rgba(47, 110, 104, 0.12)', color: '#2F6E68' },
  Review: { bg: 'rgba(156, 108, 16, 0.12)', color: '#9C6C10' },
  'Under Review': { bg: 'rgba(156, 108, 16, 0.12)', color: '#9C6C10' },
  Planning: { bg: 'rgba(45, 62, 81, 0.10)', color: '#2D3E51' },
  'Yet to Start': { bg: 'rgba(150, 160, 168, 0.15)', color: '#96A0A8' },
  'Not Started': { bg: 'rgba(150, 160, 168, 0.15)', color: '#96A0A8' },
  'On Hold': { bg: 'rgba(92, 103, 115, 0.12)', color: '#5C6773' },
  Cancelled: { bg: 'rgba(92, 103, 115, 0.12)', color: '#5C6773' },
  Backlog: { bg: 'rgba(150, 160, 168, 0.15)', color: '#96A0A8' },
  // leave / approval statuses
  Pending: { bg: 'rgba(156, 108, 16, 0.12)', color: '#9C6C10' },
  Approved: { bg: 'rgba(62, 122, 52, 0.12)', color: '#3E7A34' },
  Rejected: { bg: 'rgba(163, 91, 36, 0.12)', color: '#A35B24' },
};

export const statusPillStyle = (status: string): PillStyle => STATUS_STYLES[status] ?? { bg: 'rgba(150, 160, 168, 0.15)', color: '#96A0A8' };

// Status dot colour (task rows) — honours overdue.
export function statusDot(status: string, overdue = false): string {
  if (overdue && status !== 'Done' && status !== 'Cancelled') return '#A35B24';
  if (status === 'Done' || status === 'Completed') return '#3E7A34';
  if (status.startsWith('WIP')) return '#2F6E68';
  if (status === 'Planning') return '#2D3E51';
  if (status === 'Under Review' || status === 'Review') return '#9C6C10';
  if (status === 'On Hold') return '#5C6773';
  if (status === 'Cancelled') return '#5C6773';
  return '#96A0A8';
}

// Priority column display: "→ Low" / "→ Medium" / "+ High" / "!! Critical".
const PRIORITY_DISPLAY: Record<string, { label: string; color: string }> = {
  Low: { label: '→ Low', color: '#3E7A34' },
  Medium: { label: '→ Medium', color: '#5C6773' },
  High: { label: '+ High', color: '#9C6C10' },
  Critical: { label: '!! Critical', color: '#A35B24' },
};
export const priorityDisplay = (p: string) => PRIORITY_DISPLAY[p] ?? { label: p, color: '#5C6773' };
