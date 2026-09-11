import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Issues the next EMP-XXXXX id via the same persistent IdCounter the app itself
// uses at runtime (id.utils.ts's generateId) -- NOT a find-max-row+increment, which
// would silently collide with the counter's own future issuance. Duplicated here
// (rather than importing id.utils.ts) because this script runs standalone via
// ts-node outside Nest's DI container.
async function nextEmpId(): Promise<string> {
  const counter = await prisma.idCounter.upsert({
    where: { prefix: 'EMP' },
    create: { prefix: 'EMP', nextValue: 2 },
    update: { nextValue: { increment: 1 } },
  });
  return `EMP-${String(counter.nextValue - 1).padStart(5, '0')}`;
}

// Each account below is independently idempotent (checked by its own email) so
// running this against an already-seeded database only ever fills in whichever
// of these two accounts is still missing -- it never touches an existing user.
async function ensureSuperAdmin(opts: {
  email: string;
  firstName: string;
  lastName: string;
  designation: string;
}) {
  const existing = await prisma.user.findUnique({ where: { email: opts.email } });
  if (existing) {
    console.log(`✓ ${opts.designation} already exists:`, existing.empId, existing.email);
    return;
  }

  const passwordHash = await bcrypt.hash('Admin@1234', 12);
  const empId = await nextEmpId();

  const user = await prisma.user.create({
    data: {
      empId,
      firstName: opts.firstName,
      lastName: opts.lastName,
      email: opts.email,
      passwordHash,
      role: 'Super Admin',
      designation: opts.designation,
      team: '',
      isActive: true,
    },
  });

  console.log(`✅ ${opts.designation} created successfully`);
  console.log('   EmpId :', user.empId);
  console.log('   Email :', user.email);
  console.log('   Pass  : Admin@1234');
  console.log('');
  console.log('⚠️  Change the password after first login!');
}

async function main() {
  console.log('🌱 Seeding LG Desk database...');

  // The original account -- deliberately left untouched, empId included. Renaming
  // an existing empId would ripple through ~12 foreign-key tables plus non-FK string
  // fields like Task.assigneeIds, with no safe way to guarantee every reference gets
  // updated, so the founder's account below is added alongside it instead of replacing it.
  await ensureSuperAdmin({
    email: 'info@aswinibajaj.com',
    firstName: 'Super',
    lastName: 'Admin',
    designation: 'System Administrator',
  });

  // The founder's own real login, added alongside the above (not replacing it).
  await ensureSuperAdmin({
    email: 'aswinibajaj@uxl.club',
    firstName: 'Aswini',
    lastName: 'Bajaj',
    designation: 'Founder',
  });
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
