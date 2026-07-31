// One-time backfill for PFIX-ROUND3-CONFIRMED-BUGS Fix 1 — seeds the id_counters table from
// the current max surviving ID per prefix, so numbering continues forward correctly instead
// of colliding with anything already issued. Idempotent: skips any prefix that already has a
// counter row rather than overwriting it, so it's safe to re-run.
//
// Run this AFTER the schema migration (`prisma db push`) has been applied and BEFORE deploying
// the id.utils.ts code that reads from id_counters — the new code will error on any prefix
// with no counter row and no fallback path.
//
//   npx ts-node --transpile-only --compiler-options "{\"module\":\"CommonJS\"}" prisma/backfill-id-counters.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// (model accessor, idField, prefix) — must match every generateId()/createWithId() call site
// in apps/api/src (see id.utils.ts). Keep this list in sync if a new ID-prefixed model is added.
const COUNTERS: Array<{ model: string; idField: string; prefix: string }> = [
  { model: 'workLog', idField: 'logId', prefix: 'WL' },
  { model: 'internWorkLog', idField: 'logId', prefix: 'IWL' },
  { model: 'dueDateRequest', idField: 'ddrId', prefix: 'DDR' },
  { model: 'meeting', idField: 'meetingId', prefix: 'MTG' },
  { model: 'registrationRequest', idField: 'regId', prefix: 'REG' },
  { model: 'profileUpdateRequest', idField: 'reqId', prefix: 'PR' },
  { model: 'user', idField: 'empId', prefix: 'EMP' },
  { model: 'workDuration', idField: 'sessionId', prefix: 'WD' },
  { model: 'task', idField: 'taskId', prefix: 'TSK' },
  { model: 'progressUpdate', idField: 'updateId', prefix: 'UPD' },
  { model: 'workFunction', idField: 'functionId', prefix: 'FN' },
  { model: 'project', idField: 'projId', prefix: 'PRJ' },
  { model: 'leave', idField: 'leaveId', prefix: 'LV' },
];

async function main() {
  console.log('Backfilling id_counters from current survivor max IDs...\n');

  for (const { model, idField, prefix } of COUNTERS) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const delegate = (prisma as any)[model];
    const last = await delegate.findFirst({ orderBy: { [idField]: 'desc' } });
    const maxN = last ? parseInt(String(last[idField]).split('-').pop(), 10) : 0;
    const nextValue = maxN + 1;

    const existing = await prisma.idCounter.findUnique({ where: { prefix } });
    if (existing) {
      console.log(`  ${prefix}: counter already exists (nextValue=${existing.nextValue}) — left untouched`);
      continue;
    }

    await prisma.idCounter.create({ data: { prefix, nextValue } });
    console.log(`  ${prefix}: seeded nextValue=${nextValue} (current max survivor: ${maxN === 0 ? 'none' : maxN})`);
  }

  console.log('\nDone. Review the printed nextValue for each prefix before deploying the code that reads from id_counters.');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
