WITH ranked_completions AS (
  SELECT
    "id",
    FIRST_VALUE("id") OVER (
      PARTITION BY "itp_instance_id", "checklist_item_id"
      ORDER BY
        CASE
          WHEN "status" = 'failed' THEN 0
          WHEN "verification_status" = 'verified' THEN 1
          WHEN "status" = 'completed' THEN 2
          WHEN "status" = 'not_applicable' THEN 3
          ELSE 4
        END,
        COALESCE("verified_at", "completed_at", TIMESTAMP '1970-01-01') DESC,
        "id" ASC
    ) AS "canonical_id",
    ROW_NUMBER() OVER (
      PARTITION BY "itp_instance_id", "checklist_item_id"
      ORDER BY
        CASE
          WHEN "status" = 'failed' THEN 0
          WHEN "verification_status" = 'verified' THEN 1
          WHEN "status" = 'completed' THEN 2
          WHEN "status" = 'not_applicable' THEN 3
          ELSE 4
        END,
        COALESCE("verified_at", "completed_at", TIMESTAMP '1970-01-01') DESC,
        "id" ASC
    ) AS "row_number"
  FROM "itp_completions"
),
duplicate_completions AS (
  SELECT "id", "canonical_id"
  FROM ranked_completions
  WHERE "row_number" > 1
)
DELETE FROM "itp_completion_attachments" AS duplicate_attachment
USING duplicate_completions
WHERE duplicate_attachment."completion_id" = duplicate_completions."id"
  AND EXISTS (
    SELECT 1
    FROM "itp_completion_attachments" AS canonical_attachment
    WHERE canonical_attachment."completion_id" = duplicate_completions."canonical_id"
      AND canonical_attachment."document_id" = duplicate_attachment."document_id"
  );

WITH ranked_completions AS (
  SELECT
    "id",
    FIRST_VALUE("id") OVER (
      PARTITION BY "itp_instance_id", "checklist_item_id"
      ORDER BY
        CASE
          WHEN "status" = 'failed' THEN 0
          WHEN "verification_status" = 'verified' THEN 1
          WHEN "status" = 'completed' THEN 2
          WHEN "status" = 'not_applicable' THEN 3
          ELSE 4
        END,
        COALESCE("verified_at", "completed_at", TIMESTAMP '1970-01-01') DESC,
        "id" ASC
    ) AS "canonical_id",
    ROW_NUMBER() OVER (
      PARTITION BY "itp_instance_id", "checklist_item_id"
      ORDER BY
        CASE
          WHEN "status" = 'failed' THEN 0
          WHEN "verification_status" = 'verified' THEN 1
          WHEN "status" = 'completed' THEN 2
          WHEN "status" = 'not_applicable' THEN 3
          ELSE 4
        END,
        COALESCE("verified_at", "completed_at", TIMESTAMP '1970-01-01') DESC,
        "id" ASC
    ) AS "row_number"
  FROM "itp_completions"
),
duplicate_completions AS (
  SELECT "id", "canonical_id"
  FROM ranked_completions
  WHERE "row_number" > 1
)
UPDATE "itp_completion_attachments" AS attachment
SET "completion_id" = duplicate_completions."canonical_id"
FROM duplicate_completions
WHERE attachment."completion_id" = duplicate_completions."id";

WITH ranked_completions AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "itp_instance_id", "checklist_item_id"
      ORDER BY
        CASE
          WHEN "status" = 'failed' THEN 0
          WHEN "verification_status" = 'verified' THEN 1
          WHEN "status" = 'completed' THEN 2
          WHEN "status" = 'not_applicable' THEN 3
          ELSE 4
        END,
        COALESCE("verified_at", "completed_at", TIMESTAMP '1970-01-01') DESC,
        "id" ASC
    ) AS "row_number"
  FROM "itp_completions"
)
DELETE FROM "itp_completions" AS completion
USING ranked_completions
WHERE completion."id" = ranked_completions."id"
  AND ranked_completions."row_number" > 1;

DROP INDEX IF EXISTS "itp_completions_itp_instance_id_checklist_item_id_idx";

CREATE UNIQUE INDEX "itp_completions_itp_instance_id_checklist_item_id_key"
ON "itp_completions"("itp_instance_id", "checklist_item_id");
