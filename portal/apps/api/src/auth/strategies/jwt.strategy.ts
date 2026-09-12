import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';

// Byte-for-byte the same payload shape and validation logic as LGDesk's
// apps/api/src/auth/strategies/jwt.strategy.ts -- a token minted by either app must
// validate identically in both, since they share JWT_SECRET and the revokedToken table.
export interface JwtPayload {
  sub: string; // empId
  email: string;
  role: string;
  team?: string | null;
  jti: string;
  iat: number;
  exp: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET is not set — refusing to start with an insecure default.');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload) {
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
