import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IdUtilsService } from '../common/utils/id.utils';
import { CalendarService } from '../calendar/calendar.service';
import { UsersService } from '../users/users.service';
import { MeetingsService } from '../meetings/meetings.service';
import { EmailService } from '../email/email.service';
import { isAdmin, isManager } from '../common/constants';
import { CreateLeaveDto } from './dto/create-leave.dto';
import { ReviewLeaveDto } from './dto/review-leave.dto';
import { CreateHolidayDto } from './dto/create-holiday.dto';

@Injectable()
export class LeavesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly idUtils: IdUtilsService,
    private readonly calendar: CalendarService,
    private readonly users: UsersService,
    private readonly meetings: MeetingsService,
    private readonly email: EmailService,
  ) {}

  async submitLeave(dto: CreateLeaveDto, callerEmpId: string) {
    const start = this.normalize(dto.startDate);
    const end = this.normalize(dto.endDate);
    if (start > end) throw new BadRequestException('Start date must be on or before end date');

    let days: number;
    if (dto.leaveType === 'Half Day') {
      // Server-side enforcement (Master Reference BR-7 / FR-1): Half Day must be a single
      // day and always books 0.5 days — never trust client-side Zod validation alone.
      if (start.getTime() !== end.getTime()) {
        throw new BadRequestException('Half Day leave must be a single day.');
      }
      days = 0.5;
    } else {
      // Master Reference FR-1: days = round((end-start)/86400000) + 1. start/end are
      // both UTC-midnight-normalized above, so the difference is always an exact
      // multiple of a day — round and floor agree, but round matches the spec text.
      days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
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
    // No idempotency guard previously existed — a manager/admin could silently re-review an
    // already-decided leave and overwrite the prior outcome with no error or warning
    // (PFIX-READY-BATCH-SEQUENTIAL Fix 3, confirmed live in E2E_TEST_LOG.md Round 3).
    if (leave.status !== 'Pending') throw new ForbiddenException('This leave has already been reviewed');

    const caller = await this.getCaller(callerEmpId);
    if (!isAdmin(caller.role)) {
      // Change #48 additive OR: approve if EITHER the target's Manager_ID is the caller
      // (direct report) OR the target shares the caller's flat Team string. Never narrows.
      const owner = await this.prisma.user.findUnique({ where: { empId: leave.empId }, select: { managerId: true, team: true } });
      const isDirectReport = !!owner && owner.managerId === callerEmpId;
      const isSameTeam = !!owner && !!caller.team && owner.team === caller.team;
      if (!isDirectReport && !isSameTeam) throw new ForbiddenException();
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

  // Master Reference leaves.gs `cancelLeaveRequest(email, leaveId)` — own pending leave only.
  async cancelLeave(leaveId: string, callerEmpId: string) {
    const leave = await this.prisma.leave.findUnique({ where: { leaveId } });
    if (!leave) throw new NotFoundException('Leave not found');
    if (leave.empId !== callerEmpId) throw new ForbiddenException();
    if (leave.status !== 'Pending') throw new BadRequestException('Only pending leave requests can be cancelled.');

    await this.prisma.leave.update({ where: { leaveId }, data: { status: 'Cancelled' } });
    await this.audit(callerEmpId, 'LEAVE_CANCEL', leaveId, leave.status, 'Cancelled');
    return { ok: true };
  }

  async getPendingLeaves(callerEmpId: string) {
    const caller = await this.getCaller(callerEmpId);
    if (isAdmin(caller.role)) {
      return this.prisma.leave.findMany({ where: { status: 'Pending' }, orderBy: { createdAt: 'desc' } });
    }
    const ids = await this.getApprovableEmpIds(caller);
    return this.prisma.leave.findMany({ where: { status: 'Pending', empId: { in: ids } }, orderBy: { createdAt: 'desc' } });
  }

  async getPendingLeaveCount(callerEmpId: string) {
    const caller = await this.getCaller(callerEmpId);
    if (isAdmin(caller.role)) {
      return { count: await this.prisma.leave.count({ where: { status: 'Pending' } }) };
    }
    const ids = await this.getApprovableEmpIds(caller);
    return { count: await this.prisma.leave.count({ where: { status: 'Pending', empId: { in: ids } } }) };
  }

  async addHoliday(dto: CreateHolidayDto, callerEmpId: string) {
    const caller = await this.getCaller(callerEmpId);
    if (!isAdmin(caller.role)) throw new ForbiddenException();
    // Round4 checklist#6: description is optional -- reference has it, rebuild didn't.
    const holiday = await this.prisma.holiday.create({ data: { name: dto.name, date: this.normalize(dto.date), description: dto.description } });
    void this.syncHolidayToCalendar(holiday.id);
    await this.audit(callerEmpId, 'HOLIDAY_ADD', holiday.id);
    return holiday;
  }

  async deleteHoliday(id: string, callerEmpId: string) {
    const caller = await this.getCaller(callerEmpId);
    if (!isAdmin(caller.role)) throw new ForbiddenException();
    const holiday = await this.prisma.holiday.findUnique({ where: { id } });
    if (!holiday) throw new NotFoundException('Holiday not found');
    void this.calendar.deleteHolidayEvent(id);
    await this.prisma.holiday.delete({ where: { id } });
    await this.audit(callerEmpId, 'HOLIDAY_DELETE', id);
    return { ok: true };
  }

  async getHolidays() {
    return this.prisma.holiday.findMany({ orderBy: { date: 'asc' } });
  }

  // Master Reference Part 20 BR-1: Admin = all approved leaves; Manager = subordinates +
  // self; Member = own only. Only APPROVED leaves render on the calendar (Event Types
  // table — Task/Project/Holiday/Meeting are unconditional, but "Approved leave" is the
  // only leave state that gets a calendar chip).
  async getCalendarData(callerEmpId: string) {
    const caller = await this.getCaller(callerEmpId);
    let empScope: string[] | null = null; // null = no filter (Admin/SA sees all)
    if (!isAdmin(caller.role)) {
      if (isManager(caller.role)) {
        const subs = await this.users.getSubordinateIds(caller.empId);
        empScope = [caller.empId, ...subs];
      } else {
        empScope = [caller.empId];
      }
    }

    const leaveWhere: Record<string, unknown> = { status: 'Approved' };
    if (empScope) leaveWhere.empId = { in: empScope };

    const [leaves, holidays, meetings] = await Promise.all([
      this.prisma.leave.findMany({ where: leaveWhere, orderBy: { startDate: 'asc' } }),
      this.prisma.holiday.findMany({ orderBy: { date: 'asc' } }),
      this.meetings.getMeetings(callerEmpId),
    ]);
    return { leaves, holidays, meetings };
  }

  // ═══════════════════════════════════════════════ helpers
  private async getCaller(empId: string) {
    const caller = await this.prisma.user.findUnique({ where: { empId }, select: { empId: true, role: true, team: true } });
    if (!caller) throw new ForbiddenException();
    return caller;
  }

  // Change #48: the set of employees whose leaves a TC/TF may approve — additive OR of
  // direct reports (managerId === self) and same flat-Team members. Used identically by
  // getPendingLeaves and getPendingLeaveCount so the badge and the list always match (BR-5).
  private async getApprovableEmpIds(caller: { empId: string; team: string | null }): Promise<string[]> {
    const or: Array<{ managerId: string } | { team: string }> = [{ managerId: caller.empId }];
    if (caller.team) or.push({ team: caller.team });
    const users = await this.prisma.user.findMany({ where: { OR: or }, select: { empId: true } });
    return users.map((u) => u.empId);
  }

  private normalize(iso: string): Date {
    const d = new Date(iso);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }

  // Round4 S5: was a standalone `new Resend(key)` client with a hardcoded `.in` sender
  // domain (every other sender in the codebase uses the configurable FROM_EMAIL, `.co`)
  // and no error-field check on the send result. Now routes through the shared
  // EmailService the same way every other notification path does (see
  // meetings.service.ts's notifyMeetingScheduled for the identical try/catch shape).
  private async notifyManager(empId: string, leaveType: string, start: Date, end: Date) {
    try {
      const user = await this.prisma.user.findUnique({ where: { empId }, select: { firstName: true, lastName: true, managerId: true } });
      if (!user?.managerId) return;
      const manager = await this.prisma.user.findUnique({ where: { empId: user.managerId }, select: { email: true, firstName: true, lastName: true } });
      if (!manager?.email) return;
      await this.email.sendLeaveSubmitted({
        managerEmail: manager.email,
        managerName: `${manager.firstName} ${manager.lastName}`,
        applicantName: `${user.firstName} ${user.lastName}`,
        leaveType,
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10),
      });
    } catch {
      // Notification is best-effort — never affects leave submission itself.
    }
  }

  private async syncLeaveToCalendar(leaveId: string) {
    await this.calendar.syncLeave(leaveId);
  }

  private async syncHolidayToCalendar(holidayId: string) {
    await this.calendar.syncHoliday(holidayId);
  }

  private async audit(empId: string, action: string, entityId: string, before: string | null = null, after: string | null = null) {
    await this.prisma.auditLog.create({ data: { empId, action, entity: 'Leave', entityId, before, after } });
  }
}
