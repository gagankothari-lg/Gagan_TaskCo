import { Injectable, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { GoogleVerifyService } from './google-verify.service';

const BCRYPT_ROUNDS = 12;

type SessionUser = {
  empId: string;
  email: string;
  role: string;
  team: string | null;
  firstName: string;
  lastName: string;
};

export interface LoginResponse {
  token: string;
  user: {
    empId: string;
    firstName: string;
    lastName: string;
    name: string;
    email: string;
    role: string;
    team?: string;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly googleVerify: GoogleVerifyService,
  ) {}

  // ─────────────────────────────────────────────── LOGIN
  // Byte-for-byte the same mechanism as LGDesk's auth.service.ts login(): same lookup,
  // same constant-time no-user path, same bcrypt rounds, same token payload shape/jti.
  async login(dto: LoginDto): Promise<LoginResponse> {
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: dto.email, mode: 'insensitive' } },
    });
    if (!user) {
      await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
      throw new UnauthorizedException('Invalid credentials');
    }
    const passwordOk = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordOk) throw new UnauthorizedException('Invalid credentials');
    if (!user.isActive) throw new UnauthorizedException('Account inactive');

    return this.mintSession(user);
  }

  // ─────────────────────────────────────────────── GOOGLE SIGN-IN
  async googleLogin(idToken: string): Promise<LoginResponse> {
    const payload = await this.googleVerify.verify(idToken);

    let user = await this.prisma.user.findUnique({ where: { googleSub: payload.sub } });

    if (!user) {
      const email = payload.email;
      if (!email) throw new UnauthorizedException('Invalid Google token');
      const byEmail = await this.prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
      });
      if (byEmail) {
        // First-time link: an existing password-only account signing in with Google
        // for the first time, per SSO_Portal_Architecture_Decisions.md §5.
        user = await this.prisma.user.update({
          where: { empId: byEmail.empId },
          data: { googleSub: payload.sub, googleEmail: email, googleLinkedAt: new Date() },
        });
      }
    }

    if (!user) {
      // Distinct 404 + code so a later caller (registration routing, Phase 4) can tell
      // "no account" apart from a bad/expired token instead of a generic 401.
      throw new NotFoundException({
        code: 'NO_ACCOUNT',
        message: 'No LGDesk account exists for this Google identity',
      });
    }
    if (!user.isActive) throw new UnauthorizedException('Account inactive');

    return this.mintSession(user);
  }

  // ─────────────────────────────────────────────── GET /auth/me
  // Portal's own concern is identity only -- not LGDesk's full InitialPayload
  // (tasks/projects/etc.), which stays LGDesk's business.
  async me(empId: string) {
    const user = await this.prisma.user.findUnique({ where: { empId } });
    if (!user || !user.isActive) throw new UnauthorizedException('Account inactive');
    return {
      empId: user.empId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      name: `${user.firstName} ${user.lastName}`,
      role: user.role,
      team: user.team ?? undefined,
      designation: user.designation ?? undefined,
    };
  }

  // ─────────────────────────────────────────────── LOGOUT
  // Per-jti revocation, matching LGDesk's logout() exactly (idempotent upsert) --
  // the shared revokedToken table means this also ends the session in LGDesk.
  async logout(empId: string, jti: string, expiresAt: Date) {
    await this.prisma.revokedToken.upsert({
      where: { jti },
      create: { jti, empId, expiresAt },
      update: {},
    });
    return { ok: true };
  }

  private async mintSession(user: SessionUser): Promise<LoginResponse> {
    const jti = randomUUID();
    const token = await this.jwt.signAsync({
      sub: user.empId,
      email: user.email,
      role: user.role,
      team: user.team,
      jti,
    });
    return {
      token,
      user: {
        empId: user.empId,
        firstName: user.firstName,
        lastName: user.lastName,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.role,
        team: user.team ?? undefined,
      },
    };
  }
}
