import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, calendar_v3 } from 'googleapis';
import { PrismaService } from '../prisma/prisma.service';

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
      const res = await this.cal.events.insert({ calendarId: this.calendarId, requestBody: event });
      return res.data.id ?? null;
    } catch (err) {
      this.logger.error('createGCalEvent failed', err);
      return null;
    }
  }

  async updateGCalEvent(
    eventId: string,
    params: { title?: string; description?: string; startDate?: Date; endDate?: Date; allDay?: boolean },
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
      await this.cal.events.patch({ calendarId: this.calendarId, eventId, requestBody: patch });
      return true;
    } catch (err) {
      this.logger.warn(`updateGCalEvent ${eventId} failed`, err);
      return false;
    }
  }

  async deleteGCalEvent(eventId: string): Promise<boolean> {
    if (!this.cal) return false;
    try {
      await this.cal.events.delete({ calendarId: this.calendarId, eventId });
      return true;
    } catch {
      this.logger.warn(`deleteGCalEvent ${eventId}: already deleted or not found`);
      return false;
    }
  }

  // ─── HIGH-LEVEL: Leave sync ───────────────────────────────────────────────

  async syncLeave(leaveId: string): Promise<void> {
    if (!this.cal) return;
    const leave = await this.prisma.leave.findUnique({
      where: { leaveId },
      include: { user: true },
    });
    if (!leave || leave.status !== 'Approved') return;

    const title = `[Leave] ${leave.user.firstName} ${leave.user.lastName} — ${leave.leaveType}`;
    const description = `Type: ${leave.leaveType} · Days: ${leave.days}`;

    if (leave.calEventId) {
      await this.updateGCalEvent(leave.calEventId, {
        title,
        description,
        startDate: leave.startDate,
        endDate: leave.endDate,
        allDay: true,
      });
    } else {
      const eventId = await this.createGCalEvent({
        title,
        description,
        startDate: leave.startDate,
        endDate: leave.endDate,
        allDay: true,
        colorId: '11', // Tomato
      });
      if (eventId) {
        await this.prisma.leave.update({ where: { leaveId }, data: { calEventId: eventId } });
      }
    }
  }

  async deleteLeaveEvent(leaveId: string): Promise<void> {
    const leave = await this.prisma.leave.findUnique({ where: { leaveId }, select: { id: true, calEventId: true } });
    if (leave?.calEventId) {
      await this.deleteGCalEvent(leave.calEventId);
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

    const [tasks, projects] = await Promise.all([
      this.prisma.task.findMany({
        where: { dueDate: { not: null }, status: { notIn: ['Done', 'Cancelled'] } },
        select: { id: true, taskId: true, title: true, status: true, priority: true, dueDate: true, calEventId: true },
      }),
      this.prisma.project.findMany({
        where: { deadline: { not: null }, status: { notIn: ['Done', 'Cancelled'] } },
        select: { id: true, projId: true, name: true, status: true, priority: true, deadline: true, calEventId: true },
      }),
    ]);

    for (const t of tasks) {
      const title = `[Task] ${t.title}`;
      const description = `Status: ${t.status} · Priority: ${t.priority}`;
      if (t.calEventId) {
        await this.updateGCalEvent(t.calEventId, { title, description, startDate: t.dueDate!, allDay: true });
      } else {
        const eventId = await this.createGCalEvent({ title, description, startDate: t.dueDate!, allDay: true, colorId: '6' });
        if (eventId) await this.prisma.task.update({ where: { taskId: t.taskId }, data: { calEventId: eventId } });
      }
    }

    for (const p of projects) {
      const title = `[Project] ${p.name}`;
      const description = `Status: ${p.status} · Priority: ${p.priority}`;
      if (p.calEventId) {
        await this.updateGCalEvent(p.calEventId, { title, description, startDate: p.deadline!, allDay: true });
      } else {
        const eventId = await this.createGCalEvent({ title, description, startDate: p.deadline!, allDay: true, colorId: '9' });
        if (eventId) await this.prisma.project.update({ where: { projId: p.projId }, data: { calEventId: eventId } });
      }
    }

    this.logger.log(`Daily sync done: ${tasks.length} tasks, ${projects.length} projects`);
  }
}
