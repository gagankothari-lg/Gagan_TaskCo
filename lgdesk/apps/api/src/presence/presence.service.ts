import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PRESENCE_STATUSES, STALE_MS } from './presence.constants';

@Injectable()
export class PresenceService {
  constructor(private readonly prisma: PrismaService) {}

  async setStatus(empId: string, status?: string) {
    const data: { presenceUpdatedAt: Date; presenceStatus?: string } = { presenceUpdatedAt: new Date() };
    if (status && (PRESENCE_STATUSES as readonly string[]).includes(status)) data.presenceStatus = status;
    const user = await this.prisma.user.update({
      where: { empId },
      data,
      select: { presenceStatus: true, presenceUpdatedAt: true },
    });
    return { status: user.presenceStatus, updatedAt: user.presenceUpdatedAt };
  }

  // Postgres-native equivalent of the reference's cache-TTL auto-expiry: staleness is
  // computed fresh at read time from a plain column, not a background job or a stored
  // "offline" write -- a user whose heartbeat has stopped (closed tab, crashed session)
  // reads as effectively offline regardless of their last explicit status, without ever
  // needing a cron to go flip anyone's row.
  async getAll(): Promise<Record<string, string>> {
    const users = await this.prisma.user.findMany({
      where: { isActive: true },
      select: { empId: true, presenceStatus: true, presenceUpdatedAt: true },
    });
    const now = Date.now();
    const result: Record<string, string> = {};
    for (const u of users) {
      const stale = !u.presenceUpdatedAt || now - u.presenceUpdatedAt.getTime() > STALE_MS;
      result[u.empId] = stale ? 'offline' : u.presenceStatus;
    }
    return result;
  }
}
