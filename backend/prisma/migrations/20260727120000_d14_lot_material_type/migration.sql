-- D14.1 (docs/plans/d14-q6-pack-spec-2026-07-27.md §7).
--
-- Additive and nullable: NULL is the correct value for every existing row and
-- means "not recorded", which errs to full frequency (§3.4). No backfill, and no
-- index — `material_type` is read only for the lot already being evaluated and
-- is never queried across lots.

-- AlterTable
ALTER TABLE "lots" ADD COLUMN "material_type" TEXT;
