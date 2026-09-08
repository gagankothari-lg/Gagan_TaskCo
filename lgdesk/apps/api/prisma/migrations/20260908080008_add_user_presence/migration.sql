-- AlterTable
ALTER TABLE "users" ADD COLUMN     "presenceStatus" TEXT NOT NULL DEFAULT 'online',
ADD COLUMN     "presenceUpdatedAt" TIMESTAMP(3);

