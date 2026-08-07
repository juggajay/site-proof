# Hold-point rejection + conditional release — design Rev 2

**Status:** awaiting Jay approval. Rev 1 (2026-08-07) was adversarially reviewed (18 findings,
4 critical); Rev 2 folds the review. The reviewer verified claims against origin/master and
against published authority specs (TfNSW D&C Q6, TMR MRTS300, Main Roads WA Spec 201).
Approved as a Wave-4 item by Jay 2026-08-06; build starts only from this document after approval.

## What Rev 1 got wrong (and Rev 2 changes)

1. **Rev 1 modelled conditional release as ordinary `released` + warn-only condition rows.**
   REFUTED by code: both release executors mark the linked ITP completion `completed` AND
   `verified` in the release transaction, then run lot progression
   (`publicReleaseExecution.ts:155-180`, `actionRoutes.ts`). Under Rev 1, open conditions would
   coexist with a verified ITP item and a conforming lot — materially stronger than "permission
   to proceed", and not what authority specs mean by a conditional release.
2. **Rev 1's "4 nullable rejection columns + existing snapshots" history.** REFUTED: the
   `hold_point_release.v1` snapshot is a structured versioned shape (no rejection fields, no
   signature/name/org), snapshots can be disabled, and clearing latest-round columns on
   re-request would destroy the only complete rejection record.
3. **Rev 1's "old token dead" claim.** REFUTED at the public boundary: a USED token still
   answers GET until expiry, so a prior recipient could keep reading the HP and its evidence
   after a new round begins.
4. **Rev 1 conflated decision-terminal with lifecycle-terminal.** If `rejected` joins the
   request-release guard set, re-request becomes impossible. Also factual: the persisted
   requested state is `notified`, not `requested`.

## Design (Rev 2)

### R1. First-class decision rounds

New model `HoldPointDecisionRound`:
- `holdPointId`, `roundNumber` (unique per HP), `requestedAt`, `requestedById`,
  `responseToPriorRejection` (nullable text — required by the UI when a prior round was rejected)
- outcome fields (all null until decided): `outcome` (`released` | `released_with_conditions` |
  `rejected`), `decidedAt`, `decidedByName`, `decidedByOrg`, `decisionReason` (required for
  reject), `signatureUrl`, `decisionMethod` (public_token | authenticated | batch)
- Immutable once decided: no update path mutates a decided round; corrections are a new round.

`HoldPointReleaseToken` gains `decisionRoundId`. Public GET refuses tokens whose round is not
the HP's current round OR whose round is decided (revocation-by-round); `usedAt` additionally
refuses GET, closing the disclosure gap. Batch capability URLs bind to rounds the same way.

`HoldPoint` keeps `status` for lifecycle (`pending` → `notified` → `released`/`rejected`/
`completed`) with three DISTINCT predicates in code, named and exported:
- decision-eligible: `status = 'notified'` AND current round undecided
- re-requestable: `status = 'rejected'`
- lifecycle-terminal: `released`, `completed`

Rejection provenance lives on the round, never on clearable HP columns. The HP row carries only
`status='rejected'` + current round pointer.

### R2. Conditional release withholds verification (the Rev 1 reversal)

- Unconditional release: exactly today's behavior (ITP completion verified in-transaction).
- **Release with conditions: HP `status='released'` (work may proceed) but the ITP completion is
  NOT verified.** It is marked completed-with-conditions-pending (existing status vocabulary at
  build time; no verified stamp). Verification happens when the LAST condition is closed, in that
  transaction, attributed as "verified on recorded satisfaction of release conditions" — never
  backdated to the release.
- Consequence (deliberate): a lot cannot conform while conditions are open, because its ITP item
  is unverified. That is the conservative reading of the authority specs, and it is the
  defensible default for a QA record. If a contract treats conditional release as full release,
  the authority can simply release unconditionally.

### R3. Conditions and closure semantics

`HoldPointReleaseCondition`: `decisionRoundId` (provenance to the round, not just the HP),
`sequence` (unique per round), `text` (bounded, nonblank), `recordedSatisfiedAt`,
`recordedSatisfiedByName` (text, survives user deletion), `satisfactionNote`,
`satisfactionEvidenceDocumentId` (nullable FK).

- Closure verb is **"Record satisfaction"** — copy and data model both say the contractor
  RECORDED the condition as satisfied. CIVOS never asserts the authority accepted it. (Reviewer
  is right: contractor self-closure is not contractual closure; we record, we do not adjudicate.)
- Guarded update (`recordedSatisfiedAt IS NULL`), audit row in the same transaction, duplicate
  attempts refused. Evidence reference optional but nudged (the UI asks for a photo/document).
- Internal roles: PM / QM / site manager. Foreman can view, not record.

### R4. Authority and role boundaries

- Public token bearer = the nominated authority for that round, by construction. Identity rules
  copy the shipped release path exactly: server binds actor name to the token recipient where
  available; signature on a public bearer page is asserted provenance and is labelled as such in
  UI and PDF.
- Authenticated reject/conditional-release does NOT inherit the wide release-role helper (which
  admits foreman/site engineer). v1: authenticated decision verbs restricted to QM +
  superintendent-mapped roles; the existing wide set keeps unconditional release only (today's
  behavior, unchanged). A per-project authority configuration is future work, noted not built.
- Condition satisfaction recording: R3 roles; rejection re-request: existing request-release
  roles + a required `responseToPriorRejection`.

### R5. Race rules

Every decision write is an exact guarded update inside the existing serializable transaction:
`WHERE holdPointId = ? AND roundNumber = ? AND outcome IS NULL` (+ HP `status='notified'`).
Losers get the existing already-decided refusal. Re-request: `WHERE status='rejected' AND
currentRound = ?` then creates round N+1 and mints round-bound tokens. No broad notIn guards
anywhere in the new paths. Sibling tokens of a decided round are dead for GET and mutation by
the round rules in R1.

### R6. Surfaces

- **Public page:** outcome SELECTOR first (Release / Release with conditions / Reject), then
  progressive disclosure of that outcome's form (conditions list / reason), then a
  decision-specific confirmation summary ("You are rejecting HP-3; the contractor will be able
  to re-request"). Never three equal submit buttons (mis-decision risk on mobile).
- **Batch review room: v1 keeps RELEASE ONLY.** Mixed per-HP outcomes need a per-item decision
  grain the current one-signature batch model cannot truthfully carry; reject/conditional are
  single-HP actions in v1. Stated as a descope, revisit on demand.
- **Internal remediation surface (new, required):** the lot checklist HP row and HP register show
  `rejected` state + reason + "Re-request release" affordance (with the response field). A
  rejected HP is a to-do, not a dead end.
- **Readiness:** lot evidence readiness gains reason codes for `hp_conditions_open` (blocking by
  construction via the unverified ITP item — R2) and surfaces the condition list. The scope
  statement in Rev 1 ("no changes to release readiness computation") is corrected: HP release
  eligibility computation is untouched; lot readiness gains the new reason code rendering.
- **Evidence PDF:** prints the decided terms of each round immutably (from round rows) plus
  "condition status as at <generatedAt>" — the pack never implies closure it cannot prove, and a
  rejected round's reason is never lost to a later release.
- **Notifications:** rejection → requester + QM (needs-action); conditional release → requester +
  QM (needs-action). Types classified in the shipped triage module (#1778). Notifications are
  static records; the live tracker is the readiness item. (Build prerequisite: #1778 merged.)

### Cut lines (v1)

- No raise-NCR from the public page (standing Jay cut).
- No authority accounts, negotiation threads, or authority re-verification of recorded
  satisfaction. No per-project authority configuration (fixed conservative defaults, noted).
- Batch reject/conditional: cut (R6).
- No workflow-graph editors, ever.

### Migration

Additive: `HoldPointDecisionRound`, `HoldPointReleaseCondition`, `decisionRoundId` on token +
current-round pointer on HoldPoint. Backfill: existing released/completed HPs get a synthetic
round 1 from their release fields (script, idempotent). Applied to prod BEFORE merge.

### Acceptance tests (expanded per review)

Race/rounds: exact-guard double decision; reject/re-request concurrency; superseded-round token
GET refused; used-token GET refused; round immutability. Semantics: conditional release leaves
ITP unverified; last-satisfaction-recording verifies with honest attribution; lot cannot conform
with open conditions; rejected round reason survives later release rounds (PDF + API).
Boundaries: wide-role authenticated reject refused; public actor identity server-bound; payload
size limits; no-store headers on all new public responses. Closure: duplicate satisfaction
refused; actor text survives user deletion. Batch: reject/conditional absent from batch room.
Notifications: types classified needs-action (drift test).

### Open items for the build spec

1. Exact ITP-completion status token for "completed, verification withheld" — pick from the
   existing completion vocabulary at build grounding (do not invent a parallel status system).
2. Synthetic round-1 backfill details (which timestamp wins when releasedAt is null on a
   completed HP).
3. Whether `hp_conditions_open` needs its own readiness copy or rides the existing unverified-
   item reason text.
