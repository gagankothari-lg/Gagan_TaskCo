-- DropForeignKey
ALTER TABLE "work_breaks" DROP CONSTRAINT "work_breaks_sessionId_fkey";

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "recurrencePattern" TEXT NOT NULL DEFAULT 'One Time';

-- AlterTable
ALTER TABLE "work_functions" ADD COLUMN     "recurringPattern" TEXT NOT NULL DEFAULT 'One Time';

-- AlterTable
ALTER TABLE "holidays" ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "announcements" ADD COLUMN     "priority" TEXT NOT NULL DEFAULT 'Normal',
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'General';

-- AlterTable
ALTER TABLE "registration_requests" ADD COLUMN     "dob" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "work_breaks" ADD CONSTRAINT "work_breaks_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "work_durations"("sessionId") ON DELETE CASCADE ON UPDATE CASCADE;

