WITH ranked_ncr_evidence AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY ncr_id, document_id
      ORDER BY uploaded_at ASC, id ASC
    ) AS duplicate_rank
  FROM "ncr_evidence"
)
DELETE FROM "ncr_evidence"
WHERE id IN (
  SELECT id
  FROM ranked_ncr_evidence
  WHERE duplicate_rank > 1
);

CREATE UNIQUE INDEX "ncr_evidence_ncr_id_document_id_key" ON "ncr_evidence"("ncr_id", "document_id");
