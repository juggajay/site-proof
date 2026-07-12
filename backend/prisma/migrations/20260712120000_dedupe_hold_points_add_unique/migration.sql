-- Merge existing duplicate hold point rows before enforcing one row per
-- lot/checklist item. Keep the most advanced/latest row in each group.

CREATE TEMP TABLE "hold_point_duplicate_map" ON COMMIT DROP AS
WITH ranked_hold_points AS (
  SELECT
    "id",
    FIRST_VALUE("id") OVER (
      PARTITION BY "lot_id", "itp_checklist_item_id"
      ORDER BY
        CASE "status"
          WHEN 'released' THEN 1
          WHEN 'completed' THEN 2
          WHEN 'notified' THEN 3
          WHEN 'pending' THEN 4
          ELSE 5
        END,
        "updated_at" DESC,
        "created_at" DESC,
        "id" ASC
    ) AS "keep_id"
  FROM "hold_points"
)
SELECT
  "id" AS "duplicate_id",
  "keep_id"
FROM ranked_hold_points
WHERE "id" <> "keep_id";

UPDATE "hold_point_release_tokens" tokens
SET "hold_point_id" = duplicates."keep_id"
FROM "hold_point_duplicate_map" duplicates
WHERE tokens."hold_point_id" = duplicates."duplicate_id";

UPDATE "audit_logs" logs
SET "entity_id" = duplicates."keep_id"
FROM "hold_point_duplicate_map" duplicates
WHERE logs."entity_id" = duplicates."duplicate_id"
  AND LOWER(REPLACE(REPLACE(logs."entity_type", ' ', '_'), '-', '_')) IN ('hold_point', 'holdpoint', 'hold_points', 'holdpoints');

UPDATE "comments" comments
SET "entity_id" = duplicates."keep_id"
FROM "hold_point_duplicate_map" duplicates
WHERE comments."entity_id" = duplicates."duplicate_id"
  AND LOWER(REPLACE(REPLACE(comments."entity_type", ' ', '_'), '-', '_')) IN ('hold_point', 'holdpoint', 'hold_points', 'holdpoints');

UPDATE "notification_alerts" alerts
SET "entity_id" = duplicates."keep_id"
FROM "hold_point_duplicate_map" duplicates
WHERE alerts."entity_id" = duplicates."duplicate_id"
  AND LOWER(REPLACE(REPLACE(alerts."entity_type", ' ', '_'), '-', '_')) IN ('hold_point', 'holdpoint', 'hold_points', 'holdpoints');

UPDATE "notifications" notifications
SET "link_url" = REPLACE(notifications."link_url", duplicates."duplicate_id", duplicates."keep_id")
FROM "hold_point_duplicate_map" duplicates
WHERE notifications."link_url" IS NOT NULL
  AND notifications."link_url" LIKE '%' || duplicates."duplicate_id" || '%';

DELETE FROM "hold_points" hold_points
USING "hold_point_duplicate_map" duplicates
WHERE hold_points."id" = duplicates."duplicate_id";

CREATE UNIQUE INDEX "hold_points_lot_id_itp_checklist_item_id_key"
ON "hold_points"("lot_id", "itp_checklist_item_id");
