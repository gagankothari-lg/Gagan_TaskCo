import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { PrismaService } from '../prisma/prisma.service';
import { IdUtilsService } from '../common/utils/id.utils';
import { isAdmin, isManager } from '../common/constants';
import { CreateLeaveDto } from './dto/create-leave.dto';
import { ReviewLeaveDto } from './dto/review-leave.dto';
import { CreateHolidayDto } from './dto/create-holiday.dto';

@Injectable()
export class LeavesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly idUtils: IdUtilsService,
    private readonly config: ConfigService,
  ) {}

  async submitLeave(dto: CreateLeaveDto, callerEmpId: string) {
    const start = this.normalize(dto.startDate);
    const end = this.normalize(dto.endDate);
    if (start > end) throw new BadRequestException('Start date must be on or before end date');

    let days: number;
    if (dto.leaveType === 'Half Day') {
      if (start.getTime() !== end.getTime()) {
        throw new BadRequestException('Half Day leave must have the same start and end date');
      }
      days = 0.5;
    } else {
      days = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
    }

    const leaveId = await this.idUtils.generateId('leave', 'leaveId', 'LV');
    await this.prisma.leave.create({
      data: { leaveId, empId: callerEmpId, leaveType: dto.leaveType, startDate: start, endDate: end, days, reason: dto.reason ?? '', status: 'Pending' },
    });
    // Notify the manager — fire-and-forget so it never blocks the response.
    void this.notifyManager(callerEmpId, dto.leaveType, start, end);
    return { leaveId };
  }

  async reviewLeave(leaveId: string, dto: ReviewLeaveDto, callerEmpId: string) {
    const leave = await this.prisma.leave.findUnique({ where: { leaveId } });
    if (!leave) throw new NotFoundException('Leave not found');
    if (leave.empId === callerEmpId) throw new ForbiddenException('You cannot review your own leave');

    const caller = await this.getCaller(callerEmpId);
    if (!isAdmin(caller.role)) {
      const owner = await this.prisma.user.findUnique({ where: { empId: leave.empId }, select: { managerId: true } });
      if (!owner || owner.managerId !== callerEmpId) throw new ForbiddenException();
    }

    await this.prisma.leave.update({
      where: { leaveId },
      data: { status: dto.status, reviewNotes: dto.notes, reviewedBy: callerEmpId },
    });
    if (dto.status === 'Approved') void this.syncLeaveToCalendar(leaveId);
    await this.audit(callerEmpId, 'LEAVE_REVIEW', leaveId, leave.status, dto.status);
    return { ok: true };
  }

  async getMyLeaves(callerEmpId: string) {
    return this.prisma.leave.findMany({ where: { empId: callerEmpId }, orderBy: { createdAt: 'desc' } });
  }

  async getPendingLeaves(callerEmpId: string) {
    const caller = await this.getCaller(callerEmpId);
    if (isAdmin(caller.role)) {
      return this.prisma.leave.findMany({ where: { status: 'Pending' }, orderBy: { createdAt: 'desc' } });
    }
    const reports = await this.prisma.user.findMany({ where: { managerId: callerEmpId }, select: { empId: true } });
    const ids = reports.map((r) => r.empId);
    return this.prisma.leave.findMany({ where: { status: 'Pending', empId: { in: ids } }, orderBy: { createdAt: 'desc' } });
  }

  async getPendingLeaveCount(callerEmpId: string) {
    const caller = await this.getCaller(callerEmpId);
    if (isAdmin(caller.role)) {
      return { count: await this.prisma.leave.count({ where: { status: 'Pending' } }) };
    }
    const reports = await this.prisma.user.findMany({ where: { managerId: callerEmpId }, select: { empId: true } });
    const ids = reports.map((r) => r.empId);
    return { count: await this.prisma.leave.count({ where: { status: 'Pending', empId: { in: ids } } }) };
  }

  async addHoliday(dto: CreateHolidayDto, callerEmpId: string) {
    const caller = await this.getCaller(callerEmpId);
    if (!isAdmin(caller.role)) throw new ForbiddenException();
    const holiday = await this.prisma.holiday.create({ data: { name: dto.name, date: this.normalize(dto.date) } });
    void this.syncHolidayToCalendar(holiday.id);
    await this.audit(callerEmpId, 'HOLIDAY_ADD', holiday.id);
    return holiday;
  }

  async deleteHoliday(id: string, callerEmpId: string) {
    const caller = await this.getCaller(callerEmpId);
    if (!isAdmin(caller.role)) throw new ForbiddenException();
    const holiday = await this.prisma.holiday.findUnique({ where: { id } });
    if (!holiday) throw new NotFoundException('Holiday not found');
    await this.prisma.holiday.delete({ where: { id } });
    await this.audit(callerEmpId, 'HOLIDAY_DELETE', id);
    return { ok: true };
  }

  async getHolidays() {
    return this.prisma.holiday.findMany({ orderBy: { date: 'asc' } });
  }

  async getCalendarData(callerEmpId: string) {
    const [leaves, holidays] = await Promise.all([
      this.prisma.leave.findMany({ where: { empId: callerEmpId }, orderBy: { startDate: 'asc' } }),
      this.prisma.holiday.findMany({ orderBy: { date: 'asc' } }),
    ]);
    // Meetings come from the (not-yet-built) MeetingsModule — empty for now.
    return { leaves, holidays, meetings: [] as unknown[] };
  }

  // ═══════════════════════════════════════════════ helpers
  private async getCaller(empId: string) {
    const caller = await this.prisma.user.findUnique({ where: { empId }, select: { empId: true, role: true } });
    if (!caller) throw new ForbiddenException();
    return caller;
  }

  private normalize(iso: string): Date {
    const d = new Date(iso);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }

  private async notifyManager(empId: string, leaveType: string, start: Date, end: Date) {
    try {
      const key = this.config.get<string>('RESEND_API_KEY');
      if (!key) return;
      const user = await this.prisma.user.findUnique({ where: { empId }, select: { firstName: true, lastName: true, managerId: true } });
      if (!user?.managerId) return;
      const manager = await this.prisma.user.findUnique({ where: { empId: user.managerId }, select: { email: true } });
      if (!manager?.email) return;
      const resend = new Resend(key);
      await resend.emails.send({
        from: 'LG Desk <noreply@leveragedgrowth.in>',
        to: manager.email,
        subject: `Leave request from ${user.firstName} ${user.lastName}`,
        text: `${user.firstName} ${user.lastName} requested ${leaveType} from ${start.toISOString().slice(0, 10)} to ${end.toISOString().slice(0, 10)}. Review it in LG Desk.`,
      });
    } catch {
      // fire-and-forget — never surface notification failures
    }
  }

  // Google Calendar sync stubs (fire-and-forget; integration wired with real creds later).
  private async syncLeaveToCalendar(_leaveId: string) {
    /* no-op until Google Calendar credentials are configured */
  }
  private async syncHolidayToCalendar(_holidayId: string) {
    /* no-op until Google Calendar credentials are configured */
  }

  private async audit(empId: string, action: string, entityId: string, before: string | null = null, after: string | null = null) {
    await this.prisma.auditLog.create({ data: { empId, action, entity: 'Leave', entityId, before, after } });
  }
}
