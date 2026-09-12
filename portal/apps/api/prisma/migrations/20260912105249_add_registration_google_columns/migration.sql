-- AlterTable
ALTER TABLE "portal"."registration_requests" ADD COLUMN     "googleEmail" TEXT,
ADD COLUMN     "googleSub" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "registration_requests_googleSub_key" ON "portal"."registration_requests"("googleSub");

