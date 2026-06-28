import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IdUtilsService } from '../common/utils/id.utils';
import { isAdmin, isManager } from '../common/constants';
import { CreateWorkLogDto } from './dto/create-work-log.dto';
import { UpdateWorkLogDto } from './dto/update-work-log.dto';
import { CreateInternLogDto } from './dto/create-intern-log.dto';
import { AdminCreateLogDto } from './dto/admin-create-log.dto';

// Intern attendance strings that count as an off/leave day.
const INTERN_OFF_PATTERNS = /^\s*(holiday|leave|week.?off|off|absent|half.?day|sick|vacation|alt.?week)\s*$/i;

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

type Caller = { empId: string; role: string; team: string | null };

@Injectable()
export class WorkLogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly idUtils: IdUtilsService,
  ) {}

  // ─────────────────────────────────────────────── submit / update
  async submitWorkLog(dto: CreateWorkLogDto, callerEmpId: string) {
    const caller = await this.getCaller(callerEmpId);
    if (caller.role === 'Intern') {
      return this.saveInternWorkLog(
        { date: dto.date, attendance: dto.attendance, work1stHalf: dto.work1stHalf, work2ndHalf: dto.work2ndHalf, extraHours: dto.extraHours, remark: dto.remark },
        callerEmpId,
      );
    }

    const date = this.normalizeDate(dto.date);
    const manager = isManager(caller.role);
    const future = date > this.startOfTodayUtc();

    let status = manager ? dto.status : undefined;
    if (future && !status) status = 'Tentative';

    const data = {
      month: this.monthOf(date),
      dayName: this.dayNameOf(date),
      attendance: dto.attendance ?? 'Present',
      purpose: dto.purpose,
      leaveRequested: dto.leaveRequested,
      work1stHalf: dto.work1stHalf,
      work2ndHalf: dto.work2ndHalf,
      extraHours: dto.extraHours ?? 0,
      remark: dto.remark,
      status,
      comments: manager ? dto.comments : undefined,
    };

    const logId = await this.idUtils.generateId('workLog', 'logId', 'WL');
    const log = await this.prisma.workLog.upsert({
      where: { empId_date: { empId: callerEmpId, date } },
      create: { logId, empId: callerEmpId, date, ...data },
      update: data,
    });
    await this.audit(callerEmpId, 'WORKLOG_SUBMIT', log.logId);
    return { logId: log.logId };
  }

  async saveInternWorkLog(dto: CreateInternLogDto, callerEmpId: string) {
    const caller = await this.getCaller(callerEmpId);
    if (caller.role !== 'Intern') throw new ForbiddenException('Only interns use the intern work log');

    const date = this.normalizeDate(dto.date);
    const data = {
      month: this.monthOf(date),
      dayName: this.dayNameOf(date),
      attendance: dto.attendance ?? 'Present',
      work1stHalf: dto.work1stHalf,
      work2ndHalf: dto.work2ndHalf,
      extraHours: dto.extraHours ?? 0,
      remark: dto.remark,
    };
    const logId = await this.idUtils.generateId('internWorkLog', 'logId', 'IWL');
    const log = await this.prisma.internWorkLog.upsert({
      where: { empId_date: { empId: callerEmpId, date } },
      create: { logId, empId: callerEmpId, date, ...data },
      update: data,
    });
    return { logId: log.logId };
  }

  async updateWorkLog(logId: string, dto: UpdateWorkLogDto, callerEmpId: string) {
    const caller = await this.getCaller(callerEmpId);
    const log = await this.prisma.workLog.findUnique({ where: { logId } });
    if (!log) throw new NotFoundException('Work log not found');
    const manager = isManager(caller.role);
    if (log.empId !== callerEmpId && !manager) throw new ForbiddenException();

    const data: Record<string, unknown> = {};
    if (dto.date !== undefined) {
      const d = this.normalizeDate(dto.date);
      data.date = d;
      data.month = this.monthOf(d);
      data.dayName = this.dayNameOf(d);
    }
    if (dto.attendance !== undefined) data.attendance = dto.attendance;
    if (dto.purpose !== undefined) data.purpose = dto.purpose;
    if (dto.leaveRequested !== undefined) data.leaveRequested = dto.leaveRequested;
    if (dto.work1stHalf !== undefined) data.work1stHalf = dto.work1stHalf;
    if (dto.work2ndHalf !== undefined) data.work2ndHalf = dto.work2ndHalf;
    if (dto.extraHours !== undefined) data.extraHours = dto.extraHours;
    if (dto.remark !== undefined) data.remark = dto.remark;
    // status/comments are manager-only.
    if (manager && dto.status !== undefined) data.status = dto.status;
    if (manager && dto.comments !== undefined) data.comments = dto.comments;

    const updated = await this.prisma.workLog.update({ where: { logId }, data });
    await this.audit(callerEmpId, 'WORKLOG_UPDATE', logId);
    return { logId: updated.logId };
  }

  // ─────────────────────────────────────────────── manager status/comment
  async setWorkLogStatus(empId: string, date: string, status: string, callerEmpId: string) {
    await this.requireManager(callerEmpId);
    const d = this.normalizeDate(date);
    const log = await this.prisma.workLog.findUnique({ where: { empId_date: { empId, date: d } } });
    if (!log) throw new NotFoundException('Work log not found');
    await this.prisma.workLog.update({ where: { id: log.id }, data: { status } });
    await this.audit(callerEmpId, 'WORKLOG_STATUS', log.logId, null, status);
    return { ok: true };
  }

  async setWorkLogComment(empId: string, date: string, comment: string, callerEmpId: string) {
    await this.requireManager(callerEmpId);
    const d = this.normalizeDate(date);
    const log = await this.prisma.workLog.findUnique({ where: { empId_date: { empId, date: d } } });
    if (!log) throw new NotFoundException('Work log not found');
    await this.prisma.workLog.update({ where: { id: log.id }, data: { comments: comment } });
    await this.audit(callerEmpId, 'WORKLOG_COMMENT', log.logId);
    return { ok: true };
  }

  // ─────────────────────────────────────────────── reads
  async getMyWorkLogs(callerEmpId: string, start?: string, end?: string) {
    const caller = await this.getCaller(callerEmpId);
    const where = { empId: callerEmpId, ...this.dateRange(start, end) };
    if (caller.role === 'Intern') {
      return this.prisma.internWorkLog.findMany({ where, orderBy: { date: 'desc' } });
    }
    return this.prisma.workLog.findMany({ where, orderBy: { date: 'desc' } });
  }

  async getMemberWorkLogs(targetEmpId: string, callerEmpId: string, start?: string, end?: string) {
    const caller = await this.requireManager(callerEmpId);
    const target = await this.prisma.user.findUnique({ where: { empId: targetEmpId }, select: { role: true, team: true } });
    if (!target) throw new NotFoundException('Employee not found');
    if (!isAdmin(caller.role) && target.team !== caller.team) throw new ForbiddenException();

    const where = { empId: targetEmpId, ...this.dateRange(start, end) };
    if (target.role === 'Intern') return this.prisma.internWorkLog.findMany({ where, orderBy: { date: 'desc' } });
    return this.prisma.workLog.findMany({ where, orderBy: { date: 'desc' } });
  }

  async getTeamWorkLogs(callerEmpId: string, start?: string, end?: string) {
    const caller = await this.requireManager(callerEmpId);
    let empIds: string[] | undefined;
    if (!isAdmin(caller.role)) {
      const members = await this.prisma.user.findMany({ where: { team: caller.team }, select: { empId: true } });
      empIds = members.map((m) => m.empId);
    }
    const where = { ...(empIds ? { empId: { in: empIds } } : {}), ...this.dateRange(start, end) };
    const [logs, holidays] = await Promise.all([
      this.prisma.workLog.findMany({ where, orderBy: { date: 'desc' } }),
      this.prisma.holiday.findMany({ where: this.dateRange(start, end), orderBy: { date: 'asc' } }),
    ]);
    return { logs, holidays };
  }

  async getWeekSummary(callerEmpId: string, start: string, end: string) {
    const caller = await this.getCaller(callerEmpId);
    const where = { empId: callerEmpId, ...this.dateRange(start, end) };
    const logs =
      caller.role === 'Intern'
        ? await this.prisma.internWorkLog.findMany({ where })
        : await this.prisma.workLog.findMany({ where });

    const sum = { present: 0, leaveFullDay: 0, leaveHalfDay: 0, extraFull: 0, extraHalf: 0, holiday: 0, weekOff: 0, altWeekOff: 0, totalOtHours: 0 };
    for (const l of logs) {
      this.classify(l.attendance, sum);
      sum.totalOtHours += l.extraHours ?? 0;
    }
    return sum;
  }

  async adminSubmitWorkLog(dto: AdminCreateLogDto, callerEmpId: string) {
    const caller = await this.requireManager(callerEmpId);
    const target = await this.prisma.user.findUnique({ where: { empId: dto.targetEmpId }, select: { role: true, team: true } });
    if (!target) throw new NotFoundException('Employee not found');
    if (!isAdmin(caller.role) && target.team !== caller.team) throw new ForbiddenException();

    const date = this.normalizeDate(dto.date);
    if (target.role === 'Intern') {
      const data = { month: this.monthOf(date), dayName: this.dayNameOf(date), attendance: dto.attendance ?? 'Present', work1stHalf: dto.work1stHalf, work2ndHalf: dto.work2ndHalf, extraHours: dto.extraHours ?? 0, remark: dto.remark };
      const logId = await this.idUtils.generateId('internWorkLog', 'logId', 'IWL');
      const log = await this.prisma.internWorkLog.upsert({
        where: { empId_date: { empId: dto.targetEmpId, date } },
        create: { logId, empId: dto.targetEmpId, date, ...data },
        update: data,
      });
      await this.audit(callerEmpId, 'WORKLOG_ADMIN', log.logId);
      return { logId: log.logId };
    }

    const data = {
      month: this.monthOf(date), dayName: this.dayNameOf(date), attendance: dto.attendance ?? 'Present',
      purpose: dto.purpose, leaveRequested: dto.leaveRequested, work1stHalf: dto.work1stHalf, work2ndHalf: dto.work2ndHalf,
      extraHours: dto.extraHours ?? 0, remark: dto.remark, status: dto.status, comments: dto.comments,
    };
    const logId = await this.idUtils.generateId('workLog', 'logId', 'WL');
    const log = await this.prisma.workLog.upsert({
      where: { empId_date: { empId: dto.targetEmpId, date } },
      create: { logId, empId: dto.targetEmpId, date, ...data },
      update: data,
    });
    await this.audit(callerEmpId, 'WORKLOG_ADMIN', log.logId);
    return { logId: log.logId };
  }

  async getTeamWorkLogOverview(callerEmpId: string, month: string) {
    const caller = await this.requireManager(callerEmpId);
    const members = await this.prisma.user.findMany({
      where: isAdmin(caller.role) ? { isActive: true } : { team: caller.team, isActive: true },
      select: { empId: true, firstName: true, lastName: true, role: true },
    });

    const out = [];
    for (const m of members) {
      const logs =
        m.role === 'Intern'
          ? await this.prisma.internWorkLog.findMany({ where: { empId: m.empId, month } })
          : await this.prisma.workLog.findMany({ where: { empId: m.empId, month } });
      const c = { present: 0, leaveFullDay: 0, leaveHalfDay: 0, extraFull: 0, extraHalf: 0, holiday: 0, weekOff: 0, altWeekOff: 0, totalOtHours: 0 };
      for (const l of logs) {
        this.classify(l.attendance, c);
        c.totalOtHours += l.extraHours ?? 0;
      }
      const otHours = c.totalOtHours + c.extraFull * 9 + c.extraHalf * 4;
      out.push({ empId: m.empId, name: `${m.firstName} ${m.lastName}`, P: c.present, LF: c.leaveFullDay, LH: c.leaveHalfDay, H: c.holiday, W: c.weekOff, AW: c.altWeekOff, EF: c.extraFull, EH: c.extraHalf, otHours });
    }
    return out;
  }

  // ═══════════════════════════════════════════════ helpers
  private async getCaller(empId: string): Promise<Caller> {
    const caller = await this.prisma.user.findUnique({ where: { empId }, select: { empId: true, role: true, team: true } });
    if (!caller) throw new ForbiddenException();
    return caller;
  }

  private async requireManager(empId: string): Promise<Caller> {
    const caller = await this.getCaller(empId);
    if (!isManager(caller.role)) throw new ForbiddenException();
    return caller;
  }

  private normalizeDate(iso: string): Date {
    const d = new Date(iso);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }

  private startOfTodayUtc(): Date {
    const n = new Date();
    return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
  }

  private monthOf(date: Date): string {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  private dayNameOf(date: Date): string {
    return DAY_NAMES[date.getUTCDay()];
  }

  private dateRange(start?: string, end?: string): { date?: { gte?: Date; lte?: Date } } {
    const f: { gte?: Date; lte?: Date } = {};
    if (start) f.gte = this.normalizeDate(start);
    if (end) f.lte = this.normalizeDate(end);
    return Object.keys(f).length ? { date: f } : {};
  }

  private classify(attendance: string | null, sum: { present: number; leaveFullDay: number; leaveHalfDay: number; extraFull: number; extraHalf: number; holiday: number; weekOff: number; altWeekOff: number }) {
    const a = (attendance ?? '').toLowerCase();
    if (a.includes('extra') && a.includes('full')) sum.extraFull++;
    else if (a.includes('extra') && a.includes('half')) sum.extraHalf++;
    else if (a.includes('alt') && a.includes('week')) sum.altWeekOff++;
    else if (a.includes('week') && a.includes('off')) sum.weekOff++;
    else if (a.includes('holiday')) sum.holiday++;
    else if (a.includes('half')) sum.leaveHalfDay++;
    else if (a.includes('leave') || a.includes('absent') || INTERN_OFF_PATTERNS.test(a)) sum.leaveFullDay++;
    else sum.present++;
  }

  private async audit(empId: string, action: string, entityId: string, before: string | null = null, after: string | null = null) {
    await this.prisma.auditLog.create({ data: { empId, action, entity: 'WorkLog', entityId, before, after } });
  }
}
