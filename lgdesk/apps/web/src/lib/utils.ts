// Shared UI helpers — pill/badge class mapping, avatars, date formatting.
// Class names target the GAS-verified rules in globals.css.
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** shadcn/ui-standard classname merge helper (clsx + tailwind-merge). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Join truthy class fragments. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/** Slugify a label into a CSS-class-safe token: "WIP - 25%" -> "WIP-25". */
export function slug(s: string): string {
  return s.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// ─── Status pills ───────────────────────────────────────────────
// Our P00 task statuses diverge from GAS; map each to the nearest GAS pill class.
const STATUS_PILL: Record<string, string> = {
  Backlog: 'pill-Backlog',
  'Not Started': 'pill-Not-Started',
  'WIP - 25%': 'pill-WIP-0-25',
  'WIP - 50%': 'pill-WIP-25-50',
  'WIP - 75%': 'pill-WIP-50-75',
  Done: 'pill-Done',
  Completed: 'pill-Completed',
  Cancelled: 'pill-Cancelled',
  'Under Review': 'pill-Review',
  Review: 'pill-Review',
  'On Hold': 'pill-On-Hold',
  Planning: 'pill-Planning',
  Pending: 'pill-Pending',
  Approved: 'pill-Approved',
  Rejected: 'pill-Rejected',
};

export function pillClass(status: string): string {
  return cx('pill', STATUS_PILL[status] ?? `pill-${slug(status)}`);
}

export function rolePillClass(role: string): string {
  return cx('pill', `pill-${slug(role)}`);
}

const PRIORITY_BADGE: Record<string, string> = {
  Critical: 'badge-critical',
  High: 'badge-high',
  Medium: 'badge-medium',
  Low: 'badge-low',
};
export function badgeClass(priority: string): string {
  return cx('badge', PRIORITY_BADGE[priority] ?? `badge-${priority.toLowerCase()}`);
}

/** Coloured left-border / status-dot colour for a task, honouring overdue. */
export function statusDotColor(status: string, opts?: { overdue?: boolean }): string {
  if (opts?.overdue && status !== 'Done' && status !== 'Cancelled') return 'var(--danger)';
  if (status === 'Done' || status === 'Completed') return 'var(--ok)';
  if (status.startsWith('WIP')) return '#1565c0';
  if (status === 'Under Review' || status === 'Review') return 'var(--warn)';
  if (status === 'On Hold') return '#f57f17';
  if (status === 'Cancelled') return 'var(--muted)';
  return 'var(--muted2)';
}

// ─── Avatars ────────────────────────────────────────────────────
// Exact GAS palette + hash lives in avatar-colors.ts; re-export for callers.
export { avatarColor } from './avatar-colors';

/** Up to two uppercase initials from a display name. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

// ─── Dates ──────────────────────────────────────────────────────
/** Date -> "YYYY-MM-DD" (UTC-safe, no Date-object/string mismatch). */
export function toISODate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
}

export function fmtDate(d: Date | string, opts?: Intl.DateTimeFormatOptions): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString(undefined, opts ?? { month: 'short', day: 'numeric', year: 'numeric' });
}

export function fmtDateRange(a: Date | string, b: Date | string): string {
  return `${fmtDate(a, { month: 'short', day: 'numeric' })} – ${fmtDate(b, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

/** Seconds/minutes -> "HH:MM:SS" or "Hh Mm". */
export function hms(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, '0')).join(':');
}
