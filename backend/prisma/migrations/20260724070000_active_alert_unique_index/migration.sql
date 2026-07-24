-- One active alert per (type, entity_id).
--
-- The alert generators (hourly worker + admin check endpoint) use a
-- check-then-create pattern; without a database-enforced identity two
-- concurrent runs could both pass the existence check and write duplicate
-- active alerts (external review 2026-07-24, P1). entity_id is globally
-- unique per entity (NCR/hold-point UUIDs, or diary-<projectId>-<date>), so
-- (type, entity_id) identifies an alert; resolved alerts are history and stay
-- out of the constraint via the partial index predicate.

-- Resolve any existing duplicate active alerts first, keeping the original
-- (oldest) of each group so escalation timing stays anchored to the first
-- occurrence. Duplicates are resolved, not deleted — they remain as history.
UPDATE "notification_alerts"
SET "resolved_at" = NOW()
WHERE "id" IN (
  SELECT "id"
  FROM (
    SELECT
      "id",
      ROW_NUMBER() OVER (
        PARTITION BY "type", "entity_id"
        ORDER BY "created_at" ASC, "id" ASC
      ) AS row_number
    FROM "notification_alerts"
    WHERE "resolved_at" IS NULL
  ) ranked
  WHERE ranked.row_number > 1
);

CREATE UNIQUE INDEX "notification_alerts_active_type_entity_key"
ON "notification_alerts" ("type", "entity_id")
WHERE "resolved_at" IS NULL;
