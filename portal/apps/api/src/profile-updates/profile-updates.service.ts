import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IdUtilsService } from '../common/utils/id.utils';
import { isAdmin } from '../common/constants';
import { UpdateProfileDto } from './dto/update-profile.dto';

type Caller = { empId: string; role: string; team: string | null };

@Injectable()
export class ProfileUpdatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly idUtils: IdUtilsService,
  ) {}

  // Exactly LGDesk's UsersService.submitProfileUpdate categorization, re-read fresh:
  // designation/firstName/lastName/dob apply immediately (personal/cosmetic, per Round5
  // add'l-2 -- they don't affect how other users' views of the org structure resolve);
  // team/subDepartment/newManagerEmail always queue for approval. Don't invent a different
  // split -- this exact set is what LGDesk's code enforces today.
  private static readonly PROFILE_IMMEDIATE_KEYS = new Set(['designation', 'firstName', 'lastName', 'dob']);

  async submitProfileUpdate(empId: string, dto: UpdateProfileDto) {
    const provided = Object.entries(dto).filter(([, v]) => v !== undefined && v !== null);
    if (provided.length === 0) throw new BadRequestException('No changes provided');

    const immediate = Object.fromEntries(provided.filter(([k]) => ProfileUpdatesService.PROFILE_IMMEDIATE_KEYS.has(k)));
    const queued = Object.fromEntries(provided.filter(([k]) => !ProfileUpdatesService.PROFILE_IMMEDIATE_KEYS.has(k)));

    if (Object.keys(immediate).length > 0) {
      const data: { firstName?: string; lastName?: string; designation?: string; dob?: Date | null } = {};
      if (typeof immediate.firstName === 'string') data.firstName = immediate.firstName;
      if (typeof immediate.lastName === 'string') data.lastName = immediate.lastName;
      if (typeof immediate.designation === 'string') data.designation = immediate.designation;
      if ('dob' in immediate) data.dob = immediate.dob ? new Date(immediate.dob as string) : null;
      await this.prisma.user.update({ where: { empId }, data });
    }

    if (Object.keys(queued).length === 0) return { immediate: true };

    const reqId = await this.idUtils.createWithId('profileUpdateRequest', 'reqId', 'PR', async (id) => {
      await this.prisma.profileUpdateRequest.create({
        data: { reqId: id, empId, changes: JSON.stringify(queued), status: 'Pending' },
      });
      return id;
    });
    return { immediate: false, reqId };
  }

  // ─────────────────────────────────────────────── GET /profile-updates
  // Same authorization scoping as LGDesk's getPendingProfileRequests: Admin/Super Admin
  // see every pending request; everyone else sees only requests for people who are either
  // their direct designated report (managerId match) OR on their same team.
  async getPendingProfileRequests(callerEmpId: string) {
    const caller = await this.getCaller(callerEmpId);
    if (isAdmin(caller.role)) {
      return this.prisma.profileUpdateRequest.findMany({
        where: { status: 'Pending' },
        orderBy: { createdAt: 'desc' },
      });
    }
    const memberIds = await this.getApprovableEmpIds(caller);
    return this.prisma.profileUpdateRequest.findMany({
      where: { status: 'Pending', empId: { in: memberIds } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─────────────────────────────────────────────── POST /profile-updates/:reqId/approve
  // Mirrors LGDesk's approveProfileUpdate exactly, including the silent no-op when a
  // requested newManagerEmail doesn't resolve to a real employee (auth.gs:493-495 --
  // doesn't reject the whole approval, just skips that one field).
  async approveProfileUpdate(reqId: string, callerEmpId: string) {
    const req = await this.prisma.profileUpdateRequest.findUnique({ where: { reqId } });
    if (!req) throw new NotFoundException('Profile request not found');
    const caller = await this.getCaller(callerEmpId);
    if (!isAdmin(caller.role) && !(await this.canReviewProfileRequest(req.empId, caller))) {
      throw new ForbiddenException('Not authorized to approve this request.');
    }
    if (req.status !== 'Pending') throw new BadRequestException('Profile request already processed');

    const changes = this.parseChanges(req.changes);
    const data: {
      firstName?: string;
      lastName?: string;
      designation?: string;
      team?: string;
      subDepartment?: string;
      dob?: Date | null;
      managerId?: string;
    } = {};
    if (typeof changes.firstName === 'string') data.firstName = changes.firstName;
    if (typeof changes.lastName === 'string') data.lastName = changes.lastName;
    if (typeof changes.designation === 'string') data.designation = changes.designation;
    if (typeof changes.team === 'string') data.team = changes.team;
    if (typeof changes.subDepartment === 'string') data.subDepartment = changes.subDepartment;
    if (changes.dob !== undefined) data.dob = changes.dob ? new Date(changes.dob as string) : null;
    if (typeof changes.newManagerEmail === 'string' && changes.newManagerEmail) {
      const mgr = await this.prisma.user.findUnique({ where: { email: changes.newManagerEmail }, select: { empId: true } });
      if (mgr) data.managerId = mgr.empId;
    }

    await this.prisma.user.update({ where: { empId: req.empId }, data });
    await this.prisma.profileUpdateRequest.update({
      where: { id: req.id },
      data: { status: 'Approved', reviewedBy: callerEmpId },
    });
    return { ok: true };
  }

  // ─────────────────────────────────────────────── POST /profile-updates/:reqId/reject
  async rejectProfileUpdate(reqId: string, callerEmpId: string, notes?: string) {
    const req = await this.prisma.profileUpdateRequest.findUnique({ where: { reqId } });
    if (!req) throw new NotFoundException('Profile request not found');
    const caller = await this.getCaller(callerEmpId);
    if (!isAdmin(caller.role) && !(await this.canReviewProfileRequest(req.empId, caller))) {
      throw new ForbiddenException('Not authorized to reject this request.');
    }
    await this.prisma.profileUpdateRequest.update({
      where: { id: req.id },
      data: { status: 'Rejected', reviewedBy: callerEmpId, notes },
    });
    return { ok: true };
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

  private async getApprovableEmpIds(caller: Caller): Promise<string[]> {
    const or: Array<{ managerId: string } | { team: string }> = [{ managerId: caller.empId }];
    if (caller.team) or.push({ team: caller.team });
    const users = await this.prisma.user.findMany({ where: { OR: or }, select: { empId: true } });
    return users.map((u) => u.empId);
  }

  private async canReviewProfileRequest(targetEmpId: string, caller: Caller): Promise<boolean> {
    const target = await this.prisma.user.findUnique({ where: { empId: targetEmpId }, select: { managerId: true, team: true } });
    if (!target) return false;
    if (target.managerId === caller.empId) return true;
    return !!caller.team && !!target.team && target.team === caller.team;
  }

  private parseChanges(raw: string): Record<string, unknown> {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
}
