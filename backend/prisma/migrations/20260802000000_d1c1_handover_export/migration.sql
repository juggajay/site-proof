-- Wave D `D1c.1` — the handover export job row, the frozen member ledger and
-- legal hold.
-- Spec `docs/plans/wave-d-handover-spec-2026-07-28.md` Rev 3 §7.4, §7.5, §7.6,
-- §7.9; §4.6.1 (frozen members), §4.6.2 (lease and fencing), §4.5.5 (BigInt).
--
-- THREE new tables, NO trigger, NO CHECK. Entirely additive: no column is
-- added to, altered on or dropped from any existing table, there is no backfill
-- and there is no data movement. Rollback (§7.9) is `DROP TABLE` x3 — nothing
-- to un-write.
--
-- WHY THERE IS NO TRIGGER HERE, WHEN THE D1b MIGRATION SHIPPED TWO.
-- `folio_issues` and `folio_snapshots` are HISTORICAL RECORDS, so `UPDATE` is
-- rejected in the database (`[DH-B1]`, **AT-141**). A `handover_exports` row is
-- a MUTABLE JOB ROW by design: a worker claims it, heartbeats it, records
-- progress against it, publishes to it and later expires its artefact. Its
-- correctness comes from the FENCING TOKEN — every state write is a conditional
-- `UPDATE ... WHERE lease_token = $token` (§4.6.2, `lib/handover/exportLease.ts`)
-- — not from immutability. A trigger here would break the feature rather than
-- protect it, and asserting an invariant a table cannot hold is what `[DR2-B7]`
-- punished.
--
-- `artifact_legal_holds` IS append-only, and is append-only by SHAPE rather
-- than by trigger: it carries no mutable state to update. A hold and its
-- release are both INSERTs and the sequence is the record, so the read
-- ("latest row wins", `lib/handover/legalHold.ts`) is the only consumer and
-- there is nothing an `UPDATE` could usefully target (§7.6).

-- ---------------------------------------------------------------------------
-- 1. `handover_exports` — the job row (§7.4)
-- ---------------------------------------------------------------------------
-- `total_bytes` and `file_size` are BIGINT, not INTEGER: `fileSize Int` caps at
-- 2,147,483,647 bytes and the decided cap is 8 GiB of output (§4.5.3, §4.5.5).
--
-- `upload_state` holds S3 multipart state — upload id, part numbers, ETags.
-- Rev 3 wrote "only if `D1c.0` selects a resumable path"; it did (§4.5.3), so
-- the column is kept. It is a TRANSPORT-layer resume; the ZIP itself is always
-- rebuilt from the frozen ledger (§4.6.3).
--
-- `expires_at` is the retention TTL (§10.5, `[DR2-B5]`). When the artefact is
-- swept the ROW SURVIVES with a null `file_url` — an export that was generated
-- and has expired is a fact worth keeping (**AT-148**).
CREATE TABLE "handover_exports" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "scope" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "requested_by" TEXT,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- The lease quartet (`[DR-B5]`, and exactly what `[DH-j]`'s out-of-process
    -- worker needs to claim, fence and renew a job it did not receive as a
    -- request). `lease_token` is regenerated on every claim, so a worker
    -- resumed from a stale lease holds a token no state write will match.
    "lease_owner" TEXT,
    "lease_token" TEXT,
    "lease_expires_at" TIMESTAMP(3),
    "heartbeat_at" TIMESTAMP(3),
    "next_attempt_at" TIMESTAMP(3),
    "failure_count" INTEGER NOT NULL DEFAULT 0,
    "last_failure_reason" TEXT,
    -- The freeze instant. Everything after it is out of this archive by
    -- design, and the manifest records the cutoff (§4.6.1).
    "snapshot_cutoff_at" TIMESTAMP(3),
    "total_members" INTEGER,
    "processed_members" INTEGER NOT NULL DEFAULT 0,
    "total_bytes" BIGINT,
    "file_size" BIGINT,
    "file_url" TEXT,
    "sha256" TEXT,
    "upload_state" JSONB,
    "manifest_summary" JSONB,
    "completed_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "handover_exports_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- 2. `handover_export_members` — the FROZEN ledger (§7.5, `[DR-B7]`)
-- ---------------------------------------------------------------------------
-- Rev 1's archive was "reproducible from immutable inputs" while selecting
-- mutable, supersedable documents. A row here pins one source row AS IT WAS at
-- the freeze: exact id, §7.7 revision token, storage locator, byte size where
-- known, checksum where known, archive path and a deterministic order key. If a
-- folio is reissued mid-archive, the archive continues from these rows.
--
-- `byte_size` is NULLABLE deliberately — §4.5.4's unmeasured set.
-- `HoldPoint.release_signature_url` and `evidence_package_url` are bare strings
-- with no stored size, so a counts-and-sums preflight is an ESTIMATE with a
-- named unmeasured set, not a measurement, and a zero there would be a lie
-- shaped like a number.
CREATE TABLE "handover_export_members" (
    "id" TEXT NOT NULL,
    "export_id" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "source_revision" TEXT,
    "storage_locator" TEXT NOT NULL,
    "archive_path" TEXT NOT NULL,
    "byte_size" BIGINT,
    "source_checksum" TEXT,
    "state" TEXT NOT NULL DEFAULT 'pending',
    "omission_reason" TEXT,
    "order_key" TEXT NOT NULL,

    CONSTRAINT "handover_export_members_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- 3. `artifact_legal_holds` — append-only hold events (§7.6, `[DR2-B5]`)
-- ---------------------------------------------------------------------------
-- The naive fix — an `on_legal_hold` boolean on `folio_issues` — is
-- self-contradictory: it is an `UPDATE` on a table whose trigger rejects
-- `UPDATE` (§7.1). Hold state cannot live on the immutable row.
--
-- An artefact is on hold when its MOST RECENT ROW is `placed`. No update, no
-- delete, no boolean. That is also the only shape that survives being asked
-- "who put this on hold, when, and why" two years later, which is the question
-- a legal hold exists to answer. **AT-148**.
--
-- `artifact_id` carries NO foreign key on purpose: one hold table over two
-- artefact tables (`folio_issue` and `handover_export`), and a hold row
-- outliving its target is the safer failure of the two.
CREATE TABLE "artifact_legal_holds" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "artifact_type" TEXT NOT NULL,
    "artifact_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "actor_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "artifact_legal_holds_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- 4. Indexes — exactly the three sets §7.4–§7.6 name, and no others
-- ---------------------------------------------------------------------------
-- `[project_id, requested_at]` serves the project list route;
-- `[status, lease_expires_at]` is the worker's claim scan (§4.6.2) — the one
-- query a poller runs on a cadence; `[expires_at]` is the retention sweep
-- (§10.5).
CREATE INDEX "handover_exports_project_id_requested_at_idx" ON "handover_exports"("project_id", "requested_at");
CREATE INDEX "handover_exports_status_lease_expires_at_idx" ON "handover_exports"("status", "lease_expires_at");
CREATE INDEX "handover_exports_expires_at_idx" ON "handover_exports"("expires_at");

CREATE INDEX "handover_export_members_export_id_state_idx" ON "handover_export_members"("export_id", "state");
-- Two members cannot claim one path inside one archive. Collision suffixing
-- (§4.7.3, " (2)") happens in the freeze; this constraint is what makes a bug
-- in it a failed INSERT rather than a silently overwritten archive entry.
CREATE UNIQUE INDEX "handover_export_members_export_id_archive_path_key" ON "handover_export_members"("export_id", "archive_path");

-- The "latest row wins" read (§7.6) is this index, exactly.
CREATE INDEX "artifact_legal_holds_artifact_type_artifact_id_created_at_idx" ON "artifact_legal_holds"("artifact_type", "artifact_id", "created_at");

-- ---------------------------------------------------------------------------
-- 5. Foreign keys
-- ---------------------------------------------------------------------------
-- `requested_by` and `actor_id` are `SET NULL`, not `CASCADE`: a departed
-- employee's account being removed must not delete the record that an export
-- was generated or that a hold was placed.
ALTER TABLE "handover_exports" ADD CONSTRAINT "handover_exports_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "handover_exports" ADD CONSTRAINT "handover_exports_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "handover_export_members" ADD CONSTRAINT "handover_export_members_export_id_fkey" FOREIGN KEY ("export_id") REFERENCES "handover_exports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "artifact_legal_holds" ADD CONSTRAINT "artifact_legal_holds_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "artifact_legal_holds" ADD CONSTRAINT "artifact_legal_holds_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
