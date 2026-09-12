import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { isAdmin } from '../common/constants';

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

  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────── reads
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

  // Profile-update submission/approval retired from LGDesk in P21 (Phase 5b) -- Portal's
  // POST /profile-updates and GET/POST /profile-updates/:id/approve|reject are now the
  // only place this action exists.

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
