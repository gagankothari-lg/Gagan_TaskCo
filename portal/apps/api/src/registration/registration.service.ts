import {
  Injectable,
  Logger,
  ConflictException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { IdUtilsService } from '../common/utils/id.utils';
import { GoogleVerifyService } from '../auth/google-verify.service';
import { EmailService } from '../email/email.service';
import { MANUAL_MANAGER_ROLES, isAdmin } from '../common/constants';
import { RegisterRequestDto } from './dto/register-request.dto';

const BCRYPT_ROUNDS = 12;

// Never includes passwordHash (business rule #1, same as LGDesk's USER_SELECT).
const USER_SELECT = {
  empId: true,
  firstName: true,
  lastName: true,
  email: true,
} as const;

// Same shape as LGDesk's users.service.ts REG_REQUEST_SELECT, minus passwordHash, plus
// googleSub/googleEmail so the approval screen can show whether a request is Google-linked.
const REG_REQUEST_SELECT = {
  id: true,
  regId: true,
  firstName: true,
  lastName: true,
  email: true,
  designation: true,
  team: true,
  subDepartment: true,
  managerId: true,
  role: true,
  status: true,
  reviewedBy: true,
  notes: true,
  dob: true,
  googleSub: true,
  googleEmail: true,
  createdAt: true,
} as const;

type Captain = { empId: string; firstName: string; lastName: string; email: string } | null;
type Caller = { empId: string; role: string; team: string | null };

@Injectable()
export class RegistrationService {
  private readonly logger = new Logger(RegistrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly idUtils: IdUtilsService,
    private readonly googleVerify: GoogleVerifyService,
    private readonly email: EmailService,
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

  // ─────────────────────────────────────────────── GET /registration
  // Same authorization scoping as LGDesk's getRegistrationRequests: Admin/Super Admin see
  // every request; Team Captain/Team Facilitator see only requests where they're the
  // designated manager OR the request's team matches their own.
  async getRegistrationRequests(callerEmpId: string) {
    const caller = await this.getCaller(callerEmpId);
    if (isAdmin(caller.role)) {
      return this.prisma.registrationRequest.findMany({
        select: REG_REQUEST_SELECT,
        orderBy: { createdAt: 'desc' },
      });
    }
    return this.prisma.registrationRequest.findMany({
      where: { OR: this.approvableRequestFilter(caller) },
      select: REG_REQUEST_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─────────────────────────────────────────────── POST /registration/:regId/approve
  // Mirrors LGDesk's approveRegistration exactly: empId via the shared IdCounter,
  // passwordHash copied as-is (already hashed at submission, never re-hashed), role/team/
  // manager/designation/dob carried over. New for Phase 4b: carries googleSub/googleEmail
  // onto the User row too, so a Google-assisted applicant's sign-in stays linked.
  async approveRegistration(reqId: string, callerEmpId: string) {
    const req = await this.prisma.registrationRequest.findUnique({ where: { regId: reqId } });
    if (!req) throw new NotFoundException('Registration request not found');
    const caller = await this.getCaller(callerEmpId);
    if (!isAdmin(caller.role) && !this.canReviewRegistration(req, caller)) {
      throw new ForbiddenException('Not authorized to approve this request.');
    }
    if (req.status !== 'Pending') throw new BadRequestException('Registration request already processed');

    const existing = await this.prisma.user.findFirst({
      where: { email: { equals: req.email, mode: 'insensitive' } },
    });
    if (existing) throw new ConflictException('Email already registered');

    const empId = await this.idUtils.createWithId('user', 'empId', 'EMP', async (id) => {
      await this.prisma.user.create({
        data: {
          empId: id,
          firstName: req.firstName,
          lastName: req.lastName,
          email: req.email,
          passwordHash: req.passwordHash,
          role: req.role,
          designation: req.designation,
          managerId: req.managerId,
          team: req.team,
          subDepartment: req.subDepartment,
          dob: req.dob,
          isActive: true,
          googleSub: req.googleSub ?? undefined,
          googleEmail: req.googleEmail ?? undefined,
          googleLinkedAt: req.googleSub ? new Date() : undefined,
        },
      });
      return id;
    });
    await this.prisma.registrationRequest.update({
      where: { id: req.id },
      data: { status: 'Approved', reviewedBy: callerEmpId },
    });

    const loginUrl = process.env.FRONTEND_URL || 'http://localhost:3003';
    this.email
      .sendRegistrationApproved({
        applicantEmail: req.email,
        applicantFirstName: req.firstName,
        empId,
        role: req.role,
        team: req.team ?? '',
        loginUrl,
      })
      .catch(() => undefined);

    return { empId };
  }

  // ─────────────────────────────────────────────── POST /registration/:regId/reject
  async rejectRegistration(reqId: string, callerEmpId: string, notes?: string) {
    const req = await this.prisma.registrationRequest.findUnique({ where: { regId: reqId } });
    if (!req) throw new NotFoundException('Registration request not found');
    const caller = await this.getCaller(callerEmpId);
    if (!isAdmin(caller.role) && !this.canReviewRegistration(req, caller)) {
      throw new ForbiddenException('Not authorized to reject this request.');
    }
    await this.prisma.registrationRequest.update({
      where: { id: req.id },
      data: { status: 'Rejected', reviewedBy: callerEmpId, notes },
    });

    const approver = await this.prisma.user.findUnique({
      where: { empId: callerEmpId },
      select: { email: true },
    });
    this.email
      .sendRegistrationRejected({
        applicantEmail: req.email,
        applicantFirstName: req.firstName,
        reason: notes,
        contactEmail: approver?.email ?? 'admin@leveragedgrowth.co',
      })
      .catch(() => undefined);

    return { ok: true };
  }

  // ─────────────────────────────────────────────── manager/Team-Captain lookup
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

  // ═══════════════════════════════════════════════ helpers (ported from users.service.ts)

  private async getCaller(empId: string): Promise<Caller> {
    const caller = await this.prisma.user.findUnique({
      where: { empId },
      select: { empId: true, role: true, team: true },
    });
    if (!caller) throw new ForbiddenException();
    return caller;
  }

  private approvableRequestFilter(caller: Caller): Array<{ managerId: string } | { team: string }> {
    const or: Array<{ managerId: string } | { team: string }> = [{ managerId: caller.empId }];
    if (caller.team) or.push({ team: caller.team });
    return or;
  }

  private canReviewRegistration(
    req: { managerId: string | null; team: string | null },
    caller: Caller,
  ): boolean {
    if (req.managerId === caller.empId) return true;
    return !!caller.team && !!req.team && req.team === caller.team;
  }
}
