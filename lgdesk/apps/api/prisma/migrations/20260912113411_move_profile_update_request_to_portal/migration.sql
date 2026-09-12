-- Moves ProfileUpdateRequest's physical table to the "portal" Postgres schema (P20 Part 0).
-- Ownership of this table's migrations transfers to Portal from this point on -- LGDesk
-- keeps reading/writing it via Prisma (schema.prisma now maps it with @@schema("portal")),
-- but never generates a migration against it again. The real FK to public.users(empId)
-- (ON DELETE RESTRICT) is unaffected -- Postgres cross-schema foreign keys work natively,
-- and SET SCHEMA only moves the table object, not what its constraints point at.
-- Data-preserving: no rows touched.
ALTER TABLE "public"."profile_update_requests" SET SCHEMA "portal";
