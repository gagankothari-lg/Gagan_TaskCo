import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.softwareTile.upsert({
    where: { key: 'lgdesk' },
    update: {},
    create: {
      key: 'lgdesk',
      label: 'LGDesk',
      url: 'https://prodtaskco.vercel.app',
      isActive: true,
      sortOrder: 0,
    },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
