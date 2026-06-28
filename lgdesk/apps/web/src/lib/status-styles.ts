// Exact GAS status pill + priority styles (PMASTER-UI §16).

export interface PillStyle { bg: string; color: string }

const STATUS_STYLES: Record<string, PillStyle> = {
  Done: { bg: '#e8f5e9', color: '#2e7d32' },
  Completed: { bg: '#e8f5e9', color: '#2e7d32' },
  'WIP (0-25%)': { bg: '#e3f2fd', color: '#1565c0' },
  'WIP (25-50%)': { bg: '#e3f2fd', color: '#1565c0' },
  'WIP (50-75%)': { bg: '#e3f2fd', color: '#1565c0' },
  'WIP (75-100%)': { bg: '#e3f2fd', color: '#1565c0' },
  // P00 task statuses (our schema) mapped to the same blues:
  'WIP - 25%': { bg: '#e3f2fd', color: '#1565c0' },
  'WIP - 50%': { bg: '#e3f2fd', color: '#1565c0' },
  'WIP - 75%': { bg: '#e3f2fd', color: '#1565c0' },
  WIP: { bg: '#e3f2fd', color: '#1565c0' },
  Review: { bg: '#fff3e0', color: '#e65100' },
  'Under Review': { bg: '#fff3e0', color: '#e65100' },
  Planning: { bg: '#e8eaf6', color: '#1a237e' },
  'Yet to Start': { bg: '#f5f5f5', color: '#757575' },
  'Not Started': { bg: '#f5f5f5', color: '#757575' },
  'On Hold': { bg: '#fff8e1', color: '#f57f17' },
  Cancelled: { bg: '#fce8e8', color: '#c62828' },
  Backlog: { bg: '#fafafa', color: '#9e9e9e' },
  // leave / approval statuses
  Pending: { bg: '#fff3e0', color: '#e65100' },
  Approved: { bg: '#e8f5e9', color: '#2e7d32' },
  Rejected: { bg: '#fce8e8', color: '#c62828' },
};

export const statusPillStyle = (status: string): PillStyle => STATUS_STYLES[status] ?? { bg: '#f5f5f5', color: '#757575' };

// Status dot colour (task rows) — honours overdue.
export function statusDot(status: string, overdue = false): string {
  if (overdue && status !== 'Done' && status !== 'Cancelled') return '#c62828';
  if (status === 'Done' || status === 'Completed') return '#2e7d32';
  if (status.startsWith('WIP')) return '#1565c0';
  if (status === 'Planning') return '#1a237e';
  if (status === 'Under Review' || status === 'Review') return '#e65100';
  if (status === 'On Hold') return '#f57f17';
  if (status === 'Cancelled') return '#9e9e9e';
  return '#9e9e9e';
}

// Priority column display: "→ Low" / "→ Medium" / "+ High" / "!! Critical".
const PRIORITY_DISPLAY: Record<string, { label: string; color: string }> = {
  Low: { label: '→ Low', color: '#757575' },
  Medium: { label: '→ Medium', color: '#1a237e' },
  High: { label: '+ High', color: '#e65100' },
  Critical: { label: '!! Critical', color: '#c62828' },
};
export const priorityDisplay = (p: string) => PRIORITY_DISPLAY[p] ?? { label: p, color: '#757575' };
