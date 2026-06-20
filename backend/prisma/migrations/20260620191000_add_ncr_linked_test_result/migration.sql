ALTER TABLE "ncrs" ADD COLUMN "linked_test_result_id" TEXT;

CREATE INDEX "ncrs_linked_test_result_id_idx" ON "ncrs"("linked_test_result_id");

ALTER TABLE "ncrs"
  ADD CONSTRAINT "ncrs_linked_test_result_id_fkey"
  FOREIGN KEY ("linked_test_result_id")
  REFERENCES "test_results"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
