-- Wave C5.2 — the survey record
-- (docs/plans/wave-c5-survey-material-traceability-spec-2026-07-31.md §5.2)
--
-- Filed evidence with attribution and a lifecycle. NO coordinate, level,
-- deviation or tolerance column: those are C5.4/C5.5 and both are BLOCKED on
-- primary sources nobody in this program has read. Additive; nothing is
-- backfilled, because there is no historical survey data to recover.

CREATE TABLE "survey_records" (
    "id"                     TEXT NOT NULL,
    "project_id"             TEXT NOT NULL,
    "lot_id"                 TEXT,
    "kind"                   TEXT NOT NULL,
    "status"                 TEXT NOT NULL DEFAULT 'requested',
    "requested_by"           TEXT,
    "requested_at"           TIMESTAMP(3),
    "surveyor_name"          TEXT,
    "surveyor_company"       TEXT,
    "surveyor_registration"  TEXT,
    "surveyed_at"            TIMESTAMP(3),
    "report_document_id"     TEXT,
    "surveyor_verdict"       TEXT,
    "verdict_source_note"    TEXT,
    "reviewed_by"            TEXT,
    "reviewed_at"            TIMESTAMP(3),
    "accepted_by"            TEXT,
    "accepted_at"            TIMESTAMP(3),
    "rejection_reason"       TEXT,
    "superseded_by_id"       TEXT,
    "notes"                  TEXT,
    "created_at"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"             TIMESTAMP(3) NOT NULL,
    CONSTRAINT "survey_records_pkey" PRIMARY KEY ("id")
);

-- Vocabulary is a CHECK, not prose. `[C5S-B4]`: correcting a state name after
-- the pilot is then a reviewed migration, which is the point.
ALTER TABLE "survey_records" ADD CONSTRAINT "survey_records_kind_check"
  CHECK ("kind" IN ('set_out','conformance','as_built'));
ALTER TABLE "survey_records" ADD CONSTRAINT "survey_records_status_check"
  CHECK ("status" IN ('requested','in_progress','received','accepted','rejected'));
ALTER TABLE "survey_records" ADD CONSTRAINT "survey_records_verdict_check"
  CHECK ("surveyor_verdict" IS NULL
      OR "surveyor_verdict" IN ('conforms','does_not_conform','qualified','not_stated'));

-- `[C5S-B1]` as constraints. THE FIRST ONE IS THE GATE; the other two are
-- hygiene. `[C5R-B1]`: a row with status='accepted', accepted_by=NULL,
-- accepted_at=NULL, surveyor_verdict='conforms' satisfies the latter two, so
-- without the first the wave's flagship invariant would be prose — and the
-- likelier failure was not a red test but a green one written against the
-- constraints that existed.
ALTER TABLE "survey_records" ADD CONSTRAINT "survey_records_accepted_requires_actor_check"
  CHECK ("status" <> 'accepted'
      OR ("accepted_by" IS NOT NULL AND "accepted_at" IS NOT NULL));
ALTER TABLE "survey_records" ADD CONSTRAINT "survey_records_accepted_actor_check"
  CHECK (("accepted_at" IS NULL) = ("accepted_by" IS NULL));
ALTER TABLE "survey_records" ADD CONSTRAINT "survey_records_accepted_requires_verdict_check"
  CHECK ("status" <> 'accepted' OR "surveyor_verdict" IS NOT NULL);
ALTER TABLE "survey_records" ADD CONSTRAINT "survey_records_self_supersede_check"
  CHECK ("superseded_by_id" IS NULL OR "superseded_by_id" <> "id");

-- Restrict on the report: the original file cannot be deleted out from under
-- the evidence record. Matches `drawings.document_id`. The usable error message
-- comes from the `survey_report` EVIDENCE_LINK_GUARDS entry, not from this FK.
ALTER TABLE "survey_records" ADD CONSTRAINT "survey_records_report_document_id_fkey"
  FOREIGN KEY ("report_document_id") REFERENCES "documents"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "survey_records" ADD CONSTRAINT "survey_records_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "survey_records" ADD CONSTRAINT "survey_records_lot_id_fkey"
  FOREIGN KEY ("lot_id") REFERENCES "lots"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "survey_records" ADD CONSTRAINT "survey_records_superseded_by_id_fkey"
  FOREIGN KEY ("superseded_by_id") REFERENCES "survey_records"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "survey_records" ADD CONSTRAINT "survey_records_requested_by_fkey"
  FOREIGN KEY ("requested_by") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "survey_records" ADD CONSTRAINT "survey_records_reviewed_by_fkey"
  FOREIGN KEY ("reviewed_by") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "survey_records" ADD CONSTRAINT "survey_records_accepted_by_fkey"
  FOREIGN KEY ("accepted_by") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "survey_records_project_id_status_idx" ON "survey_records"("project_id","status");
CREATE INDEX "survey_records_lot_id_idx"            ON "survey_records"("lot_id");
CREATE INDEX "survey_records_project_id_kind_idx"   ON "survey_records"("project_id","kind");
