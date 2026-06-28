import {
  Injectable,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { IdUtilsService } from '../common/utils/id.utils';
import { isAdmin, isManager } from '../common/constants';
import { ClockOutDto } from './dto/clock-out.dto';
import { EditTimeDto } from './dto/edit-time.dto';
import { EditBreakDto } from './dto/edit-break.dto';

type SessionRow = {
  id: string; sessionId: string; empId: string; date: Date; clockIn: Date | null; clockOut: Date | null;
  totalBreakMins: number; grossMinutes: number; netMinutes: number; status: string; autoClocked: boolean;
  notes: string | null;
};

const STATUS_ORDER: Record<string, number> = { ACTIVE: 0, ON_BREAK: 1, COMPLETED: 2, AUTO_CLOSED: 3, IDLE: 4 };

@Injectable()
export class WorkDurationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly idUtils: IdUtilsService,
  ) {}

  // ─────────────────────────────────────────────── clock actions
  async clockIn(empId: string) {
    const s = await this.getOrCreateTodaySession(empId);
    if (s.status === 'ACTIVE') throw new ConflictException('Already clocked in');
    await this.prisma.workDuration.update({ where: { id: s.id }, data: { clockIn: new Date(), status: 'ACTIVE' } });
    await this.audit(empId, 'CLOCK_IN', s.sessionId);
    return this.getStatus(empId);
  }

  async startBreak(empId: string) {
    const s = await this.getOrCreateTodaySession(empId);
    if (s.status !== 'ACTIVE') throw new ConflictException('Not clocked in or already on break');
    await this.prisma.workDuration.update({ where: { id: s.id }, data: { status: 'ON_BREAK' } });
    await this.prisma.workBreak.create({ data: { sessionId: s.sessionId, breakStart: new Date() } });
    await this.audit(empId, 'BREAK_START', s.sessionId);
    return this.getStatus(empId);
  }

  async endBreak(empId: string) {
    const s = await this.getOrCreateTodaySession(empId);
    if (s.status !== 'ON_BREAK') throw new ConflictException('Not on break');
    const open = await this.prisma.workBreak.findFirst({ where: { sessionId: s.sessionId, breakEnd: null }, orderBy: { breakStart: 'desc' } });
    if (open) {
      const now = new Date();
      const mins = Math.ceil((now.getTime() - open.breakStart.getTime()) / 60000);
      await this.prisma.workBreak.update({ where: { id: open.id }, data: { breakEnd: now, durationMins: mins } });
      // CUMULATIVE: add to totalBreakMins, never replace (rule #10).
      await this.prisma.workDuration.update({ where: { id: s.id }, data: { status: 'ACTIVE', totalBreakMins: s.totalBreakMins + mins } });
    } else {
      await this.prisma.workDuration.update({ where: { id: s.id }, data: { status: 'ACTIVE' } });
    }
    await this.audit(empId, 'BREAK_END', s.sessionId);
    return this.getStatus(empId);
  }

  async clockOut(empId: string, dto?: ClockOutDto) {
    const s = await this.getOrCreateTodaySession(empId);
    if (s.status === 'ON_BREAK') throw new ConflictException('End break before clocking out');
    if (s.status !== 'ACTIVE' || !s.clockIn) throw new ConflictException('Not clocked in');

    let clockOut: Date;
    if (dto?.customTime) {
      clockOut = this.applyTime(s.clockIn, dto.customTime);
      if (clockOut <= s.clockIn) throw new BadRequestException('Clock-out time must be after clock-in');
    } else {
      clockOut = new Date();
    }
    const grossMinutes = Math.floor((clockOut.getTime() - s.clockIn.getTime()) / 60000);
    const netMinutes = Math.max(0, grossMinutes - s.totalBreakMins);
    const notes = dto?.reason ? this.appendNote(s.notes, `Clock-out reason [${new Date().toISOString()}]: ${dto.reason}`) : s.notes;

    await this.prisma.workDuration.update({ where: { id: s.id }, data: { clockOut, status: 'COMPLETED', grossMinutes, netMinutes, notes } });
    await this.syncWorkLog(empId, s.date, netMinutes);
    await this.audit(empId, 'CLOCK_OUT', s.sessionId);
    return this.getStatus(empId);
  }

  async getStatus(empId: string) {
    const s = await this.getOrCreateTodaySession(empId);
    const breaks = await this.prisma.workBreak.findMany({ where: { sessionId: s.sessionId }, orderBy: { breakStart: 'asc' } });
    const sumBreaks = breaks.reduce((a, b) => a + (b.durationMins ?? 0), 0);
    const totalBreakMins = Math.max(sumBreaks, s.totalBreakMins);
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 14);
    const history = await this.prisma.workDuration.findMany({ where: { empId, date: { gte: this.dateOnly(since) } }, orderBy: { date: 'desc' } });
    return { status: s.status, session: s, breaks, totalBreakMins, history };
  }

  // ─────────────────────────────────────────────── manual edits
  async editTime(empId: string, dto: EditTimeDto) {
    const s = await this.getOrCreateTodaySession(empId);
    const base = s.clockIn ?? s.date;
    const newClockIn = this.applyTime(base, dto.startTime);

    const data: Record<string, unknown> = { clockIn: newClockIn };
    if (dto.breakMins !== undefined) data.totalBreakMins = dto.breakMins; // manual direct set
    let newClockOut = s.clockOut;
    if (s.clockOut && dto.endTime) {
      newClockOut = this.applyTime(s.clockOut, dto.endTime);
      data.clockOut = newClockOut;
    }
    let net = s.netMinutes;
    if (newClockOut) {
      const gross = Math.floor((newClockOut.getTime() - newClockIn.getTime()) / 60000);
      net = Math.max(0, gross - (dto.breakMins ?? s.totalBreakMins));
      data.grossMinutes = gross;
      data.netMinutes = net;
    }
    data.notes = this.appendNote(s.notes, `Time edited [${new Date().toISOString()}] by ${empId}: start=${dto.startTime} end=${dto.endTime ?? '-'} break=${dto.breakMins ?? '-'} reason=${dto.reason}`);

    await this.prisma.workDuration.update({ where: { id: s.id }, data });
    if (newClockOut) await this.syncWorkLog(empId, s.date, net);
    await this.audit(empId, 'EDIT_TIME', s.sessionId);
    return this.getStatus(empId);
  }

  async editBreak(empId: string, dto: EditBreakDto) {
    const s = await this.getOrCreateTodaySession(empId);
    const data: Record<string, unknown> = { totalBreakMins: dto.breakMins };
    let net = s.netMinutes;
    if (s.clockIn && s.clockOut) {
      const gross = Math.floor((s.clockOut.getTime() - s.clockIn.getTime()) / 60000);
      net = Math.max(0, gross - dto.breakMins);
      data.grossMinutes = gross;
      data.netMinutes = net;
    }
    data.notes = this.appendNote(s.notes, `Break edited [${new Date().toISOString()}] by ${empId}: break=${dto.breakMins}`);
    await this.prisma.workDuration.update({ where: { id: s.id }, data });
    if (s.clockOut) await this.syncWorkLog(empId, s.date, net);
    await this.audit(empId, 'EDIT_BREAK', s.sessionId);
    return { totalBreakMins: dto.breakMins, netMinutes: net };
  }

  // ─────────────────────────────────────────────── ranges / team
  async getWorkDurationsForRange(empId: string, start: string, end: string): Promise<Record<string, string>> {
    const sessions = await this.prisma.workDuration.findMany({ where: { empId, date: { gte: this.normalize(start), lte: this.normalize(end) } } });
    const out: Record<string, string> = {};
    for (const s of sessions) out[this.isoDate(s.date)] = this.toHMS(s.netMinutes);
    return out;
  }

  async getTeamWorkDurationsRange(callerEmpId: string, start: string, end: string): Promise<Record<string, string>> {
    const caller = await this.requireManager(callerEmpId);
    const where: { date: { gte: Date; lte: Date }; empId?: { in: string[] } } = { date: { gte: this.normalize(start), lte: this.normalize(end) } };
    if (!isAdmin(caller.role)) {
      const members = await this.prisma.user.findMany({ where: { team: caller.team }, select: { empId: true } });
      where.empId = { in: members.map((m) => m.empId) };
    }
    const sessions = await this.prisma.workDuration.findMany({ where });
    const out: Record<string, string> = {};
    for (const s of sessions) out[`${s.empId}:${this.isoDate(s.date)}`] = this.toHMS(s.netMinutes);
    return out;
  }

  async getTeamClockStatus(callerEmpId: string) {
    const caller = await this.requireManager(callerEmpId);
    const members = await this.prisma.user.findMany({
      where: isAdmin(caller.role) ? { isActive: true } : { team: caller.team, isActive: true },
      select: { empId: true, firstName: true, lastName: true },
    });
    const today = this.todayUtc();
    const result = [];
    for (const m of members) {
      const s = await this.prisma.workDuration.findFirst({ where: { empId: m.empId, date: today } });
      result.push({
        empId: m.empId,
        name: `${m.firstName} ${m.lastName}`,
        status: s?.status ?? 'IDLE',
        clockInTs: s?.clockIn ? s.clockIn.toISOString() : null,
        totalBreakMins: s?.totalBreakMins ?? 0,
        netWorkMins: s?.netMinutes ?? 0,
      });
    }
    result.sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9));
    return result;
  }

  async syncWorkDurationsToWorkLog(callerEmpId: string) {
    const caller = await this.getCaller(callerEmpId);
    if (!isAdmin(caller.role)) throw new ForbiddenException();
    const sessions = await this.prisma.workDuration.findMany({ where: { netMinutes: { gt: 0 } } });
    for (const s of sessions) await this.syncWorkLog(s.empId, s.date, s.netMinutes);
    return { synced: sessions.length };
  }

  // ─────────────────────────────────────────────── cron (hourly daily-boundary check)
  @Cron('0 * * * *')
  async autoClockOut() {
    const midnight = this.todayUtc(); // 00:00 UTC = 05:30 IST
    const sessions = await this.prisma.workDuration.findMany({
      where: { status: { in: ['ACTIVE', 'ON_BREAK'] }, clockIn: { lt: midnight } },
    });
    for (const s of sessions) {
      if (!s.clockIn) continue;
      const gross = Math.floor((midnight.getTime() - s.clockIn.getTime()) / 60000);
      const net = Math.max(0, gross - s.totalBreakMins);
      await this.prisma.workDuration.update({ where: { id: s.id }, data: { clockOut: midnight, status: 'AUTO_CLOSED', grossMinutes: gross, netMinutes: net, autoClocked: true } });
      await this.syncWorkLog(s.empId, s.date, net);
      await this.audit(s.empId, 'AUTO_CLOSE', s.sessionId);
    }
  }

  // ═══════════════════════════════════════════════ helpers
  private async getOrCreateTodaySession(empId: string): Promise<SessionRow> {
    const date = this.todayUtc();
    const existing = await this.prisma.workDuration.findUnique({ where: { empId_date: { empId, date } } });
    if (existing) return existing;
    const sessionId = await this.idUtils.generateId('workDuration', 'sessionId', 'WD');
    return this.prisma.workDuration.create({ data: { sessionId, empId, date, status: 'IDLE', totalBreakMins: 0 } });
  }

  private async getCaller(empId: string) {
    const caller = await this.prisma.user.findUnique({ where: { empId }, select: { empId: true, role: true, team: true } });
    if (!caller) throw new ForbiddenException();
    return caller;
  }

  private async requireManager(empId: string) {
    const caller = await this.getCaller(empId);
    if (!isManager(caller.role)) throw new ForbiddenException();
    return caller;
  }

  // Sync net minutes into the day's WorkLog row (no-op if no row exists).
  private async syncWorkLog(empId: string, date: Date, netMinutes: number) {
    await this.prisma.workLog.updateMany({ where: { empId, date }, data: { workDuration: netMinutes } });
  }

  private appendNote(notes: string | null, line: string): string {
    return notes ? `${notes}\n${line}` : line;
  }

  // Keep the date of `base`, set its UTC time to HH:MM.
  private applyTime(base: Date, hhmm: string): Date {
    const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10));
    const d = new Date(base);
    d.setUTCHours(Number.isNaN(h) ? 0 : h, Number.isNaN(m) ? 0 : m, 0, 0);
    return d;
  }

  private todayUtc(): Date {
    const n = new Date();
    return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
  }

  private dateOnly(d: Date): Date {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }

  private normalize(iso: string): Date {
    const d = new Date(iso);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }

  private isoDate(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  private toHMS(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = Math.floor(minutes % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
  }

  private async audit(empId: string, action: string, entityId: string) {
    await this.prisma.auditLog.create({ data: { empId, action, entity: 'WorkDuration', entityId } });
  }
}
