import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

// Portal's own EmailModule instance -- same provider (Resend) and no-op-if-unconfigured
// behavior as LGDesk's, own env vars (RESEND_API_KEY/FROM_EMAIL configured separately in
// Portal's own Render project), never a runtime dependency on LGDesk. Only the two
// registration-approval templates Portal's own approve/reject flow needs (Phase 4b) --
// sendRegistrationSubmitted (manager notification on submission) stays out of scope this
// phase, matching Phase 4a's submission endpoint, which also doesn't send it.
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend | null;
  private from: string;

  constructor(private config: ConfigService) {
    // Resend's own constructor throws synchronously on an empty/missing key (unlike
    // LGDesk's, Portal genuinely has no key configured yet) -- construct lazily so the
    // module can still boot; `send()` below no-ops before ever touching `this.resend`.
    const apiKey = this.config.get('RESEND_API_KEY');
    this.resend = apiKey ? new Resend(apiKey) : null;
    this.from = this.config.get('FROM_EMAIL') || 'LG Desk Portal <noreply@leveragedgrowth.co>';
  }

  private async send(to: string, subject: string, html: string): Promise<boolean> {
    if (!this.resend) {
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

  // Ported verbatim from LGDesk's email.service.ts.
  async sendRegistrationApproved(params: {
    applicantEmail: string;
    applicantFirstName: string;
    empId: string;
    role: string;
    team: string;
    loginUrl: string;
  }): Promise<void> {
    await this.send(
      params.applicantEmail,
      `Welcome to LG Desk — Your account is ready!`,
      `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'Helvetica Neue',Arial,sans-serif">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)">
    <div style="background:#1a237e;padding:24px 32px">
      <div style="color:#fff;font-size:20px;font-weight:700">LG Desk</div>
      <div style="color:#c5cae9;font-size:13px;margin-top:4px">Welcome aboard!</div>
    </div>
    <div style="padding:32px">
      <p style="color:#424242;margin:0 0 16px">Hi ${params.applicantFirstName},</p>
      <p style="color:#424242;margin:0 0 24px">Your registration request has been <strong style="color:#2e7d32">approved</strong>. Your LG Desk account is now active.</p>
      <div style="background:#e8f5e9;border-radius:8px;padding:20px;margin-bottom:24px">
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="color:#757575;font-size:13px;padding:4px 0;width:80px">Employee ID</td><td style="color:#1a237e;font-size:13px;font-weight:600;padding:4px 0">${params.empId}</td></tr>
          <tr><td style="color:#757575;font-size:13px;padding:4px 0">Role</td><td style="color:#212121;font-size:13px;padding:4px 0">${params.role}</td></tr>
          <tr><td style="color:#757575;font-size:13px;padding:4px 0">Team</td><td style="color:#212121;font-size:13px;padding:4px 0">${params.team}</td></tr>
          <tr><td style="color:#757575;font-size:13px;padding:4px 0">Email</td><td style="color:#212121;font-size:13px;padding:4px 0">${params.applicantEmail}</td></tr>
        </table>
      </div>
      <p style="color:#424242;margin:0 0 20px">Sign in with the password you set during registration:</p>
      <a href="${params.loginUrl}" style="display:inline-block;background:#1a237e;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:14px;font-weight:600">Sign In to LG Desk →</a>
      <p style="color:#9e9e9e;font-size:12px;margin-top:24px">First time in? After signing in, go to your Profile to set up your presence and review your tasks.</p>
    </div>
  </div>
</body>
</html>`,
    );
  }

  // Ported verbatim from LGDesk's email.service.ts.
  async sendRegistrationRejected(params: {
    applicantEmail: string;
    applicantFirstName: string;
    reason?: string;
    contactEmail: string;
  }): Promise<void> {
    await this.send(
      params.applicantEmail,
      `LG Desk Registration — Update on your request`,
      `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'Helvetica Neue',Arial,sans-serif">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)">
    <div style="background:#1a237e;padding:24px 32px">
      <div style="color:#fff;font-size:20px;font-weight:700">LG Desk</div>
    </div>
    <div style="padding:32px">
      <p style="color:#424242;margin:0 0 16px">Hi ${params.applicantFirstName},</p>
      <p style="color:#424242;margin:0 0 20px">After review, your LG Desk registration request was not approved at this time.</p>
      ${params.reason ? `<div style="background:#fff3e0;border-left:4px solid #e65100;padding:16px;border-radius:4px;margin-bottom:20px"><div style="color:#e65100;font-size:12px;font-weight:600;margin-bottom:4px">REASON</div><div style="color:#424242;font-size:14px">${params.reason}</div></div>` : ''}
      <p style="color:#424242;margin:0 0 8px">If you believe this is an error or have questions, please reach out to your manager or contact:</p>
      <a href="mailto:${params.contactEmail}" style="color:#1a237e">${params.contactEmail}</a>
    </div>
  </div>
</body>
</html>`,
    );
  }
}
