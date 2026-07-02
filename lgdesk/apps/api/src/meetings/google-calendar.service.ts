import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, calendar_v3 } from 'googleapis';

/**
 * Google Calendar is the secondary "invite layer" — the DB is the source of truth (rule #21).
 * This mirrors CalendarService's authenticated-client pattern exactly (same JWT build from
 * GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY and the same GOOGLE_CALENDAR_ID target),
 * but adds the meeting-specific needs CalendarService doesn't cover: attendees and a Google
 * Meet link via conferenceData.createRequest.
 *
 * Until service-account credentials are configured, these methods no-op (return null / skip).
 * Every call is wrapped so a Calendar failure NEVER affects the API response.
 */
@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);
  private cal: calendar_v3.Calendar | null = null;

  constructor(private readonly config: ConfigService) {
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

  private get calendarId(): string {
    return this.config.get('GOOGLE_CALENDAR_ID') || 'primary';
  }

  async createCalendarEvent(opts: {
    meetingId: string;
    title: string;
    description?: string;
    startTime: Date;
    endTime: Date;
    attendeeEmails: string[];
  }): Promise<{ calEventId: string; meetLink?: string } | null> {
    if (!this.cal) return null;
    try {
      const event: calendar_v3.Schema$Event = {
        summary: opts.title,
        description: opts.description,
        extendedProperties: { private: { lgdesk_source: 'true' } },
        start: { dateTime: opts.startTime.toISOString(), timeZone: 'Asia/Kolkata' },
        end: { dateTime: opts.endTime.toISOString(), timeZone: 'Asia/Kolkata' },
        attendees: opts.attendeeEmails.map((email) => ({ email })),
        // conferenceData.createRequest asks Google to mint a Meet link for this event.
        conferenceData: {
          createRequest: {
            requestId: opts.meetingId,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
      };
      const res = await this.cal.events.insert({
        calendarId: this.calendarId,
        requestBody: event,
        conferenceDataVersion: 1, // required for conferenceData.createRequest to take effect
        sendUpdates: 'all',
      });
      const calEventId = res.data.id;
      if (!calEventId) return null;
      const meetLink =
        res.data.hangoutLink ??
        res.data.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri ??
        undefined;
      return { calEventId, meetLink };
    } catch (e) {
      this.logger.warn(`Calendar create failed: ${e instanceof Error ? e.message : e}`);
      return null;
    }
  }

  async cancelCalendarEvent(calEventId: string): Promise<void> {
    if (!this.cal) return;
    try {
      await this.cal.events.delete({ calendarId: this.calendarId, eventId: calEventId });
    } catch (e) {
      this.logger.warn(`Calendar cancel failed: ${e instanceof Error ? e.message : e}`);
    }
  }
}
