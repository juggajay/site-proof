# Variation Register — Lean v1 Plan (2026-07-08)

**Why:** Progress claims are built purely from conformed lots × budget %.
Extra/changed work (variations) has no home — a first-claim-cycle blocker
for the target user. Every AU competitor (Payapps, Varicon, Styck,
Planyard) bundles variations with progress claims.

**Product stance (locked):** claims = data-compiler, Xero owns money.
The register captures the paper trail (number, description, client ref,
evidence, one approved amount) and lets an approved variation be claimed
as a line in a progress claim. Explicitly OUT of scope: pricing
build-ups, margin analysis, contract-clause/SOPA logic, partial claiming
of a variation (whole-once in v1), variation-from-diary-event flows.

**Naming trap:** "variation" already means (a) free-text
`variationNotes` on claim certification and (b) diary
`eventType='variation'`. The new entity is `Variation` / "Variations
register"; do not touch the existing two.

## Data model (additive migration, hand-written SQL per house style)

```prisma
model Variation {
  id              String    @id @default(uuid())
  projectId       String    @map("project_id")
  variationNumber String    @map("variation_number") // "VAR-0001"
  title           String
  description     String?
  status          String    @default("proposed")
  // proposed | submitted | approved | rejected | claimed
  approvedAmount  Decimal?  @map("approved_amount")  // ex-GST
  clientReference String?   @map("client_reference") // site instruction / client VO ref
  lotId           String?   @map("lot_id")
  claimedInId     String?   @map("claimed_in_id")
  submittedAt     DateTime? @map("submitted_at")
  approvedAt      DateTime? @map("approved_at")
  rejectedAt      DateTime? @map("rejected_at")
  rejectionReason String?   @map("rejection_reason")
  createdById     String?   @map("created_by")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  project   Project        @relation(... onDelete: Cascade)
  lot       Lot?           @relation(... onDelete: SetNull)
  claimedIn ProgressClaim? @relation(... onDelete: SetNull)
  createdBy User?          @relation(... onDelete: SetNull)
  evidence  VariationEvidence[]

  @@unique([projectId, variationNumber])
  @@map("variations")
}

model VariationEvidence {
  id           String   @id @default(uuid())
  variationId  String   @map("variation_id")
  documentId   String   @map("document_id")
  evidenceType String   @map("evidence_type")
  uploadedAt   DateTime @default(now()) @map("uploaded_at")
  // both FKs Cascade; mirrors NCREvidence (schema.prisma:866-878)
  @@unique([variationId, documentId])
  @@map("variation_evidence")
}
```

Status transitions (app-enforced, no PG enums — house style):
proposed → submitted → approved | rejected; rejected → submitted
(resubmit); approved → claimed only via claim creation; claim deletion
(draft-only) reverses claimed → approved + claimedInId=null.
`approvedAmount > 0` required at the approve transition. Claimed
variations are immutable (no edit/delete). Delete allowed only for
proposed/rejected.

## Backend (PR 1)

New router `backend/src/routes/claims/variationRoutes.ts` (or sibling
file), mounted under `/api/projects/:projectId/variations` inside
claims.ts wiring so it reuses `requireCommercialProjectAccess`
(claims.ts:36-53) verbatim — commercial roles only, subbie-blocked,
`requireWritable` on mutations.

- `GET /` register list (order variationNumber desc)
- `POST /` create — number allocation copies
  `createNcrWithAllocatedNumber` (ncrs/ncrNumberAllocation.ts:26-55):
  max(sequence)+1 inside $transaction, 5-retry on P2002,
  `VAR-${padStart(4,'0')}`
- `PUT /:id` field edits (blocked once claimed) + status transitions
  with guards above
- `DELETE /:id` proposed/rejected only
- `POST /:id/evidence` {documentId, evidenceType} +
  `DELETE /:id/evidence/:evidenceId` — mirror NCR evidence routes
- Zod validation module beside it (workflowValidation.ts style);
  amounts validated > 0, ≤ 2dp via roundClaimAmountToCents

Claim wiring (workflowRoutes.ts):
- `createClaimSchema` gains optional `variationIds: string[]`
- Create guards: each variation exists in project, status='approved',
  claimedInId=null, approvedAmount>0; FOR UPDATE row locks like lots
- `totalClaimedAmount += Σ approvedAmount` (workflowRoutes.ts:239-247) —
  certification/paid guards then cover variations automatically
- Same transaction sets status='claimed' + claimedInId
- Draft-claim delete (postEvidenceWorkflowRoutes.ts:530-579) reverses
- Claim detail payload (readRoutes.ts) includes claimed variations;
  list payload gains `variationCount`
- Evidence-package endpoint (evidenceRoutes.ts): top-level
  `variations: []` (number, title, clientReference, approvedAmount,
  evidence docs) parallel to `lots`, and summary totals include the
  variation subtotal
- Xero export (xeroExport.ts): one row per claimed variation — same
  InvoiceNumber, Quantity 1, UnitAmount = approvedAmount, Description
  `Variation VAR-XXXX — {title}`; reconciliation guard (:118-128)
  already enforces total consistency

Migration: additive only — CREATE TABLE ×2, indexes, FKs (Cascade /
SetNull as above). Follows 20260704185738_hold_point_release_batch
style. **Prod apply is manual (`npx prisma migrate status` →
`migrate deploy`) and only after Jay's explicit "go".** Local test DB
gets it via `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/siteproof_test npx prisma migrate deploy`.

## Frontend (PR 2)

- `frontend/src/pages/variations/` copying the NCR module shape:
  thin `VariationsPage.tsx`, `hooks/useVariationsData.ts` (useQuery on
  new `queryKeys.variations(projectId)`), `useVariationActions`,
  `useVariationModals`, filters bar (status), desktop table + mobile
  list (useIsMobile), `?variation=<id>` deep link via
  useRegisterDeepLink
- Status labels via `STATUS_LABELS`/`formatStatusLabel`
  (lib/statusLabels.ts) — add the five variation statuses there, NOT an
  inline badge switch
- Create/edit modal: title, description, client reference, optional lot
  picker, amount (ex GST); Approve action prompts/confirms final amount;
  Reject captures reason; Submit is one click
- Detail sheet: fields + evidence list (NCREvidenceList pattern,
  openDocumentAccessUrl only) + two-step upload (POST /documents/upload
  → POST /variations/:id/evidence, RectifyNCRModal.tsx:61-109 pattern)
- CreateClaimModal: "Approved variations" section under the lots list —
  checkboxes, fixed amounts (no % entry), fold into the displayed total;
  payload gains `variationIds`
- Route `/projects/:projectId/variations` behind ProjectProtectedRoute
  COMMERCIAL_ROLES (App.tsx claims pattern :445-453); nav items in
  Sidebar.tsx (:117-121 pattern, requiresCommercialAccess) and
  MobileNav.tsx
- ClaimsTable: variations count shown alongside Lots count column
  (payload `variationCount`)
- **Rail rider:** add 'Rail' to the four activity lists —
  createLotForm.ts:13-23, LotEditFormFields.tsx:7-16,
  bulkCreateLots.ts:14, importLotsCsv.ts:189

## Evidence package PDF (PR 3)

- `ClaimPackageOptions` gains `includeVariations` (default true in
  constants.ts:77-86 + PACKAGE_SECTIONS in EvidencePackageModal.tsx)
- claimEvidencePackagePdf.ts: variations block after the NCR section
  (:436) — table of VAR#, title, client ref, amount + evidence manifest
  entries; lot-summary TOTAL row and cover reflect the combined total

## Test plan
- Backend: number-allocation unit tests (NCR-pattern, mocked client);
  transition guard tests; claim-create-with-variations totals + guards
  (DB-backed against local test DB); xero reconciliation incl.
  variation rows; evidence-package payload section
- Frontend: register page (NCR test patterns), create/claim-modal
  payload wiring, statusLabels, evidence upload flow mocked
- Guardrails: frontend productionReadiness (route-guard pin will need a
  new assertion for the variations route), backend routeAuthCoverage

## PR sequence
1. PR 1 backend (schema+migration+routes+claim wiring+xero+package
   payload+tests) — **merge only after Jay's "go" + manual prod
   migrate deploy**
2. PR 2 frontend register + claim wiring + nav + Rail rider
3. PR 3 evidence-package PDF section
