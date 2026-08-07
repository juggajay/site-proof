# HP decision lifecycle — BUILD SPEC (self-contained, per-PR briefs for the codex builder)

**Authority chain:** design Rev 3 (`docs/plans/hp-decision-design-2026-08-07.md`, #1785) ←
primary-source research (`docs/research/hp-release-authority-research-2026-08-07.md`, #1788) ←
adversarial plan review 2026-08-07 (Fable, BUILD-READY-WITH-CORRECTIONS: 3 critical, 5 high,
6 medium — all folded here as binding text). This document supersedes Rev 3 wherever they
disagree. The builder implements ONE PR section at a time, exactly as written, and treats every
line as binding. Descoping requires documenting the cut in the PR body; scope expansion is
forbidden.

Ground rules (all PRs): TypeScript strict; prettier before commit; `npm run fallow:audit`
verdict in PR body; backend DB tests against local disposable Postgres only
(`postgresql://postgres:postgres@localhost:5432/siteproof_test`, `npx prisma migrate deploy`
first); base every branch on **origin/master** freshly fetched; PR-and-stop (never merge).
Follow `tasks/lessons.md`.

## Decisions locked by the review (do not relitigate)

- **D-C1 (conditional-release blocking mechanism): option (c).** Blocking does NOT ride the ITP
  item's `verificationStatus` (unknown tokens fall through as non-blocking across ~56 consumer
  files — silently unsafe; and `pending_verification` would let a QM verify past the authority's
  conditions via `completionVerificationRoutes.ts:239-250`). Instead: a **conditions-open limb in
  the conformance prerequisites**, beside `noOpenNcrs` (`lib/conformancePrerequisites.ts`,
  `lotConformable` at `lib/readiness/predicates.ts:477`), driven by a count of open conditions on
  the lot's hold points' current rounds. The ITP completion on a conditional release is written
  `status='completed'` with today's default (NOT 'verified' — leave `verificationStatus` exactly
  as a non-release completion would have it); verified lands when the last condition is recorded
  satisfied (PR D). One enforcement point, no vocabulary contagion.
- **D-C2 (authority-model mapping — a NAMED BEHAVIOR CHANGE, not "existing behavior"):**
  `Project.hpApprovalRequirement === 'superintendent'` → that project's specification hold points
  are `authorityClass='principal'`: decisions happen ONLY via round-bound tokens; the in-app
  release door returns 403 for EVERY internal role including the `superintendent` project role
  (today that setting merely narrows in-app release to owner/admin/PM/superintendent —
  `actionRoutes.ts:108-141` — this PR changes that, and the PR body must say so). Any other
  `hpApprovalRequirement` value → today's authenticated door remains (mapped as
  `contractor_internal` semantics). `authorityClass` is stored per HP, derived at request time
  from the project setting, overridable at HP creation for contractor-designated points.
- **D-C3:** this document IS the concrete normative text (schema below) — never reference
  "Rev 2".
- **D-H1 (provenance survives token deletion):** rounds denormalize
  `recipientEmail/recipientName` and `decidedByName/decidedByOrg` onto the row; any
  `decidedByTokenId` FK is nullable `onDelete: SetNull` (pattern:
  `RequirementEvaluation.actorTokenId` + `actorLabel`, `schema.prisma:2148,2157`). Token rows are
  aggressively deleted (re-request/chase `deleteMany` at `requestReleaseRoutes.ts:404-409,
  883-888`; ~48h retention sweep) — nothing evidentiary may live only on a token.
- **D-H2 (deploy-gap tolerance):** every new column nullable or defaulted; NEW code tolerates
  tokens/HPs with no round (old rows + gap-window rows) by lazy-binding or null-guarding; the
  backfill is an idempotent, re-runnable operator script run AFTER frontend+backend deploy
  (PR F), never on deploy. Synthetic rounds use a unique key that makes re-runs no-ops.
- **D-H3 + D-H4 (rejection NCR):** raised INSIDE the decision transaction using
  `allocateNcrNumber(tx, projectId)` (`routes/ncrs/ncrNumberAllocation.ts:24`) with the
  `[projectId, ncrNumber]` P2002 retry composed with the decision's own retry loop — never
  post-commit, never `createNcrWithAllocatedNumber` (it opens its own tx). The NCR gets an
  `NCRLot` row for the HP's lot and the existing lot-status flip to `'ncr_raised'`
  (`ncrCore.ts:376-397` is the reference shape), `category='other'`, `raisedById=null`,
  description prefilled from the authority's reasons, and the round stores `linkedNcrId`.
- **D-H5 (no dead-end surfaces):** backend HP list/detail responses gain
  `latestRound { outcome, decidedAt, decisionReason, ncrId, ncrNumber, ncrStatus,
  openConditionCount }` and the surfaces enumerated in PR E each render the refused/conditioned
  state explicitly. A refused HP must never be visually identical to a never-requested one.
- **D-M5 (batch asymmetry):** batch room stays release-only; its page copy notes that refusal or
  conditional release happens through each hold point's individual link.

## Concrete schema (PR A implements exactly this)

```prisma
model HoldPointDecisionRound {
  id                        String    @id @default(uuid())
  holdPointId               String    @map("hold_point_id")
  roundNumber               Int       @map("round_number")
  authorityClass            String    @default("principal") @map("authority_class") // 'principal' | 'contractor_internal'
  requestedAt               DateTime  @default(now()) @map("requested_at")
  requestedById             String?   @map("requested_by_id")
  responseToPriorRejection  String?   @map("response_to_prior_rejection")
  // recipient provenance denormalized (D-H1)
  recipientEmail            String?   @map("recipient_email")
  recipientName             String?   @map("recipient_name")
  // outcome — all null until decided; immutable once outcome set
  outcome                   String?   // 'released' | 'released_with_conditions' | 'rejected'
  decidedAt                 DateTime? @map("decided_at")
  decidedByName             String?   @map("decided_by_name")
  decidedByOrg              String?   @map("decided_by_org")
  decidedByTokenId          String?   @map("decided_by_token_id")
  decisionReason            String?   @map("decision_reason")
  decisionMethod            String?   @map("decision_method") // 'public_token' | 'authenticated'
  signatureUrl              String?   @map("signature_url")
  linkedNcrId               String?   @map("linked_ncr_id")
  // contractor-side recall (only while undecided)
  withdrawnAt               DateTime? @map("withdrawn_at")
  withdrawnById             String?   @map("withdrawn_by_id")
  withdrawalReason          String?   @map("withdrawal_reason")
  holdPoint                 HoldPoint @relation(fields: [holdPointId], references: [id], onDelete: Cascade)
  linkedNcr                 NCR?      @relation(fields: [linkedNcrId], references: [id], onDelete: SetNull)
  conditions                HoldPointReleaseCondition[]
  @@unique([holdPointId, roundNumber])
  @@index([holdPointId, outcome])
  @@map("hold_point_decision_rounds")
}

model HoldPointReleaseCondition {
  id                      String    @id @default(uuid())
  decisionRoundId         String    @map("decision_round_id")
  sequence                Int
  text                    String    // bounded by route validation (M3), not schema
  recordedSatisfiedAt     DateTime? @map("recorded_satisfied_at")
  recordedSatisfiedById   String?   @map("recorded_satisfied_by_id")
  recordedSatisfiedByName String?   @map("recorded_satisfied_by_name") // survives user deletion
  satisfactionNote        String?   @map("satisfaction_note")
  satisfactionEvidenceDocumentId String? @map("satisfaction_evidence_document_id")
  decisionRound           HoldPointDecisionRound @relation(fields: [decisionRoundId], references: [id], onDelete: Cascade)
  @@unique([decisionRoundId, sequence])
  @@index([decisionRoundId, recordedSatisfiedAt])
  @@map("hold_point_release_conditions")
}
```

Plus: `HoldPoint.currentRoundId String? @map("current_round_id")` (+ relation, `SetNull`);
`HoldPoint.authorityClass String @default("principal")`; `HoldPointReleaseToken.decisionRoundId
String? @map("decision_round_id")` (+ relation, `SetNull`); `Project.hpInternalReleaserIds
String[] @default([]) @map("hp_internal_releaser_ids")` (nominated internal releasers,
person-keyed per research). NCR gains the back-relation for `linkedNcr`. All additive; every
column nullable or defaulted (D-H2).

## Round predicates (PR B implements; single source module)

- `decisionEligible(hp, round)`: `hp.status === 'notified'` AND `round.outcome IS NULL` AND
  `round.withdrawnAt IS NULL` AND round is `hp.currentRoundId`.
- `reRequestable(hp)`: `hp.status === 'pending'` AND latest round outcome `'rejected'` AND its
  `linkedNcr.status` ∈ CLOSED_NCR_STATUSES (`lib/readiness/predicates.ts:337`) — gate lives in
  `updateExistingHoldPointForReleaseRequest` (`requestReleaseRoutes.ts:155`), shared by single +
  batch paths; read NCR status via prisma directly (no routes/ncrs import).
- Lifecycle-terminal: `'released' | 'completed'` (UNCHANGED — reject returns status to
  `'pending'`, so existing `notIn ['released','completed']` guards keep working; that is the
  point).
- Every decision/withdraw write is an exact guarded `updateMany` inside the existing serializable
  transaction: `WHERE id = round AND outcome IS NULL AND withdrawn_at IS NULL` (+ HP
  `status='notified'` guard on the HP row). Count 0 → the shipped already-decided refusal.
- Token GET (public payload route): refuse when token's round ≠ HP's current round, round
  decided/withdrawn, or `usedAt` set — in addition to the shipped expiry/hash checks.

## PR briefs

### PR A — schema only (`hp-a-schema`)
The prisma models above, `npm run db:migrate -- --name hp_decision_rounds`, `npm run
db:generate`. NO route/lib changes. DoD: migrate deploy green on local test DB; backend
type-check green (client regen may require adding the new relations to existing includes ONLY if
type errors force it — otherwise touch nothing). **Migration SQL applied to prod BEFORE merge by
the operator** (orchestrator does this; the PR body must print the SQL path).

### PR B — round core (`hp-b-rounds`)
Round creation on both request paths (single `requestReleaseRoutes.ts:837ff`, batch `:355ff` —
shared helper), roundNumber = prior max+1, recipient denormalization, token binding
(`decisionRoundId` on mint at `:411/:891`), null-round tolerance for legacy tokens (decision
paths lazy-bind: if token has no round, bind-or-create the HP's current open round at decision
time), withdraw verb (`POST /api/holdpoints/:id/withdraw-request`, roles QM/PM/site manager,
reason required; kills unused tokens via existing deleteMany pattern, closes round undecided, HP
→ pre-request state incl. chase reset `:81`), round predicates module, `latestRound` in detail +
list responses (`detailResponse.ts`, `listPresentation.ts`). Owns those files + new
`roundCore.ts` + tests (round-per-request, withdraw round-trip, guarded double-withdraw, legacy
token lazy-bind, latestRound projection).

### PR C — public decision verbs (`hp-c-decisions`)
Reject + conditional-release schemas/routes under the existing `/public` section of
`routes/holdpoints.ts` (inherits no-store `holdpoints.ts:86-89`, global rate limit, helmet).
Validation caps mirror `publicReleaseSchema` (`validation.ts:93-100`): name 160 / org 160 /
signature ≤900KB data-URL / token 512; reject reason min 25 max 5000; conditions array 1..20
items, each 1..500 chars, nonblank, server-splits lines. Identity binding copies the shipped
door exactly: recipient eligibility re-checked at decision time (`holdpoints.ts:226-235`), actor
`external_token` labelled with recipientName never email (`:254-258`), released-by name locked
to token recipient (`:223-224`). Reject: guarded round decide + NCR raised in-tx per D-H3/D-H4 +
HP status → `'pending'` + chase reset. Conditional: guarded decide + condition rows + HP →
`'released'` with today's release mechanics EXCEPT the ITP completion is written
`status='completed'` without the verified stamp (D-C1) + release-notification variant.
`DecisionKind` union gains `'rejection' | 'conditional_release' | 'withdrawal'`
(`lib/readiness/recordDecision.ts:47-54`) with snapshot rows recorded under the shipped
machinery; new `AuditAction`s; new notification types added to `NOTIFICATION_TRIAGE`
(`routes/notifications/triage.ts:29`) as needs_action (drift test will enforce). D-C2's 403 on
the in-app door for `principal` HPs lands here (`actionRoutes.ts`), named as a behavior change in
the PR body. Owns: `routes/holdpoints.ts`, `validation.ts`, new `publicDecisionExecution.ts`,
`actionRoutes.ts`, `recordDecision.ts` (union only), `triage.ts` (map entries only) + DB tests
(reject→NCR atomicity incl. crash-window assertion via tx rollback test, double-decide race,
token round revocation on GET, re-request gate closed/open NCR, eligibility re-check, caps).

### PR D — conformance + conditions (`hp-d-conditions`)
The D-C1 limb: open-conditions count for a lot's HPs' current rounds wired into
`lib/conformancePrerequisites.ts` beside `noOpenNcrs` + `lotConformable`
(`lib/readiness/predicates.ts:477`) + `routes/itp/helpers/lotProgression.ts:73-84`;
`hp_conditions_open` added to `READINESS_REASON_CODES` (`lib/readiness/contracts/
reasonCodes.ts:29ff`) with provenance + emitted from `evidenceReadiness`; record-satisfaction
route (`POST /api/holdpoints/:id/conditions/:conditionId/record-satisfaction`, roles
QM/PM/site manager, guarded `recordedSatisfiedAt IS NULL`, audit row in-tx, optional
evidenceDocumentId, actor name denormalized); last-satisfaction flips the linked ITP completion
to verified attributed "verified on recorded satisfaction of release conditions". Owns those
files + new conditions route module + DB tests (lot unconformable while open, conformable after
last satisfaction, duplicate-close refused, reason code contract).

### PR E — frontend (`hp-e-frontend`)
Public token page: outcome selector → progressive disclosure (conditions list input / reject
reason with live 25-char counter) → decision-specific confirmation; copy per Rev 3 R2 ("granting
permission to proceed", never "conform"; conditional labelled a CIVOS convention). Internal
surfaces (each an explicit item — D-H5): ITP checklist HP state
(`ITPChecklistHoldPointState.tsx` gains refused + conditions states), HP register buckets +
counters (`HoldPointsPage.tsx:236`, `holdPointsPageData.ts:182-185`) with "release refused —
NCR-#### open" and "released — N conditions open" chips (shared statusLabels/statusColors),
re-request affordance with required response field, lot readiness panel rendering
`hp_conditions_open`, subbie portal HP projection, foreman WorkScreen, both evidence PDFs
(`holdPointEvidencePdf.ts`, `claimEvidencePackagePdf.ts`: immutable round terms + "condition
status as at <generatedAt>" + refused rounds never erased), record-satisfaction UI on the HP
detail/lot surface. Owns frontend only + unit tests per surface.

### PR F — backfill + sweep (`hp-f-backfill`)
Idempotent operator script (`backend/src/scripts/`): synthetic round 1 for every HP without
rounds — released/completed HPs → decided round (outcome 'released', decidedAt = releasedAt ??
updatedAt fallback with a `synthetic:true` marker in a notes field), `notified` HPs → OPEN round
bound to their live unused tokens, `pending` HPs → no round. Unique `[holdPointId, roundNumber]`
makes re-runs no-ops; script prints a dry-run plan by default and mutates only with `--execute`.
Run AFTER PR E deploys (operator step). Plus the acceptance sweep checklist and a copy audit
("never 'conformed by the authority'" grep across frontend + PDFs).

## Acceptance tests (cross-PR, the build is done when all pass)
Rev 3's list with the review's additions: no authenticated decision path for `principal` HPs
(403 incl. superintendent role — the D-C2 change); withdraw round-trip; reject→NCR atomic (no
rejected round without NCR — tx rollback test); NCRLot row + lot flip on rejection; re-request
blocked until NCR closed; conditional release leaves lot unconformable via the prerequisites
limb (NOT via verificationStatus) until last satisfaction; used/superseded-round token GET
refused; refused HP renders distinctly on register/checklist/PDF; caps enforced on public
payloads; triage drift test green; backfill re-run is a no-op.
