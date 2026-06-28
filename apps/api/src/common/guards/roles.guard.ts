import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector, private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(), context.getClass()
    ]);
    if (!required) return true;
    const { user } = context.switchToHttp().getRequest();
    // Always re-validate role from DB (business rule #16)
    const dbUser = await this.prisma.user.findUnique({ where: { empId: user.empId } });
    if (!dbUser || !required.includes(dbUser.role)) throw new ForbiddenException();
    return true;
  }
}
