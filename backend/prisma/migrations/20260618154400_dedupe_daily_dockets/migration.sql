-- Merge existing duplicate daily docket parent rows before adding the
-- one-docket-per-subcontractor/project/date unique index.
--
-- Child rows and user-facing references are moved to a canonical docket. The
-- canonical docket is the most advanced/latest row in the duplicate group.

CREATE TEMP TABLE "daily_docket_duplicate_map" ON COMMIT DROP AS
WITH ranked_daily_dockets AS (
  SELECT
    "id",
    FIRST_VALUE("id") OVER (
      PARTITION BY "subcontractor_company_id", "project_id", "date"
      ORDER BY
        CASE "status"
          WHEN 'approved' THEN 1
          WHEN 'pending_approval' THEN 2
          WHEN 'queried' THEN 3
          WHEN 'submitted' THEN 4
          WHEN 'draft' THEN 5
          WHEN 'rejected' THEN 6
          ELSE 7
        END,
        "updated_at" DESC,
        "created_at" DESC,
        "id" ASC
    ) AS "keep_id"
  FROM "daily_dockets"
)
SELECT
  "id" AS "duplicate_id",
  "keep_id"
FROM ranked_daily_dockets
WHERE "id" <> "keep_id";

CREATE TEMP TABLE "daily_docket_merge_sources" ON COMMIT DROP AS
SELECT DISTINCT "keep_id", "keep_id" AS "source_id"
FROM "daily_docket_duplicate_map"
UNION ALL
SELECT "keep_id", "duplicate_id" AS "source_id"
FROM "daily_docket_duplicate_map";

CREATE TEMP TABLE "daily_docket_merged_metadata" ON COMMIT DROP AS
SELECT
  sources."keep_id",
  MIN(dockets."created_at") AS "created_at",
  MAX(dockets."updated_at") AS "updated_at",
  (ARRAY_AGG(dockets."submitted_by" ORDER BY dockets."submitted_at" DESC NULLS LAST, dockets."updated_at" DESC) FILTER (WHERE dockets."submitted_by" IS NOT NULL))[1] AS "submitted_by",
  MAX(dockets."submitted_at") AS "submitted_at",
  (ARRAY_AGG(dockets."approved_by" ORDER BY dockets."approved_at" DESC NULLS LAST, dockets."updated_at" DESC) FILTER (WHERE dockets."approved_by" IS NOT NULL))[1] AS "approved_by",
  MAX(dockets."approved_at") AS "approved_at",
  STRING_AGG(NULLIF(BTRIM(dockets."foreman_notes"), ''), E'\n\n' ORDER BY dockets."created_at", dockets."id") FILTER (WHERE NULLIF(BTRIM(dockets."foreman_notes"), '') IS NOT NULL) AS "foreman_notes",
  STRING_AGG(NULLIF(BTRIM(dockets."adjustment_reason"), ''), E'\n\n' ORDER BY dockets."created_at", dockets."id") FILTER (WHERE NULLIF(BTRIM(dockets."adjustment_reason"), '') IS NOT NULL) AS "adjustment_reason",
  STRING_AGG(NULLIF(BTRIM(dockets."notes"), ''), E'\n\n' ORDER BY dockets."created_at", dockets."id") FILTER (WHERE NULLIF(BTRIM(dockets."notes"), '') IS NOT NULL) AS "notes",
  SUM(COALESCE(dockets."total_plant_approved", 0)) AS "source_total_plant_approved"
FROM "daily_docket_merge_sources" sources
JOIN "daily_dockets" dockets ON dockets."id" = sources."source_id"
GROUP BY sources."keep_id";

UPDATE "docket_labour" labour
SET "docket_id" = duplicates."keep_id"
FROM "daily_docket_duplicate_map" duplicates
WHERE labour."docket_id" = duplicates."duplicate_id";

UPDATE "docket_plant" plant
SET "docket_id" = duplicates."keep_id"
FROM "daily_docket_duplicate_map" duplicates
WHERE plant."docket_id" = duplicates."duplicate_id";

UPDATE "diary_personnel" personnel
SET "docket_id" = duplicates."keep_id"
FROM "daily_docket_duplicate_map" duplicates
WHERE personnel."docket_id" = duplicates."duplicate_id";

UPDATE "diary_plant" plant
SET "docket_id" = duplicates."keep_id"
FROM "daily_docket_duplicate_map" duplicates
WHERE plant."docket_id" = duplicates."duplicate_id";

UPDATE "audit_logs" logs
SET "entity_id" = duplicates."keep_id"
FROM "daily_docket_duplicate_map" duplicates
WHERE logs."entity_id" = duplicates."duplicate_id"
  AND LOWER(REPLACE(REPLACE(logs."entity_type", ' ', '_'), '-', '_')) IN ('docket', 'daily_docket', 'dailydocket');

UPDATE "comments" comments
SET "entity_id" = duplicates."keep_id"
FROM "daily_docket_duplicate_map" duplicates
WHERE comments."entity_id" = duplicates."duplicate_id"
  AND LOWER(REPLACE(REPLACE(comments."entity_type", ' ', '_'), '-', '_')) IN ('docket', 'daily_docket', 'dailydocket');

UPDATE "notification_alerts" alerts
SET "entity_id" = duplicates."keep_id"
FROM "daily_docket_duplicate_map" duplicates
WHERE alerts."entity_id" = duplicates."duplicate_id"
  AND LOWER(REPLACE(REPLACE(alerts."entity_type", ' ', '_'), '-', '_')) IN ('docket', 'daily_docket', 'dailydocket');

UPDATE "sync_queue" queue
SET "entity_id" = duplicates."keep_id"
FROM "daily_docket_duplicate_map" duplicates
WHERE queue."entity_id" = duplicates."duplicate_id"
  AND LOWER(REPLACE(REPLACE(queue."entity_type", ' ', '_'), '-', '_')) IN ('docket', 'daily_docket', 'dailydocket');

UPDATE "notifications" notifications
SET "link_url" = REPLACE(notifications."link_url", duplicates."duplicate_id", duplicates."keep_id")
FROM "daily_docket_duplicate_map" duplicates
WHERE notifications."link_url" IS NOT NULL
  AND notifications."link_url" LIKE '%' || duplicates."duplicate_id" || '%';

WITH recalculated_totals AS (
  SELECT
    metadata."keep_id",
    COALESCE(labour_totals."submitted_cost", 0) AS "total_labour_submitted",
    COALESCE(labour_totals."approved_hours", 0) AS "total_labour_approved",
    COALESCE(labour_totals."approved_cost", 0) AS "total_labour_approved_cost",
    COALESCE(plant_totals."submitted_cost", 0) AS "total_plant_submitted",
    CASE
      WHEN COALESCE(metadata."source_total_plant_approved", 0) > 0 THEN metadata."source_total_plant_approved"
      ELSE COALESCE(plant_totals."approved_hours", 0)
    END AS "total_plant_approved",
    COALESCE(plant_totals."approved_cost", 0) AS "total_plant_approved_cost"
  FROM "daily_docket_merged_metadata" metadata
  LEFT JOIN (
    SELECT
      "docket_id",
      SUM(COALESCE("submitted_cost", 0)) AS "submitted_cost",
      SUM(COALESCE("approved_hours", 0)) AS "approved_hours",
      SUM(COALESCE("approved_cost", 0)) AS "approved_cost"
    FROM "docket_labour"
    GROUP BY "docket_id"
  ) labour_totals ON labour_totals."docket_id" = metadata."keep_id"
  LEFT JOIN (
    SELECT
      "docket_id",
      SUM(COALESCE("submitted_cost", 0)) AS "submitted_cost",
      SUM(
        CASE
          WHEN "approved_cost" IS NOT NULL AND COALESCE("hourly_rate", 0) <> 0 THEN "approved_cost" / "hourly_rate"
          WHEN "approved_cost" IS NOT NULL THEN COALESCE("hours_operated", 0)
          ELSE 0
        END
      ) AS "approved_hours",
      SUM(COALESCE("approved_cost", 0)) AS "approved_cost"
    FROM "docket_plant"
    GROUP BY "docket_id"
  ) plant_totals ON plant_totals."docket_id" = metadata."keep_id"
)
UPDATE "daily_dockets" dockets
SET
  "created_at" = metadata."created_at",
  "submitted_by" = COALESCE(dockets."submitted_by", metadata."submitted_by"),
  "submitted_at" = COALESCE(dockets."submitted_at", metadata."submitted_at"),
  "approved_by" = COALESCE(dockets."approved_by", metadata."approved_by"),
  "approved_at" = COALESCE(dockets."approved_at", metadata."approved_at"),
  "foreman_notes" = COALESCE(metadata."foreman_notes", dockets."foreman_notes"),
  "adjustment_reason" = COALESCE(metadata."adjustment_reason", dockets."adjustment_reason"),
  "notes" = COALESCE(metadata."notes", dockets."notes"),
  "total_labour_submitted" = totals."total_labour_submitted",
  "total_labour_approved" = totals."total_labour_approved",
  "total_plant_submitted" = totals."total_plant_submitted",
  "total_plant_approved" = totals."total_plant_approved",
  "total_labour_approved_cost" = totals."total_labour_approved_cost",
  "total_plant_approved_cost" = totals."total_plant_approved_cost",
  "updated_at" = GREATEST(dockets."updated_at", metadata."updated_at")
FROM "daily_docket_merged_metadata" metadata
JOIN recalculated_totals totals ON totals."keep_id" = metadata."keep_id"
WHERE dockets."id" = metadata."keep_id";

DELETE FROM "daily_dockets" dockets
USING "daily_docket_duplicate_map" duplicates
WHERE dockets."id" = duplicates."duplicate_id";
