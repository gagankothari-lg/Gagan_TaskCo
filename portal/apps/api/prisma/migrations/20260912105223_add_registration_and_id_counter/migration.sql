-- Baseline migration: "id_counters" (LGDesk-owned) and "registration_requests" (moved from
-- LGDesk to the "portal" schema by LGDesk's own 20260912105016_move_registration_request_
-- to_portal migration) already exist with real data. This SQL is NOT executed; it documents
-- the exact structure Portal's schema.prisma now declares (verified column-by-column and
-- index-by-index against the live database on 2026-09-12) and is recorded as applied via
-- `prisma migrate resolve --applied` so Portal's own migration history accounts for their
-- current shape before the real, executed ALTER TABLE that follows (adding googleSub/
-- googleEmail) in the next migration.

-- CreateTable
CREATE TABLE "public"."id_counters" (
    "prefix" TEXT NOT NULL,
    "nextValue" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "id_counters_pkey" PRIMARY KEY ("prefix")
);

-- CreateTable
CREATE TABLE "portal"."registration_requests" (
    "id" TEXT NOT NULL,
    "regId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "designation" TEXT,
    "team" TEXT,
    "subDepartment" TEXT,
    "managerId" TEXT,
    "role" TEXT NOT NULL DEFAULT 'Team Member',
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "reviewedBy" TEXT,
    "notes" TEXT,
    "dob" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registration_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "registration_requests_regId_key" ON "portal"."registration_requests"("regId");
