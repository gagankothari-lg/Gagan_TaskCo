-- Baseline migration: "users" and "revoked_tokens" already exist in the shared database
-- (created and migrated by LGDesk, which owns them -- see ERP/SSO_Portal_Architecture_
-- Decisions.md). This SQL is NOT executed against the database; it documents the exact
-- structure Portal's schema.prisma now declares for these tables (verified column-by-column
-- and index-by-index against the live database on 2026-09-12) and is recorded as applied via
-- `prisma migrate resolve --applied` so Portal's own migration history accounts for their
-- current shape without ever running this DDL for real.

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "empId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "designation" TEXT,
    "managerId" TEXT,
    "team" TEXT,
    "subDepartment" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "dob" TIMESTAMP(3),
    "presenceStatus" TEXT NOT NULL DEFAULT 'online',
    "presenceUpdatedAt" TIMESTAMP(3),
    "personalCalendarId" TEXT,
    "googleSub" TEXT,
    "googleEmail" TEXT,
    "googleLinkedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."revoked_tokens" (
    "id" TEXT NOT NULL,
    "jti" TEXT NOT NULL,
    "empId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revoked_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_empId_key" ON "public"."users"("empId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_googleSub_key" ON "public"."users"("googleSub");

-- CreateIndex
CREATE UNIQUE INDEX "revoked_tokens_jti_key" ON "public"."revoked_tokens"("jti");

-- CreateIndex
CREATE INDEX "revoked_tokens_jti_idx" ON "public"."revoked_tokens"("jti");
