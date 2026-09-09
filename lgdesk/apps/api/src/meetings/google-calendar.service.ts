import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, calendar_v3 } from 'googleapis';

/**
 * Google Calendar is the secondary "invite layer" — the DB is the source of truth (rule #21).
 * This mirrors CalendarService's authenticated-client pattern exactly (same JWT build from
 * GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY), but adds the meeting-specific needs
 * CalendarService doesn't cover: attendees and a Google Meet link via conferenceData.createRequest.
 *
 * Domain-wide delegation (2026-09-09): a bare service account cannot invite attendees or
 * reliably mint a Meet link — Google explicitly requires the caller to act AS a real, licensed
 * Workspace user for both (see CHANGELOG's "Domain-wide-delegation investigation" entry, which
 * predicted this exact failure before any real Workspace accounts existed to test against).
 * Now that every employee has a Workspace seat, this service impersonates the MEETING'S ACTUAL
 * ORGANIZER for every Calendar call — `subject: organizerEmail` on the JWT — so the invite is
 * created directly on that person's own real calendar exactly as if they'd sent it themselves:
 * native Accept/Decline for attendees, a Meet link that actually resolves, and `calendarId:
 * 'primary'` now correctly means "the organizer's own primary calendar," not the service
 * account's.
 *
 * This REQUIRES a Workspace Super Admin to have granted this service account's Client ID
 * domain-wide delegation for the `https://www.googleapis.com/auth/calendar` scope (Admin
 * console → Security → API Controls → Domain-wide Delegation). Until that's granted, every
 * call below will fail with an `unauthorized_client` / `invalid_grant` error from Google —
 * caught and logged, never thrown, so a meeting still gets created either way (see
 * MeetingsService.syncToCalendar's personal-calendar-copy fallback layer).
 *
 * One impersonated client per organizer email is cached for the life of the process — building
 * a `google.auth.JWT` is cheap, but there's no reason to redo it every call for the same person.
 */
@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);
  private readonly serviceAccountEmail?: string;
  private readonly serviceAccountKey?: string;
  private readonly clientCache = new Map<string, calendar_v3.Calendar>();

  constructor(private readonly config: ConfigService) {
    this.serviceAccountEmail = this.config.get<string>('GOOGLE_SERVICE_ACCOUNT_EMAIL');
    this.serviceAccountKey = this.config.get<string>('GOOGLE_PRIVATE_KEY')?.replace(/\\n/g, '\n');
    if (!this.serviceAccountEmail || !this.serviceAccountKey) {
      this.logger.warn('Google Calendar not configured (GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY missing)');
    }
  }

  isConfigured(): boolean {
    return !!(this.serviceAccountEmail && this.serviceAccountKey);
  }

  // Builds (and caches) a Calendar client impersonating `organizerEmail` via domain-wide
  // delegation. Returns null if the service account itself isn't configured at all — a
  // missing/not-yet-granted delegation isn't detectable here; it only surfaces as an API
  // error on the actual call, which every caller below already catches.
  private clientFor(organizerEmail: string): calendar_v3.Calendar | null {
    if (!this.serviceAccountEmail || !this.serviceAccountKey) return null;
    const cached = this.clientCache.get(organizerEmail);
    if (cached) return cached;
    const auth = new google.auth.JWT({
      email: this.serviceAccountEmail,
      key: this.serviceAccountKey,
      scopes: ['https://www.googleapis.com/auth/calendar'],
      subject: organizerEmail, // ← domain-wide delegation: act AS this real Workspace user
    });
    const client = google.calendar({ version: 'v3', auth });
    this.clientCache.set(organizerEmail, client);
    return client;
  }

  async createCalendarEvent(opts: {
    meetingId: string;
    organizerEmail: string;
    title: string;
    description?: string;
    startTime: Date;
    endTime: Date;
    attendeeEmails: string[];
  }): Promise<{ calEventId: string; meetLink?: string } | null> {
    const cal = this.clientFor(opts.organizerEmail);
    if (!cal) return null;
    try {
      const event: calendar_v3.Schema$Event = {
        summary: opts.title,
        description: opts.description,
        extendedProperties: { private: { lgdesk_source: 'true' } },
        start: { dateTime: opts.startTime.toISOString(), timeZone: 'Asia/Kolkata' },
        end: { dateTime: opts.endTime.toISOString(), timeZone: 'Asia/Kolkata' },
        // The organizer is implicit (this call is made AS them via impersonation) — only
        // list attendees who aren't the organizer, so Google doesn't send them a redundant
        // self-invite.
        attendees: opts.attendeeEmails.filter((e) => e !== opts.organizerEmail).map((email) => ({ email })),
        // conferenceData.createRequest asks Google to mint a Meet link for this event.
        conferenceData: {
          createRequest: {
            requestId: opts.meetingId,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
      };
      const res = await cal.events.insert({
        calendarId: 'primary', // impersonated identity's own calendar
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
      this.logger.warn(
        `Calendar create failed (organizer ${opts.organizerEmail}): ${e instanceof Error ? e.message : e}`,
      );
      return null;
    }
  }

  async cancelCalendarEvent(organizerEmail: string, calEventId: string): Promise<void> {
    const cal = this.clientFor(organizerEmail);
    if (!cal) return;
    try {
      await cal.events.delete({ calendarId: 'primary', eventId: calEventId });
    } catch (e) {
      this.logger.warn(`Calendar cancel failed (organizer ${organizerEmail}): ${e instanceof Error ? e.message : e}`);
    }
  }
}
