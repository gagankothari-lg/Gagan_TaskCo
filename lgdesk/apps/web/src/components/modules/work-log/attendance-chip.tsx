// Round4 F3: 11-value WFO/WFH-split vocabulary (setupSheets.gs VALIDATIONS.Work_Log.Attendance) --
// was the pre-migration 8-value set. WFH variants get the reference's own distinct hex
// (app.js.html:1856-1868 WL_ATTENDANCE_STYLES) since this component's existing CSS-var
// palette has no separate "home" shade to reuse.
const MAP: Record<string, { abbr: string; cls: string }> = {
  'Present-WFO': { abbr: 'P-WFO', cls: 'bg-[var(--ok)]/20 text-[var(--ok)]' },
  'Present-WFH': { abbr: 'P-WFH', cls: 'bg-[#e0f2fe] text-[#0369a1]' },
  'Leave Full Day': { abbr: 'LF', cls: 'bg-[var(--danger)]/20 text-[var(--danger)]' },
  'Leave Half Day': { abbr: 'LH', cls: 'bg-[var(--warn)]/20 text-[var(--warn)]' },
  'Alternate Week Off': { abbr: 'AW', cls: 'bg-[var(--warn)]/15 text-[var(--warn)]' },
  'Week Off': { abbr: 'W', cls: 'bg-[var(--bg)] text-[var(--muted)]' },
  Holiday: { abbr: 'H', cls: 'bg-[var(--p3)] text-[var(--p)]' },
  'Extra Full Day-WFO': { abbr: 'EF-WFO', cls: 'bg-[var(--ok)]/25 text-[var(--ok)]' },
  'Extra Full Day-WFH': { abbr: 'EF-WFH', cls: 'bg-[#1e3a5f] text-white' },
  'Extra Half Day-WFO': { abbr: 'EH-WFO', cls: 'bg-[var(--ok)]/15 text-[var(--ok)]' },
  'Extra Half Day-WFH': { abbr: 'EH-WFH', cls: 'bg-[#581c87] text-white' },
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
