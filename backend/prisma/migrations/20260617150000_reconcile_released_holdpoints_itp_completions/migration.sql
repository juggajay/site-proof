-- Released hold points are authoritative sign-off for their linked ITP item.
-- Older releases could leave the hold point released while the ITP completion
-- row was missing or still pending, which blocked lot conformance. Reconcile
-- that historical state so existing lots are repaired on deploy.

UPDATE "itp_completions" AS completion
SET
  "status" = 'completed',
  "completed_at" = COALESCE(
    completion."completed_at",
    hold_point."released_at",
    hold_point."updated_at",
    CURRENT_TIMESTAMP
  ),
  "verification_status" = 'verified',
  "verified_at" = COALESCE(
    completion."verified_at",
    hold_point."released_at",
    hold_point."updated_at",
    CURRENT_TIMESTAMP
  )
FROM "itp_instances" AS instance
JOIN "hold_points" AS hold_point
  ON hold_point."lot_id" = instance."lot_id"
WHERE completion."itp_instance_id" = instance."id"
  AND completion."checklist_item_id" = hold_point."itp_checklist_item_id"
  AND hold_point."status" = 'released'
  AND (
    completion."status" <> 'completed'
    OR completion."completed_at" IS NULL
    OR completion."verification_status" <> 'verified'
    OR completion."verified_at" IS NULL
  );

INSERT INTO "itp_completions" (
  "id",
  "itp_instance_id",
  "checklist_item_id",
  "status",
  "completed_at",
  "verification_status",
  "verified_at"
)
SELECT
  lower(
    substr(generated.seed, 1, 8) || '-' ||
    substr(generated.seed, 9, 4) || '-' ||
    '4' || substr(generated.seed, 14, 3) || '-' ||
    '8' || substr(generated.seed, 18, 3) || '-' ||
    substr(generated.seed, 21, 12)
  ) AS "id",
  instance."id" AS "itp_instance_id",
  hold_point."itp_checklist_item_id" AS "checklist_item_id",
  'completed' AS "status",
  COALESCE(hold_point."released_at", hold_point."updated_at", CURRENT_TIMESTAMP) AS "completed_at",
  'verified' AS "verification_status",
  COALESCE(hold_point."released_at", hold_point."updated_at", CURRENT_TIMESTAMP) AS "verified_at"
FROM "hold_points" AS hold_point
JOIN "itp_instances" AS instance
  ON instance."lot_id" = hold_point."lot_id"
CROSS JOIN LATERAL (
  SELECT md5(random()::text || clock_timestamp()::text || hold_point."id" || instance."id") AS seed
) AS generated
WHERE hold_point."status" = 'released'
  AND NOT EXISTS (
    SELECT 1
    FROM "itp_completions" AS existing
    WHERE existing."itp_instance_id" = instance."id"
      AND existing."checklist_item_id" = hold_point."itp_checklist_item_id"
  )
ON CONFLICT ("itp_instance_id", "checklist_item_id") DO NOTHING;
