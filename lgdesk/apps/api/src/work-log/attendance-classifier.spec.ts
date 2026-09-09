import {
  computeAttendance,
  roundMinutesToHalfHour,
  saturdaysInMonth,
  defaultAlternateSaturdays,
  isSaturdayIso,
  DayType,
} from './attendance-classifier';

describe('roundMinutesToHalfHour', () => {
  it.each([
    [0, 0],
    [30, 0.5],
    [60, 1],
    [119, 2], // 1.9833h -> nearest half-hour is 2.0
    [120, 2],
    [121, 2], // 2.0166h -> nearest half-hour is 2.0
    // The brief's own worked example flagged this one for double-checking: 135 min =
    // 2.25h sits EXACTLY halfway between 2.0h and 2.5h. Math.round breaks ties upward
    // (Math.round(4.5) === 5 in JS), so this rounds to 2.5h, not the 2.0h the brief's
    // prose stated -- verified directly in Node before writing this assertion. The
    // *formula* (`Math.round(x*2)/2`) is what the brief endorsed; this is its real,
        // reproducible output for that exact input, not a guess.
    [135, 2.5],
    [165, 3], // 2.75h -> 3.0h, matches the brief's own second example
    [240, 4],
    [270, 4.5],
    [540, 9],
    [555, 9.5],
  ])('%i raw minutes -> %s hours', (mins, expected) => {
    expect(roundMinutesToHalfHour(mins)).toBe(expected);
  });
});

describe('computeAttendance', () => {
  // The brief's own worked-examples table, used as literal test cases.
  const table: Array<[DayType, number, string, string, number]> = [
    ['WorkingDay', 0, 'WFO', 'Leave Full Day', 0],
    ['WorkingDay', 2, 'WFO', 'Leave Full Day', 2],
    ['WorkingDay', 3, 'WFH', 'Leave Full Day', 3],
    ['WorkingDay', 3.9, 'WFO', 'Leave Full Day', 3.9],
    ['WorkingDay', 5, 'WFO', 'Leave Half Day', 0],
    ['WorkingDay', 6, 'WFH', 'Leave Half Day', 2],
    ['WorkingDay', 9, 'WFO', 'Present-WFO', 0],
    ['WorkingDay', 10, 'WFO', 'Present-WFO', 0],
    ['WorkingDay', 12, 'WFH', 'Present-WFH', 3],
    ['WeekOff', 3, 'WFO', 'Week Off', 0],
    ['WeekOff', 4, 'WFO', 'Extra Half Day-WFO', 0],
    ['WeekOff', 6, 'WFH', 'Extra Half Day-WFH', 2],
    ['AlternateWeekOff', 9, 'WFO', 'Extra Full Day-WFO', 0],
    ['AlternateWeekOff', 11, 'WFH', 'Extra Full Day-WFH', 2],
    ['Holiday', 1, 'WFO', 'Holiday', 0],
    ['Holiday', 3, 'WFH', 'Holiday', 3],
  ];

  it.each(table)('%s, %s hours, %s -> %s / extraHours=%s', (dayType, hours, mode, expectedAttendance, expectedExtra) => {
    const result = computeAttendance(dayType, hours, mode);
    expect(result.attendance).toBe(expectedAttendance);
    expect(result.extraHours).toBe(expectedExtra);
  });

  describe('boundary values', () => {
    it('Working Day: exactly 2h (below the 4h Leave Half Day threshold) stays Leave Full Day', () => {
      expect(computeAttendance('WorkingDay', 2, 'WFO')).toEqual({ attendance: 'Leave Full Day', extraHours: 2 });
    });
    it('Working Day: exactly 4h crosses into Leave Half Day', () => {
      expect(computeAttendance('WorkingDay', 4, 'WFO')).toEqual({ attendance: 'Leave Half Day', extraHours: 0 });
    });
    it('Working Day: exactly 9h crosses into Present', () => {
      expect(computeAttendance('WorkingDay', 9, 'WFH')).toEqual({ attendance: 'Present-WFH', extraHours: 0 });
    });
    it('Week Off: exactly 4h crosses into Extra Half Day', () => {
      expect(computeAttendance('WeekOff', 4, 'WFO')).toEqual({ attendance: 'Extra Half Day-WFO', extraHours: 0 });
    });
    it('Week Off: exactly 9h crosses into Extra Full Day', () => {
      expect(computeAttendance('WeekOff', 9, 'WFO')).toEqual({ attendance: 'Extra Full Day-WFO', extraHours: 0 });
    });
    it('Alternate Week Off: just under 4h stays unworked', () => {
      expect(computeAttendance('AlternateWeekOff', 3.5, 'WFH')).toEqual({ attendance: 'Alternate Week Off', extraHours: 0 });
    });
  });

  describe('ambiguous/missing work mode defaults to WFO', () => {
    it('null workMode on a Present day', () => {
      expect(computeAttendance('WorkingDay', 9, null)).toEqual({ attendance: 'Present-WFO', extraHours: 0 });
    });
    it('undefined workMode on an Extra Full Day', () => {
      expect(computeAttendance('WeekOff', 9, undefined)).toEqual({ attendance: 'Extra Full Day-WFO', extraHours: 0 });
    });
  });

  it('Holiday attendance is always Holiday regardless of hours worked', () => {
    expect(computeAttendance('Holiday', 0, 'WFO').attendance).toBe('Holiday');
    expect(computeAttendance('Holiday', 12, 'WFH').attendance).toBe('Holiday');
  });
});

describe('saturdaysInMonth', () => {
  it('returns all Saturdays in a 31-day month (September 2026)', () => {
    // 2026-09-01 is a Tuesday -- Saturdays fall on 5, 12, 19, 26.
    expect(saturdaysInMonth('2026-09')).toEqual(['2026-09-05', '2026-09-12', '2026-09-19', '2026-09-26']);
  });

  it('returns 5 Saturdays for a month that has them (August 2026)', () => {
    // 2026-08-01 is a Saturday -- Saturdays fall on 1, 8, 15, 22, 29.
    expect(saturdaysInMonth('2026-08')).toEqual(['2026-08-01', '2026-08-08', '2026-08-15', '2026-08-22', '2026-08-29']);
  });
});

describe('defaultAlternateSaturdays', () => {
  it('defaults to the 1st and 3rd Saturday of the month', () => {
    expect(defaultAlternateSaturdays('2026-09')).toEqual(['2026-09-05', '2026-09-19']);
  });
});

describe('isSaturdayIso', () => {
  it('true for a real Saturday', () => expect(isSaturdayIso('2026-09-05')).toBe(true));
  it('false for a Sunday', () => expect(isSaturdayIso('2026-09-06')).toBe(false));
  it('false for a Friday', () => expect(isSaturdayIso('2026-09-04')).toBe(false));
});
