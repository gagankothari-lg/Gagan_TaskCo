// Read-only investigative script for PFIX-ID-COUNTER-MIGRATION-CLEANUP Step 3. Does NOT
// write anything. Compares the highest entityId ever referenced in AuditLog (any action, not
// just CREATE, since some entities are only audited on approve/reject) per prefix against the
// current id_counters.nextValue, to check whether the survivor-based backfill left a gap.
//
//   npx ts-node --transpile-only --compiler-options "{\"module\":\"CommonJS\"}" prisma/check-audit-log-max-ids.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PREFIXES = ['TSK', 'DDR', 'PRJ', 'WL', 'IWL', 'MTG', 'REG', 'PR', 'EMP', 'WD', 'UPD', 'FN', 'LV'];

async function main() {
  for (const prefix of PREFIXES) {
    const rows = await prisma.auditLog.findMany({
      where: { entityId: { startsWith: `${prefix}-` } },
      select: { entityId: true },
    });
    let maxSeen = 0;
    for (const r of rows) {
      const n = parseInt(r.entityId.split('-').pop() as string, 10);
      if (!Number.isNaN(n) && n > maxSeen) maxSeen = n;
    }
    const counter = await prisma.idCounter.findUnique({ where: { prefix } });
    // generateId()'s upsert increments the STORED value then returns (stored-1) as the
    // issued number. So the value currently sitting in storage (read directly, no call made)
    // IS exactly what the next call will issue -- no further adjustment needed here.
    const nextIssue = counter ? counter.nextValue : null;
    const gap = nextIssue !== null && maxSeen >= nextIssue;
    console.log(
      `${prefix}: audit-log max ever seen=${maxSeen || 'none'} | stored nextValue (next issue)=${nextIssue ?? 'NO COUNTER ROW'}` +
      (gap ? '  <-- GAP: next issue would duplicate/undercut an ID already seen in the audit log' : ''),
    );
  }
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
