// Daily check-in + auto-attendance engine (implementation brief 2026-09-09) — pure,
// framework-free functions kept separate from work-log.service.ts specifically so the
// business-rule math can be unit-tested in isolation from Prisma/NestJS. Every label this
// module produces MUST be one of ATTENDANCE_TYPES (common/constants.ts) — do not invent
// new attendance strings here.

export type DayType = 'Holiday' | 'WeekOff' | 'AlternateWeekOff' | 'WorkingDay';

export interface AttendanceResult {
  attendance: string;
  extraHours: number;
}

/**
 * Rounds raw clocked minutes to the nearest half-hour, expressed in hours. This rounding
 * IS the "2:15/2:45 isn't accepted" enforcement -- there is no separate rejection step.
 *
 * Note (flagged during implementation): `Math.round(x*2)/2` breaks an exact tie (a value
 * sitting precisely halfway between two half-hour steps, e.g. 2.25h = 135 raw minutes,
 * exactly between 2.0h and 2.5h) by rounding UP -- so 135 minutes rounds to 2.5h, not the
 * 2.0h the brief's own worked-example table stated. Verified directly in Node
 * (`Math.round(4.5) === 5`, `4.5/2 === 2.25` -> `Math.round(2.25*2)/2 === 2.5`) before
 * writing this, since the brief itself flagged the 135-minute example as worth
 * double-checking against a real interpreter rather than trusting the write-up. The
 * *formula* is unchanged from what the brief endorsed ("Math.round(...) is the right
 * idea") -- only that one specific worked number in the brief's prose was arithmetically
 * wrong; the 165-minute example (2.75h -> 3.0h) already matched.
 */
export function roundMinutesToHalfHour(netMinutes: number): number {
  return Math.round((netMinutes / 60) * 2) / 2;
}

/** Normalizes a possibly-null/unknown work mode to 'WFO' or 'WFH', defaulting ambiguous
 * cases to WFO -- matches ATTENDANCE_TYPES's own documented default-to-WFO convention for
 * cases where the mode can't be determined. */
function normalizeMode(workMode: string | null | undefined): 'WFO' | 'WFH' {
  return workMode === 'WFH' ? 'WFH' : 'WFO';
}

/**
 * The core hour-formula, precedence: Holiday > Week Off / Alternate Week Off > Working Day.
 * `dayType` must already reflect that precedence (see classifyDayType in
 * work-log.service.ts, which owns the Holiday/Saturday-lookup side of it) -- this function
 * only implements the hours-to-label/extra-hours math for a day type already resolved.
 */
export function computeAttendance(dayType: DayType, hours: number, workMode: string | null | undefined): AttendanceResult {
  const mode = normalizeMode(workMode);

  if (dayType === 'Holiday') {
    // Attendance is ALWAYS 'Holiday', never overwritten by hours worked -- only extraHours
    // reflects the hours, and only once they clear the same >=2 floor as everywhere else.
    return { attendance: 'Holiday', extraHours: hours >= 2 ? hours : 0 };
  }

  if (dayType === 'WorkingDay') {
    const baseline: 0 | 4 | 9 = hours >= 9 ? 9 : hours >= 4 ? 4 : 0;
    const attendance = baseline === 9 ? `Present-${mode}` : baseline === 4 ? 'Leave Half Day' : 'Leave Full Day';
    const extraRaw = hours - baseline;
    return { attendance, extraHours: extraRaw >= 2 ? extraRaw : 0 };
  }

  // WeekOff or AlternateWeekOff -- unworked (< 4h) keeps the day's own off-day label with
  // no extra hours; 4-9h is a half day worked, 9h+ a full day worked.
  const offLabel = dayType === 'WeekOff' ? 'Week Off' : 'Alternate Week Off';
  if (hours < 4) return { attendance: offLabel, extraHours: 0 };
  if (hours < 9) {
    const extraRaw = hours - 4;
    return { attendance: `Extra Half Day-${mode}`, extraHours: extraRaw >= 2 ? extraRaw : 0 };
  }
  const extraRaw = hours - 9;
  return { attendance: `Extra Full Day-${mode}`, extraHours: extraRaw >= 2 ? extraRaw : 0 };
}

// ─── Alternate-Saturday date helpers (pure) ────────────────────────────────────

/** All Saturdays in `month` ("YYYY-MM"), as UTC-midnight ISO date strings, ascending. */
export function saturdaysInMonth(month: string): string[] {
  const [y, m] = month.split('-').map(Number);
  const out: string[] = [];
  const d = new Date(Date.UTC(y, m - 1, 1));
  while (d.getUTCMonth() === m - 1) {
    if (d.getUTCDay() === 6) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

/** Default off-Saturdays for an employee who hasn't set a preference: the 1st and 3rd
 * Saturday of the month (matches the app's prior global-fixed assumption, now the
 * per-employee fallback rather than the only option). */
export function defaultAlternateSaturdays(month: string): [string, string] {
  const sats = saturdaysInMonth(month);
  return [sats[0], sats[2]];
}

export function isSaturdayIso(iso: string): boolean {
  return new Date(`${iso}T00:00:00Z`).getUTCDay() === 6;
}
