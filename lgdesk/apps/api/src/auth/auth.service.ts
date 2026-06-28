import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { Resend } from 'resend';
import {
  InitialPayload,
  LoginResponse,
  Task,
  Project,
  WorkFunction,
  EmployeeDto,
  AssignmentEntry,
} from '../common/api-types';
import { PrismaService } from '../prisma/prisma.service';
import { isAdmin, isManager } from '../common/constants';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

const BCRYPT_ROUNDS = 12;
const OTP_TTL_MS = 15 * 60 * 1000;        // 15 minutes
const REVOKE_ALL_TTL_MS = 8 * 24 * 60 * 60 * 1000; // > max token lifetime (7d)

// Minimal shape of a User row we operate on (passwordHash deliberately not surfaced).
type UserRow = {
  empId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  team: string | null;
  designation: string | null;
  subDepartment: string | null;
  isActive: boolean;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ─────────────────────────────────────────────── LOGIN
  async login(dto: LoginDto): Promise<LoginResponse> {
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: dto.email, mode: 'insensitive' } },
    });
    // Generic message for both unknown email and bad password (no enumeration).
    if (!user) {
      // Constant-time: spend ~the same work as a real compare so the no-user
      // path can't be distinguished by response timing.
      await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
      throw new UnauthorizedException('Invalid credentials');
    }
    const passwordOk = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordOk) throw new UnauthorizedException('Invalid credentials');
    if (!user.isActive) throw new UnauthorizedException('Account inactive');

    const jti = randomUUID();
    const token = await this.jwt.signAsync({
      sub: user.empId,
      email: user.email,
      role: user.role,
      team: user.team,
      jti,
    });

    const hasMisAccess = await this.checkMisAccess(user.empId);
    await this.audit(user.empId, 'LOGIN');

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
        hasMisAccess,
      },
    };
  }

  // ─────────────────────────────────────────────── GET /auth/me
  async getInitialPayload(empId: string): Promise<InitialPayload> {
    const user = await this.prisma.user.findUnique({ where: { empId } });
    if (!user || !user.isActive) throw new UnauthorizedException('Account inactive');

    const hasMisAccess = await this.checkMisAccess(empId);

    const [tasks, projects, functions, employees, pendingLeaveCount, pendingDdrCount] =
      await Promise.all([
        this.getAuthorizedTasks(user),
        this.getAuthorizedProjects(user),
        this.getAuthorizedFunctions(user),
        this.getAuthorizedEmployees(user),
        this.getPendingLeaveCount(user),
        this.getPendingDdrCount(empId),
      ]);

    const attCounts = await this.getAttCounts(tasks.map((t) => t.taskId));

    return {
      ok: true,
      currentUser: {
        empId: user.empId,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        team: user.team ?? undefined,
        designation: user.designation ?? undefined,
        subDepartment: user.subDepartment ?? undefined,
        hasMisAccess,
      },
      tasks,
      projects,
      functions,
      employees,
      pendingLeaveCount,
      pendingDdrCount,
      attCounts,
      hasMisAccess,
    };
  }

  // ─────────────────────────────────────────────── LOGOUT
  async logout(empId: string, jti: string, expiresAt: Date) {
    // Idempotent: re-logging-out the same token must not error (TC-AUTH-013).
    await this.prisma.revokedToken.upsert({
      where: { jti },
      create: { jti, empId, expiresAt },
      update: {},
    });
    await this.audit(empId, 'LOGOUT');
    return { ok: true };
  }

  // ─────────────────────────────────────────────── PASSWORD RESET (request)
  async requestPasswordReset(email: string) {
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    if (user) {
      // Only the most recent OTP is valid (TC-AUTH-029) — drop any prior ones.
      await this.prisma.passwordResetOtp.deleteMany({
        where: { email: { equals: email, mode: 'insensitive' } },
      });
      const otp = String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
      await this.prisma.passwordResetOtp.create({
        data: { email: user.email, otp, expiresAt: new Date(Date.now() + OTP_TTL_MS) },
      });
      await this.sendOtpEmail(user.email, otp);
    }
    // Always OK — never leak whether the email exists (TC-AUTH-015).
    return { ok: true };
  }

  // ─────────────────────────────────────────────── PASSWORD RESET (confirm)
  async confirmPasswordReset(email: string, otp: string, newPassword: string) {
    const record = await this.prisma.passwordResetOtp.findFirst({
      where: { email: { equals: email, mode: 'insensitive' }, otp, used: false },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) throw new BadRequestException('Invalid OTP');
    if (record.expiresAt < new Date()) throw new BadRequestException('OTP expired');

    const user = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    if (!user) throw new BadRequestException('Invalid OTP');

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({ where: { empId: user.empId }, data: { passwordHash } });
    await this.prisma.passwordResetOtp.update({
      where: { id: record.id },
      data: { used: true },
    });
    await this.revokeAllSessions(user.empId);
    return { ok: true };
  }

  // ─────────────────────────────────────────────── CHANGE PASSWORD
  async changePassword(empId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { empId } });
    if (!user) throw new UnauthorizedException('Current password incorrect');
    const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Current password incorrect');

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({ where: { empId }, data: { passwordHash } });
    await this.revokeAllSessions(empId); // force re-login (TC-AUTH-019)
    await this.audit(empId, 'CHANGE_PASSWORD');
    return { ok: true };
  }

  // Registration moved to UsersService (P03). POST /auth/register/request delegates there.

  // ─────────────────────────────────────────────── CRON: nightly cleanup
  @Cron('0 3 * * *')
  async cleanupExpiredTokens() {
    const now = new Date();
    await this.prisma.revokedToken.deleteMany({ where: { expiresAt: { lt: now } } });
    await this.prisma.passwordResetOtp.deleteMany({
      where: { OR: [{ expiresAt: { lt: now } }, { used: true }] },
    });
  }

  // ═══════════════════════════════════════════════ helpers

  private async checkMisAccess(empId: string): Promise<boolean> {
    const row = await this.prisma.misAccess.findUnique({ where: { empId } });
    return !!row;
  }

  private async audit(empId: string, action: string) {
    await this.prisma.auditLog.create({
      data: { empId, action, entity: 'Auth', entityId: empId },
    });
  }

  // Insert a sentinel that revokes every token for this user minted before now.
  private async revokeAllSessions(empId: string) {
    await this.prisma.revokedToken.create({
      data: {
        jti: `revoke-all:${empId}:${randomUUID()}`,
        empId,
        expiresAt: new Date(Date.now() + REVOKE_ALL_TTL_MS),
      },
    });
  }

  private async sendOtpEmail(email: string, otp: string) {
    const key = this.config.get<string>('RESEND_API_KEY');
    if (!key) return; // dev / no-key: skip silently
    try {
      const resend = new Resend(key);
      await resend.emails.send({
        from: 'LG Desk <noreply@leveragedgrowth.in>',
        to: email,
        subject: 'LG Desk password reset',
        text: `Your LG Desk password reset code is ${otp}. It expires in 15 minutes. If you did not request this, ignore this email.`,
      });
    } catch {
      // Never surface email-delivery failures (would leak account existence / break flow).
    }
  }

  private parseIds(value?: string | null): string[] {
    return value ? value.split(',').filter(Boolean) : [];
  }

  private parseHistory(value?: string | null): AssignmentEntry[] {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as AssignmentEntry[]) : [];
    } catch {
      return [];
    }
  }

  private async getTeamEmpIds(user: UserRow): Promise<string[]> {
    if (!user.team) return [user.empId];
    const members = await this.prisma.user.findMany({
      where: { team: user.team },
      select: { empId: true },
    });
    const ids = members.map((m) => m.empId);
    if (!ids.includes(user.empId)) ids.push(user.empId);
    return ids;
  }

  // ── RBAC: tasks ──
  private async getAuthorizedTasks(user: UserRow): Promise<Task[]> {
    if (isAdmin(user.role)) {
      const all = await this.prisma.task.findMany();
      return all.map((t) => this.mapTask(t));
    }
    if (isManager(user.role)) {
      const teamIds = await this.getTeamEmpIds(user);
      const all = await this.prisma.task.findMany();
      return all
        .filter((t) => this.taskInManagerScope(t, user, teamIds))
        .map((t) => this.mapTask(t));
    }
    // Team Member / Intern: strictly own
    const rows = await this.prisma.task.findMany({
      where: { OR: [{ assignerId: user.empId }, { assigneeIds: { contains: user.empId } }] },
    });
    return rows
      .filter((t) => t.assignerId === user.empId || this.parseIds(t.assigneeIds).includes(user.empId))
      .map((t) => this.mapTask(t));
  }

  private taskInManagerScope(
    t: { assignerId: string; assigneeIds: string; assignedTeams: string },
    user: UserRow,
    teamIds: string[],
  ): boolean {
    if (t.assignerId === user.empId) return true;
    if (this.parseIds(t.assigneeIds).some((a) => teamIds.includes(a))) return true;
    if (user.team && this.parseIds(t.assignedTeams).includes(user.team)) return true;
    return false;
  }

  // ── RBAC: projects ──
  private async getAuthorizedProjects(user: UserRow): Promise<Project[]> {
    if (isAdmin(user.role)) {
      const all = await this.prisma.project.findMany();
      return all.map((p) => this.mapProject(p));
    }
    const ids = isManager(user.role) ? await this.getTeamEmpIds(user) : [user.empId];
    const all = await this.prisma.project.findMany();
    return all
      .filter((p) => {
        if (p.assignerId === user.empId) return true;
        if (this.parseIds(p.ownerIds).some((o) => ids.includes(o))) return true;
        if (this.parseIds(p.assigneeIds).some((a) => ids.includes(a))) return true;
        if (isManager(user.role) && user.team && this.parseIds(p.assignedTeams).includes(user.team))
          return true;
        return false;
      })
      .map((p) => this.mapProject(p));
  }

  // ── RBAC: functions ──
  private async getAuthorizedFunctions(user: UserRow): Promise<WorkFunction[]> {
    if (isAdmin(user.role)) {
      const all = await this.prisma.workFunction.findMany();
      return all.map((f) => this.mapFunction(f));
    }
    const ids = isManager(user.role) ? await this.getTeamEmpIds(user) : [user.empId];
    const all = await this.prisma.workFunction.findMany();
    return all
      .filter((f) => {
        if (f.assignerId === user.empId) return true;
        if (this.parseIds(f.assigneeIds).some((a) => ids.includes(a))) return true;
        if (isManager(user.role) && user.team && this.parseIds(f.assignedTeams).includes(user.team))
          return true;
        return false;
      })
      .map((f) => this.mapFunction(f));
  }

  // ── RBAC: employees ──
  private async getAuthorizedEmployees(user: UserRow): Promise<EmployeeDto[]> {
    const where = isAdmin(user.role) ? {} : { isActive: true };
    const rows = await this.prisma.user.findMany({ where, select: this.userSelect });
    return rows.map((u) => this.mapEmployee(u));
  }

  private async getPendingLeaveCount(user: UserRow): Promise<number> {
    if (isAdmin(user.role)) {
      return this.prisma.leave.count({ where: { status: 'Pending', reviewedBy: null } });
    }
    if (isManager(user.role)) {
      const teamIds = await this.getTeamEmpIds(user);
      return this.prisma.leave.count({
        where: { status: 'Pending', reviewedBy: null, empId: { in: teamIds } },
      });
    }
    return 0;
  }

  // Pending DDRs whose underlying entity was assigned by this user.
  private async getPendingDdrCount(empId: string): Promise<number> {
    const ddrs = await this.prisma.dueDateRequest.findMany({ where: { status: 'Pending' } });
    if (ddrs.length === 0) return 0;

    const taskIds = ddrs.filter((d) => d.entityType === 'Task').map((d) => d.entityId);
    const projIds = ddrs.filter((d) => d.entityType === 'Project').map((d) => d.entityId);
    const fnIds = ddrs.filter((d) => d.entityType === 'Function').map((d) => d.entityId);

    const [tasks, projects, fns] = await Promise.all([
      taskIds.length
        ? this.prisma.task.findMany({ where: { taskId: { in: taskIds } }, select: { taskId: true, assignerId: true } })
        : Promise.resolve([]),
      projIds.length
        ? this.prisma.project.findMany({ where: { projId: { in: projIds } }, select: { projId: true, assignerId: true } })
        : Promise.resolve([]),
      fnIds.length
        ? this.prisma.workFunction.findMany({ where: { functionId: { in: fnIds } }, select: { functionId: true, assignerId: true } })
        : Promise.resolve([]),
    ]);

    const assignerOf = new Map<string, string>();
    tasks.forEach((t) => assignerOf.set(`Task:${t.taskId}`, t.assignerId));
    projects.forEach((p) => assignerOf.set(`Project:${p.projId}`, p.assignerId));
    fns.forEach((f) => assignerOf.set(`Function:${f.functionId}`, f.assignerId));

    return ddrs.reduce(
      (acc, d) => (assignerOf.get(`${d.entityType}:${d.entityId}`) === empId ? acc + 1 : acc),
      0,
    );
  }

  private async getAttCounts(taskIds: string[]): Promise<Record<string, number>> {
    if (taskIds.length === 0) return {};
    const grouped = await this.prisma.attachment.groupBy({
      by: ['taskId'],
      where: { taskId: { in: taskIds }, isDeleted: false },
      _count: { _all: true },
    });
    const out: Record<string, number> = {};
    for (const g of grouped) {
      if (g.taskId) out[g.taskId] = g._count._all;
    }
    return out;
  }

  // ── select that never includes passwordHash (business rule #1) ──
  private readonly userSelect = {
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

  // ── mappers (DB row → API shape) ──
  private mapTask(t: {
    id: string; taskId: string; projId: string | null; functionId: string | null;
    title: string; description: string | null; assigneeIds: string; assignedTeams: string;
    assignerId: string; status: string; priority: string; recurring: boolean;
    dueDate: Date | null; estimatedHours: number | null; actualHours: number;
    fileLink: string | null; links: string | null; assignmentHistory: string;
    createdAt: Date; updatedAt: Date;
  }): Task {
    return {
      id: t.id,
      taskId: t.taskId,
      projId: t.projId ?? undefined,
      functionId: t.functionId ?? undefined,
      title: t.title,
      description: t.description ?? undefined,
      assigneeIds: this.parseIds(t.assigneeIds),
      assignedTeams: this.parseIds(t.assignedTeams),
      assignerId: t.assignerId,
      status: t.status,
      priority: t.priority,
      recurring: t.recurring,
      dueDate: t.dueDate ? t.dueDate.toISOString() : undefined,
      estimatedHours: t.estimatedHours ?? undefined,
      actualHours: t.actualHours,
      fileLink: t.fileLink ?? undefined,
      links: t.links ?? undefined,
      assignmentHistory: this.parseHistory(t.assignmentHistory),
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    };
  }

  private mapProject(p: {
    id: string; projId: string; parentProjId: string | null; name: string;
    description: string | null; ownerIds: string; assignerId: string; assigneeIds: string;
    assignedTeams: string; status: string; priority: string; startDate: Date | null;
    deadline: Date | null; createdAt: Date; updatedAt: Date;
  }): Project {
    return {
      id: p.id,
      projId: p.projId,
      parentProjId: p.parentProjId ?? undefined,
      name: p.name,
      description: p.description ?? undefined,
      ownerIds: this.parseIds(p.ownerIds),
      assignerId: p.assignerId,
      assigneeIds: this.parseIds(p.assigneeIds),
      assignedTeams: this.parseIds(p.assignedTeams),
      status: p.status,
      priority: p.priority,
      startDate: p.startDate ? p.startDate.toISOString() : undefined,
      deadline: p.deadline ? p.deadline.toISOString() : undefined,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  }

  private mapFunction(f: {
    id: string; functionId: string; parentFnId: string | null; projId: string | null;
    name: string; description: string | null; assignerId: string; assigneeIds: string;
    assignedTeams: string; status: string; priority: string; startDate: Date | null;
    deadline: Date | null; createdAt: Date; updatedAt: Date;
  }): WorkFunction {
    return {
      id: f.id,
      functionId: f.functionId,
      parentFnId: f.parentFnId ?? undefined,
      projId: f.projId ?? undefined,
      name: f.name,
      description: f.description ?? undefined,
      assignerId: f.assignerId,
      assigneeIds: this.parseIds(f.assigneeIds),
      assignedTeams: this.parseIds(f.assignedTeams),
      status: f.status,
      priority: f.priority,
      startDate: f.startDate ? f.startDate.toISOString() : undefined,
      deadline: f.deadline ? f.deadline.toISOString() : undefined,
      createdAt: f.createdAt.toISOString(),
      updatedAt: f.updatedAt.toISOString(),
    };
  }

  private mapEmployee(u: {
    id: string; empId: string; firstName: string; lastName: string; email: string;
    role: string; designation: string | null; managerId: string | null; team: string | null;
    subDepartment: string | null; isActive: boolean; dob: Date | null;
    createdAt: Date; updatedAt: Date;
  }): EmployeeDto {
    return {
      id: u.id,
      empId: u.empId,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      role: u.role,
      designation: u.designation ?? undefined,
      managerId: u.managerId ?? undefined,
      team: u.team ?? undefined,
      subDepartment: u.subDepartment ?? undefined,
      isActive: u.isActive,
      dob: u.dob ? u.dob.toISOString() : undefined,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
      displayName: `${u.firstName} ${u.lastName}`,
    };
  }
}
