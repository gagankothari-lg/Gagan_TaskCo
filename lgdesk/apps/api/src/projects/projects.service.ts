import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IdUtilsService } from '../common/utils/id.utils';
import { CalendarService } from '../calendar/calendar.service';
import { isAdmin, isManager, parseIds, joinIds } from '../common/constants';
import { Project } from '../common/api-types';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

type Caller = { empId: string; role: string; team: string | null };
type ProjectRow = {
  id: string; projId: string; parentProjId: string | null; name: string; description: string | null;
  ownerIds: string; assignerId: string; assigneeIds: string; assignedTeams: string; status: string;
  priority: string; startDate: Date | null; deadline: Date | null; calEventId: string | null; createdAt: Date; updatedAt: Date;
};

export type ProjectScope = 'mine' | 'team' | 'all';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly idUtils: IdUtilsService,
    private readonly calendar: CalendarService,
  ) {}

  async getAuthorizedProjects(callerEmpId: string, scope?: ProjectScope): Promise<Project[]> {
    const caller = await this.getCaller(callerEmpId);
    const effective: ProjectScope =
      scope ?? (isAdmin(caller.role) ? 'all' : isManager(caller.role) ? 'team' : 'mine');

    const all = await this.prisma.project.findMany({ orderBy: { createdAt: 'desc' } });

    let visible: ProjectRow[];
    if (effective === 'all') {
      visible = all;
    } else if (effective === 'team') {
      visible = all.filter((p) => this.visibleToManager(p, caller));
    } else {
      visible = all.filter((p) => this.ownedBy(p, callerEmpId));
    }

    // Include parent projects for context even if not directly authorized.
    const byId = new Map(all.map((p) => [p.projId, p]));
    const result = new Map(visible.map((p) => [p.projId, p]));
    for (const p of visible) {
      let parentId = p.parentProjId;
      while (parentId && byId.has(parentId) && !result.has(parentId)) {
        const parent = byId.get(parentId)!;
        result.set(parent.projId, parent);
        parentId = parent.parentProjId;
      }
    }
    return Array.from(result.values()).map((p) => this.mapProject(p));
  }

  async getProjectById(projId: string, callerEmpId: string) {
    const project = await this.requireProject(projId);
    const caller = await this.getCaller(callerEmpId);
    if (!this.canView(project, caller)) throw new ForbiddenException();

    const [taskCount, subProjectCount, functionCount] = await Promise.all([
      this.prisma.task.count({ where: { projId } }),
      this.prisma.project.count({ where: { parentProjId: projId } }),
      this.prisma.workFunction.count({ where: { projId } }),
    ]);
    return { ...this.mapProject(project), taskCount, subProjectCount, functionCount };
  }

  async createProject(dto: CreateProjectDto, callerEmpId: string): Promise<Project> {
    const caller = await this.getCaller(callerEmpId);
    if (!isManager(caller.role)) throw new ForbiddenException(); // managers/admins only

    const projId = await this.idUtils.generateId('project', 'projId', 'PRJ');
    const assigneeIds = dto.assigneeIds ?? [];
    const teams = dto.assignedTeams ?? [];
    const history = [
      { date: new Date().toISOString(), by: callerEmpId, assignees: assigneeIds, teams },
    ];

    const created = await this.prisma.project.create({
      data: {
        projId,
        parentProjId: dto.parentProjId,
        name: dto.name,
        description: dto.description,
        ownerIds: joinIds([callerEmpId]), // creator owns it; admins can change later
        assignerId: callerEmpId, // ← from JWT
        assigneeIds: joinIds(assigneeIds),
        assignedTeams: joinIds(teams),
        status: dto.status ?? 'Not Started',
        priority: dto.priority ?? 'Medium',
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        deadline: dto.deadline ? new Date(dto.deadline) : null,
        assignmentHistory: JSON.stringify(history),
      },
    });
    await this.audit(callerEmpId, 'CREATE', created.projId);
    if (created.deadline) {
      void this.calendar.createGCalEvent({
        title: `[Project] ${created.name}`,
        description: `Status: ${created.status} · Priority: ${created.priority}`,
        startDate: created.deadline,
        allDay: true,
        colorId: '9',
      }).then((eventId) => {
        if (eventId) this.prisma.project.update({ where: { projId: created.projId }, data: { calEventId: eventId } }).catch(() => undefined);
      }).catch(() => undefined);
    }
    return this.mapProject(created);
  }

  async updateProject(projId: string, dto: UpdateProjectDto, callerEmpId: string): Promise<Project> {
    const project = await this.requireProject(projId);
    const caller = await this.getCaller(callerEmpId);
    if (!this.canModify(project, caller)) throw new ForbiddenException();

    const data: {
      name?: string; description?: string | null; status?: string; priority?: string;
      startDate?: Date | null; deadline?: Date | null; parentProjId?: string | null;
      assigneeIds?: string; assignedTeams?: string; ownerIds?: string;
    } = {};

    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.startDate !== undefined) data.startDate = dto.startDate ? new Date(dto.startDate) : null;
    if (dto.deadline !== undefined) data.deadline = dto.deadline ? new Date(dto.deadline) : null;
    if (dto.parentProjId !== undefined) data.parentProjId = dto.parentProjId;
    if (dto.assigneeIds !== undefined) data.assigneeIds = joinIds(dto.assigneeIds);
    if (dto.assignedTeams !== undefined) data.assignedTeams = joinIds(dto.assignedTeams);
    // ownerIds: ONLY an admin may change it (rule #2).
    if (dto.ownerIds !== undefined && isAdmin(caller.role)) data.ownerIds = joinIds(dto.ownerIds);

    const updated = await this.prisma.project.update({ where: { projId }, data });
    await this.audit(callerEmpId, 'UPDATE', projId);
    if (updated.deadline) {
      const calParams = { title: `[Project] ${updated.name}`, description: `Status: ${updated.status} · Priority: ${updated.priority}`, startDate: updated.deadline, allDay: true };
      if (updated.calEventId) {
        void this.calendar.updateGCalEvent(updated.calEventId, calParams).catch(() => undefined);
      } else {
        void this.calendar.createGCalEvent({ ...calParams, colorId: '9' }).then((eventId) => {
          if (eventId) this.prisma.project.update({ where: { projId }, data: { calEventId: eventId } }).catch(() => undefined);
        }).catch(() => undefined);
      }
    }
    return this.mapProject(updated);
  }

  async deleteProject(projId: string, callerEmpId: string): Promise<{ ok: true }> {
    const caller = await this.getCaller(callerEmpId);
    if (!isAdmin(caller.role)) throw new ForbiddenException();
    const project = await this.requireProject(projId);
    if (project.calEventId) void this.calendar.deleteGCalEvent(project.calEventId).catch(() => undefined);
    await this.prisma.project.delete({ where: { projId } });
    await this.audit(callerEmpId, 'DELETE', projId);
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

  private async requireProject(projId: string): Promise<ProjectRow> {
    const p = await this.prisma.project.findUnique({ where: { projId } });
    if (!p) throw new NotFoundException('Project not found');
    return p;
  }

  private ownedBy(p: ProjectRow, empId: string): boolean {
    return (
      p.assignerId === empId ||
      parseIds(p.ownerIds).includes(empId) ||
      parseIds(p.assigneeIds).includes(empId)
    );
  }

  private visibleToManager(p: ProjectRow, caller: Caller): boolean {
    if (this.ownedBy(p, caller.empId)) return true;
    if (caller.team && parseIds(p.assignedTeams).includes(caller.team)) return true;
    return false;
  }

  private canView(p: ProjectRow, caller: Caller): boolean {
    if (isAdmin(caller.role)) return true;
    if (isManager(caller.role)) return this.visibleToManager(p, caller);
    return this.ownedBy(p, caller.empId);
  }

  private canModify(p: ProjectRow, caller: Caller): boolean {
    if (isAdmin(caller.role)) return true;
    if (parseIds(p.ownerIds).includes(caller.empId)) return true;
    if (isManager(caller.role) && caller.team && parseIds(p.assignedTeams).includes(caller.team)) return true;
    return false;
  }

  private mapProject(p: ProjectRow): Project {
    return {
      id: p.id,
      projId: p.projId,
      parentProjId: p.parentProjId ?? undefined,
      name: p.name,
      description: p.description ?? undefined,
      ownerIds: parseIds(p.ownerIds),
      assignerId: p.assignerId,
      assigneeIds: parseIds(p.assigneeIds),
      assignedTeams: parseIds(p.assignedTeams),
      status: p.status,
      priority: p.priority,
      startDate: p.startDate ? p.startDate.toISOString() : undefined,
      deadline: p.deadline ? p.deadline.toISOString() : undefined,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  }

  private async audit(empId: string, action: string, entityId: string) {
    await this.prisma.auditLog.create({
      data: { empId, action, entity: 'Project', entityId },
    });
  }
}
