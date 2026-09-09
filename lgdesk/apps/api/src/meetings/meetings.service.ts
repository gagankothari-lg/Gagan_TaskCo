import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IdUtilsService } from '../common/utils/id.utils';
import { GoogleCalendarService } from './google-calendar.service';
import { CalendarService } from '../calendar/calendar.service';
import { EmailService } from '../email/email.service';
import { isAdmin, isManager, parseIds, joinIds } from '../common/constants';
import { CreateMeetingDto } from './dto/create-meeting.dto';

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 min — Master Reference Part 21 "Cache Strategy"

type Caller = { empId: string; role: string; team: string | null };
type MeetingRow = {
  id: string; meetingId: string; title: string; description: string | null; organizerId: string;
  attendeeIds: string; attendeeTeams: string; meetType: string; startTime: Date; endTime: Date;
  meetLink: string | null; calEventId: string | null; status: string; createdAt: Date;
};

@Injectable()
export class MeetingsService {
  // Simple in-process TTL cache (Master Reference: "CacheService-backed, key
  // mtg_{email}_{start}_{end}, TTL 10 min"). No Redis in this stack (CLAUDE.md), so a
  // per-instance Map is the direct equivalent of GAS's CacheService semantics.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly rangeCache = new Map<string, { at: number; data: any[] }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly idUtils: IdUtilsService,
    private readonly calendar: GoogleCalendarService,
    // Round6 #13: reuses CalendarService's per-employee calendar lifecycle
    // (resolvePersonalCalendar/createGCalEvent) for the personal-calendar-copy step --
    // GoogleCalendarService stays focused on the Meet-link/attendee-invite event only.
    private readonly calendarLifecycle: CalendarService,
    private readonly email: EmailService,
  ) {}

  userCanSeeMeeting(m: MeetingRow, caller: Caller): boolean {
    if (isAdmin(caller.role)) return true;
    // AUDIT_REPORT.md A5 finding 5 (`meet.gs:490-492` tmType==='company' → true): Company
    // Meetings are visible org-wide to every active employee, matching the reference's
    // `_userCanSeeMeeting`. Without this case, Company meetings (whose attendeeIds/
    // attendeeTeams are deliberately emptied in createMeeting) were only visible to the
    // organizer and admins.
    if (m.meetType === 'company') return true;
    if (m.organizerId === caller.empId) return true;
    if (parseIds(m.attendeeIds).includes(caller.empId)) return true;
    if (caller.team && parseIds(m.attendeeTeams).includes(caller.team)) return true;
    return false;
  }

  async createMeeting(dto: CreateMeetingDto, callerEmpId: string) {
    const caller = await this.getCaller(callerEmpId);
    const meetType = dto.meetType === 'personal' ? 'custom' : (dto.meetType ?? 'custom');

    // Master Reference Part 21 "Schedule Meeting" authorization gates.
    if (meetType === 'company' && !isAdmin(caller.role)) {
      throw new ForbiddenException('Only Super Admins and Admins can schedule Company Meetings.');
    }
    if (meetType === 'team' && !isManager(caller.role)) {
      throw new ForbiddenException('Only Managers and above can schedule Team Meetings.');
    }

    // Team meetings auto-resolve to the organizer's own team when no explicit teams
    // are supplied; Company meetings invite every active employee regardless of what
    // the client sent (attendeeIds/attendeeTeams are ignored for that template).
    let attendeeIds = dto.attendeeIds ?? [];
    let attendeeTeams = dto.attendeeTeams ?? [];
    if (meetType === 'team' && attendeeTeams.length === 0 && caller.team) {
      attendeeTeams = [caller.team];
    }
    if (meetType === 'company') {
      attendeeIds = [];
      attendeeTeams = [];
    }

    const start = new Date(dto.startTime);
    const end = new Date(start.getTime() + dto.durationMins * 60000);

    // PFIX-IDCOUNTER-BATCH: collision-safe, matching approveRegistration's fix.
    // DB first — source of truth (rule #21).
    const meeting = await this.idUtils.createWithId('meeting', 'meetingId', 'MTG', (meetingId) =>
      this.prisma.meeting.create({
        data: {
          meetingId,
          title: dto.title,
          description: dto.description,
          organizerId: callerEmpId, // ← from JWT
          attendeeIds: joinIds(attendeeIds),
          attendeeTeams: joinIds(attendeeTeams),
          meetType,
          startTime: start,
          endTime: end,
          status: 'Scheduled',
        },
      }),
    );
    const meetingId = meeting.meetingId;

    // Calendar sync — fire-and-forget; never blocks/fails the response.
    void this.syncToCalendar(meeting.id, meetingId, meetType, attendeeIds, attendeeTeams, dto, start, end, callerEmpId);
    // AUDIT_REPORT.md A5 finding 6 (`meet.gs:433-457` _sendMeetingGmail): "A meeting has
    // been scheduled" notification email — fire-and-forget, independent of Calendar/Meet
    // (needs no Google credentials, uses the existing Resend-backed EmailService).
    void this.notifyMeetingScheduled(meetType, attendeeIds, attendeeTeams, caller.team, dto, start);
    await this.audit(callerEmpId, 'MEETING_CREATE', meetingId);
    return { meetingId, meetLink: meeting.meetLink ?? undefined };
  }

  async getMeetings(callerEmpId: string) {
    const caller = await this.getCaller(callerEmpId);
    const rows = await this.prisma.meeting.findMany({ where: { status: { not: 'Cancelled' } }, orderBy: { startTime: 'asc' } });
    return rows.filter((m) => this.userCanSeeMeeting(m, caller)).map((m) => this.mapMeeting(m));
  }

  async getMeetingsForRange(callerEmpId: string, start: string, end: string) {
    const cacheKey = `mtg_${callerEmpId}_${start}_${end}`;
    const hit = this.rangeCache.get(cacheKey);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;

    const caller = await this.getCaller(callerEmpId);
    const rows = await this.prisma.meeting.findMany({
      where: { status: { not: 'Cancelled' }, startTime: { gte: new Date(start), lte: new Date(end) } },
      orderBy: { startTime: 'asc' },
    });
    const data = rows.filter((m) => this.userCanSeeMeeting(m, caller)).map((m) => this.mapMeeting(m));
    this.rangeCache.set(cacheKey, { at: Date.now(), data });
    return data;
  }

  async getUpcomingMeetings(callerEmpId: string) {
    const caller = await this.getCaller(callerEmpId);
    const rows = await this.prisma.meeting.findMany({
      where: { status: { not: 'Cancelled' }, startTime: { gt: new Date() } },
      orderBy: { startTime: 'asc' },
    });
    return rows.filter((m) => this.userCanSeeMeeting(m, caller)).map((m) => this.mapMeeting(m));
  }

  async cancelMeeting(meetingId: string, callerEmpId: string) {
    const meeting = await this.prisma.meeting.findUnique({ where: { meetingId } });
    if (!meeting) throw new NotFoundException('Meeting not found');
    const caller = await this.getCaller(callerEmpId);
    // Master Reference Part 21 "Cancel" GAP: a non-organizer manager may see the Cancel
    // button in the UI, but only the organizer/creator or an admin may actually cancel.
    if (!isAdmin(caller.role) && meeting.organizerId !== callerEmpId) {
      throw new ForbiddenException('Not authorized to cancel this meeting.');
    }

    await this.prisma.meeting.update({ where: { meetingId }, data: { status: 'Cancelled' } });
    if (meeting.calEventId) {
      // Domain-wide delegation (2026-09-09): cancellation must be done AS the organizer
      // too, since the event now lives on the organizer's own primary calendar, not the
      // service account's — see google-calendar.service.ts's header comment.
      const organizerEmail = await this.getEmail(meeting.organizerId);
      if (organizerEmail) void this.calendar.cancelCalendarEvent(organizerEmail, meeting.calEventId);
    }
    await this.audit(callerEmpId, 'MEETING_CANCEL', meetingId);
    return { ok: true };
  }

  // ═══════════════════════════════════════════════ helpers
  private async getCaller(empId: string): Promise<Caller> {
    const caller = await this.prisma.user.findUnique({ where: { empId }, select: { empId: true, role: true, team: true } });
    if (!caller) throw new ForbiddenException();
    return caller;
  }

  // Domain-wide delegation (2026-09-09): every GoogleCalendarService call now needs the
  // organizer's real email to impersonate them — this is the single lookup point for that.
  private async getEmail(empId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({ where: { empId }, select: { email: true } });
    return user?.email ?? null;
  }

  // meetType 'company' invites every active employee regardless of attendeeIds/Teams
  // (Master Reference Meeting Templates table: "All employees ... auto-added").
  private async resolveAttendeesToEmails(meetType: string, attendeeIds: string[], attendeeTeams: string[]): Promise<string[]> {
    return (await this.resolveAttendees(meetType, attendeeIds, attendeeTeams)).map((a) => a.email);
  }

  // Round6 #13: same resolution as resolveAttendeesToEmails, but keeps empId alongside
  // email -- syncToCalendar needs empId to route each attendee's personal-calendar copy
  // (CalendarService.resolvePersonalCalendar takes an empId, not an email).
  private async resolveAttendees(meetType: string, attendeeIds: string[], attendeeTeams: string[]): Promise<{ empId: string; email: string }[]> {
    if (meetType === 'company') {
      return this.prisma.user.findMany({ where: { isActive: true }, select: { empId: true, email: true } });
    }
    const byEmpId = new Map<string, string>();
    if (attendeeIds.length) {
      const users = await this.prisma.user.findMany({ where: { empId: { in: attendeeIds } }, select: { empId: true, email: true } });
      users.forEach((u) => byEmpId.set(u.empId, u.email));
    }
    if (attendeeTeams.length) {
      const users = await this.prisma.user.findMany({ where: { team: { in: attendeeTeams }, isActive: true }, select: { empId: true, email: true } });
      users.forEach((u) => byEmpId.set(u.empId, u.email));
    }
    return [...byEmpId.entries()].map(([empId, email]) => ({ empId, email }));
  }

  // AUDIT_REPORT.md A5 finding 6: mirrors `_sendMeetingGmail` (`meet.gs:433-457`) — sent to
  // resolved attendee emails only (the organizer is included automatically whenever they're
  // also one of the resolved recipients — e.g. Company/Team scope — same as the reference;
  // unlike the 5-minute reminder, the reference does NOT force-add the organizer here).
  private async notifyMeetingScheduled(
    meetType: string,
    attendeeIds: string[],
    attendeeTeams: string[],
    organizerTeam: string | null,
    dto: CreateMeetingDto,
    start: Date,
  ) {
    try {
      const attendeeEmails = await this.resolveAttendeesToEmails(meetType, attendeeIds, attendeeTeams);
      await this.email.sendMeetingScheduled({
        attendeeEmails,
        title: dto.title,
        description: dto.description,
        startTime: start,
        durationMins: dto.durationMins,
        meetType,
        team: meetType === 'team' ? (attendeeTeams[0] ?? organizerTeam) : undefined,
      });
    } catch {
      // Notification is best-effort — never affects meeting creation itself.
    }
  }

  private async syncToCalendar(
    id: string,
    meetingId: string,
    meetType: string,
    attendeeIds: string[],
    attendeeTeams: string[],
    dto: CreateMeetingDto,
    start: Date,
    end: Date,
    organizerEmpId: string,
  ) {
    try {
      const attendees = await this.resolveAttendees(meetType, attendeeIds, attendeeTeams);
      const attendeeEmails = attendees.map((a) => a.email);
      // Domain-wide delegation (2026-09-09): the invite/Meet-link event is now created
      // AS the organizer (impersonation), so their email is required up front — if it
      // can't be resolved, skip the invite layer entirely (personal-calendar-copy loop
      // below still runs regardless, so the meeting is never silently lost).
      const organizerEmail = await this.getEmail(organizerEmpId);
      const result = organizerEmail
        ? await this.calendar.createCalendarEvent({ meetingId, organizerEmail, title: dto.title, description: dto.description, startTime: start, endTime: end, attendeeEmails })
        : null;
      if (result) {
        await this.prisma.meeting.update({ where: { id }, data: { calEventId: result.calEventId, meetLink: result.meetLink } });
      }
      // Round6 #13 (meet.gs:274-313 _tryCalMeetingSync): ALSO copy a plain, no-attendee
      // event into each invited employee's own personal "TM: {name}" calendar, so it
      // shows up there without them needing to accept the real Calendar invite above.
      // Deliberately separate from the Meet-link event just created -- this is the
      // convenience-visibility layer, not the authoritative invite. Includes the
      // organizer too, matching the reference's explicit `allEmails.push(orgEmail)`.
      const recipientEmpIds = new Set(attendees.map((a) => a.empId));
      recipientEmpIds.add(organizerEmpId);
      const description = (result?.meetLink ? `Join Meeting: ${result.meetLink}\n` : '') + (dto.description ?? '');
      for (const empId of recipientEmpIds) {
        const target = await this.calendarLifecycle.resolvePersonalCalendar(empId);
        if (!target) continue;
        await this.calendarLifecycle.createGCalEvent({
          title: dto.title,
          description,
          startDate: start,
          endDate: end,
          calendarId: target.calendarId,
        });
      }
    } catch {
      // Calendar is secondary — swallow.
    }
  }

  private mapMeeting(m: MeetingRow) {
    return {
      id: m.id,
      meetingId: m.meetingId,
      title: m.title,
      description: m.description ?? undefined,
      organizerId: m.organizerId,
      attendeeIds: parseIds(m.attendeeIds),
      attendeeTeams: parseIds(m.attendeeTeams),
      meetType: m.meetType,
      startTime: m.startTime.toISOString(),
      endTime: m.endTime.toISOString(),
      meetLink: m.meetLink ?? undefined,
      calEventId: m.calEventId ?? undefined,
      status: m.status,
      createdAt: m.createdAt.toISOString(),
    };
  }

  private async audit(empId: string, action: string, entityId: string) {
    await this.prisma.auditLog.create({ data: { empId, action, entity: 'Meeting', entityId } });
  }
}
