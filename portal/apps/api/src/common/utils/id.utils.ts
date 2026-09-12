import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// Direct port of LGDesk's apps/api/src/common/utils/id.utils.ts -- same shared IdCounter
// table, same collision-safe retry loop. Portal must keep issuing REG-XXXXX from this exact
// counter so it continues LGDesk's existing sequence rather than starting a new one.
@Injectable()
export class IdUtilsService {
  constructor(private prisma: PrismaService) {}

  async generateId(_model: string, _idField: string, prefix: string): Promise<string> {
    const counter = await this.prisma.idCounter.upsert({
      where: { prefix },
      create: { prefix, nextValue: 2 },
      update: { nextValue: { increment: 1 } },
    });
    return `${prefix}-${String(counter.nextValue - 1).padStart(5, '0')}`;
  }

  async createWithId<T>(
    model: string,
    idField: string,
    prefix: string,
    run: (id: string) => Promise<T>,
    maxRetries = 5,
  ): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      const id = await this.generateId(model, idField, prefix);
      try {
        return await run(id);
      } catch (err) {
        const e = err as { code?: string; meta?: { target?: unknown } };
        const target = e?.meta?.target;
        const idCollided = Array.isArray(target)
          ? target.includes(idField)
          : String(target ?? '').includes(idField);
        if (e?.code === 'P2002' && idCollided && attempt < maxRetries) continue;
        throw err;
      }
    }
  }
}
