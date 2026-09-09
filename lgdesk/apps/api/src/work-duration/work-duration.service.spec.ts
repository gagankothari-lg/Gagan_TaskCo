import { ConflictException, ForbiddenException } from '@nestjs/common';
import { WorkDurationService } from './work-duration.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { IdUtilsService } from '../common/utils/id.utils';
import type { CalendarService } from '../calendar/calendar.service';
import type { WorkLogService } from '../work-log/work-log.service';

const TODAY = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));

function baseSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sess1', sessionId: 'WD-00001', empId: 'EMP-1', date: TODAY,
    clockIn: null, clockOut: null, totalBreakMins: 0, grossMinutes: 0, netMinutes: 0,
    status: 'IDLE', autoClocked: false, notes: null, isWorking: null, workMode: null,
    ...overrides,
  };
}

function makeMockPrisma(session: ReturnType<typeof baseSession>) {
  return {
    workDuration: {
      findUnique: jest.fn().mockResolvedValue(session),
      update: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
        Object.assign(session, data);
        return Promise.resolve(session);
      }),
      findMany: jest.fn().mockResolvedValue([]), // getStatus()'s 14-day history read
    },
    user: { findUnique: jest.fn().mockResolvedValue({ empId: 'EMP-1', role: 'Team Member', team: 'Tech' }) },
    workBreak: { findMany: jest.fn().mockResolvedValue([]) },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  } as unknown as jest.Mocked<PrismaService> & {
    workDuration: { findUnique: jest.Mock; update: jest.Mock };
    user: { findUnique: jest.Mock };
  };
}

function makeService(session: ReturnType<typeof baseSession>) {
  const prisma = makeMockPrisma(session);
  const idUtils = {} as unknown as IdUtilsService;
  const calendar = {} as unknown as CalendarService;
  const workLog = { classifyAndSyncWorkLog: jest.fn().mockResolvedValue(undefined) } as unknown as WorkLogService;
  const service = new WorkDurationService(prisma as unknown as PrismaService, idUtils, calendar, workLog);
  return { service, prisma, workLog, session };
}

describe('WorkDurationService.setDailyStatus (daily check-in popup)', () => {
  it('"not working" from a fresh IDLE session writes 0 hours through the classifier immediately, no clock session started', async () => {
    const { service, prisma, workLog, session } = makeService(baseSession());
    const result = await service.setDailyStatus('EMP-1', { isWorking: false });

    expect(session.isWorking).toBe(false);
    expect(session.workMode).toBeNull();
    expect(session.clockIn).toBeNull(); // no clock-in was triggered
    expect(workLog.classifyAndSyncWorkLog).toHaveBeenCalledWith('EMP-1', TODAY, 0, null);
    expect(result).toBeDefined();
    expect(prisma.workDuration.update).toHaveBeenCalledTimes(1); // only the isWorking write, no clockIn write
  });

  it('"working" + WFO clocks the employee in', async () => {
    const { service, session } = makeService(baseSession());
    await service.setDailyStatus('EMP-1', { isWorking: true, workMode: 'WFO' });

    expect(session.isWorking).toBe(true);
    expect(session.workMode).toBe('WFO');
    expect(session.status).toBe('ACTIVE');
    expect(session.clockIn).toBeInstanceOf(Date);
  });

  it('rejects Yes -> No while ACTIVE ("clock out first")', async () => {
    const { service } = makeService(baseSession({ isWorking: true, workMode: 'WFO', status: 'ACTIVE', clockIn: new Date() }));
    await expect(service.setDailyStatus('EMP-1', { isWorking: false })).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects Yes -> No while ON_BREAK too', async () => {
    const { service } = makeService(baseSession({ isWorking: true, workMode: 'WFH', status: 'ON_BREAK', clockIn: new Date() }));
    await expect(service.setDailyStatus('EMP-1', { isWorking: false })).rejects.toBeInstanceOf(ConflictException);
  });

  it('accepts Yes -> No when IDLE/COMPLETED (no active session to interrupt)', async () => {
    const { service, session } = makeService(baseSession({ isWorking: true, workMode: 'WFO', status: 'COMPLETED', clockIn: new Date(), clockOut: new Date() }));
    await service.setDailyStatus('EMP-1', { isWorking: false });
    expect(session.isWorking).toBe(false);
  });

  it('WFO <-> WFH while already clocked in (ACTIVE) updates the mode only -- never re-clocks-in, never throws', async () => {
    const clockInTime = new Date();
    const { service, prisma, workLog, session } = makeService(
      baseSession({ isWorking: true, workMode: 'WFO', status: 'ACTIVE', clockIn: clockInTime }),
    );
    await expect(service.setDailyStatus('EMP-1', { isWorking: true, workMode: 'WFH' })).resolves.toBeDefined();

    expect(session.workMode).toBe('WFH');
    expect(session.status).toBe('ACTIVE'); // untouched -- no re-clock-in
    expect(session.clockIn).toBe(clockInTime); // untouched
    // No completed clock-out yet -- must NOT reclassify (would wrongly write 0 hours worked).
    expect(workLog.classifyAndSyncWorkLog).not.toHaveBeenCalled();
    expect(prisma.workDuration.update).toHaveBeenCalledTimes(1);
  });

  it('WFO <-> WFH after a completed clock-out DOES reclassify so the -WFO/-WFH suffix updates', async () => {
    const { service, workLog, session } = makeService(
      baseSession({ isWorking: true, workMode: 'WFO', status: 'COMPLETED', clockIn: new Date(), clockOut: new Date(), netMinutes: 540 }),
    );
    await service.setDailyStatus('EMP-1', { isWorking: true, workMode: 'WFH' });

    expect(session.workMode).toBe('WFH');
    expect(session.status).toBe('COMPLETED'); // still not re-triggered
    expect(workLog.classifyAndSyncWorkLog).toHaveBeenCalledWith('EMP-1', TODAY, 540, 'WFH');
  });

  it('rejects when workMode is missing and isWorking is true', async () => {
    const { service } = makeService(baseSession());
    await expect(service.setDailyStatus('EMP-1', { isWorking: true } as never)).rejects.toThrow(/workMode is required/);
  });

  it('rejects when workMode is present and isWorking is false', async () => {
    const { service } = makeService(baseSession());
    await expect(service.setDailyStatus('EMP-1', { isWorking: false, workMode: 'WFO' } as never)).rejects.toThrow(/must not be set/);
  });

  it('is not applicable to Interns', async () => {
    const { service, prisma } = makeService(baseSession());
    prisma.user.findUnique.mockResolvedValue({ empId: 'EMP-1', role: 'Intern', team: 'Tech' });
    await expect(service.setDailyStatus('EMP-1', { isWorking: true, workMode: 'WFO' })).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('WorkDurationService.getDailyStatus', () => {
  it('reports null/null before any answer today', async () => {
    const { service } = makeService(baseSession());
    expect(await service.getDailyStatus('EMP-1')).toEqual({ isWorking: null, workMode: null });
  });
});
