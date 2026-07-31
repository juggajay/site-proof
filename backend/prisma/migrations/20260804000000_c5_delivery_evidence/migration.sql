-- Wave C5.1 — delivery evidence
-- (docs/plans/wave-c5-survey-material-traceability-spec-2026-07-31.md §5.1)
--
-- Two nullable columns on a table foremen already fill in. The record program
-- line 79 calls a "concrete/asphalt docket" is `DiaryDelivery`, not `Docket` —
-- `Docket` is a labour/plant timesheet with no supplier, material or batch.
-- Additive and reversible by column drop; no existing row is rewritten.

ALTER TABLE "diary_deliveries" ADD COLUMN "docket_document_id" TEXT;
ALTER TABLE "diary_deliveries" ADD COLUMN "batch_ref"          TEXT;

-- Restrict, matching `drawings.document_id`: the filed docket cannot be deleted
-- out from under the delivery that references it. The usable 409 comes from the
-- `delivery_docket` EVIDENCE_LINK_GUARDS entry; this FK is the backstop.
ALTER TABLE "diary_deliveries"
  ADD CONSTRAINT "diary_deliveries_docket_document_id_fkey"
  FOREIGN KEY ("docket_document_id") REFERENCES "documents"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Required, not optional: `lot_id` has an FK and no index today (the table
-- declares no `@@index` at all — `@@unique([diaryId, requestKey])` is its only
-- usable index), and every C5 lot-scoped read drives off `lot_id`.
CREATE INDEX "diary_deliveries_lot_id_idx" ON "diary_deliveries"("lot_id");
