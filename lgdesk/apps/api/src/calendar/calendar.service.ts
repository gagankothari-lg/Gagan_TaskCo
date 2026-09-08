import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, calendar_v3 } from 'googleapis';
import { PrismaService } from '../prisma/prisma.service';
import { parseIds } from '../common/constants';

@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);
  private cal: calendar_v3.Calendar | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const email = this.config.get<string>('GOOGLE_SERVICE_ACCOUNT_EMAIL');
    const key = this.config.get<string>('GOOGLE_PRIVATE_KEY')?.replace(/\\n/g, '\n');
    if (email && key) {
      const auth = new google.auth.JWT({
        email,
        key,
        scopes: ['https://www.googleapis.com/auth/calendar'],
      });
      this.cal = google.calendar({ version: 'v3', auth });
    } else {
      this.logger.warn('Google Calendar not configured (GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY missing)');
    }
  }

  isConfigured(): boolean {
    return this.cal !== null;
  }

  private get calendarId(): string {
    return this.config.get('GOOGLE_CALENDAR_ID') || 'primary';
  }

  // ─── LOW-LEVEL: Google Calendar API calls ────────────────────────────────────

  async createGCalEvent(params: {
    title: string;
    description?: string;
    startDate: Date;
    endDate?: Date;
    allDay?: boolean;
    colorId?: string;
    // Round6 #13: defaults to the single shared calendar (holidays' target, and the
    // pre-Round6 legacy behavior) -- per-employee call sites pass the resolved
    // personal calendar ID explicitly instead.
    calendarId?: string;
  }): Promise<string | null> {
    if (!this.cal) return null;
    try {
      const end = params.endDate ?? params.startDate;
      const event: calendar_v3.Schema$Event = {
        summary: params.title,
        description: params.description,
        colorId: params.colorId,
        extendedProperties: { private: { lgdesk_source: 'true' } },
        ...(params.allDay
          ? {
              start: { date: params.startDate.toISOString().slice(0, 10) },
              end: { date: end.toISOString().slice(0, 10) },
            }
          : {
              start: { dateTime: params.startDate.toISOString(), timeZone: 'Asia/Kolkata' },
              end: { dateTime: end.toISOString(), timeZone: 'Asia/Kolkata' },
            }),
      };
      const res = await this.cal.events.insert({ calendarId: params.calendarId ?? this.calendarId, requestBody: event });
      return res.data.id ?? null;
    } catch (err) {
      this.logger.error('createGCalEvent failed', err);
      return null;
    }
  }

  async updateGCalEvent(
    eventId: string,
    params: { title?: string; description?: string; startDate?: Date; endDate?: Date; allDay?: boolean; calendarId?: string },
  ): Promise<boolean> {
    if (!this.cal) return false;
    try {
      const patch: calendar_v3.Schema$Event = {};
      if (params.title) patch.summary = params.title;
      if (params.description !== undefined) patch.description = params.description;
      if (params.startDate) {
        const end = params.endDate ?? params.startDate;
        if (params.allDay) {
          patch.start = { date: params.startDate.toISOString().slice(0, 10) };
          patch.end = { date: end.toISOString().slice(0, 10) };
        } else {
          patch.start = { dateTime: params.startDate.toISOString(), timeZone: 'Asia/Kolkata' };
          patch.end = { dateTime: end.toISOString(), timeZone: 'Asia/Kolkata' };
        }
      }
      await this.cal.events.patch({ calendarId: params.calendarId ?? this.calendarId, eventId, requestBody: patch });
      return true;
    } catch (err) {
      this.logger.warn(`updateGCalEvent ${eventId} failed`, err);
      return false;
    }
  }

  async deleteGCalEvent(eventId: string, calendarId?: string): Promise<boolean> {
    if (!this.cal) return false;
    try {
      await this.cal.events.delete({ calendarId: calendarId ?? this.calendarId, eventId });
      return true;
    } catch {
      this.logger.warn(`deleteGCalEvent ${eventId}: already deleted or not found`);
      return false;
    }
  }

  // Round6 #13: tasks/projects can be reassigned, which can move which employee's
  // personal calendar holds the CURRENT copy of an event relative to whoever held the
  // stale one -- there's no stored record of "which calendar was this eventId created
  // in" (matching the reference's own single Cal_Event_ID column, no per-calendar
  // tracking). Mirrors calendar.gs's _calFindAndDelete exactly: search every calendar
  // this service account owns and delete the event from wherever it's actually found,
  // tolerating a miss on each calendar it isn't in. Unpaginated (single page, like the
  // reference's own unpaginated CalendarApp.getAllOwnedCalendars()) -- fine at current
  // scale, would need paging past ~250 owned calendars (one per active employee).
  async deleteGCalEventFromAnyCalendar(eventId: string): Promise<void> {
    if (!this.cal) return;
    try {
      const list = await this.cal.calendarList.list({ minAccessRole: 'owner' });
      for (const entry of list.data.items ?? []) {
        if (!entry.id) continue;
        try {
          await this.cal.events.delete({ calendarId: entry.id, eventId });
          return; // found and deleted -- stop searching
        } catch {
          // not in this calendar -- try the next one
        }
      }
    } catch (err) {
      this.logger.warn(`deleteGCalEventFromAnyCalendar(${eventId}) failed`, err);
    }
  }

  // ─── Per-employee calendar lifecycle (Round6 #13) ────────────────────────────
  // Mirrors calendar.gs's _getOrCreateUserCal: one "TM: {name}" calendar per employee,
  // owned by the service account, shared read-only with that employee. See the
  // domain-wide-delegation writeup in this ticket's report -- creating a calendar the
  // service account owns and ACL-sharing it as 'reader' is a distinct operation from
  // impersonating the employee or inviting attendees to an event; it does not require
  // domain-wide delegation.

  async getOrCreateUserCalendar(empId: string, email: string, name: string): Promise<string | null> {
    if (!this.cal) return null;
    try {
      const created = await this.cal.calendars.insert({ requestBody: { summary: `TM: ${name}`, timeZone: 'Asia/Kolkata' } });
      const calendarId = created.data.id;
      if (!calendarId) return null;
      try {
        await this.cal.acl.insert({ calendarId, requestBody: { role: 'reader', scope: { type: 'user', value: email } } });
      } catch (err) {
        this.logger.warn(`ACL share failed for ${email}`, err);
      }
      await this.prisma.user.update({ where: { empId }, data: { personalCalendarId: calendarId } });
      this.logger.log(`Created personal calendar for ${email}: ${calendarId}`);
      return calendarId;
    } catch (err) {
      this.logger.error(`getOrCreateUserCalendar failed for ${email}`, err);
      return null;
    }
  }

  // Resolves (and lazily creates) the calendar + display name to route a per-employee
  // event to. Reference fallback preserved: an employee with no email can't be
  // ACL-shared with, so events route to the shared calendar instead of a personal one
  // (calendar.gs:39: `if (!empEmail) return _getOrCreateCompanyCal();`).
  async resolvePersonalCalendar(empId: string): Promise<{ calendarId: string; name: string } | null> {
    if (!this.cal) return null;
    const user = await this.prisma.user.findUnique({
      where: { empId },
      select: { empId: true, email: true, firstName: true, lastName: true, personalCalendarId: true },
    });
    if (!user) return null;
    const name = `${user.firstName} ${user.lastName}`.trim() || user.email || empId;
    if (user.personalCalendarId) return { calendarId: user.personalCalendarId, name };
    if (!user.email) return { calendarId: this.calendarId, name };
    const calendarId = await this.getOrCreateUserCalendar(user.empId, user.email, name);
    if (!calendarId) return null;
    return { calendarId, name };
  }

  // Round6 #13: mirrors calendar.gs's _tryCalTaskSync/_tryCalProjectSync exactly -- one
  // event per recipient (assignee or owner), title suffixed with their name to
  // distinguish each copy, only the LAST recipient's event ID is returned/tracked
  // (matches the reference's own single-Cal_Event_ID-per-record limitation; earlier
  // recipients' copies aren't tracked for later update/delete, same as the reference).
  // CREATE and UPDATE both funnel through here -- an existing event is deleted from
  // wherever it actually lives before recreating fresh copies for the CURRENT
  // recipient list, matching _tryCalTaskSync's own fallthrough (its UPDATE branch runs
  // the identical delete-then-recreate logic as CREATE, not a true per-calendar patch).
  // An empty recipient list (e.g. a task assigned only to a team, no individual
  // assignees) produces zero events, matching the reference exactly -- it has no
  // team-to-calendar fallback either.
  async syncRoutedEvent(params: {
    recipientEmpIds: string[];
    existingEventId?: string | null;
    title: string;
    description?: string;
    startDate: Date;
    endDate?: Date;
    allDay?: boolean;
    colorId?: string;
  }): Promise<string | null> {
    if (!this.cal) return null;
    if (params.existingEventId) await this.deleteGCalEventFromAnyCalendar(params.existingEventId);
    if (params.recipientEmpIds.length === 0) return null;
    let lastEventId: string | null = null;
    for (const empId of params.recipientEmpIds) {
      const target = await this.resolvePersonalCalendar(empId);
      if (!target) continue;
      const eventId = await this.createGCalEvent({
        title: `${params.title} — ${target.name}`,
        description: params.description,
        startDate: params.startDate,
        endDate: params.endDate,
        allDay: params.allDay,
        colorId: params.colorId,
        calendarId: target.calendarId,
      });
      if (eventId) lastEventId = eventId;
    }
    return lastEventId;
  }

  // ─── HIGH-LEVEL: Leave sync ───────────────────────────────────────────────

  async syncLeave(leaveId: string): Promise<void> {
    if (!this.cal) return;
    const leave = await this.prisma.leave.findUnique({
      where: { leaveId },
      include: { user: true },
    });
    if (!leave || leave.status !== 'Approved') return;

    // Round6 #13: routes to the REQUESTER's own personal calendar (calendar.gs:
    // _tryCalLeaveSync), not the shared calendar -- a leave has exactly one employee,
    // no multi-recipient ambiguity, so a true in-place patch (not delete+recreate)
    // stays correct here even after per-employee routing.
    const target = await this.resolvePersonalCalendar(leave.empId);
    if (!target) return;

    const title = `[Leave] ${leave.user.firstName} ${leave.user.lastName} — ${leave.leaveType}`;
    const description = `Type: ${leave.leaveType} · Days: ${leave.days}`;

    if (leave.calEventId) {
      await this.updateGCalEvent(leave.calEventId, {
        title,
        description,
        startDate: leave.startDate,
        endDate: leave.endDate,
        allDay: true,
        calendarId: target.calendarId,
      });
    } else {
      const eventId = await this.createGCalEvent({
        title,
        description,
        startDate: leave.startDate,
        endDate: leave.endDate,
        allDay: true,
        colorId: '11', // Tomato
        calendarId: target.calendarId,
      });
      if (eventId) {
        await this.prisma.leave.update({ where: { leaveId }, data: { calEventId: eventId } });
      }
    }
  }

  async deleteLeaveEvent(leaveId: string): Promise<void> {
    const leave = await this.prisma.leave.findUnique({ where: { leaveId }, select: { id: true, calEventId: true } });
    if (leave?.calEventId) {
      // Round6 #13: leave events now live in the employee's personal calendar, not the
      // shared one -- brute-force search (same helper tasks/projects use) rather than
      // re-deriving which calendar via a second User lookup.
      await this.deleteGCalEventFromAnyCalendar(leave.calEventId);
      await this.prisma.leave.update({ where: { leaveId }, data: { calEventId: null } });
    }
  }

  // ─── HIGH-LEVEL: Holiday sync ─────────────────────────────────────────────

  async syncHoliday(holidayId: string): Promise<void> {
    if (!this.cal) return;
    const holiday = await this.prisma.holiday.findUnique({ where: { id: holidayId } });
    if (!holiday) return;

    const title = `[Holiday] ${holiday.name}`;

    if (holiday.calEventId) {
      await this.updateGCalEvent(holiday.calEventId, {
        title,
        startDate: holiday.date,
        endDate: holiday.date,
        allDay: true,
      });
    } else {
      const eventId = await this.createGCalEvent({
        title,
        startDate: holiday.date,
        endDate: holiday.date,
        allDay: true,
        colorId: '10', // Sage
      });
      if (eventId) {
        await this.prisma.holiday.update({ where: { id: holidayId }, data: { calEventId: eventId } });
      }
    }
  }

  async deleteHolidayEvent(holidayId: string): Promise<void> {
    const holiday = await this.prisma.holiday.findUnique({ where: { id: holidayId }, select: { id: true, calEventId: true } });
    if (holiday?.calEventId) {
      await this.deleteGCalEvent(holiday.calEventId);
    }
  }

  // ─── FULL DAILY SYNC ─────────────────────────────────────────────────────

  async fullDailySync(): Promise<void> {
    if (!this.cal) return;
    this.logger.log('Starting daily calendar sync...');

    const [tasks, projects, approvedLeavesNoEvent, unapprovedLeavesWithEvent, holidaysNoEvent] = await Promise.all([
      this.prisma.task.findMany({
        where: { dueDate: { not: null }, status: { notIn: ['Done', 'Cancelled'] } },
        select: { id: true, taskId: true, title: true, status: true, priority: true, dueDate: true, calEventId: true, assigneeIds: true },
      }),
      this.prisma.project.findMany({
        where: { deadline: { not: null }, status: { notIn: ['Done', 'Cancelled'] } },
        select: { id: true, projId: true, name: true, status: true, priority: true, deadline: true, calEventId: true, ownerIds: true },
      }),
      // Round5 add'l-5: reference (calendar.gs fullSyncCalendar) reconciles all 4 entity
      // types as a backstop for whenever event-driven sync was missed — this daily sync
      // previously covered only Tasks/Projects. Leaves/Holidays already have event-driven
      // sync on submit/approve (syncLeave/syncHoliday, called elsewhere); this backstop
      // only needs to catch what that missed, matching the reference's own create-missing/
      // delete-stale semantics exactly (it does not re-sync already-synced rows daily).
      this.prisma.leave.findMany({ where: { status: 'Approved', calEventId: null }, select: { leaveId: true } }),
      this.prisma.leave.findMany({ where: { status: { not: 'Approved' }, calEventId: { not: null } }, select: { leaveId: true } }),
      this.prisma.holiday.findMany({ where: { calEventId: null }, select: { id: true } }),
    ]);

    // Round6 #13: routed through syncRoutedEvent (assignee/owner personal calendars) --
    // note this changes an already-synced row's daily refresh from a single in-place
    // patch to a delete+recreate across each current recipient's calendar, since (like
    // the reference) there's no stored record of which calendar a stale calEventId
    // actually lives in once assignees/owners can change.
    for (const t of tasks) {
      const eventId = await this.syncRoutedEvent({
        recipientEmpIds: parseIds(t.assigneeIds),
        existingEventId: t.calEventId,
        title: `[Task] ${t.title}`,
        description: `Status: ${t.status} · Priority: ${t.priority}`,
        startDate: t.dueDate!,
        allDay: true,
        colorId: '6',
      });
      if (eventId !== t.calEventId) {
        await this.prisma.task.update({ where: { taskId: t.taskId }, data: { calEventId: eventId } });
      }
    }

    for (const p of projects) {
      const eventId = await this.syncRoutedEvent({
        recipientEmpIds: parseIds(p.ownerIds),
        existingEventId: p.calEventId,
        title: `[Project] ${p.name}`,
        description: `Status: ${p.status} · Priority: ${p.priority}`,
        startDate: p.deadline!,
        allDay: true,
        colorId: '9',
      });
      if (eventId !== p.calEventId) {
        await this.prisma.project.update({ where: { projId: p.projId }, data: { calEventId: eventId } });
      }
    }

    for (const l of approvedLeavesNoEvent) await this.syncLeave(l.leaveId);
    for (const l of unapprovedLeavesWithEvent) await this.deleteLeaveEvent(l.leaveId);
    for (const h of holidaysNoEvent) await this.syncHoliday(h.id);

    this.logger.log(
      `Daily sync done: ${tasks.length} tasks, ${projects.length} projects, ` +
        `${approvedLeavesNoEvent.length} leaves created, ${unapprovedLeavesWithEvent.length} leaves removed, ` +
        `${holidaysNoEvent.length} holidays created`,
    );
  }
}
