# Second-pass class hunt — 2026-07-11

Follow-up to the 2026-07-10 external review fix campaign. Six read-only hunters,
one per finding CLASS, verifying against current master. Goal: find OTHER
instances of the six classes yesterday's 8 findings belonged to.

Prod-data verdict (run first, `docs/research/prod-integrity-aggregates-2026-07-10.sql`):
orphan failed-ITPs 0, evidence-free NCRs 0, duplicate payments 0, duplicate
claims = 4 groups ALL in QA/test projects. Yesterday's bugs never bit real prod data.

## Verified findings (11 total: 2 High, 3 Medium, 6 Low)

### HIGH
- **H-EVID (evidence links).** Generic `DELETE /api/documents/:id` blocks NCR
  evidence (F-06 fix) but NOT `VariationEvidence` (onDelete: Cascade,
  schema.prisma:1414). Deleting the backing doc of a CLAIMED variation silently
  cascades its evidence away on a money path. Variation-specific route is
  guarded; generic route is the bypass. Fix: mirror NCR link block in
  deleteRoutes.ts.
- **H-PAGE (pagination).** Conformance Report / Material Conformance Record PDF
  embeds test results + NCRs via the paginated list endpoints capped at 20
  (`useConformanceReportGeneration.ts:108-111`; default limit 20). A lot with
  >20 density/compaction tests (routine) silently ships a compliance PDF missing
  the newest-20-only. Sibling HP evidence package loads the same data correctly
  (Prisma relation, no take). Fix: page through both (helpers
  fetchAllTestResultPages / fetchAllNcrPages already exist).

### MEDIUM
- **M-TX (split transaction).** NCR reopen (ncrClosureWorkflow.ts:568-599) flips
  the NCR in one write, its lots in a separate un-transacted write. Crash between
  → open NCR whose lots don't show ncr_raised, and reopen can't re-run (status no
  longer closed). The adjacent `close` handler already wraps both in one tx —
  reopen should mirror it. 3-line fix.
- **M-OFFLINE (offline lossiness).** A `pending_verification` ITP completion
  (subbie submitted, awaiting HC) can be reset to `pending` by an offline
  re-toggle — offline reconstruction drops verificationStatus so both surfaces
  render it unlocked; backend re-completion guard (completions.ts:387-398) covers
  verified+failed but NOT pending_verification. Wipes attribution, drops it from
  the HC verification queue. Gated behind opt-in requireSubcontractorVerification.
  Fix: one guard beside the verified guard (root-cause, covers all callers).
- **M-ALLOC (number allocators).** Concurrent "Request Release" double-click can
  create duplicate HoldPoint rows — no unique(lotId, itpChecklistItemId), create
  branch reads existing HPs OUTSIDE the tx (requestReleaseRoutes.ts:570-618, create
  at 838). Two rows, two live tokens, two superintendent emails; releasing one
  strands the other. Dockets had this EXACT bug and got the FOR-UPDATE + dedupe
  migration fix in June; HPs never did. Race-only (replay is safe). Fix: FOR UPDATE
  lock + re-read in tx; durable backstop = unique constraint after a dedupe migration.

### LOW
- **L-EVID-1.** Generic metadata PATCH mutates NCR evidence even on a CLOSED NCR
  (requireDocumentMutationAccess only runs ITP-locked check). F-10 gap one table over.
- **L-EVID-2.** Generic metadata PATCH mutates a CLAIMED variation's evidence doc.
- **L-VAR.** Variation create has no requestKey — replay creates duplicate VAR-000N
  (contained: lands as visible/deletable `proposed`, not claimable).
- **L-INVITE.** Concurrent subbie invites create duplicate SubcontractorCompany +
  double email (app-level check, no unique constraint, not in a tx).
- **L-XERO.** Xero export button has no in-flight disable → double-click = two
  identical CSVs. (The feared class DOESN'T EXIST — export is read-only CSV, no
  live Xero API, no tokens, no server side effect on retry. Deterministic invoice
  number → Xero-side dedup catches human re-import.)
- **L-OFFLINE.** signatureDataUrl never carried on offline completions; evidenceRequired
  defaulted to 'none' offline (bypassable warning only) — report-fidelity, no gate.

## Root-cause themes (fix these, not just instances)
1. **Evidence-link guards must be TABLE-DRIVEN.** deleteRoutes + requireDocumentMutationAccess
   + assertDocumentCanUseGenericVersioning each hand-check ITP/NCR; every new evidence-link
   table (Variation now, next one later) repeats the class. Make it a list.
2. **fetchAll*Pages exists 3x; adopt it everywhere "all rows for this scope" is needed.**
   Same 20-row default on /api/lots, /api/test-results, /api/ncrs bites every non-paging caller.
3. **Number/one-per-X creates need FOR-UPDATE + unique constraint, not app-level findFirst.**
   Dockets/diaries/claims do this; hold points, variations, invites don't.

## Confirmed clean (high-confidence, mechanism named in hunter reports)
Claims (create/certify/pay/delete), dockets, diaries, lots, projects, test-result numbering,
NCR numbering, most split-tx flows (HP release, invitation accept, lot create, docket approve),
lot/NCR/delay/claims/costs register CSVs, claim evidence package, HP evidence package,
dashboard PDF, scheduled reports (disclosed digest), witness offline (F-08 fix holding),
TestResult/Drawing document links.
