import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class IdUtilsService {
  constructor(private prisma: PrismaService) {}

  async generateId(model: string, idField: string, prefix: string): Promise<string> {
    const last = await (this.prisma as any)[model].findFirst({ orderBy: { createdAt: 'desc' } });
    if (!last) return `${prefix}-00001`;
    const n = parseInt(last[idField].split('-').pop(), 10);
    return `${prefix}-${String(n + 1).padStart(5, '0')}`;
  }
}
