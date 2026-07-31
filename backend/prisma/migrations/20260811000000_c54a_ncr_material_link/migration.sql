-- Wave C5.4a §5.1 — link an NCR to the delivery that supplied the material.
-- Additive only: one nullable column, one FK, one index. Reverse is a column drop.

ALTER TABLE "ncrs" ADD COLUMN "linked_delivery_id" TEXT;

ALTER TABLE "ncrs"
  ADD CONSTRAINT "ncrs_linked_delivery_id_fkey"
  FOREIGN KEY ("linked_delivery_id") REFERENCES "diary_deliveries"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ncrs_linked_delivery_id_idx" ON "ncrs"("linked_delivery_id");
