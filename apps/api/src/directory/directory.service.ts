import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const USER_SELECT = {
  id: true, empId: true, firstName: true, lastName: true, email: true, role: true,
  designation: true, managerId: true, team: true, subDepartment: true, isActive: true,
  dob: true, createdAt: true, updatedAt: true,
} as const;

type UserRow = {
  empId: string; firstName: string; lastName: string; managerId: string | null;
  team: string | null; [key: string]: unknown;
};

@Injectable()
export class DirectoryService {
  private orgCache: { at: number; data: UserRow[] } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async getTeamDirectory(callerEmpId: string) {
    const caller = await this.getCaller(callerEmpId);
    const [members, nameMap] = await Promise.all([
      this.prisma.user.findMany({ where: { team: caller.team, isActive: true }, select: USER_SELECT, orderBy: { firstName: 'asc' } }),
      this.nameMap(),
    ]);
    return members.map((u) => ({ ...u, managerName: u.managerId ? nameMap.get(u.managerId) ?? null : null }));
  }

  async getCompanyDirectory(_callerEmpId: string) {
    const [all, nameMap] = await Promise.all([
      this.prisma.user.findMany({ where: { isActive: true }, select: USER_SELECT, orderBy: { firstName: 'asc' } }),
      this.nameMap(),
    ]);
    return all.map((u) => ({
      ...u,
      managerName: u.managerId ? nameMap.get(u.managerId) ?? null : null,
      chatSpaceLink: '', // placeholder until Chat Spaces are configured
    }));
  }

  async getOrgChartData(): Promise<UserRow[]> {
    const now = Date.now();
    if (this.orgCache && now - this.orgCache.at < 10 * 60 * 1000) return this.orgCache.data;
    const users = (await this.prisma.user.findMany({ where: { isActive: true }, select: USER_SELECT })) as unknown as UserRow[];
    this.orgCache = { at: now, data: users };
    return users;
  }

  // ═══════════════════════════════════════════════ helpers
  private async getCaller(empId: string) {
    const caller = await this.prisma.user.findUnique({ where: { empId }, select: { empId: true, role: true, team: true } });
    if (!caller) throw new ForbiddenException();
    return caller;
  }

  private async nameMap(): Promise<Map<string, string>> {
    const users = await this.prisma.user.findMany({ select: { empId: true, firstName: true, lastName: true } });
    return new Map(users.map((u) => [u.empId, `${u.firstName} ${u.lastName}`]));
  }
}
