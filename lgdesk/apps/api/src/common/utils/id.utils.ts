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

  /**
   * Collision-safe create: generate the next sequential ID, run the create/upsert,
   * and if a concurrent save grabbed the same ID first (unique-constraint P2002 on
   * `idField`), regenerate and retry. `generateId` alone is a naive SELECT-MAX+INSERT
   * and races under concurrent saves (e.g. two employees submitting work logs at once);
   * the `@unique` DB constraint + this retry loop make the operation safe (business
   * requirement: work-log IDs must never collide under concurrent submission).
   */
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
        // Prisma throws PrismaClientKnownRequestError with code 'P2002' on a unique
        // violation. Retry ONLY when it's the generated ID column that collided —
        // any other unique conflict (e.g. empId+date) is a real error, so rethrow.
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
