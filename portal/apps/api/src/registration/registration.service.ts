import { Injectable, Logger, ConflictException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { IdUtilsService } from '../common/utils/id.utils';
import { GoogleVerifyService } from '../auth/google-verify.service';
import { MANUAL_MANAGER_ROLES } from '../common/constants';
import { RegisterRequestDto } from './dto/register-request.dto';

const BCRYPT_ROUNDS = 12;

// Never includes passwordHash (business rule #1, same as LGDesk's USER_SELECT).
const USER_SELECT = {
  empId: true,
  firstName: true,
  lastName: true,
  email: true,
} as const;

type Captain = { empId: string; firstName: string; lastName: string; email: string } | null;

@Injectable()
export class RegistrationService {
  private readonly logger = new Logger(RegistrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly idUtils: IdUtilsService,
    private readonly googleVerify: GoogleVerifyService,
  ) {}

  // ─────────────────────────────────────────────── POST /registration
  // Same validation/lookup rules as LGDesk's UsersService.submitRegistration, re-read fresh.
  async submitRegistration(dto: RegisterRequestDto) {
    const existingUser = await this.prisma.user.findFirst({
      where: { email: { equals: dto.email, mode: 'insensitive' } },
    });
    if (existingUser) throw new ConflictException('Email already registered');

    const existingReq = await this.prisma.registrationRequest.findFirst({
      where: { email: { equals: dto.email, mode: 'insensitive' }, status: 'Pending' },
    });
    if (existingReq) throw new ConflictException('A registration request for this email already exists');

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const role = dto.role ?? 'Team Member';
    let captain: Captain = null;
    if ((MANUAL_MANAGER_ROLES as readonly string[]).includes(role) && dto.managerEmail) {
      const manualManager = await this.prisma.user.findFirst({
        where: { email: { equals: dto.managerEmail, mode: 'insensitive' }, isActive: true },
        select: USER_SELECT,
      });
      if (!manualManager) {
        throw new BadRequestException('The reports-to email you entered does not match an active employee.');
      }
      captain = manualManager;
    } else {
      captain = await this.getTeamCaptainByTeam(dto.team, dto.subDepartment);
    }

    // Google-assisted path: re-verify server-side, never trust the client's claim. A bad/
    // missing token is not a hard failure -- just proceed as an ordinary manual registration.
    let googleSub: string | undefined;
    let googleEmail: string | undefined;
    if (dto.googleIdToken) {
      try {
        const payload = await this.googleVerify.verify(dto.googleIdToken);
        googleSub = payload.sub;
        googleEmail = payload.email;
      } catch (err) {
        this.logger.warn(
          `Registration submitted with an invalid/unverifiable googleIdToken for ${dto.email} -- proceeding as manual registration: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    const regId = await this.idUtils.createWithId('registrationRequest', 'regId', 'REG', async (id) => {
      await this.prisma.registrationRequest.create({
        data: {
          regId: id,
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          passwordHash,
          designation: dto.designation,
          team: dto.team,
          subDepartment: dto.subDepartment,
          managerId: captain?.empId ?? null,
          role,
          status: 'Pending',
          dob: dto.dob ? new Date(dto.dob) : null,
          googleSub,
          googleEmail,
        },
      });
      return id;
    });

    return { reqId: regId };
  }

  // ─────────────────────────────────────────────── manager/Team-Captain lookup
  // Same shape/behavior as LGDesk's UsersService.getTeamCaptainByTeam, re-read fresh.
  async getTeamCaptainByTeam(team?: string | null, subDepartment?: string | null): Promise<Captain> {
    if (team) {
      if (subDepartment) {
        const subTc = await this.prisma.user.findFirst({
          where: { role: 'Team Captain', team, subDepartment, isActive: true },
          select: USER_SELECT,
        });
        if (subTc) return subTc;
      }
      const teamTc = await this.prisma.user.findFirst({
        where: { role: 'Team Captain', team, isActive: true },
        select: USER_SELECT,
      });
      if (teamTc) return teamTc;
    }
    const sa = await this.prisma.user.findFirst({ where: { role: 'Super Admin', isActive: true }, select: USER_SELECT });
    if (sa) return sa;
    const admin = await this.prisma.user.findFirst({ where: { role: 'Admin', isActive: true }, select: USER_SELECT });
    if (admin) return admin;
    return null;
  }
}
