-- Moves RegistrationRequest's physical table to the "portal" Postgres schema. Ownership
-- of this table's migrations transfers to Portal from this point on (P18 Part 0) -- LGDesk
-- keeps reading/writing it via Prisma (schema.prisma now maps it with @@schema("portal")),
-- but never generates a migration against it again. Data-preserving: SET SCHEMA moves the
-- table (and its indexes/constraints) in place, no rows are touched.
CREATE SCHEMA IF NOT EXISTS "portal";

ALTER TABLE "public"."registration_requests" SET SCHEMA "portal";
