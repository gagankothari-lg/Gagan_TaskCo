-- Baseline migration: "profile_update_requests" already exists (moved from LGDesk to the
-- "portal" schema by LGDesk's own 20260912113411_move_profile_update_request_to_portal
-- migration) with real data. This SQL is NOT executed; it documents the exact structure
-- Portal's schema.prisma now declares (verified column-by-column and index-by-index against
-- the live database on 2026-09-12) and is recorded as applied via
-- `prisma migrate resolve --applied` so Portal's own migration history accounts for its
-- current shape without ever running this DDL for real.

-- CreateTable
CREATE TABLE "portal"."profile_update_requests" (
    "id" TEXT NOT NULL,
    "reqId" TEXT NOT NULL,
    "empId" TEXT NOT NULL,
    "changes" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "reviewedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profile_update_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profile_update_requests_reqId_key" ON "portal"."profile_update_requests"("reqId");
