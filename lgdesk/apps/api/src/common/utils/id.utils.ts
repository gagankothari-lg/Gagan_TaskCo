import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class IdUtilsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Issues the next sequential ID for `prefix` from a persistent counter (the `IdCounter`
   * table), never derived from surviving business rows. The prior find-last-row+increment
   * approach silently reused an ID whenever the highest-numbered row of a type was deleted —
   * confirmed live (PFIX-ROUND3-CONFIRMED-BUGS Fix 1). `model`/`idField` are no longer read
   * from; kept in the signature so every existing call site is unchanged — `prefix` alone
   * identifies the counter (each prefix already maps 1:1 to one model+idField in this repo).
   * `nextValue` always means "the next value to store after this issuance"; the value actually
   * issued is always `nextValue - 1` on the returned row, in both branches:
   *  - first-ever call for a prefix: `create` stores 2 → issued = 2-1 = 1.
   *  - subsequent calls: `update`'s atomic `increment` stores old+1 → issued = (old+1)-1 = old.
   * `upsert` on a single @id field compiles to one atomic `INSERT ... ON CONFLICT DO UPDATE`
   * on Postgres, so concurrent callers serialize correctly with no separate transaction needed.
   */
  async generateId(_model: string, _idField: string, prefix: string): Promise<string> {
    const counter = await this.prisma.idCounter.upsert({
      where: { prefix },
      create: { prefix, nextValue: 2 },
      update: { nextValue: { increment: 1 } },
    });
    return `${prefix}-${String(counter.nextValue - 1).padStart(5, '0')}`;
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
