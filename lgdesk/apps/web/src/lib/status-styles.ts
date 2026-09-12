// Exact GAS status pill + priority styles (PMASTER-UI §16).

export interface PillStyle { bg: string; color: string }

// UXL Club palette (design.md): Done/Completed and the WIP/"in progress" family
// and Yet-to-Start/Backlog ("todo" family) and Cancelled map to the 4 approved
// task-status colors. Review/Planning/On Hold/Pending/Approved/Rejected are
// leave/project-approval states outside that approved mapping and intentionally
// left on their prior palette — see redesign report.
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
  Review: { bg: '#fff3e0', color: '#e65100' },
  'Under Review': { bg: '#fff3e0', color: '#e65100' },
  Planning: { bg: '#e8eaf6', color: '#1a237e' },
  'Yet to Start': { bg: 'rgba(150, 160, 168, 0.15)', color: '#96A0A8' },
  'Not Started': { bg: 'rgba(150, 160, 168, 0.15)', color: '#96A0A8' },
  'On Hold': { bg: '#fff8e1', color: '#f57f17' },
  Cancelled: { bg: 'rgba(92, 103, 115, 0.12)', color: '#5C6773' },
  Backlog: { bg: 'rgba(150, 160, 168, 0.15)', color: '#96A0A8' },
  // leave / approval statuses
  Pending: { bg: '#fff3e0', color: '#e65100' },
  Approved: { bg: '#e8f5e9', color: '#2e7d32' },
  Rejected: { bg: '#fce8e8', color: '#c62828' },
};

export const statusPillStyle = (status: string): PillStyle => STATUS_STYLES[status] ?? { bg: '#f5f5f5', color: '#757575' };

// Status dot colour (task rows) — honours overdue.
export function statusDot(status: string, overdue = false): string {
  if (overdue && status !== 'Done' && status !== 'Cancelled') return '#A35B24';
  if (status === 'Done' || status === 'Completed') return '#3E7A34';
  if (status.startsWith('WIP')) return '#2F6E68';
  if (status === 'Planning') return '#1a237e';
  if (status === 'Under Review' || status === 'Review') return '#e65100';
  if (status === 'On Hold') return '#f57f17';
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
