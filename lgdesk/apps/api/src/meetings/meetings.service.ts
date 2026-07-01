import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IdUtilsService } from '../common/utils/id.utils';
import { GoogleCalendarService } from './google-calendar.service';
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
  ) {}

  userCanSeeMeeting(m: MeetingRow, caller: Caller): boolean {
    if (isAdmin(caller.role)) return true;
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

    const meetingId = await this.idUtils.generateId('meeting', 'meetingId', 'MTG');
    const start = new Date(dto.startTime);
    const end = new Date(start.getTime() + dto.durationMins * 60000);

    // DB first — source of truth (rule #21).
    const meeting = await this.prisma.meeting.create({
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
    });

    // Calendar sync — fire-and-forget; never blocks/fails the response.
    void this.syncToCalendar(meeting.id, meetingId, meetType, attendeeIds, attendeeTeams, dto, start, end);
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
    if (meeting.calEventId) void this.calendar.cancelCalendarEvent(meeting.calEventId);
    await this.audit(callerEmpId, 'MEETING_CANCEL', meetingId);
    return { ok: true };
  }

  // ═══════════════════════════════════════════════ helpers
  private async getCaller(empId: string): Promise<Caller> {
    const caller = await this.prisma.user.findUnique({ where: { empId }, select: { empId: true, role: true, team: true } });
    if (!caller) throw new ForbiddenException();
    return caller;
  }

  // meetType 'company' invites every active employee regardless of attendeeIds/Teams
  // (Master Reference Meeting Templates table: "All employees ... auto-added").
  private async resolveAttendeesToEmails(meetType: string, attendeeIds: string[], attendeeTeams: string[]): Promise<string[]> {
    if (meetType === 'company') {
      const users = await this.prisma.user.findMany({ where: { isActive: true }, select: { email: true } });
      return users.map((u) => u.email);
    }
    const emails = new Set<string>();
    if (attendeeIds.length) {
      const users = await this.prisma.user.findMany({ where: { empId: { in: attendeeIds } }, select: { email: true } });
      users.forEach((u) => emails.add(u.email));
    }
    if (attendeeTeams.length) {
      const users = await this.prisma.user.findMany({ where: { team: { in: attendeeTeams }, isActive: true }, select: { email: true } });
      users.forEach((u) => emails.add(u.email));
    }
    return [...emails];
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
  ) {
    try {
      const attendeeEmails = await this.resolveAttendeesToEmails(meetType, attendeeIds, attendeeTeams);
      const result = await this.calendar.createCalendarEvent({ meetingId, title: dto.title, description: dto.description, startTime: start, endTime: end, attendeeEmails });
      if (result) {
        await this.prisma.meeting.update({ where: { id }, data: { calEventId: result.calEventId, meetLink: result.meetLink } });
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
