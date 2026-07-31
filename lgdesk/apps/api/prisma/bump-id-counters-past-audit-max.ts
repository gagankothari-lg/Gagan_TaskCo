// One-time targeted fix for PFIX-ID-COUNTER-MIGRATION-CLEANUP Step 3. Bumps ONLY the specific
// prefixes confirmed (via check-audit-log-max-ids.ts) to have a real gap between their
// survivor-seeded counter and the highest ID ever seen in AuditLog. Not a rerun of the whole
// backfill -- a targeted correction for exactly the prefixes that need it.
//
//   npx ts-node --transpile-only --compiler-options "{\"module\":\"CommonJS\"}" prisma/bump-id-counters-past-audit-max.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// prefix -> new nextValue (= highest ID ever seen in AuditLog + 1), confirmed via
// check-audit-log-max-ids.ts immediately before writing this list.
const BUMPS: Record<string, number> = {
  TSK: 12, // audit max 11, counter was about to reissue 11
  PRJ: 4,  // audit max 3, counter was about to reissue 3
  FN: 14,  // audit max 13, counter was about to reissue as low as 7
};

async function main() {
  for (const [prefix, newNextValue] of Object.entries(BUMPS)) {
    const before = await prisma.idCounter.findUnique({ where: { prefix } });
    if (!before) {
      console.log(`${prefix}: NO counter row found -- skipping, this should not happen`);
      continue;
    }
    if (before.nextValue >= newNextValue) {
      console.log(`${prefix}: current nextValue=${before.nextValue} is already >= ${newNextValue} -- left untouched`);
      continue;
    }
    const after = await prisma.idCounter.update({ where: { prefix }, data: { nextValue: newNextValue } });
    console.log(`${prefix}: bumped nextValue ${before.nextValue} -> ${after.nextValue}`);
  }
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
