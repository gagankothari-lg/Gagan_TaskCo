import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from '../tasks/tasks.service';
import { MeetingsService } from '../meetings/meetings.service';
import { isAdmin, isManager, parseIds, isDone, isInProgress, isClosed, calcScore } from '../common/constants';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';

type Caller = { empId: string; role: string; team: string | null };
type Emp = { empId: string; firstName: string; lastName: string; role: string; team: string | null; dob: Date | null };

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasks: TasksService,
    private readonly meetings: MeetingsService,
  ) {}

  async getDashboardExtras(callerEmpId: string) {
    const caller = await this.getCaller(callerEmpId);
    // Read employees exactly ONCE and share across sub-calls (perf requirement).
    const employees = await this.prisma.user.findMany({
      where: { isActive: true },
      select: { empId: true, firstName: true, lastName: true, role: true, team: true, dob: true },
    });

    const [notices, onLeaveToday, scoreboard, upcomingTasks] = await Promise.all([
      this.getNotices(caller, employees),
      this.getOnLeaveToday(employees),
      this.getScoreboard(caller, employees),
      this.getUpcomingTasks(callerEmpId),
    ]);
    return { notices, onLeaveToday, scoreboard, upcomingTasks };
  }

  async getNotices(caller: Caller, employees: Emp[]) {
    const today = this.todayUtc();
    const nameOf = (empId: string) => {
      const e = employees.find((x) => x.empId === empId);
      return e ? `${e.firstName} ${e.lastName}` : empId;
    };

    // 1. Announcements within their window + visible to this role.
    const allAnn = await this.prisma.announcement.findMany({ orderBy: { createdAt: 'desc' } });
    const announcements = allAnn
      .filter((a) => (!a.startDate || a.startDate <= today) && (!a.expiresAt || a.expiresAt >= today))
      .filter((a) => this.visibleTo(a.visibility, caller.role))
      .map((a) => ({ id: a.id, title: a.title, content: a.content, startDate: a.startDate?.toISOString() ?? null, expiresAt: a.expiresAt?.toISOString() ?? null }));

    // 2. Birthdays today.
    const birthdays = employees
      .filter((e) => e.dob && e.dob.getUTCMonth() === today.getUTCMonth() && e.dob.getUTCDate() === today.getUTCDate())
      .map((e) => ({ empId: e.empId, name: `${e.firstName} ${e.lastName}` }));

    // 3. On leave today (approved).
    const onLeave = await this.getOnLeaveToday(employees);

    // 4. Upcoming meetings in the next 7 days.
    const weekAhead = new Date(today);
    weekAhead.setUTCDate(weekAhead.getUTCDate() + 7);
    const upcoming = await this.meetings.getUpcomingMeetings(caller.empId);
    const meetings = upcoming
      .filter((m) => new Date(m.startTime) <= weekAhead)
      .map((m) => ({ meetingId: m.meetingId, title: m.title, startTime: m.startTime }));

    void nameOf;
    return { announcements, birthdays, onLeave, meetings, forms: [] as unknown[] };
  }

  async getOnLeaveToday(employees: Emp[]) {
    const today = this.todayUtc();
    const leaves = await this.prisma.leave.findMany({
      where: { status: 'Approved', startDate: { lte: today }, endDate: { gte: today } },
    });
    return leaves.map((l) => {
      const e = employees.find((x) => x.empId === l.empId);
      return { empId: l.empId, name: e ? `${e.firstName} ${e.lastName}` : l.empId, leaveType: l.leaveType };
    });
  }

  async getScoreboard(caller: Caller, employees: Emp[]) {
    let scope: Emp[];
    if (isAdmin(caller.role)) scope = employees;
    else if (isManager(caller.role)) scope = employees.filter((e) => e.team && e.team === caller.team);
    else scope = employees.filter((e) => e.empId === caller.empId);

    const tasks = await this.prisma.task.findMany();
    const today = this.todayUtc();

    const rows = scope.map((e) => {
      const mine = tasks.filter((t) => parseIds(t.assigneeIds).includes(e.empId));
      let done = 0;
      let inProg = 0;
      let overdue = 0;
      for (const t of mine) {
        if (isDone(t.status)) done++;
        if (isInProgress(t.status)) inProg++;
        if (t.dueDate && !isClosed(t.status) && t.dueDate < today) overdue++;
      }
      return { empId: e.empId, name: `${e.firstName} ${e.lastName}`, score: calcScore(done, inProg, overdue), done, inProg, overdue, rank: 0 };
    });

    rows.sort((a, b) => b.score - a.score);
    let lastScore = Number.POSITIVE_INFINITY;
    let lastRank = 0;
    rows.forEach((r, i) => {
      if (r.score === lastScore) r.rank = lastRank;
      else { r.rank = i + 1; lastRank = r.rank; lastScore = r.score; }
    });
    return rows;
  }

  async getUpcomingTasks(callerEmpId: string) {
    const tasks = await this.tasks.getAuthorizedTasks(callerEmpId);
    const today = this.todayUtc();
    const day = (n: number) => { const d = new Date(today); d.setUTCDate(d.getUTCDate() + n); return d; };
    const tomorrow = day(1);
    const in7 = day(7);
    const in14 = day(14);

    const buckets: { overdue: typeof tasks; today: typeof tasks; tomorrow: typeof tasks; thisWeek: typeof tasks; nextWeek: typeof tasks } = {
      overdue: [], today: [], tomorrow: [], thisWeek: [], nextWeek: [],
    };
    for (const t of tasks) {
      if (!t.dueDate || isClosed(t.status)) continue;
      const due = this.dateOnly(new Date(t.dueDate));
      if (due < today) buckets.overdue.push(t);
      else if (due.getTime() === today.getTime()) buckets.today.push(t);
      else if (due.getTime() === tomorrow.getTime()) buckets.tomorrow.push(t);
      else if (due > tomorrow && due <= in7) buckets.thisWeek.push(t);
      else if (due > in7 && due <= in14) buckets.nextWeek.push(t);
    }
    return buckets;
  }

  // ─────────────────────────────────────────────── announcements
  async createAnnouncement(dto: CreateAnnouncementDto, callerEmpId: string) {
    const caller = await this.getCaller(callerEmpId);
    if (!isAdmin(caller.role)) throw new ForbiddenException();
    const start = dto.startDate ? new Date(dto.startDate) : new Date();
    const expires = dto.endDate ? new Date(dto.endDate) : (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d; })();
    const ann = await this.prisma.announcement.create({
      data: { title: dto.title, content: dto.content ?? '', authorId: callerEmpId, visibility: dto.visibility ?? 'Organisation', startDate: start, expiresAt: expires },
    });
    await this.audit(callerEmpId, 'ANNOUNCEMENT_CREATE', ann.id);
    return ann;
  }

  async deleteAnnouncement(id: string, callerEmpId: string) {
    const caller = await this.getCaller(callerEmpId);
    if (!isAdmin(caller.role)) throw new ForbiddenException();
    await this.prisma.announcement.delete({ where: { id } });
    await this.audit(callerEmpId, 'ANNOUNCEMENT_DELETE', id);
    return { ok: true };
  }

  async getAnnouncements(callerEmpId: string) {
    const caller = await this.getCaller(callerEmpId);
    const all = await this.prisma.announcement.findMany({ orderBy: { createdAt: 'desc' } });
    if (isAdmin(caller.role)) return all; // management view
    const today = this.todayUtc();
    return all
      .filter((a) => (!a.startDate || a.startDate <= today) && (!a.expiresAt || a.expiresAt >= today))
      .filter((a) => this.visibleTo(a.visibility, caller.role));
  }

  // ═══════════════════════════════════════════════ helpers
  private visibleTo(visibility: string, role: string): boolean {
    if (visibility === 'Organisation' || visibility === 'All') return true;
    if (visibility === 'TCs & TFs') return isManager(role);
    if (visibility === 'TCs Only') return isAdmin(role) || role === 'Team Captain';
    return false;
  }

  private async getCaller(empId: string): Promise<Caller> {
    const caller = await this.prisma.user.findUnique({ where: { empId }, select: { empId: true, role: true, team: true } });
    if (!caller) throw new ForbiddenException();
    return caller;
  }

  private todayUtc(): Date {
    const n = new Date();
    return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
  }
  private dateOnly(d: Date): Date {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }
  private async audit(empId: string, action: string, entityId: string) {
    await this.prisma.auditLog.create({ data: { empId, action, entity: 'Announcement', entityId } });
  }
}
