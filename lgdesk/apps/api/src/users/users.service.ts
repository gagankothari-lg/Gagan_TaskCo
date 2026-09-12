import {
  Injectable,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IdUtilsService } from '../common/utils/id.utils';
import { isAdmin } from '../common/constants';
import { UpdateProfileDto } from './dto/update-profile.dto';

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

  // Shared manager-visibility scope: the caller themselves plus every subordinate beneath
  // them. Extracted from TasksService (PFIX-READY-BATCH-SEQUENTIAL Fix 4) so ProjectsService
  // can widen its own manager-scope check the same way instead of duplicating the logic.
  async managerScopeIds(caller: { empId: string }): Promise<Set<string>> {
    const subs = await this.getSubordinateIds(caller.empId);
    return new Set([caller.empId, ...subs]);
  }

  // ─────────────────────────────────────────────── profile updates
  // Round5 add'l-2: reference (auth.gs:412-420) applies Designation immediately
  // regardless of what else is submitted alongside it in the same call -- only Team/
  // Sub-Department/Manager ever require approval, because only those affect how other
  // users' views of the org structure resolve. The rebuild's own net-new firstName/
  // lastName/dob fields (no reference equivalent) are personal/cosmetic in the same way
  // Designation is, not organizational, so they're grouped with it here rather than
  // left in the "requires approval" bucket by accident of the old single-field check.
  private static readonly PROFILE_IMMEDIATE_KEYS = new Set(['designation', 'firstName', 'lastName', 'dob']);

  async submitProfileUpdate(empId: string, dto: UpdateProfileDto) {
    const provided = Object.entries(dto).filter(([, v]) => v !== undefined && v !== null);
    if (provided.length === 0) throw new BadRequestException('No changes provided');

    const immediate = Object.fromEntries(provided.filter(([k]) => UsersService.PROFILE_IMMEDIATE_KEYS.has(k)));
    const queued = Object.fromEntries(provided.filter(([k]) => !UsersService.PROFILE_IMMEDIATE_KEYS.has(k)));

    if (Object.keys(immediate).length > 0) {
      const data: { firstName?: string; lastName?: string; designation?: string; dob?: Date | null } = {};
      if (typeof immediate.firstName === 'string') data.firstName = immediate.firstName;
      if (typeof immediate.lastName === 'string') data.lastName = immediate.lastName;
      if (typeof immediate.designation === 'string') data.designation = immediate.designation;
      if ('dob' in immediate) data.dob = immediate.dob ? new Date(immediate.dob as string) : null;
      await this.prisma.user.update({ where: { empId }, data });
      await this.audit(empId, 'UPDATE_PROFILE', 'User', empId, null, JSON.stringify(immediate));
    }

    if (Object.keys(queued).length === 0) return { immediate: true };

    // PFIX-IDCOUNTER-BATCH: collision-safe, matching approveRegistration's fix.
    const reqId = await this.idUtils.createWithId('profileUpdateRequest', 'reqId', 'PR', async (id) => {
      await this.prisma.profileUpdateRequest.create({
        data: { reqId: id, empId, changes: JSON.stringify(queued), status: 'Pending' },
      });
      return id;
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
    const memberIds = await this.getApprovableEmpIds(caller);
    return this.prisma.profileUpdateRequest.findMany({
      where: { status: 'Pending', empId: { in: memberIds } },
      orderBy: { createdAt: 'desc' },
    });
  }

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
    // Round5 add'l-2: reference (auth.gs:493-495) resolves the requested manager's email
    // to a real employee and silently no-ops (doesn't reject the whole approval) if the
    // email doesn't match anyone -- mirrored exactly here.
    if (typeof changes.newManagerEmail === 'string' && changes.newManagerEmail) {
      const mgr = await this.prisma.user.findUnique({ where: { email: changes.newManagerEmail }, select: { empId: true } });
      if (mgr) data.managerId = mgr.empId;
    }

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
    const caller = await this.getCaller(callerEmpId);
    if (!isAdmin(caller.role) && !(await this.canReviewProfileRequest(req.empId, caller))) {
      throw new ForbiddenException('Not authorized to reject this request.');
    }
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

    // No one may change their own role through this endpoint (applies to every
    // role, Super Admin included) — checked before any role-specific branching.
    if (callerEmpId === targetEmpId) {
      throw new ForbiddenException('You cannot change your own role.');
    }

    if (isAdmin(caller.role)) {
      // Hierarchy: an Admin may not modify another admin-level account (Admin or
      // Super Admin) — only a Super Admin can touch admin accounts — and an
      // Admin may never grant the Super Admin role.
      if (caller.role === 'Admin' && isAdmin(target.role)) {
        throw new ForbiddenException('Only a Super Admin can change an admin account\'s role');
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

  // Round6 #13: deliberately does NOT touch personalCalendarId or attempt any ACL
  // unshare/calendar-delete step. Confirmed directly against the reference (grepped
  // calendar.gs/auth.gs for any deactivate-time cleanup) -- there is no ACL-remove or
  // calendar-delete call anywhere; a deactivated employee's "TM: {name}" calendar and
  // its share simply persist untouched forever. Matching that, not inventing cleanup
  // the reference doesn't have.
  async deactivateEmployee(targetEmpId: string, callerEmpId: string) {
    const target = await this.prisma.user.findUnique({ where: { empId: targetEmpId } });
    if (!target) throw new NotFoundException('Employee not found');
    await this.prisma.user.update({ where: { empId: targetEmpId }, data: { isActive: false } });
    await this.audit(callerEmpId, 'DEACTIVATE', 'User', targetEmpId, 'active', 'inactive');
    this.clearOrgCache();
    return { ok: true };
  }

  // Out of scope in P03 — a default-manager fallback store is deferred; return ok.
  async setDefaultManager(_email: string, _name: string, _callerEmpId: string) {
    return { ok: true };
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

  // Additive-OR (mirrors LeavesService.getApprovableEmpIds): a manager may
  // review anyone who is either their direct designated report (managerId
  // match) OR on their same team — either condition independently qualifies.
  private async getApprovableEmpIds(caller: { empId: string; team: string | null }): Promise<string[]> {
    const or: Array<{ managerId: string } | { team: string }> = [{ managerId: caller.empId }];
    if (caller.team) or.push({ team: caller.team });
    const users = await this.prisma.user.findMany({ where: { OR: or }, select: { empId: true } });
    return users.map((u) => u.empId);
  }

  private async canReviewProfileRequest(targetEmpId: string, caller: { empId: string; team: string | null }): Promise<boolean> {
    const target = await this.prisma.user.findUnique({ where: { empId: targetEmpId }, select: { managerId: true, team: true } });
    if (!target) return false;
    if (target.managerId === caller.empId) return true;
    return !!caller.team && !!target.team && target.team === caller.team;
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
