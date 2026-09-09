import { BadRequestException } from '@nestjs/common';
import { WorkLogService } from './work-log.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { IdUtilsService } from '../common/utils/id.utils';

// UTC-midnight Date matching how this codebase stores every @db.Date column.
function d(iso: string): Date {
  const [y, m, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

function makeMockPrisma() {
  return {
    holiday: { findUnique: jest.fn() },
    alternateSaturday: { findUnique: jest.fn(), upsert: jest.fn() },
    workLog: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
    workDuration: { findUnique: jest.fn() },
  } as unknown as jest.Mocked<PrismaService> & {
    holiday: { findUnique: jest.Mock };
    alternateSaturday: { findUnique: jest.Mock; upsert: jest.Mock };
    workLog: { findUnique: jest.Mock; update: jest.Mock; create: jest.Mock };
    workDuration: { findUnique: jest.Mock };
  };
}

function makeMockIdUtils() {
  return {
    createWithId: jest.fn((_model: string, _idField: string, prefix: string, run: (id: string) => Promise<unknown>) =>
      run(`${prefix}-00001`),
    ),
  } as unknown as IdUtilsService;
}

describe('WorkLogService — day-type precedence', () => {
  let prisma: ReturnType<typeof makeMockPrisma>;
  let service: WorkLogService;

  beforeEach(() => {
    prisma = makeMockPrisma();
    service = new WorkLogService(prisma as unknown as PrismaService, makeMockIdUtils());
  });

  it('a Sunday that is also a Holiday resolves to Holiday, not Week Off', async () => {
    prisma.holiday.findUnique.mockResolvedValue({ id: 'h1', date: d('2026-09-06'), name: 'Some Holiday' });
    // 2026-09-06 is a Sunday.
    const result = await service.classifyDayType('EMP-1', d('2026-09-06'));
    expect(result).toBe('Holiday');
    expect(prisma.alternateSaturday.findUnique).not.toHaveBeenCalled();
  });

  it("an employee's chosen Alternate Saturday that is also a Holiday resolves to Holiday, not Alternate Week Off", async () => {
    // 2026-09-05 is a Saturday.
    prisma.holiday.findUnique.mockResolvedValue({ id: 'h2', date: d('2026-09-05'), name: 'Some Holiday' });
    prisma.alternateSaturday.findUnique.mockResolvedValue({
      empId: 'EMP-1', month: '2026-09', offDate1: d('2026-09-05'), offDate2: d('2026-09-19'),
    });
    const result = await service.classifyDayType('EMP-1', d('2026-09-05'));
    expect(result).toBe('Holiday');
  });

  it('a plain Saturday that is neither a holiday nor the employee\'s chosen off-day is a Working Day', async () => {
    prisma.holiday.findUnique.mockResolvedValue(null);
    prisma.alternateSaturday.findUnique.mockResolvedValue({
      empId: 'EMP-1', month: '2026-09', offDate1: d('2026-09-05'), offDate2: d('2026-09-19'),
    });
    // 2026-09-12 is a Saturday, but not one of this employee's chosen off-dates.
    const result = await service.classifyDayType('EMP-1', d('2026-09-12'));
    expect(result).toBe('WorkingDay');
  });

  it("the employee's chosen off-Saturday (no holiday involved) is Alternate Week Off", async () => {
    prisma.holiday.findUnique.mockResolvedValue(null);
    prisma.alternateSaturday.findUnique.mockResolvedValue({
      empId: 'EMP-1', month: '2026-09', offDate1: d('2026-09-05'), offDate2: d('2026-09-19'),
    });
    const result = await service.classifyDayType('EMP-1', d('2026-09-19'));
    expect(result).toBe('AlternateWeekOff');
  });

  it('with no saved AlternateSaturday row, defaults to the 1st and 3rd Saturday', async () => {
    prisma.holiday.findUnique.mockResolvedValue(null);
    prisma.alternateSaturday.findUnique.mockResolvedValue(null);
    // 2026-09-05 = 1st Saturday -> off. 2026-09-12 = 2nd Saturday -> working.
    expect(await service.classifyDayType('EMP-1', d('2026-09-05'))).toBe('AlternateWeekOff');
    expect(await service.classifyDayType('EMP-1', d('2026-09-12'))).toBe('WorkingDay');
    expect(await service.classifyDayType('EMP-1', d('2026-09-19'))).toBe('AlternateWeekOff');
  });

  it('a plain weekday (not Sat/Sun, no holiday) is a Working Day', async () => {
    prisma.holiday.findUnique.mockResolvedValue(null);
    // 2026-09-08 is a Tuesday.
    const result = await service.classifyDayType('EMP-1', d('2026-09-08'));
    expect(result).toBe('WorkingDay');
    expect(prisma.alternateSaturday.findUnique).not.toHaveBeenCalled();
  });
});

describe('WorkLogService — attendanceSource guard (classifyAndSyncWorkLog)', () => {
  let prisma: ReturnType<typeof makeMockPrisma>;
  let service: WorkLogService;

  beforeEach(() => {
    prisma = makeMockPrisma();
    service = new WorkLogService(prisma as unknown as PrismaService, makeMockIdUtils());
    prisma.holiday.findUnique.mockResolvedValue(null);
    prisma.alternateSaturday.findUnique.mockResolvedValue(null);
  });

  it('a MANUAL row is never overwritten on attendance/extraHours -- only workDuration updates', async () => {
    prisma.workLog.findUnique.mockResolvedValue({
      id: 'row1', attendanceSource: 'MANUAL', attendance: 'Present-WFH', extraHours: 5,
    });
    // 2026-09-08 is a Tuesday (Working Day); 540 min = 9h, would classify to Present-WFO
    // if this were AUTO -- but it's MANUAL, so nothing but workDuration should change.
    await service.classifyAndSyncWorkLog('EMP-1', d('2026-09-08'), 540, 'WFO');

    expect(prisma.workLog.update).toHaveBeenCalledTimes(1);
    expect(prisma.workLog.update).toHaveBeenCalledWith({ where: { id: 'row1' }, data: { workDuration: 540 } });
    expect(prisma.workLog.create).not.toHaveBeenCalled();
  });

  it('an AUTO row IS overwritten with the freshly classified attendance/extraHours', async () => {
    prisma.workLog.findUnique.mockResolvedValue({ id: 'row2', attendanceSource: 'AUTO', attendance: 'Leave Full Day', extraHours: 0 });
    await service.classifyAndSyncWorkLog('EMP-1', d('2026-09-08'), 540, 'WFO');

    expect(prisma.workLog.update).toHaveBeenCalledWith({
      where: { id: 'row2' },
      data: expect.objectContaining({ attendance: 'Present-WFO', extraHours: 0, workDuration: 540, attendanceSource: 'AUTO' }),
    });
  });

  it('a missing row is created fresh as AUTO', async () => {
    prisma.workLog.findUnique.mockResolvedValue(null);
    prisma.workLog.create.mockResolvedValue({ id: 'new1' });
    await service.classifyAndSyncWorkLog('EMP-1', d('2026-09-08'), 540, 'WFH');

    expect(prisma.workLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        logId: 'WL-00001', empId: 'EMP-1', attendance: 'Present-WFH', extraHours: 0, workDuration: 540, attendanceSource: 'AUTO',
      }),
    });
    expect(prisma.workLog.update).not.toHaveBeenCalled();
  });

  it('a concurrent-create race (date P2002) re-resolves against the row that won instead of throwing', async () => {
    prisma.workLog.findUnique
      .mockResolvedValueOnce(null) // first read: nothing there yet
      .mockResolvedValueOnce({ id: 'raced', attendanceSource: 'AUTO', attendance: 'Leave Full Day', extraHours: 0 }); // re-read after the race
    prisma.workLog.create.mockRejectedValue({ code: 'P2002', meta: { target: ['empId', 'date'] } });

    await expect(service.classifyAndSyncWorkLog('EMP-1', d('2026-09-08'), 540, 'WFO')).resolves.toBeUndefined();
    expect(prisma.workLog.update).toHaveBeenCalledWith({
      where: { id: 'raced' },
      data: expect.objectContaining({ attendance: 'Present-WFO' }),
    });
  });
});

describe('WorkLogService — Alternate Saturday validation + retroactive recompute', () => {
  let prisma: ReturnType<typeof makeMockPrisma>;
  let service: WorkLogService;

  beforeEach(() => {
    prisma = makeMockPrisma();
    service = new WorkLogService(prisma as unknown as PrismaService, makeMockIdUtils());
    prisma.holiday.findUnique.mockResolvedValue(null);
    prisma.workDuration.findUnique.mockResolvedValue(null);
    prisma.workLog.findUnique.mockResolvedValue(null);
    prisma.workLog.create.mockResolvedValue({ id: 'x' });
  });

  it('rejects a non-Saturday date', async () => {
    prisma.alternateSaturday.findUnique.mockResolvedValue(null);
    await expect(
      service.setAlternateSaturdays('EMP-1', { month: '2026-09', offDates: ['2026-09-05', '2026-09-08'] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a date outside the given month', async () => {
    prisma.alternateSaturday.findUnique.mockResolvedValue(null);
    await expect(
      service.setAlternateSaturdays('EMP-1', { month: '2026-09', offDates: ['2026-09-05', '2026-08-01'] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects duplicate dates', async () => {
    prisma.alternateSaturday.findUnique.mockResolvedValue(null);
    await expect(
      service.setAlternateSaturdays('EMP-1', { month: '2026-09', offDates: ['2026-09-05', '2026-09-05'] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts a valid pair even when one of them also happens to be a holiday', async () => {
    prisma.alternateSaturday.findUnique.mockResolvedValue(null);
    prisma.holiday.findUnique.mockImplementation(({ where }: { where: { date: Date } }) =>
      where.date.getTime() === d('2026-09-05').getTime() ? { id: 'h', date: d('2026-09-05'), name: 'X' } : null,
    );
    await expect(
      service.setAlternateSaturdays('EMP-1', { month: '2026-09', offDates: ['2026-09-05', '2026-09-19'] }),
    ).resolves.toEqual({ ok: true });
    expect(prisma.alternateSaturday.upsert).toHaveBeenCalled();
  });

  it('changing a past month\'s selection retroactively recomputes both the removed and the added date', async () => {
    // Previously: default 1st/3rd (05, 19). New selection: 12, 19 -- so 05 goes back to
    // Working Day and 12 becomes the new Alternate Week Off. findUnique must reflect the
    // upsert's effect for the SECOND read (inside the recompute loop's classifyDayType
    // calls) but not the first ("previous") read -- a plain mockResolvedValueOnce chain
    // can't express "changes after upsert runs", so this stubs real state instead.
    let saved: { offDate1: Date; offDate2: Date } | null = null;
    prisma.alternateSaturday.findUnique.mockImplementation(() => Promise.resolve(saved));
    prisma.alternateSaturday.upsert.mockImplementation(({ create }: { create: { offDate1: Date; offDate2: Date } }) => {
      saved = { offDate1: create.offDate1, offDate2: create.offDate2 };
      return Promise.resolve(saved);
    });
    prisma.workDuration.findUnique.mockResolvedValue({ netMinutes: 0, workMode: null });

    await service.setAlternateSaturdays('EMP-1', { month: '2026-09', offDates: ['2026-09-12', '2026-09-19'] });

    // 2026-09-05 (dropped) and 2026-09-12 (added) both need their WorkLog re-run;
    // 2026-09-19 is unchanged (still off before and after) and should NOT be touched.
    const recomputedDates = prisma.workLog.create.mock.calls.map((c) => c[0].data.date.toISOString().slice(0, 10));
    expect(recomputedDates.sort()).toEqual(['2026-09-05', '2026-09-12']);
  });
});
