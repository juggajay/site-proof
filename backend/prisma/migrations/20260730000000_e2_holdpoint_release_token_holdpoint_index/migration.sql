-- Wave E2 (docs/plans/wave-e-approvals-spec-2026-07-28.md §4.2.8, §5).
-- Additive, index-only. No column added, altered or dropped; no backfill; no
-- data movement; safe to apply while serving.
--
-- `hold_point_release_tokens` had exactly one secondary index, on `batch_id`,
-- while `deleteMany({ where: { holdPointId, usedAt: null } })` runs on every
-- release request and every chase, and every chase recipient read starts from
-- `hold_point_id`. E2 turns those from user-triggered to hourly-and-automatic,
-- which is what makes an existing gap load-bearing.

-- CreateIndex
CREATE INDEX "hold_point_release_tokens_hold_point_id_idx" ON "hold_point_release_tokens"("hold_point_id");
