import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IdUtilsService } from '../common/utils/id.utils';
import { isAdmin } from '../common/constants';

type EntityType = 'Task' | 'Project' | 'Function';

@Injectable()
export class DdrService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly idUtils: IdUtilsService,
  ) {}

  // Non-assigners submit a DDR; assigners/admins change the date directly (rule #13).
  async createDdr(
    entityType: EntityType,
    entityId: string,
    newDueDate: string,
    reason: string,
    callerEmpId: string,
  ) {
    const due = new Date(newDueDate);
    if (Number.isNaN(due.getTime())) throw new BadRequestException('Invalid date');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (due < today) throw new BadRequestException('New due date cannot be in the past');

    const assignerId = await this.getEntityAssigner(entityType, entityId);
    if (assignerId === null) throw new NotFoundException('Entity not found');
    if (assignerId === callerEmpId) {
      throw new BadRequestException('Assigners change the due date directly, not via a request');
    }

    const ddrId = await this.idUtils.generateId('dueDateRequest', 'ddrId', 'DDR');
    await this.prisma.dueDateRequest.create({
      data: { ddrId, entityType, entityId, newDueDate: due, reason, requestedBy: callerEmpId, status: 'Pending' },
    });
    return { ddrId };
  }

  async getDdrs(callerEmpId: string, status?: string) {
    const caller = await this.getCaller(callerEmpId);
    const ddrs = await this.prisma.dueDateRequest.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
    });
    if (isAdmin(caller.role)) return ddrs;

    // Otherwise: DDRs the caller assigned the entity for, or that they requested.
    const out = [];
    for (const d of ddrs) {
      const assignerId = await this.getEntityAssigner(d.entityType as EntityType, d.entityId);
      if (assignerId === callerEmpId || d.requestedBy === callerEmpId) out.push(d);
    }
    return out;
  }

  async approveDdr(ddrId: string, callerEmpId: string) {
    const ddr = await this.prisma.dueDateRequest.findUnique({ where: { ddrId } });
    if (!ddr) throw new NotFoundException('Request not found');
    if (ddr.status !== 'Pending') throw new BadRequestException('Request already processed');
    await this.assertCanReview(ddr.entityType as EntityType, ddr.entityId, callerEmpId);

    await this.applyDueDate(ddr.entityType as EntityType, ddr.entityId, ddr.newDueDate);
    await this.prisma.dueDateRequest.update({
      where: { ddrId },
      data: { status: 'Approved', reviewedBy: callerEmpId },
    });
    await this.audit(callerEmpId, 'APPROVE_DDR', ddr.ddrId);
    return { ok: true };
  }

  async rejectDdr(ddrId: string, callerEmpId: string, notes?: string) {
    const ddr = await this.prisma.dueDateRequest.findUnique({ where: { ddrId } });
    if (!ddr) throw new NotFoundException('Request not found');
    if (ddr.status !== 'Pending') throw new BadRequestException('Request already processed');
    await this.assertCanReview(ddr.entityType as EntityType, ddr.entityId, callerEmpId);

    await this.prisma.dueDateRequest.update({
      where: { ddrId },
      data: { status: 'Rejected', reviewedBy: callerEmpId, notes },
    });
    await this.audit(callerEmpId, 'REJECT_DDR', ddr.ddrId);
    return { ok: true };
  }

  async getPendingDdrCount(callerEmpId: string) {
    const ddrs = await this.prisma.dueDateRequest.findMany({ where: { status: 'Pending' } });
    let count = 0;
    for (const d of ddrs) {
      const assignerId = await this.getEntityAssigner(d.entityType as EntityType, d.entityId);
      if (assignerId === callerEmpId) count++;
    }
    return { count };
  }

  // ═══════════════════════════════════════════════ helpers
  private async getCaller(empId: string) {
    const caller = await this.prisma.user.findUnique({ where: { empId }, select: { empId: true, role: true } });
    if (!caller) throw new ForbiddenException();
    return caller;
  }

  // Only the entity's assigner or an admin may approve/reject.
  private async assertCanReview(entityType: EntityType, entityId: string, callerEmpId: string) {
    const caller = await this.getCaller(callerEmpId);
    if (isAdmin(caller.role)) return;
    const assignerId = await this.getEntityAssigner(entityType, entityId);
    if (assignerId !== callerEmpId) throw new ForbiddenException();
  }

  private async getEntityAssigner(entityType: EntityType, entityId: string): Promise<string | null> {
    if (entityType === 'Task') {
      const t = await this.prisma.task.findUnique({ where: { taskId: entityId }, select: { assignerId: true } });
      return t?.assignerId ?? null;
    }
    if (entityType === 'Project') {
      const p = await this.prisma.project.findUnique({ where: { projId: entityId }, select: { assignerId: true } });
      return p?.assignerId ?? null;
    }
    if (entityType === 'Function') {
      const f = await this.prisma.workFunction.findUnique({ where: { functionId: entityId }, select: { assignerId: true } });
      return f?.assignerId ?? null;
    }
    return null;
  }

  private async applyDueDate(entityType: EntityType, entityId: string, newDueDate: Date) {
    if (entityType === 'Task') {
      await this.prisma.task.update({ where: { taskId: entityId }, data: { dueDate: newDueDate } });
    } else if (entityType === 'Project') {
      await this.prisma.project.update({ where: { projId: entityId }, data: { deadline: newDueDate } });
    } else if (entityType === 'Function') {
      await this.prisma.workFunction.update({ where: { functionId: entityId }, data: { deadline: newDueDate } });
    }
  }

  private async audit(empId: string, action: string, entityId: string) {
    await this.prisma.auditLog.create({
      data: { empId, action, entity: 'DueDateRequest', entityId },
    });
  }
}
