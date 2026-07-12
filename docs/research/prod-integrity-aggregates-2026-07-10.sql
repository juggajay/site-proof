-- Read-only prod integrity aggregates — follow-ups from the 2026-07-10
-- external review fix campaign (docs/research/external-codebase-review-2026-07-10.md).
-- SAFE: SELECT-only. Run against the Railway prod DB (psql or Railway data tab)
-- and eyeball the counts. Expected result for a healthy DB: all three return 0 rows.

-- ============================================================================
-- 1) F-02 tail — failed ITP completions with NO linked NCR
--    (the atomic fix prevents NEW orphans; pre-fix orphans heal only when the
--    completion is re-POSTed. This finds any still sitting there.)
-- ============================================================================
SELECT c.id            AS completion_id,
       i.lot_id,
       c.checklist_item_id,
       c.completed_at
FROM   itp_completions c
JOIN   itp_instances i ON i.id = c.itp_instance_id
WHERE  c.status = 'failed'
AND    NOT EXISTS (
         SELECT 1
         FROM   ncrs n
         JOIN   ncr_lots nl ON nl.ncr_id = n.id
         WHERE  nl.lot_id = i.lot_id
         AND    n.rectification_notes LIKE '%[itp-item:' || c.checklist_item_id || ']%'
       )
ORDER BY c.completed_at DESC NULLS LAST;

-- ============================================================================
-- 2) F-06 tail — NCRs in verification/closed with ZERO evidence
--    (closure now requires evidence; this finds records that slipped through
--    before the fix.)
-- ============================================================================
SELECT n.id, n.ncr_number, n.project_id, n.status
FROM   ncrs n
WHERE  n.status IN ('verification', 'closed', 'closed_concession')
AND    NOT EXISTS (SELECT 1 FROM ncr_evidence e WHERE e.ncr_id = n.id)
ORDER BY n.status, n.ncr_number;

-- ============================================================================
-- 3a) F-03 tail — duplicate-suspect claims from historical replays
--     (same project + same period + same total, more than one claim)
-- ============================================================================
SELECT project_id,
       claim_period_start,
       claim_period_end,
       total_claimed_amount,
       COUNT(*)                 AS claim_count,
       ARRAY_AGG(claim_number ORDER BY claim_number) AS claim_numbers
FROM   progress_claims
GROUP  BY project_id, claim_period_start, claim_period_end, total_claimed_amount
HAVING COUNT(*) > 1;

-- ============================================================================
-- 3b) F-04 tail — duplicate-suspect payment history entries within a claim
--     (same amount + date + reference appearing more than once; dispute_notes
--     holds the paymentHistory JSON — only parses rows that look like JSON)
-- ============================================================================
WITH parsed AS (
  SELECT id, claim_number, project_id,
         jsonb_array_elements(
           COALESCE(dispute_notes::jsonb -> 'paymentHistory', '[]'::jsonb)
         ) AS entry
  FROM   progress_claims
  WHERE  dispute_notes IS NOT NULL
  AND    dispute_notes ~ '^\s*\{'
)
SELECT id                      AS claim_id,
       claim_number,
       project_id,
       entry ->> 'amount'      AS amount,
       entry ->> 'date'        AS payment_date,
       entry ->> 'reference'   AS reference,
       COUNT(*)                AS times_recorded
FROM   parsed
GROUP  BY id, claim_number, project_id,
          entry ->> 'amount', entry ->> 'date', entry ->> 'reference'
HAVING COUNT(*) > 1;
