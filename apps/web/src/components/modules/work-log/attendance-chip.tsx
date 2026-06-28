const MAP: Record<string, { abbr: string; cls: string }> = {
  Present: { abbr: 'P', cls: 'bg-[var(--ok)]/20 text-[var(--ok)]' },
  'Leave Full Day': { abbr: 'LF', cls: 'bg-[var(--danger)]/20 text-[var(--danger)]' },
  'Leave Half Day': { abbr: 'LH', cls: 'bg-[var(--warn)]/20 text-[var(--warn)]' },
  'Alternate Week Off': { abbr: 'AW', cls: 'bg-[var(--warn)]/15 text-[var(--warn)]' },
  'Week Off': { abbr: 'W', cls: 'bg-[var(--bg)] text-[var(--muted)]' },
  Holiday: { abbr: 'H', cls: 'bg-[var(--p3)] text-[var(--p)]' },
  'Extra Full Day': { abbr: 'EF', cls: 'bg-[var(--ok)]/25 text-[var(--ok)]' },
  'Extra Half Day': { abbr: 'EH', cls: 'bg-[var(--ok)]/15 text-[var(--ok)]' },
};

export function attendanceAbbr(attendance: string): string {
  return MAP[attendance]?.abbr ?? '·';
}

export function AttendanceChip({ attendance, full }: { attendance: string; full?: boolean }) {
  const m = MAP[attendance] ?? { abbr: '·', cls: 'bg-[var(--border)] text-[var(--muted)]' };
  return (
    <span className={`inline-flex items-center rounded-[8px] px-1.5 py-0.5 text-xs font-medium ${m.cls}`} title={attendance}>
      {full ? attendance : m.abbr}
    </span>
  );
}

export default AttendanceChip;
