import {
  BadRequestException,
  ConflictException,
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IdUtilsService } from '../common/utils/id.utils';
import { ATTENDANCE_TYPES, isAdmin, isManager } from '../common/constants';
import { CreateWorkLogDto } from './dto/create-work-log.dto';
import { UpdateWorkLogDto } from './dto/update-work-log.dto';
import { CreateInternLogDto } from './dto/create-intern-log.dto';
import { AdminCreateLogDto } from './dto/admin-create-log.dto';
import { SetAlternateSaturdaysDto } from './dto/set-alternate-saturdays.dto';
import {
  DayType,
  computeAttendance,
  roundMinutesToHalfHour,
  saturdaysInMonth,
  defaultAlternateSaturdays,
  isSaturdayIso,
} from './attendance-classifier';

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
      // Round4 F3: 'Present-WFO', not the deprecated bare 'Present' -- see ATTENDANCE_TYPES.
      attendance: dto.attendance ?? 'Present-WFO',
      purpose: dto.purpose,
      leaveRequested: dto.leaveRequested,
      work1stHalf: dto.work1stHalf,
      work2ndHalf: dto.work2ndHalf,
      extraHours: dto.extraHours ?? 0,
      remark: dto.remark,
      status,
      comments: manager ? dto.comments : undefined,
      // Daily check-in engine: only mark this row MANUAL when the caller actually typed an
      // attendance/extraHours value -- a submit that only touches notes/purpose shouldn't
      // lock the row out of future auto-classification. `undefined` here (rather than
      // omitting the key) is deliberate: on create it lets the schema's own AUTO default
      // apply; on update it's a no-op that leaves whatever attendanceSource the row
      // already had untouched.
      attendanceSource: dto.attendance !== undefined || dto.extraHours !== undefined ? 'MANUAL' : undefined,
    };

    // Collision-safe: retry on a unique-ID race (concurrent submissions from other users).
    // Round5 #9: runUpsert wraps the empId+date unique-constraint race (two concurrent
    // saves for the same day) into a clean ConflictException instead of a raw P2002/500 --
    // distinct from createWithId's own logId-collision retry above it, which still sees
    // the original error untouched for anything that isn't the date conflict.
    const log = await this.idUtils.createWithId('workLog', 'logId', 'WL', (logId) =>
      this.runUpsert(
        () =>
          this.prisma.workLog.upsert({
            where: { empId_date: { empId: callerEmpId, date } },
            create: { logId, empId: callerEmpId, date, ...data },
            update: data,
          }),
        'A work log for this date was just saved by another request — please refresh and try again.',
      ),
    );
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
    const log = await this.idUtils.createWithId('internWorkLog', 'logId', 'IWL', (logId) =>
      this.runUpsert(
        () =>
          this.prisma.internWorkLog.upsert({
            where: { empId_date: { empId: callerEmpId, date } },
            create: { logId, empId: callerEmpId, date, ...data },
            update: data,
          }),
        'A work log for this date was just saved by another request — please refresh and try again.',
      ),
    );
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
    // Daily check-in engine: an explicit attendance/extraHours edit is exactly the
    // "manager or employee deliberately hand-edited this" signal the auto engine must
    // never silently override again.
    if (dto.attendance !== undefined || dto.extraHours !== undefined) data.attendanceSource = 'MANUAL';

    const updated = await this.prisma.workLog.update({ where: { logId }, data });
    await this.audit(callerEmpId, 'WORKLOG_UPDATE', logId);
    return { logId: updated.logId };
  }

  // ─────────────────────────────────────────────── manager status/comment
  async setWorkLogStatus(empId: string, date: string, status: string, callerEmpId: string) {
    const caller = await this.requireManager(callerEmpId);
    // Team clamp (same pattern as getMemberWorkLogs / adminSubmitWorkLog): a
    // TC/TF may only touch logs for members of their own team; Admin/SA unclamped.
    const target = await this.prisma.user.findUnique({ where: { empId }, select: { team: true } });
    if (!target) throw new NotFoundException('Employee not found');
    if (!isAdmin(caller.role) && target.team !== caller.team) throw new ForbiddenException();
    const d = this.normalizeDate(date);
    const log = await this.prisma.workLog.findUnique({ where: { empId_date: { empId, date: d } } });
    if (!log) throw new NotFoundException('Work log not found');
    await this.prisma.workLog.update({ where: { id: log.id }, data: { status } });
    await this.audit(callerEmpId, 'WORKLOG_STATUS', log.logId, null, status);
    return { ok: true };
  }

  async setWorkLogComment(empId: string, date: string, comment: string, callerEmpId: string) {
    const caller = await this.requireManager(callerEmpId);
    // Team clamp (same pattern as getMemberWorkLogs / adminSubmitWorkLog): a
    // TC/TF may only touch logs for members of their own team; Admin/SA unclamped.
    const target = await this.prisma.user.findUnique({ where: { empId }, select: { team: true } });
    if (!target) throw new NotFoundException('Employee not found');
    if (!isAdmin(caller.role) && target.team !== caller.team) throw new ForbiddenException();
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
    // Interns' entries live in InternWorkLog, never WorkLog (business rule 11) — querying
    // workLog alone silently drops every Intern team member with zero explicit exclusion
    // (PFIX-READY-BATCH-SEQUENTIAL Fix 2, confirmed live in E2E_TEST_LOG.md Round 3).
    let regularEmpIds: string[] | undefined;
    let internEmpIds: string[];
    if (!isAdmin(caller.role)) {
      const members = await this.prisma.user.findMany({ where: { team: caller.team }, select: { empId: true, role: true } });
      regularEmpIds = members.filter((m) => m.role !== 'Intern').map((m) => m.empId);
      internEmpIds = members.filter((m) => m.role === 'Intern').map((m) => m.empId);
    } else {
      // Admin's WorkLog query stays unfiltered (empId), matching prior behavior exactly;
      // only the Intern-side query needs an explicit empId list.
      const interns = await this.prisma.user.findMany({ where: { role: 'Intern' }, select: { empId: true } });
      internEmpIds = interns.map((m) => m.empId);
    }
    const dateFilter = this.dateRange(start, end);
    const [logs, internLogs, holidays] = await Promise.all([
      this.prisma.workLog.findMany({ where: { ...(regularEmpIds ? { empId: { in: regularEmpIds } } : {}), ...dateFilter }, orderBy: { date: 'desc' } }),
      internEmpIds.length
        ? this.prisma.internWorkLog.findMany({ where: { empId: { in: internEmpIds }, ...dateFilter }, orderBy: { date: 'desc' } })
        : Promise.resolve([]),
      this.prisma.holiday.findMany({ where: this.dateRange(start, end), orderBy: { date: 'asc' } }),
    ]);
    const mergedLogs = [...logs, ...internLogs].sort((a, b) => b.date.getTime() - a.date.getTime());
    return { logs: mergedLogs, holidays };
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
      const log = await this.idUtils.createWithId('internWorkLog', 'logId', 'IWL', (logId) =>
        this.runUpsert(
          () =>
            this.prisma.internWorkLog.upsert({
              where: { empId_date: { empId: dto.targetEmpId, date } },
              create: { logId, empId: dto.targetEmpId, date, ...data },
              update: data,
            }),
          'A work log for this employee and date was just saved by another request — please refresh and try again.',
        ),
      );
      await this.audit(callerEmpId, 'WORKLOG_ADMIN', log.logId);
      return { logId: log.logId };
    }

    // Non-Intern targets use the fixed 11-value attendance set (Round4 F3: WFO/WFH split;
    // AdminCreateLogDto can't enforce this itself — it doesn't know the target's role
    // until this lookup above).
    if (dto.attendance && !(ATTENDANCE_TYPES as readonly string[]).includes(dto.attendance)) {
      throw new BadRequestException('Invalid attendance type');
    }

    const data = {
      // Round4 F3: 'Present-WFO', not the deprecated bare 'Present' -- see ATTENDANCE_TYPES.
      month: this.monthOf(date), dayName: this.dayNameOf(date), attendance: dto.attendance ?? 'Present-WFO',
      purpose: dto.purpose, leaveRequested: dto.leaveRequested, work1stHalf: dto.work1stHalf, work2ndHalf: dto.work2ndHalf,
      extraHours: dto.extraHours ?? 0, remark: dto.remark, status: dto.status, comments: dto.comments,
      // Daily check-in engine: same MANUAL-marking rule as submitWorkLog/updateWorkLog above.
      attendanceSource: dto.attendance !== undefined || dto.extraHours !== undefined ? 'MANUAL' : undefined,
    };
    const log = await this.idUtils.createWithId('workLog', 'logId', 'WL', (logId) =>
      this.runUpsert(
        () =>
          this.prisma.workLog.upsert({
            where: { empId_date: { empId: dto.targetEmpId, date } },
            create: { logId, empId: dto.targetEmpId, date, ...data },
            update: data,
          }),
        'A work log for this employee and date was just saved by another request — please refresh and try again.',
      ),
    );
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
      // OT formula (Master Reference Change #46): Σ(Extra Hours) + (EF days × 9) + (EH days × 4),
      // then round to 1 decimal (Math.round(x*10)/10) to avoid float drift on 0.5-hour steps.
      const otHours = Math.round((c.totalOtHours + c.extraFull * 9 + c.extraHalf * 4) * 10) / 10;
      out.push({ empId: m.empId, name: `${m.firstName} ${m.lastName}`, P: c.present, LF: c.leaveFullDay, LH: c.leaveHalfDay, H: c.holiday, W: c.weekOff, AW: c.altWeekOff, EF: c.extraFull, EH: c.extraHalf, otHours });
    }
    return out;
  }

  // ─────────────────────────────────────────────── auto-attendance engine (daily check-in)

  // Precedence: Holiday > Week Off (Sunday) > Alternate Week Off (this employee's chosen
  // off-Saturday) > Working Day. A Holiday falling on a Sunday or an employee's chosen
  // Alternate Saturday still resolves to Holiday -- checked first, unconditionally.
  async classifyDayType(empId: string, date: Date): Promise<DayType> {
    const holiday = await this.prisma.holiday.findUnique({ where: { date } });
    if (holiday) return 'Holiday';
    const dow = date.getUTCDay();
    if (dow === 0) return 'WeekOff';
    if (dow === 6) {
      const iso = date.toISOString().slice(0, 10);
      const [off1, off2] = await this.getAlternateSaturdayOffDates(empId, this.monthOf(date));
      if (iso === off1 || iso === off2) return 'AlternateWeekOff';
    }
    return 'WorkingDay';
  }

  /** This employee's 2 off-Saturdays for `month` ("YYYY-MM") -- their saved choice, or the
   * 1st/3rd Saturday default if they've never set one. */
  async getAlternateSaturdayOffDates(empId: string, month: string): Promise<[string, string]> {
    const row = await this.prisma.alternateSaturday.findUnique({ where: { empId_month: { empId, month } } });
    if (row) return [this.isoDate(row.offDate1), this.isoDate(row.offDate2)];
    return defaultAlternateSaturdays(month);
  }

  async getAlternateSaturdaysView(empId: string, month: string) {
    return { saturdays: saturdaysInMonth(month), offDates: await this.getAlternateSaturdayOffDates(empId, month) };
  }

  async setAlternateSaturdays(empId: string, dto: SetAlternateSaturdaysDto): Promise<{ ok: true }> {
    const { month } = dto;
    if (!/^\d{4}-\d{2}$/.test(month)) throw new BadRequestException('month must be "YYYY-MM"');
    if (dto.offDates.length !== 2) throw new BadRequestException('offDates must contain exactly 2 dates');
    // Normalize both possible ISO shapes (date-only "YYYY-MM-DD" or a full datetime) to a
    // plain date string before comparing/validating.
    const offDates = dto.offDates.map((iso) => this.isoDate(this.normalizeDate(iso)));
    const [a, b] = offDates;
    if (a === b) throw new BadRequestException('offDates must be 2 distinct dates');
    for (const iso of offDates) {
      if (!isSaturdayIso(iso)) throw new BadRequestException(`${iso} is not a Saturday`);
      if (!iso.startsWith(month)) throw new BadRequestException(`${iso} is not in ${month}`);
    }

    // The PREVIOUS off-dates (saved choice or default) -- needed so we know which dates'
    // WorkLog classification may now be stale and need retroactive recompute.
    const previous = await this.getAlternateSaturdayOffDates(empId, month);

    const offDate1 = this.normalizeDate(a);
    const offDate2 = this.normalizeDate(b);
    await this.prisma.alternateSaturday.upsert({
      where: { empId_month: { empId, month } },
      create: { empId, month, offDate1, offDate2 },
      update: { offDate1, offDate2 },
    });

    // No time restriction on this save (confirmed intentional) -- only the Saturday(s)
    // whose off/working classification actually changed (symmetric difference of previous
    // vs. new -- a date present in both, e.g. one the employee kept, is a no-op) needs its
    // already-recorded WorkLog row (if any) re-run through the classifier, using whatever
    // netMinutes/workMode that date's WorkDuration session already has (0/null if none
    // exists), so a correction to a past month actually lands in WorkLog.
    const removed = previous.filter((iso) => !offDates.includes(iso));
    const added = offDates.filter((iso) => !previous.includes(iso));
    const changedDates = new Set([...removed, ...added]);
    for (const iso of changedDates) {
      await this.recomputeWorkLogForDate(empId, this.normalizeDate(iso));
    }
    return { ok: true };
  }

  /** Re-runs the classify-and-upsert engine for one specific date, using whatever
   * WorkDuration session (netMinutes/workMode) already exists for it, or 0/null if none --
   * used after an Alternate Saturday change retroactively alters a date's day-type. */
  private async recomputeWorkLogForDate(empId: string, date: Date): Promise<void> {
    const session = await this.prisma.workDuration.findUnique({ where: { empId_date: { empId, date } } });
    await this.classifyAndSyncWorkLog(empId, date, session?.netMinutes ?? 0, session?.workMode ?? null);
  }

  /**
   * The auto-attendance engine itself. Called from WorkDurationService on every clock-out/
   * edit-time/edit-break/auto-clock-out and from the daily-status endpoint, and from the
   * Alternate-Saturday retroactive recompute above. Non-Intern only -- WorkDurationService's
   * own syncWorkLog keeps the Intern branch (InternWorkLog, workDuration-only) untouched.
   *
   * A MANUAL row (attendanceSource: 'MANUAL' -- a human explicitly set attendance/
   * extraHours through submitWorkLog/updateWorkLog/adminSubmitWorkLog) is never overwritten
   * here beyond its raw workDuration minutes, so a deliberate correction can't be silently
   * clobbered by the next clock event.
   */
  async classifyAndSyncWorkLog(empId: string, date: Date, netMinutes: number, workMode: string | null): Promise<void> {
    const existing = await this.prisma.workLog.findUnique({ where: { empId_date: { empId, date } } });
    if (existing?.attendanceSource === 'MANUAL') {
      await this.prisma.workLog.update({ where: { id: existing.id }, data: { workDuration: netMinutes } });
      return;
    }

    const dayType = await this.classifyDayType(empId, date);
    const hours = roundMinutesToHalfHour(netMinutes);
    const { attendance, extraHours } = computeAttendance(dayType, hours, workMode);
    const data = {
      month: this.monthOf(date),
      dayName: this.dayNameOf(date),
      attendance,
      extraHours,
      workDuration: netMinutes,
      attendanceSource: 'AUTO',
    };

    if (existing) {
      await this.prisma.workLog.update({ where: { id: existing.id }, data });
      return;
    }
    try {
      await this.idUtils.createWithId('workLog', 'logId', 'WL', (logId) =>
        this.prisma.workLog.create({ data: { logId, empId, date, ...data } }),
      );
    } catch (err) {
      // A concurrent write (e.g. a manual submit landing at the same instant) may have
      // created the row a moment ago -- re-run once against whatever's actually there now
      // rather than bubbling a raw conflict into the calling clock action.
      if (this.isDateConflict(err)) {
        await this.classifyAndSyncWorkLog(empId, date, netMinutes, workMode);
        return;
      }
      throw err;
    }
  }

  // ═══════════════════════════════════════════════ helpers

  // Round5 #9: the empId+date compound unique constraint on WorkLog/InternWorkLog can
  // still raise a genuine P2002 under a real race (two concurrent submissions for the
  // same employee+day) even though upsert() handles the common case -- previously
  // unguarded, so it surfaced as a raw, unhandled 500. Deliberately narrower than a
  // blanket "catch any P2002 here" -- these upserts are inside idUtils.createWithId's
  // own logId-collision retry (see id.utils.ts), so this must NOT swallow a P2002 that's
  // actually about logId (that one needs to reach createWithId unmodified so it can mint
  // a fresh id and retry); only the empId/date conflict is converted.
  private async runUpsert<T>(fn: () => Promise<T>, conflictMessage: string): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (this.isDateConflict(err)) throw new ConflictException(conflictMessage);
      throw err;
    }
  }

  private isDateConflict(err: unknown): boolean {
    const e = err as { code?: string; meta?: { target?: unknown } };
    if (e?.code !== 'P2002') return false;
    const target = e?.meta?.target;
    const str = (Array.isArray(target) ? target.join(',') : String(target ?? '')).toLowerCase();
    return str.includes('date');
  }

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

  private isoDate(d: Date): string {
    return d.toISOString().slice(0, 10);
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
