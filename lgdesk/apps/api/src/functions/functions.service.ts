import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IdUtilsService } from '../common/utils/id.utils';
import { isAdmin, isManager, parseIds, joinIds } from '../common/constants';
import { WorkFunction } from '../common/api-types';
import { CreateFunctionDto } from './dto/create-function.dto';
import { UpdateFunctionDto } from './dto/update-function.dto';

type Caller = { empId: string; role: string; team: string | null };
type FnRow = {
  id: string; functionId: string; parentFnId: string | null; projId: string | null;
  name: string; description: string | null; assignerId: string; assigneeIds: string;
  assignedTeams: string; status: string; priority: string; startDate: Date | null;
  deadline: Date | null; links: string | null; createdById: string; createdAt: Date; updatedAt: Date;
};

@Injectable()
export class FunctionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly idUtils: IdUtilsService,
  ) {}

  // Rule #22: a TM/Intern may only create/update a function whose assignees are
  // empty or exactly themselves.
  isTmSelfAssign(assigneeIds: string[], callerEmpId: string): boolean {
    if (assigneeIds.length === 0) return true;
    return assigneeIds.length === 1 && assigneeIds[0] === callerEmpId;
  }

  async getAuthorizedFunctions(callerEmpId: string, projId?: string): Promise<WorkFunction[]> {
    const caller = await this.getCaller(callerEmpId);
    const all = await this.prisma.workFunction.findMany({
      where: projId ? { projId } : {},
      orderBy: { createdAt: 'desc' },
    });

    let visible: FnRow[];
    if (isAdmin(caller.role)) visible = all;
    else if (isManager(caller.role)) visible = all.filter((f) => this.visibleToManager(f, caller));
    else visible = all.filter((f) => this.ownedBy(f, callerEmpId));

    // Include parent functions for context (sub-function chains).
    const byId = new Map(all.map((f) => [f.functionId, f]));
    const result = new Map(visible.map((f) => [f.functionId, f]));
    for (const f of visible) {
      let parentId = f.parentFnId;
      while (parentId && byId.has(parentId) && !result.has(parentId)) {
        const parent = byId.get(parentId)!;
        result.set(parent.functionId, parent);
        parentId = parent.parentFnId;
      }
    }
    return Array.from(result.values()).map((f) => this.mapFunction(f));
  }

  async getFunctionById(functionId: string, callerEmpId: string) {
    const fn = await this.requireFn(functionId);
    const caller = await this.getCaller(callerEmpId);
    if (!this.canView(fn, caller)) throw new ForbiddenException();

    const [children, taskCount] = await Promise.all([
      this.prisma.workFunction.findMany({ where: { parentFnId: functionId }, orderBy: { createdAt: 'asc' } }),
      this.prisma.task.count({ where: { functionId } }),
    ]);
    return {
      ...this.mapFunction(fn),
      children: children.map((c) => this.mapFunction(c)),
      taskCount,
    };
  }

  async createFunction(dto: CreateFunctionDto, callerEmpId: string): Promise<WorkFunction> {
    const caller = await this.getCaller(callerEmpId);
    const assigneeIds = dto.assigneeIds ?? [];
    if (!isManager(caller.role) && !this.isTmSelfAssign(assigneeIds, callerEmpId)) {
      throw new ForbiddenException('You may only assign functions to yourself');
    }
    const teams = dto.assignedTeams ?? [];
    const functionId = await this.idUtils.generateId('workFunction', 'functionId', 'FN');
    const history = [{ date: new Date().toISOString(), by: callerEmpId, assignees: assigneeIds, teams }];

    const created = await this.prisma.workFunction.create({
      data: {
        functionId,
        parentFnId: dto.parentFnId,
        projId: dto.projId,
        name: dto.name,
        description: dto.description,
        assignerId: callerEmpId, // ← from JWT
        createdById: callerEmpId, // ← from JWT
        assigneeIds: joinIds(assigneeIds),
        assignedTeams: joinIds(teams),
        status: dto.status ?? 'Not Started',
        priority: dto.priority ?? 'Medium',
        deadline: dto.deadline ? new Date(dto.deadline) : null,
        links: dto.links ? joinIds(dto.links) : null,
        assignmentHistory: JSON.stringify(history),
      },
    });
    await this.audit(callerEmpId, 'CREATE', created.functionId);
    return this.mapFunction(created);
  }

  async updateFunction(functionId: string, dto: UpdateFunctionDto, callerEmpId: string): Promise<WorkFunction> {
    const fn = await this.requireFn(functionId);
    const caller = await this.getCaller(callerEmpId);
    if (!this.canModify(fn, caller)) throw new ForbiddenException();

    // TM/Intern: re-check self-assign on the new assignee set.
    if (!isManager(caller.role) && dto.assigneeIds !== undefined && !this.isTmSelfAssign(dto.assigneeIds, callerEmpId)) {
      throw new ForbiddenException('You may only assign functions to yourself');
    }

    const data: {
      name?: string; description?: string | null; projId?: string | null; parentFnId?: string | null;
      status?: string; priority?: string; deadline?: Date | null;
      assigneeIds?: string; assignedTeams?: string; links?: string | null;
    } = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.projId !== undefined) data.projId = dto.projId;
    if (dto.parentFnId !== undefined) data.parentFnId = dto.parentFnId;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.deadline !== undefined) data.deadline = dto.deadline ? new Date(dto.deadline) : null;
    if (dto.assigneeIds !== undefined) data.assigneeIds = joinIds(dto.assigneeIds);
    if (dto.assignedTeams !== undefined) data.assignedTeams = joinIds(dto.assignedTeams);
    if (dto.links !== undefined) data.links = dto.links ? joinIds(dto.links) : null;
    // assignerId is never changed.

    const updated = await this.prisma.workFunction.update({ where: { functionId }, data });
    await this.audit(callerEmpId, 'UPDATE', functionId);
    return this.mapFunction(updated);
  }

  async deleteFunction(functionId: string, callerEmpId: string): Promise<{ ok: true }> {
    const caller = await this.getCaller(callerEmpId);
    const fn = await this.requireFn(functionId);
    if (!this.canDelete(fn, caller)) throw new ForbiddenException();

    const ids = await this.collectDescendants(functionId);
    // Unlink tasks (do NOT delete tasks), then delete the function subtree.
    await this.prisma.task.updateMany({ where: { functionId: { in: ids } }, data: { functionId: null } });
    await this.prisma.workFunction.deleteMany({ where: { functionId: { in: ids } } });
    await this.audit(callerEmpId, 'DELETE', functionId);
    return { ok: true };
  }

  // ═══════════════════════════════════════════════ helpers
  private async getCaller(empId: string): Promise<Caller> {
    const caller = await this.prisma.user.findUnique({
      where: { empId },
      select: { empId: true, role: true, team: true },
    });
    if (!caller) throw new ForbiddenException();
    return caller;
  }

  private async requireFn(functionId: string): Promise<FnRow> {
    const fn = await this.prisma.workFunction.findUnique({ where: { functionId } });
    if (!fn) throw new NotFoundException('Function not found');
    return fn;
  }

  private async collectDescendants(functionId: string): Promise<string[]> {
    const all = [functionId];
    const queue = [functionId];
    while (queue.length) {
      const cur = queue.shift() as string;
      const children = await this.prisma.workFunction.findMany({
        where: { parentFnId: cur },
        select: { functionId: true },
      });
      for (const c of children) {
        all.push(c.functionId);
        queue.push(c.functionId);
      }
    }
    return all;
  }

  private ownedBy(f: FnRow, empId: string): boolean {
    return f.assignerId === empId || f.createdById === empId || parseIds(f.assigneeIds).includes(empId);
  }

  private visibleToManager(f: FnRow, caller: Caller): boolean {
    if (this.ownedBy(f, caller.empId)) return true;
    if (caller.team && parseIds(f.assignedTeams).includes(caller.team)) return true;
    return false;
  }

  private canView(f: FnRow, caller: Caller): boolean {
    if (isAdmin(caller.role)) return true;
    if (isManager(caller.role)) return this.visibleToManager(f, caller);
    return this.ownedBy(f, caller.empId);
  }

  private canModify(f: FnRow, caller: Caller): boolean {
    if (isAdmin(caller.role)) return true;
    if (f.assignerId === caller.empId || f.createdById === caller.empId) return true;
    if (parseIds(f.assigneeIds).includes(caller.empId)) return true;
    if (isManager(caller.role) && caller.team && parseIds(f.assignedTeams).includes(caller.team)) return true;
    return false;
  }

  // RBAC matrix Row 9: Admin/SA always; TC/TF within their own team (flat
  // Team-string match against assignedTeams). TM/Intern can never delete.
  private canDelete(f: FnRow, caller: Caller): boolean {
    if (isAdmin(caller.role)) return true;
    if (isManager(caller.role) && caller.team && parseIds(f.assignedTeams).includes(caller.team)) return true;
    return false;
  }

  private mapFunction(f: FnRow): WorkFunction {
    return {
      id: f.id,
      functionId: f.functionId,
      parentFnId: f.parentFnId ?? undefined,
      projId: f.projId ?? undefined,
      name: f.name,
      description: f.description ?? undefined,
      assignerId: f.assignerId,
      assigneeIds: parseIds(f.assigneeIds),
      assignedTeams: parseIds(f.assignedTeams),
      status: f.status,
      priority: f.priority,
      startDate: f.startDate ? f.startDate.toISOString() : undefined,
      deadline: f.deadline ? f.deadline.toISOString() : undefined,
      createdAt: f.createdAt.toISOString(),
      updatedAt: f.updatedAt.toISOString(),
    };
  }

  private async audit(empId: string, action: string, entityId: string) {
    await this.prisma.auditLog.create({
      data: { empId, action, entity: 'WorkFunction', entityId },
    });
  }
}
