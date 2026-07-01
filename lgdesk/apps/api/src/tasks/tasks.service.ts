import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IdUtilsService } from '../common/utils/id.utils';
import { UsersService } from '../users/users.service';
import { CalendarService } from '../calendar/calendar.service';
import { isAdmin, isManager, parseIds, joinIds } from '../common/constants';
import { Task, AssignmentEntry } from '../common/api-types';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { CreateProgressDto } from './dto/create-progress.dto';

type Caller = { empId: string; role: string; team: string | null };
type TaskRow = {
  id: string; taskId: string; projId: string | null; functionId: string | null;
  subFnId: string | null; title: string; description: string | null;
  assigneeIds: string; assignedTeams: string; assignerId: string; status: string;
  priority: string; recurring: boolean; dueDate: Date | null; estimatedHours: number | null;
  actualHours: number; fileLink: string | null; links: string | null;
  calEventId: string | null; assignmentHistory: string; createdAt: Date; updatedAt: Date;
};

export type Scope = 'mine' | 'team' | 'all';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly idUtils: IdUtilsService,
    private readonly users: UsersService,
    private readonly calendar: CalendarService,
  ) {}

  // ─────────────────────────────────────────────── reads
  async getAuthorizedTasks(callerEmpId: string, scope?: Scope): Promise<Task[]> {
    const caller = await this.getCaller(callerEmpId);
    const effective: Scope =
      scope ?? (isAdmin(caller.role) ? 'all' : isManager(caller.role) ? 'team' : 'mine');

    if (effective === 'all') {
      const rows = await this.prisma.task.findMany({ orderBy: { createdAt: 'desc' } });
      return rows.map((t) => this.mapTask(t));
    }

    if (effective === 'mine') {
      const rows = await this.prisma.task.findMany({
        where: { OR: [{ assignerId: callerEmpId }, { assigneeIds: { contains: callerEmpId } }] },
        orderBy: { createdAt: 'desc' },
      });
      return rows.filter((t) => this.ownedBy(t, callerEmpId)).map((t) => this.mapTask(t));
    }

    // team scope (manager)
    const scopeIds = await this.managerScopeIds(caller);
    const rows = await this.prisma.task.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.filter((t) => this.visibleToManager(t, caller, scopeIds)).map((t) => this.mapTask(t));
  }

  async getTaskById(taskId: string, callerEmpId: string): Promise<Task> {
    const task = await this.requireTask(taskId);
    const caller = await this.getCaller(callerEmpId);
    if (!(await this.canModifyTask(task, caller))) throw new ForbiddenException();
    return this.mapTask(task);
  }

  // dueDate within [weekStart, weekStart+7d), grouped by ISO date.
  async getPlanWeek(callerEmpId: string, weekStart?: string): Promise<Record<string, Task[]>> {
    const tasks = await this.getAuthorizedTasks(callerEmpId);
    const start = weekStart ? new Date(weekStart) : new Date();
    const startDay = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
    const end = new Date(startDay);
    end.setUTCDate(end.getUTCDate() + 7);

    const grouped: Record<string, Task[]> = {};
    for (const t of tasks) {
      if (!t.dueDate) continue;
      const due = new Date(t.dueDate);
      if (due >= startDay && due < end) {
        const key = due.toISOString().slice(0, 10);
        (grouped[key] ??= []).push(t);
      }
    }
    return grouped;
  }

  // ─────────────────────────────────────────────── mutations
  async createTask(dto: CreateTaskDto, callerEmpId: string): Promise<Task> {
    const assigneeSet = new Set(dto.assigneeIds ?? []);
    if (dto.assignedTeams?.length) {
      for (const id of await this.resolveTeamToEmpIds(dto.assignedTeams)) assigneeSet.add(id);
    }
    const assigneeIds = [...assigneeSet];
    const teams = dto.assignedTeams ?? [];

    const taskId = await this.idUtils.generateId('task', 'taskId', 'TSK');
    const history: AssignmentEntry[] = [
      { date: new Date().toISOString(), by: callerEmpId, assignees: assigneeIds, teams },
    ];

    const created = await this.prisma.task.create({
      data: {
        taskId,
        title: dto.title,
        description: dto.description,
        projId: dto.projId,
        functionId: dto.functionId,
        subFnId: dto.subFnId,
        assigneeIds: joinIds(assigneeIds),
        assignedTeams: joinIds(teams),
        assignerId: callerEmpId, // ← from JWT, NEVER from body (rule #2)
        status: dto.status ?? 'Not Started',
        priority: dto.priority ?? 'Medium',
        recurring: dto.recurring ?? false,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        estimatedHours: dto.estimatedHours,
        fileLink: dto.fileLink,
        links: dto.links ? joinIds(dto.links) : null,
        assignmentHistory: JSON.stringify(history),
      },
    });
    await this.audit(callerEmpId, 'CREATE', created.taskId);
    if (created.dueDate) {
      void this.calendar.createGCalEvent({
        title: `[Task] ${created.title}`,
        description: `Status: ${created.status} · Priority: ${created.priority}`,
        startDate: created.dueDate,
        allDay: true,
        colorId: '6',
      }).then((eventId) => {
        if (eventId) this.prisma.task.update({ where: { taskId: created.taskId }, data: { calEventId: eventId } }).catch(() => undefined);
      }).catch(() => undefined);
    }
    return this.mapTask(created);
  }

  async updateTask(taskId: string, dto: UpdateTaskDto, callerEmpId: string): Promise<Task> {
    const task = await this.requireTask(taskId);
    const caller = await this.getCaller(callerEmpId);
    // RBAC matrix Row 2: Interns may NOT update tasks at all, even ones they are
    // assigned to or assigned themselves.
    if (caller.role === 'Intern') throw new ForbiddenException();
    if (!(await this.canModifyTask(task, caller))) throw new ForbiddenException();

    const data: {
      title?: string; description?: string | null; projId?: string | null;
      functionId?: string | null; subFnId?: string | null; status?: string; priority?: string;
      recurring?: boolean; dueDate?: Date | null; estimatedHours?: number | null;
      fileLink?: string | null; links?: string | null;
      assigneeIds?: string; assignedTeams?: string; assignmentHistory?: string;
    } = {};

    // Reassignment → recompute lists and APPEND to assignmentHistory (never replace).
    if (dto.assigneeIds !== undefined || dto.assignedTeams !== undefined) {
      const set = new Set(dto.assigneeIds ?? parseIds(task.assigneeIds));
      const teams = dto.assignedTeams ?? parseIds(task.assignedTeams);
      if (dto.assignedTeams?.length) {
        for (const id of await this.resolveTeamToEmpIds(dto.assignedTeams)) set.add(id);
      }
      const assigneeIds = [...set];
      data.assigneeIds = joinIds(assigneeIds);
      data.assignedTeams = joinIds(teams);
      const history = this.parseHistory(task.assignmentHistory);
      history.push({ date: new Date().toISOString(), by: callerEmpId, assignees: assigneeIds, teams });
      data.assignmentHistory = JSON.stringify(history);
    }

    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.projId !== undefined) data.projId = dto.projId;
    if (dto.functionId !== undefined) data.functionId = dto.functionId;
    if (dto.subFnId !== undefined) data.subFnId = dto.subFnId;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.recurring !== undefined) data.recurring = dto.recurring;
    if (dto.dueDate !== undefined) data.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    if (dto.estimatedHours !== undefined) data.estimatedHours = dto.estimatedHours;
    if (dto.fileLink !== undefined) data.fileLink = dto.fileLink;
    if (dto.links !== undefined) data.links = dto.links ? joinIds(dto.links) : null;

    const before = { status: task.status, dueDate: task.dueDate, assigneeIds: task.assigneeIds };
    const updated = await this.prisma.task.update({ where: { taskId }, data });
    await this.audit(callerEmpId, 'UPDATE', taskId, JSON.stringify(before), JSON.stringify(dto));
    if (updated.dueDate) {
      const calParams = { title: `[Task] ${updated.title}`, description: `Status: ${updated.status} · Priority: ${updated.priority}`, startDate: updated.dueDate, allDay: true };
      if (updated.calEventId) {
        void this.calendar.updateGCalEvent(updated.calEventId, calParams).catch(() => undefined);
      } else {
        void this.calendar.createGCalEvent({ ...calParams, colorId: '6' }).then((eventId) => {
          if (eventId) this.prisma.task.update({ where: { taskId }, data: { calEventId: eventId } }).catch(() => undefined);
        }).catch(() => undefined);
      }
    }
    return this.mapTask(updated);
  }

  async deleteTask(taskId: string, callerEmpId: string): Promise<{ ok: true }> {
    const caller = await this.getCaller(callerEmpId);
    const task = await this.requireTask(taskId);
    if (!this.canDeleteTask(task, caller)) throw new ForbiddenException();
    if (task.calEventId) void this.calendar.deleteGCalEvent(task.calEventId).catch(() => undefined);
    await this.prisma.task.delete({ where: { taskId } }); // ProgressUpdates cascade via FK
    await this.audit(callerEmpId, 'DELETE', taskId);
    return { ok: true };
  }

  // ─────────────────────────────────────────────── progress
  async submitProgressUpdate(taskId: string, dto: CreateProgressDto, callerEmpId: string) {
    const task = await this.requireTask(taskId);
    const caller = await this.getCaller(callerEmpId);
    if (!(await this.canModifyTask(task, caller))) throw new ForbiddenException();

    const updateId = await this.idUtils.generateId('progressUpdate', 'updateId', 'UPD');
    await this.prisma.progressUpdate.create({
      data: {
        updateId,
        taskId,
        projId: task.projId,
        authorEmpId: callerEmpId,
        description: dto.description,
        hoursLogged: dto.hoursLogged,
        blockers: dto.blockers,
      },
    });
    if (dto.hoursLogged) {
      await this.prisma.task.update({
        where: { taskId },
        data: { actualHours: { increment: dto.hoursLogged } },
      });
    }
    return { updateId };
  }

  async getProgressUpdates(taskId: string, callerEmpId: string) {
    const task = await this.requireTask(taskId);
    const caller = await this.getCaller(callerEmpId);
    if (!(await this.canModifyTask(task, caller))) throw new ForbiddenException();
    return this.prisma.progressUpdate.findMany({ where: { taskId }, orderBy: { date: 'desc' } });
  }

  // ─────────────────────────────────────────────── authorization helpers
  // isAdmin → always; assigner/assignee → always; manager → team scope; else false.
  async canModifyTask(task: TaskRow, caller: Caller): Promise<boolean> {
    if (isAdmin(caller.role)) return true;
    if (task.assignerId === caller.empId) return true;
    if (parseIds(task.assigneeIds).includes(caller.empId)) return true;
    if (isManager(caller.role)) {
      if (caller.team && parseIds(task.assignedTeams).includes(caller.team)) return true;
      const subs = await this.users.getSubordinateIds(caller.empId);
      if (parseIds(task.assigneeIds).some((a) => subs.includes(a))) return true;
    }
    return false;
  }

  // RBAC matrix Row 3: Admin/SA always; TC/TF within their own team (flat
  // Team-string match against assignedTeams); the Team Member who created the
  // task (assignerId is set to the creator at creation) — own-created only.
  // Interns can never delete (they fall through to false).
  canDeleteTask(task: TaskRow, caller: Caller): boolean {
    if (isAdmin(caller.role)) return true;
    if (isManager(caller.role) && caller.team && parseIds(task.assignedTeams).includes(caller.team)) return true;
    if (caller.role === 'Team Member' && task.assignerId === caller.empId) return true;
    return false;
  }

  async resolveTeamToEmpIds(teamNames: string[]): Promise<string[]> {
    if (!teamNames.length) return [];
    const users = await this.prisma.user.findMany({
      where: { team: { in: teamNames }, isActive: true },
      select: { empId: true },
    });
    return users.map((u) => u.empId);
  }

  // ═══════════════════════════════════════════════ internals
  private async getCaller(empId: string): Promise<Caller> {
    const caller = await this.prisma.user.findUnique({
      where: { empId },
      select: { empId: true, role: true, team: true },
    });
    if (!caller) throw new ForbiddenException();
    return caller;
  }

  private async requireTask(taskId: string): Promise<TaskRow> {
    const task = await this.prisma.task.findUnique({ where: { taskId } });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  private async managerScopeIds(caller: Caller): Promise<Set<string>> {
    const subs = await this.users.getSubordinateIds(caller.empId);
    return new Set([caller.empId, ...subs]);
  }

  private ownedBy(task: TaskRow, empId: string): boolean {
    return task.assignerId === empId || parseIds(task.assigneeIds).includes(empId);
  }

  private visibleToManager(task: TaskRow, caller: Caller, scopeIds: Set<string>): boolean {
    if (task.assignerId === caller.empId) return true;
    if (parseIds(task.assigneeIds).some((a) => scopeIds.has(a))) return true;
    if (caller.team && parseIds(task.assignedTeams).includes(caller.team)) return true;
    return false;
  }

  private parseHistory(raw: string): AssignmentEntry[] {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as AssignmentEntry[]) : [];
    } catch {
      return [];
    }
  }

  private mapTask(t: TaskRow): Task {
    return {
      id: t.id,
      taskId: t.taskId,
      projId: t.projId ?? undefined,
      functionId: t.functionId ?? undefined,
      title: t.title,
      description: t.description ?? undefined,
      assigneeIds: parseIds(t.assigneeIds),
      assignedTeams: parseIds(t.assignedTeams),
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

  private async audit(
    empId: string,
    action: string,
    entityId: string,
    before: string | null = null,
    after: string | null = null,
  ) {
    await this.prisma.auditLog.create({
      data: { empId, action, entity: 'Task', entityId, before, after },
    });
  }
}
