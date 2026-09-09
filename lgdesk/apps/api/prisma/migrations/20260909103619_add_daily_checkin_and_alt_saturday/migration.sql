-- AlterTable
ALTER TABLE "work_logs" ADD COLUMN     "attendanceSource" TEXT NOT NULL DEFAULT 'AUTO';

-- AlterTable
ALTER TABLE "work_durations" ADD COLUMN     "isWorking" BOOLEAN,
ADD COLUMN     "workMode" TEXT;

-- CreateTable
CREATE TABLE "alternate_saturdays" (
    "id" TEXT NOT NULL,
    "empId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "offDate1" DATE NOT NULL,
    "offDate2" DATE NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alternate_saturdays_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "alternate_saturdays_empId_month_key" ON "alternate_saturdays"("empId", "month");

-- AddForeignKey
ALTER TABLE "alternate_saturdays" ADD CONSTRAINT "alternate_saturdays_empId_fkey" FOREIGN KEY ("empId") REFERENCES "users"("empId") ON DELETE CASCADE ON UPDATE CASCADE;

