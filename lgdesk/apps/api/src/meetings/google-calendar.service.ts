import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Google Calendar is the secondary "invite layer" — the DB is the source of truth (rule #21).
 * Until service-account/OAuth credentials are configured, these methods no-op. Every call is
 * wrapped so a Calendar failure NEVER affects the API response.
 */
@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);

  constructor(private readonly config: ConfigService) {}

  private get configured(): boolean {
    // Real wiring (googleapis + a service account / OAuth2 client) lands when creds exist.
    return !!this.config.get<string>('GOOGLE_CALENDAR_CREDENTIALS');
  }

  async createCalendarEvent(opts: {
    meetingId: string;
    title: string;
    description?: string;
    startTime: Date;
    endTime: Date;
    attendeeEmails: string[];
  }): Promise<{ calEventId: string; meetLink?: string } | null> {
    if (!this.configured) return null;
    try {
      // googleapis calendar.events.insert with conferenceData.createRequest goes here.
      void opts;
      return null;
    } catch (e) {
      this.logger.warn(`Calendar create failed: ${e instanceof Error ? e.message : e}`);
      return null;
    }
  }

  async cancelCalendarEvent(calEventId: string): Promise<void> {
    if (!this.configured) return;
    try {
      void calEventId; // calendar.events.delete goes here
    } catch (e) {
      this.logger.warn(`Calendar cancel failed: ${e instanceof Error ? e.message : e}`);
    }
  }
}
