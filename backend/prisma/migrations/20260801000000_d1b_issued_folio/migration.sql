-- Wave D `D1b` — the issued folio.
-- Spec `docs/plans/wave-d-handover-spec-2026-07-28.md` Rev 3 §7.1, §7.2, §7.3,
-- §7.9; threat model `docs/plans/wave-d1b-threat-model-2026-07-28.md` T-1, T-5.
--
-- THREE new tables, TWO triggers, ONE CHECK. Entirely additive: no column is
-- added to, altered on or dropped from any existing table, there is no backfill
-- and there is no data movement. Rollback (§7.9) is `DROP TRIGGER` x2,
-- `DROP FUNCTION`, `DROP TABLE` x3 — nothing to un-write.
--
-- WHY THE TRIGGERS EXIST AND A MISSING `updated_at` DOES NOT (`[DR-B7]`).
-- Rev 1 proposed to make an issued folio immutable by omitting an `updatedAt`
-- column. That prevents nothing: Prisma will happily `UPDATE` a table with no
-- such column, and raw SQL never cared. `[DH-B1]` — "an issued folio is never
-- altered" — is therefore enforced where it cannot be argued with, in the
-- database. **AT-141**.

-- ---------------------------------------------------------------------------
-- 1. `folio_snapshots` — the immutable source snapshot (§7.3)
-- ---------------------------------------------------------------------------
CREATE TABLE "folio_snapshots" (
    "id"                     TEXT         NOT NULL,
    "project_id"             TEXT         NOT NULL,
    "lot_id"                 TEXT         NOT NULL,
    "payload"                JSONB        NOT NULL,
    "payload_schema_version" INTEGER      NOT NULL,
    "profile_version"        TEXT         NOT NULL,
    "source_row_refs"        JSONB        NOT NULL,
    "created_by"             TEXT,
    "created_at"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at"             TIMESTAMP(3) NOT NULL,

    CONSTRAINT "folio_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "folio_snapshots_lot_id_created_at_idx" ON "folio_snapshots" ("lot_id", "created_at");
-- Drives the `D1c` expiry sweep and the expired-snapshot refusal (T-2).
CREATE INDEX "folio_snapshots_expires_at_idx" ON "folio_snapshots" ("expires_at");

-- ---------------------------------------------------------------------------
-- 2. `folio_issue_reservations` — the durable version binding (§7.2, `[DR2-B3]`)
-- ---------------------------------------------------------------------------
-- `issue_id` is the PREALLOCATED `folio_issues.id`, so the storage object path
-- is known before any bytes exist (§4.4.2 step 2). The unique constraint below
-- is the entire mechanism: two concurrent sessions cannot reserve one version,
-- because the second INSERT fails and retries with the next.
CREATE TABLE "folio_issue_reservations" (
    "issue_id"    TEXT         NOT NULL,
    "project_id"  TEXT         NOT NULL,
    "lot_id"      TEXT         NOT NULL,
    "snapshot_id" TEXT         NOT NULL,
    "version"     INTEGER      NOT NULL,
    "reserved_by" TEXT,
    "reserved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "folio_issue_reservations_pkey" PRIMARY KEY ("issue_id")
);

-- §7.2: "two concurrent sessions cannot reserve the same version because the
-- second insert fails". Application ordering is not a substitute and this
-- constraint — not a code path — is what **AT-146** asserts against.
CREATE UNIQUE INDEX "folio_issue_reservations_lot_id_version_key" ON "folio_issue_reservations" ("lot_id", "version");
-- For the `D1c` sweeper (§10.5) and the outstanding-reservation cap (T-3).
CREATE INDEX "folio_issue_reservations_expires_at_idx" ON "folio_issue_reservations" ("expires_at");

-- ---------------------------------------------------------------------------
-- 3. `folio_issues` — the append-only issued folio (§7.1)
-- ---------------------------------------------------------------------------
CREATE TABLE "folio_issues" (
    "id"                  TEXT         NOT NULL,
    "project_id"          TEXT         NOT NULL,
    "lot_id"              TEXT         NOT NULL,
    "snapshot_id"         TEXT         NOT NULL,
    "reservation_id"      TEXT         NOT NULL,
    "version"             INTEGER      NOT NULL,
    "format"              TEXT         NOT NULL DEFAULT 'folio',
    "file_url"            TEXT         NOT NULL,
    "file_size"           BIGINT       NOT NULL,
    "sha256"              TEXT         NOT NULL,
    "issued_by"           TEXT,
    "issued_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "compiled_from"       JSONB        NOT NULL,
    "lot_status_at_issue" TEXT         NOT NULL,
    "conformed_at_issue"  TIMESTAMP(3),

    CONSTRAINT "folio_issues_pkey" PRIMARY KEY ("id")
);

-- `[DR2-B5]`, §7.1. Rev 2 gave this column the full five-value authority
-- format vocabulary even though only the folio path writes it — a structural
-- invitation to persist `tmr` on an artefact that carries no certification.
-- Two guards deliberately: the route's Zod literal stops the honest mistake,
-- this CHECK stops the one that bypasses the route. **AT-147**.
ALTER TABLE "folio_issues" ADD CONSTRAINT "folio_issues_format_check" CHECK ("format" = 'folio');

CREATE UNIQUE INDEX "folio_issues_reservation_id_key" ON "folio_issues" ("reservation_id");
-- One issue per reserved version. The Rev 1 non-unique `[lot_id, version]`
-- index is deliberately absent: a unique constraint already indexes it
-- (`[DR-B7]`).
CREATE UNIQUE INDEX "folio_issues_lot_id_version_key" ON "folio_issues" ("lot_id", "version");
CREATE INDEX "folio_issues_project_id_issued_at_idx" ON "folio_issues" ("project_id", "issued_at");

-- ---------------------------------------------------------------------------
-- 4. Foreign keys
-- ---------------------------------------------------------------------------
ALTER TABLE "folio_snapshots" ADD CONSTRAINT "folio_snapshots_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "folio_snapshots" ADD CONSTRAINT "folio_snapshots_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "folio_snapshots" ADD CONSTRAINT "folio_snapshots_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "folio_issue_reservations" ADD CONSTRAINT "folio_issue_reservations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "folio_issue_reservations" ADD CONSTRAINT "folio_issue_reservations_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "folio_issue_reservations" ADD CONSTRAINT "folio_issue_reservations_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "folio_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "folio_issue_reservations" ADD CONSTRAINT "folio_issue_reservations_reserved_by_fkey" FOREIGN KEY ("reserved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "folio_issues" ADD CONSTRAINT "folio_issues_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "folio_issues" ADD CONSTRAINT "folio_issues_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "folio_issues" ADD CONSTRAINT "folio_issues_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "folio_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "folio_issues" ADD CONSTRAINT "folio_issues_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "folio_issue_reservations"("issue_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "folio_issues" ADD CONSTRAINT "folio_issues_issued_by_fkey" FOREIGN KEY ("issued_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 5. The immutability triggers (§7.1, §7.3, `[DR-B7]`, **AT-141**)
-- ---------------------------------------------------------------------------
-- ONE function, TWO triggers. Both an issued folio and the snapshot it was
-- compiled from are historical records: re-issuing produces a NEW version with
-- a new id and a new checksum, and the previous one stays downloadable and
-- unaltered. Neither table has an `updated_at` column, and this is why that
-- absence is not the mechanism.
--
-- `DELETE` is deliberately NOT blocked here: §10.4 permits exactly one
-- authorized, owner-only, audited deletion procedure, and a `DELETE`-rejecting
-- trigger would also break the `ON DELETE CASCADE` a project deletion needs.
CREATE OR REPLACE FUNCTION folio_reject_update() RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION
        'Table % is append-only: an issued folio and its source snapshot are never altered (Wave D [DH-B1], spec section 7.1)',
        TG_TABLE_NAME
        USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "folio_issues_reject_update"
    BEFORE UPDATE ON "folio_issues"
    FOR EACH ROW EXECUTE FUNCTION folio_reject_update();

CREATE TRIGGER "folio_snapshots_reject_update"
    BEFORE UPDATE ON "folio_snapshots"
    FOR EACH ROW EXECUTE FUNCTION folio_reject_update();
