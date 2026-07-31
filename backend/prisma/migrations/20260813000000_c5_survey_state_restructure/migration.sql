-- Wave C5 — restructure the survey record to the EVIDENCE-OF-ARRIVAL model.
--
-- Driven by docs/research/c5-surveyor-workflow-practice-2026-07-31.md, whose
-- verdict table is this migration:
--
--   requested             KEEP, optional (the trigger is a lot state, not a person)
--   in_progress           DELETE   — no competitor, no survey software, no AU spec
--                                    and no training unit defines the state (§2.4)
--   received              KEEP     — strongest-evidenced state in the machine (§3.6)
--   accepted              REMOVE   — acceptance is hold-point release and lot
--                                    conformance, both already shipped (§4.6)
--   rejected              RENAME   — `returned_for_correction`, non-terminal (§5.6)
--
-- `survey_records` is behind `C5_SURVEY_RECORDS_ENABLED` and the production
-- table is EMPTY. Evidence, all of it checkable from this repo:
--   * `surveyRecordsEnabled()` is fail-closed — absent env ⇒ off
--     (`routes/surveys/statusWorkflow.ts`, pinned by `statusWorkflow.test.ts`).
--   * The flag is set in NO deployment config: `grep -r
--     C5_SURVEY_RECORDS_ENABLED` outside `node_modules` hits only source,
--     tests and one benchmark script — no Dockerfile, no railway config, no
--     `.env.example`.
--   * Every write route is behind `requireSurveyFlag`, which 404s with the flag
--     off, so no row can be created without it (`surveyFlagMounting.db.test.ts`).
--   * The C5.2 spec's §11 rollout — the four steps that would turn it on — has
--     not been run; step 3 requires a real conformance survey to round-trip.
-- The status remap below therefore rewrites nothing in production.
--
-- It is written anyway, and written to be lossless, because local and CI
-- databases DO have rows and because a migration that would corrupt a
-- hypothetical row is a migration that will corrupt a real one someday.

-- 1. Rename in place. `reviewed_*` was already the receipt stamp; the old name
--    described a review act that the research says does not happen here.
ALTER TABLE "survey_records" RENAME COLUMN "reviewed_by" TO "received_by";
ALTER TABLE "survey_records" RENAME COLUMN "reviewed_at" TO "received_at";
ALTER TABLE "survey_records" RENAME COLUMN "rejection_reason" TO "return_reason";
ALTER TABLE "survey_records" RENAME CONSTRAINT "survey_records_reviewed_by_fkey"
  TO "survey_records_received_by_fkey";

-- 2. Preserve the acceptor's attribution BEFORE dropping the columns. On a row
--    that was accepted without ever being marked received, the acceptor is the
--    only CIVOS user who ever stood behind the transcription — losing them
--    would leave the folio printing "an unnamed user" against a real surveyor.
UPDATE "survey_records"
   SET "received_by" = "accepted_by",
       "received_at" = "accepted_at"
 WHERE "received_by" IS NULL
   AND "accepted_by" IS NOT NULL;

-- 3. Acceptance leaves the record entirely.
--
--    `accepted_requires_verdict` was `[C5S-B1]`'s teeth — it stopped `accepted`
--    from becoming a CIVOS conformance finding in disguise. It is not replaced,
--    because the act it guarded no longer exists: with no acceptance on the
--    record there is nothing for CIVOS to assert, and the verdict vocabulary
--    CHECK still refuses anything that is not a transcription.
ALTER TABLE "survey_records" DROP CONSTRAINT "survey_records_accepted_requires_actor_check";
ALTER TABLE "survey_records" DROP CONSTRAINT "survey_records_accepted_actor_check";
ALTER TABLE "survey_records" DROP CONSTRAINT "survey_records_accepted_requires_verdict_check";
ALTER TABLE "survey_records" DROP COLUMN "accepted_by";
ALTER TABLE "survey_records" DROP COLUMN "accepted_at";

-- 4. Drop the old vocabulary CHECK BEFORE remapping, not after. The old CHECK
--    forbids `returned_for_correction`, so a remap that runs first fails on the
--    first `rejected` row — caught by seeding the five old states into a local
--    database and running this file against them.
ALTER TABLE "survey_records" DROP CONSTRAINT "survey_records_status_check";

-- 5. Remap the vocabulary. Each mapping is the honest one:
--      in_progress → requested   the job was asked for and has not arrived
--      accepted    → received    the report arrived; acceptance moves to the
--                                hold point, which consumes it as evidence
--      rejected    → returned_for_correction
UPDATE "survey_records" SET "status" = 'requested'               WHERE "status" = 'in_progress';
UPDATE "survey_records" SET "status" = 'received'                WHERE "status" = 'accepted';
UPDATE "survey_records" SET "status" = 'returned_for_correction' WHERE "status" = 'rejected';

-- 6. A returned record must say why (step 8). Pre-restructure `rejected` rows
--    were allowed to carry no reason, so they are backfilled with a sentence
--    that states exactly what happened rather than inventing a trigger.
UPDATE "survey_records"
   SET "return_reason" = 'Reason not recorded — migrated from the pre-restructure `rejected` state.'
 WHERE "status" = 'returned_for_correction'
   AND ("return_reason" IS NULL OR btrim("return_reason") = '');

-- 7. The new closed vocabulary.
ALTER TABLE "survey_records" ADD CONSTRAINT "survey_records_status_check"
  CHECK ("status" IN ('requested','received','returned_for_correction'));

-- 8. The return reason is the whole value of the return state: six distinct
--    triggers are evidenced (format, wrong method for the specified accuracy,
--    missing coverage, wrong datum, wrong design surface, content mismatch) and
--    each demands a different fix (research §5.3). A bare flag is not useful.
ALTER TABLE "survey_records" ADD CONSTRAINT "survey_records_returned_requires_reason_check"
  CHECK ("status" <> 'returned_for_correction'
      OR ("return_reason" IS NOT NULL AND btrim("return_reason") <> ''));

-- 9. Hygiene, inherited from the dropped `accepted_actor` pairing: a receipt
--    time with nobody behind it is not a receipt.
ALTER TABLE "survey_records" ADD CONSTRAINT "survey_records_received_actor_check"
  CHECK (("received_at" IS NULL) = ("received_by" IS NULL));
