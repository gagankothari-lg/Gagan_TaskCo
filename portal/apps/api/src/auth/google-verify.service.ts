import { Injectable, UnauthorizedException } from '@nestjs/common';
import { OAuth2Client, TokenPayload } from 'google-auth-library';

// Shared by /auth/google (Phase 3) and /registration's Google-assisted path (Phase 4a) --
// one place owns "is this ID token acceptable", so both call sites reject the same way.
@Injectable()
export class GoogleVerifyService {
  private readonly client = new OAuth2Client();

  async verify(idToken: string): Promise<TokenPayload> {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    if (!clientId) throw new UnauthorizedException('Google sign-in is not configured');

    const ticket = await this.client.verifyIdToken({ idToken, audience: clientId });
    const payload = ticket.getPayload();
    if (!payload) throw new UnauthorizedException('Invalid Google token');
    if (!payload.email_verified) throw new UnauthorizedException('Google email not verified');

    const allowedDomains = (process.env.ALLOWED_GOOGLE_HOSTED_DOMAINS ?? '')
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);
    const hd = (payload.hd ?? '').trim().toLowerCase();
    if (!hd || !allowedDomains.includes(hd)) {
      throw new UnauthorizedException('This Google account is not on an allowed domain');
    }

    return payload;
  }
}
