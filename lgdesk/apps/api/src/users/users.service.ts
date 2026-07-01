import {
  Injectable,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { IdUtilsService } from '../common/utils/id.utils';
import { EmailService } from '../email/email.service';
import { isAdmin } from '../common/constants';
import { RegisterRequestDto } from '../auth/dto/register-request.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

const BCRYPT_ROUNDS = 12;
const ORG_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Selects that NEVER include passwordHash (business rule #1).
const USER_SELECT = {
  id: true,
  empId: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true,
  designation: true,
  managerId: true,
  team: true,
  subDepartment: true,
  isActive: true,
  dob: true,
  createdAt: true,
  updatedAt: true,
} as const;

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
  createdAt: true,
  updatedAt: true,
} as const;

export interface OrgNode {
  empId: string;
  managerId: string | null;
  reports: OrgNode[];
  [key: string]: unknown;
}

@Injectable()
export class UsersService {
  private orgCache: { at: number; data: OrgNode[] } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly idUtils: IdUtilsService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  // ─────────────────────────────────────────────── reads
  async getMe(empId: string) {
    const user = await this.prisma.user.findUnique({ where: { empId }, select: USER_SELECT });
    if (!user) throw new NotFoundException('Employee not found');
    const pendingProfileRequest = await this.prisma.profileUpdateRequest.findFirst({
      where: { empId, status: 'Pending' },
      orderBy: { createdAt: 'desc' },
    });
    return { ...user, pendingProfileRequest: pendingProfileRequest ?? null };
  }

  async getAll(callerEmpId: string) {
    const caller = await this.getCaller(callerEmpId);
    // Admin/SA see everyone (incl. inactive); everyone else sees active only.
    const where = isAdmin(caller.role) ? {} : { isActive: true };
    return this.prisma.user.findMany({ where, select: USER_SELECT, orderBy: { empId: 'asc' } });
  }

  async getOrgTree(): Promise<OrgNode[]> {
    const now = Date.now();
    if (this.orgCache && now - this.orgCache.at < ORG_CACHE_TTL_MS) return this.orgCache.data;
    const users = await this.prisma.user.findMany({ where: { isActive: true }, select: USER_SELECT });
    const tree = this.buildOrgTree(users);
    this.orgCache = { at: now, data: tree };
    return tree;
  }

  // BFS over the management tree — returns every empId beneath this manager (all levels).
  async getSubordinateIds(managerEmpId: string): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: { isActive: true },
      select: { empId: true, managerId: true },
    });
    const childrenOf = new Map<string, string[]>();
    for (const u of users) {
      if (u.managerId) {
        const arr = childrenOf.get(u.managerId) ?? [];
        arr.push(u.empId);
        childrenOf.set(u.managerId, arr);
      }
    }
    const result: string[] = [];
    const seen = new Set<string>();
    const queue = [...(childrenOf.get(managerEmpId) ?? [])];
    while (queue.length) {
      const id = queue.shift() as string;
      if (seen.has(id)) continue;
      seen.add(id);
      result.push(id);
      for (const c of childrenOf.get(id) ?? []) queue.push(c);
    }
    return result;
  }

  // ─────────────────────────────────────────────── registration
  // Canonical home for registration (delegated to from POST /auth/register/request).
  async submitRegistration(dto: RegisterRequestDto) {
    const existingUser = await this.prisma.user.findFirst({
      where: { email: { equals: dto.email, mode: 'insensitive' } },
    });
    if (existingUser) throw new ConflictException('Email already registered');

    const existingReq = await this.prisma.registrationRequest.findFirst({
      where: { email: { equals: dto.email, mode: 'insensitive' } },
    });
    if (existingReq) throw new ConflictException('A registration request for this email already exists');

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const captain = await this.getTeamCaptainByTeam(dto.team, dto.subDepartment);
    const regId = await this.idUtils.generateId('registrationRequest', 'regId', 'REG');

    await this.prisma.registrationRequest.create({
      data: {
        regId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        passwordHash,
        designation: dto.designation,
        team: dto.team,
        subDepartment: dto.subDepartment,
        managerId: captain?.empId ?? null,
        role: 'Team Member',
        status: 'Pending',
      },
    });

    if (captain) {
      const frontendUrl = this.config.get('FRONTEND_URL') || 'https://lgdesk-web.vercel.app';
      this.email.sendRegistrationSubmitted({
        managerEmail: captain.email,
        managerName: `${captain.firstName} ${captain.lastName}`,
        applicantName: `${dto.firstName} ${dto.lastName}`,
        applicantEmail: dto.email,
        applicantRole: 'Team Member',
        applicantTeam: dto.team ?? '',
        reviewUrl: `${frontendUrl}/team-members`,
      }).catch(() => undefined);
    }

    return { reqId: regId };
  }

  async getRegistrationRequests(callerEmpId: string) {
    const caller = await this.getCaller(callerEmpId);
    const where = isAdmin(caller.role) ? {} : { managerId: callerEmpId };
    return this.prisma.registrationRequest.findMany({
      where,
      select: REG_REQUEST_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  async approveRegistration(reqId: string, callerEmpId: string) {
    const req = await this.prisma.registrationRequest.findUnique({ where: { regId: reqId } });
    if (!req) throw new NotFoundException('Registration request not found');
    if (req.status !== 'Pending') throw new BadRequestException('Registration request already processed');

    const existing = await this.prisma.user.findFirst({
      where: { email: { equals: req.email, mode: 'insensitive' } },
    });
    if (existing) throw new ConflictException('Email already registered');

    const empId = await this.generateEmpId();
    await this.prisma.user.create({
      data: {
        empId,
        firstName: req.firstName,
        lastName: req.lastName,
        email: req.email,
        passwordHash: req.passwordHash,
        role: req.role,
        designation: req.designation,
        managerId: req.managerId,
        team: req.team,
        subDepartment: req.subDepartment,
        isActive: true,
      },
    });
    await this.prisma.registrationRequest.update({
      where: { id: req.id },
      data: { status: 'Approved', reviewedBy: callerEmpId },
    });
    await this.audit(callerEmpId, 'APPROVE_REGISTRATION', 'RegistrationRequest', req.regId, null, empId);
    this.clearOrgCache();

    const frontendUrl = this.config.get('FRONTEND_URL') || 'https://lgdesk-web.vercel.app';
    this.email.sendRegistrationApproved({
      applicantEmail: req.email,
      applicantFirstName: req.firstName,
      empId,
      role: req.role,
      team: req.team ?? '',
      loginUrl: frontendUrl,
    }).catch(() => undefined);

    return { empId };
  }

  async rejectRegistration(reqId: string, callerEmpId: string, notes?: string) {
    const req = await this.prisma.registrationRequest.findUnique({ where: { regId: reqId } });
    if (!req) throw new NotFoundException('Registration request not found');
    await this.prisma.registrationRequest.update({
      where: { id: req.id },
      data: { status: 'Rejected', reviewedBy: callerEmpId, notes },
    });
    await this.audit(callerEmpId, 'REJECT_REGISTRATION', 'RegistrationRequest', req.regId);

    const approver = await this.prisma.user.findUnique({
      where: { empId: callerEmpId },
      select: { email: true },
    });
    this.email.sendRegistrationRejected({
      applicantEmail: req.email,
      applicantFirstName: req.firstName,
      reason: notes,
      contactEmail: approver?.email ?? 'admin@leveragedgrowth.co',
    }).catch(() => undefined);

    return { ok: true };
  }

  // ─────────────────────────────────────────────── profile updates
  async submitProfileUpdate(empId: string, dto: UpdateProfileDto) {
    const provided = Object.entries(dto).filter(([, v]) => v !== undefined && v !== null);
    if (provided.length === 0) throw new BadRequestException('No changes provided');
    const keys = provided.map(([k]) => k);

    // Designation-only changes apply immediately; anything else needs approval.
    if (keys.length === 1 && keys[0] === 'designation') {
      await this.prisma.user.update({ where: { empId }, data: { designation: dto.designation } });
      await this.audit(empId, 'UPDATE_PROFILE', 'User', empId, null, JSON.stringify({ designation: dto.designation }));
      return { immediate: true };
    }

    const changes = Object.fromEntries(provided);
    const reqId = await this.idUtils.generateId('profileUpdateRequest', 'reqId', 'PR');
    await this.prisma.profileUpdateRequest.create({
      data: { reqId, empId, changes: JSON.stringify(changes), status: 'Pending' },
    });
    return { immediate: false, reqId };
  }

  async getPendingProfileRequests(callerEmpId: string) {
    const caller = await this.getCaller(callerEmpId);
    if (isAdmin(caller.role)) {
      return this.prisma.profileUpdateRequest.findMany({
        where: { status: 'Pending' },
        orderBy: { createdAt: 'desc' },
      });
    }
    const teamMemberIds = await this.getTeamMemberIds(caller.team);
    return this.prisma.profileUpdateRequest.findMany({
      where: { status: 'Pending', empId: { in: teamMemberIds } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approveProfileUpdate(reqId: string, callerEmpId: string) {
    const req = await this.prisma.profileUpdateRequest.findUnique({ where: { reqId } });
    if (!req) throw new NotFoundException('Profile request not found');
    if (req.status !== 'Pending') throw new BadRequestException('Profile request already processed');

    const changes = this.parseChanges(req.changes);
    const data: {
      firstName?: string;
      lastName?: string;
      designation?: string;
      team?: string;
      subDepartment?: string;
      dob?: Date | null;
    } = {};
    if (typeof changes.firstName === 'string') data.firstName = changes.firstName;
    if (typeof changes.lastName === 'string') data.lastName = changes.lastName;
    if (typeof changes.designation === 'string') data.designation = changes.designation;
    if (typeof changes.team === 'string') data.team = changes.team;
    if (typeof changes.subDepartment === 'string') data.subDepartment = changes.subDepartment;
    if (changes.dob !== undefined) data.dob = changes.dob ? new Date(changes.dob as string) : null;

    await this.prisma.user.update({ where: { empId: req.empId }, data });
    await this.prisma.profileUpdateRequest.update({
      where: { id: req.id },
      data: { status: 'Approved', reviewedBy: callerEmpId },
    });
    await this.audit(callerEmpId, 'APPROVE_PROFILE', 'ProfileUpdateRequest', req.reqId, null, req.changes);
    this.clearOrgCache();
    return { ok: true };
  }

  async rejectProfileUpdate(reqId: string, callerEmpId: string, notes?: string) {
    const req = await this.prisma.profileUpdateRequest.findUnique({ where: { reqId } });
    if (!req) throw new NotFoundException('Profile request not found');
    await this.prisma.profileUpdateRequest.update({
      where: { id: req.id },
      data: { status: 'Rejected', reviewedBy: callerEmpId, notes },
    });
    await this.audit(callerEmpId, 'REJECT_PROFILE', 'ProfileUpdateRequest', req.reqId);
    return { ok: true };
  }

  // ─────────────────────────────────────────────── role / lifecycle
  async changeRole(targetEmpId: string, newRole: string, callerEmpId: string) {
    const caller = await this.getCaller(callerEmpId);
    const target = await this.prisma.user.findUnique({ where: { empId: targetEmpId } });
    if (!target) throw new NotFoundException('Employee not found');

    if (isAdmin(caller.role)) {
      // Hierarchy: an Admin may neither grant Super Admin nor modify an existing one.
      if (caller.role === 'Admin' && target.role === 'Super Admin') {
        throw new ForbiddenException('Cannot modify a Super Admin');
      }
      if (caller.role === 'Admin' && newRole === 'Super Admin') {
        throw new ForbiddenException('Cannot assign Super Admin role');
      }
    } else if (caller.role === 'Team Captain') {
      // RBAC matrix Row 19 (_allowedNewRoles): a Team Captain may change roles for
      // own-team Team Members / Interns ONLY — never a TC/TF/Admin/Super Admin
      // target — and may not promote them into an admin role.
      if (target.role !== 'Team Member' && target.role !== 'Intern') {
        throw new ForbiddenException("You are not authorised to change this employee's role.");
      }
      if (!caller.team || target.team !== caller.team) {
        throw new ForbiddenException('You can only change roles of members in your own team.');
      }
      if (isAdmin(newRole)) {
        throw new ForbiddenException('You are not authorised to assign that role.');
      }
    } else {
      // Team Facilitator (no branch, by design) and everyone else: no capability.
      throw new ForbiddenException();
    }

    const oldRole = target.role;
    if (oldRole === newRole) return { oldRole, newRole };

    await this.prisma.user.update({ where: { empId: targetEmpId }, data: { role: newRole } });
    await this.audit(callerEmpId, 'ROLE_CHANGE', 'User', targetEmpId, oldRole, newRole);
    this.clearOrgCache();
    return { oldRole, newRole };
  }

  async deactivateEmployee(targetEmpId: string, callerEmpId: string) {
    const target = await this.prisma.user.findUnique({ where: { empId: targetEmpId } });
    if (!target) throw new NotFoundException('Employee not found');
    await this.prisma.user.update({ where: { empId: targetEmpId }, data: { isActive: false } });
    await this.audit(callerEmpId, 'DEACTIVATE', 'User', targetEmpId, 'active', 'inactive');
    this.clearOrgCache();
    return { ok: true };
  }

  // Team-captain resolution: sub-dept TC → team TC → Super Admin → Admin → null.
  async getTeamCaptainByTeam(team?: string | null, subDepartment?: string | null) {
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

  // Out of scope in P03 — a default-manager fallback store is deferred; return ok.
  async setDefaultManager(_email: string, _name: string, _callerEmpId: string) {
    return { ok: true };
  }

  generateEmpId(): Promise<string> {
    return this.idUtils.generateId('user', 'empId', 'EMP');
  }

  // ═══════════════════════════════════════════════ helpers
  private async getCaller(empId: string) {
    const caller = await this.prisma.user.findUnique({
      where: { empId },
      select: { empId: true, role: true, team: true },
    });
    if (!caller) throw new ForbiddenException();
    return caller;
  }

  private async getTeamMemberIds(team: string | null): Promise<string[]> {
    if (!team) return [];
    const members = await this.prisma.user.findMany({ where: { team }, select: { empId: true } });
    return members.map((m) => m.empId);
  }

  private buildOrgTree(users: Array<{ empId: string; managerId: string | null } & Record<string, unknown>>): OrgNode[] {
    const byId = new Map<string, OrgNode>();
    for (const u of users) byId.set(u.empId, { ...u, reports: [] });
    const roots: OrgNode[] = [];
    for (const node of byId.values()) {
      const parent = node.managerId ? byId.get(node.managerId) : undefined;
      if (parent) parent.reports.push(node);
      else roots.push(node);
    }
    return roots;
  }

  private parseChanges(raw: string): Record<string, unknown> {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  private clearOrgCache() {
    this.orgCache = null;
  }

  private async audit(
    empId: string,
    action: string,
    entity: string,
    entityId: string,
    before?: string | null,
    after?: string | null,
  ) {
    await this.prisma.auditLog.create({
      data: { empId, action, entity, entityId, before: before ?? null, after: after ?? null },
    });
  }
}
