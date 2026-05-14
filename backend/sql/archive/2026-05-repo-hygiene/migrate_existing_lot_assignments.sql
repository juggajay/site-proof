-- Migration: Migrate existing lot.assignedSubcontractorId to LotSubcontractorAssignment table
-- Date: 2026-01-29
-- Part of: Subcontractor ITP Permissions Feature

-- Migrate existing lot assignments from lots.assigned_subcontractor_id to lot_subcontractor_assignments table
-- This ensures backward compatibility with existing data while enabling the new permission system

INSERT INTO "lot_subcontractor_assignments" (
  "id",
  "lot_id",
  "subcontractor_company_id",
  "project_id",
  "can_complete_itp",
  "itp_requires_verification",
  "status",
  "assigned_at",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  l."id",
  l."assigned_subcontractor_id",
  l."project_id",
  false,
  true,
  'active',
  NOW(),
  NOW()
FROM "lots" l
WHERE l."assigned_subcontractor_id" IS NOT NULL
ON CONFLICT ("lot_id", "subcontractor_company_id") DO NOTHING;
