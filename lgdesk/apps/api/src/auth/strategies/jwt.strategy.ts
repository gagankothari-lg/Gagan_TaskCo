import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

export interface JwtPayload {
  sub: string;     // empId
  email: string;
  role: string;
  team?: string | null;
  jti: string;
  iat: number;
  exp: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    // Read directly from process.env (populated by ConfigModule) before super(),
    // since `this`/parameter-props aren't available until after super().
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET is not set — refusing to start with an insecure default.');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload) {
    // Revocation check: this exact token (jti) OR a "revoke-all" marker issued
    // after this token was minted (used by password change/reset to kill sessions).
    // iat has 1-second granularity; treat the token as "issued" at the END of its
    // iat second so a fresh login in the same second as a password change is not
    // self-revoked (only strictly-earlier tokens are killed).
    const tokenIssuedAt = new Date((payload.iat + 1) * 1000);
    const revoked = await this.prisma.revokedToken.findFirst({
      where: {
        OR: [
          { jti: payload.jti },
          {
            empId: payload.sub,
            jti: { startsWith: 'revoke-all:' },
            revokedAt: { gt: tokenIssuedAt },
          },
        ],
      },
    });
    if (revoked) throw new UnauthorizedException('Invalid token');

    const user = await this.prisma.user.findUnique({ where: { empId: payload.sub } });
    if (!user || !user.isActive) throw new UnauthorizedException('Account inactive');

    return {
      empId: payload.sub,
      email: payload.email,
      role: payload.role,
      team: payload.team ?? undefined,
      jti: payload.jti,
      exp: payload.exp,
    };
  }
}
