import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend;
  private from: string;

  constructor(private config: ConfigService) {
    this.resend = new Resend(this.config.get('RESEND_API_KEY'));
    this.from = this.config.get('FROM_EMAIL') || 'LG Desk <noreply@leveragedgrowth.co>';
  }

  private async send(to: string, subject: string, html: string): Promise<boolean> {
    if (!this.config.get('RESEND_API_KEY')) {
      this.logger.warn(`Email skipped (no RESEND_API_KEY): ${subject} → ${to}`);
      return false;
    }
    try {
      const { error } = await this.resend.emails.send({ from: this.from, to, subject, html });
      if (error) {
        this.logger.error(`Email failed: ${error.message}`);
        return false;
      }
      this.logger.log(`Email sent: ${subject} → ${to}`);
      return true;
    } catch (err) {
      this.logger.error('Email send error', err);
      return false;
    }
  }

  // AUDIT_REPORT.md A5 finding 6 (`meet.gs:373-457`, esp. `_sendMeetingGmail:433-457`):
  // "A meeting has been scheduled" notification, sent to every attendee on top of whatever
  // Calendar-invite email Google itself sends. Needs no Google credentials — plain Resend
  // email, independent of the "Google Integrations blocked" umbrella. The 5-minute
  // pre-meeting reminder (`meet.gs:373-430`) is NOT built here — see AUDIT_REPORT.md /
  // needsDecision: it requires a dedup-tracking schema field to avoid duplicate sends.
  async sendMeetingScheduled(params: {
    attendeeEmails: string[];
    title: string;
    description?: string;
    startTime: Date;
    durationMins: number;
    meetType: string;
    team?: string | null;
    meetLink?: string;
  }): Promise<void> {
    if (params.attendeeEmails.length === 0) return;

    const prefix =
      params.meetType === 'company' ? '[Company Meeting] '
      : params.meetType === 'team' ? '[Team Meeting] '
      : '[Meeting] ';
    const subject = `${prefix}${params.title || 'Meeting'}`;

    const timeStr = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(params.startTime).replace(/,(\s+\d)/, ',$1') + ' IST';

    const scope =
      params.meetType === 'company' ? 'Whole Company'
      : params.meetType === 'team' ? `Team: ${params.team ?? ''}`
      : 'Selected Attendees';

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'Helvetica Neue',Arial,sans-serif">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)">
    <div style="background:#1a237e;padding:24px 32px">
      <div style="color:#fff;font-size:20px;font-weight:700">LG Desk</div>
      <div style="color:#c5cae9;font-size:13px;margin-top:4px">A meeting has been scheduled</div>
    </div>
    <div style="padding:32px">
      <div style="background:#f5f5f5;border-radius:8px;padding:20px;margin-bottom:24px">
        <div style="font-size:16px;font-weight:600;color:#1a237e;margin-bottom:12px">${params.title || 'Meeting'}</div>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="color:#757575;font-size:13px;padding:4px 0;width:100px">Date/Time</td><td style="color:#212121;font-size:13px;padding:4px 0">${timeStr}</td></tr>
          <tr><td style="color:#757575;font-size:13px;padding:4px 0">Duration</td><td style="color:#212121;font-size:13px;padding:4px 0">${params.durationMins} minutes</td></tr>
          <tr><td style="color:#757575;font-size:13px;padding:4px 0">Audience</td><td style="color:#212121;font-size:13px;padding:4px 0">${scope}</td></tr>
          ${params.description ? `<tr><td style="color:#757575;font-size:13px;padding:4px 0;vertical-align:top">Description</td><td style="color:#212121;font-size:13px;padding:4px 0">${params.description}</td></tr>` : ''}
        </table>
      </div>
      <a href="${params.meetLink || '#'}" style="display:inline-block;background:#1a237e;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:14px;font-weight:600">${params.meetLink ? 'Join Meeting →' : 'Meet link unavailable'}</a>
    </div>
  </div>
</body>
</html>`;

    await Promise.all(params.attendeeEmails.map((to) => this.send(to, subject, html)));
  }

  // Round4 S5: previously built by leaves.service.ts's own standalone `new Resend(key)`
  // client with a hardcoded `.in` sender domain (every other sender uses `FROM_EMAIL`,
  // `.co`) and no error-field check — moved here so it goes through the same
  // shared send()/this.from/error-logging path as every other notification.
  async sendLeaveSubmitted(params: {
    managerEmail: string;
    managerName: string;
    applicantName: string;
    leaveType: string;
    startDate: string;
    endDate: string;
  }): Promise<void> {
    await this.send(
      params.managerEmail,
      `Leave request from ${params.applicantName}`,
      `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'Helvetica Neue',Arial,sans-serif">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)">
    <div style="background:#1a237e;padding:24px 32px">
      <div style="color:#fff;font-size:20px;font-weight:700">LG Desk</div>
      <div style="color:#c5cae9;font-size:13px;margin-top:4px">New leave request</div>
    </div>
    <div style="padding:32px">
      <p style="color:#424242;margin:0 0 16px">Hi ${params.managerName},</p>
      <p style="color:#424242;margin:0 0 24px">${params.applicantName} has requested leave and is waiting for your review.</p>
      <div style="background:#f5f5f5;border-radius:8px;padding:20px">
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="color:#757575;font-size:13px;padding:4px 0;width:80px">Type</td><td style="color:#212121;font-size:13px;padding:4px 0">${params.leaveType}</td></tr>
          <tr><td style="color:#757575;font-size:13px;padding:4px 0">Dates</td><td style="color:#212121;font-size:13px;padding:4px 0">${params.startDate} to ${params.endDate}</td></tr>
        </table>
      </div>
      <p style="color:#9e9e9e;font-size:12px;margin-top:24px">Review it in LG Desk.</p>
    </div>
  </div>
</body>
</html>`,
    );
  }

  async sendPasswordResetOTP(params: {
    email: string;
    firstName: string;
    otp: string;
    expiryMinutes?: number;
  }): Promise<void> {
    await this.send(
      params.email,
      `Your LG Desk reset code: ${params.otp}`,
      `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'Helvetica Neue',Arial,sans-serif">
  <div style="max-width:480px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)">
    <div style="background:#1a237e;padding:24px 32px">
      <div style="color:#fff;font-size:20px;font-weight:700">LG Desk</div>
      <div style="color:#c5cae9;font-size:13px;margin-top:4px">Password reset</div>
    </div>
    <div style="padding:32px;text-align:center">
      <p style="color:#424242;margin:0 0 24px">Hi ${params.firstName}, here's your reset code:</p>
      <div style="background:#f5f5f5;border-radius:8px;padding:24px;display:inline-block;margin-bottom:24px">
        <div style="font-size:36px;font-weight:700;letter-spacing:8px;color:#1a237e">${params.otp}</div>
      </div>
      <p style="color:#757575;font-size:13px;margin:0">This code expires in ${params.expiryMinutes ?? 15} minutes.</p>
      <p style="color:#757575;font-size:13px;margin:8px 0 0">If you didn't request this, you can safely ignore this email.</p>
    </div>
  </div>
</body>
</html>`,
    );
  }
}
