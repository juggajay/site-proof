# Hold-point rejection + conditional release — design Rev 3

**Status:** awaiting Jay approval. Rev 1 was adversarially reviewed (18 findings). Rev 2 folded
that review. **Rev 3 folds the primary-source research**
(`docs/research/hp-release-authority-research-2026-08-07.md`, #1788 — eleven AU specs + two
standard-form contracts, extracted and graded) and it **overturns Rev 2's role model**. Build
starts only from this document after approval.

## What the research changed (Rev 2 → Rev 3)

1. **Rev 2's "authenticated reject for QM + superintendent-mapped roles" was a category error.**
   Release authority in every AU spec is the PRINCIPAL'S side — TfNSW Q6 "the Principal", TMR
   MRTS50 "the Administrator", MRWA 201 "the Superintendent", VicRoads §160, ATS 1120, MITS 00B,
   NATSPEC (grade A, unanimous). The superintendent is not our customer's employee, so **no CIVOS
   role can hold specification-hold-point release or reject authority.** The identity-keyed token
   flow we already ship (named recipient, signature, external-token audit actor) is exactly what
   ATS 1120 ("the Principal will authorise a person") and ISO 9001 cl 8.6 (traceability to the
   person authorising release) require. Decisions on specification hold points happen through the
   token flow, full stop.
2. **Reject is the same actor as release — a duty, not a separate power.** ATS 1120: the
   authorised person "must either release the Hold Point or provide reasons why it will not be
   released, including details of any non-conformance" (default 10 working days). Rev 2's
   narrower reject set inverted the spec. Reasons are mandatory.
3. **The contractor-side verb is WITHDRAW, not reject.** MRWA 201.06.03(6) makes the release
   request itself the contractor's Certificate of Compliance — a QM who realises the
   certification was premature recalls the request. Internal, role-gated, and a new verb in this
   design.
4. **"Conditional release" is not spec language** (0 of 11 specs; the sole conditional-approval
   hit is MITS 00B making approval conditional on a downstream witness point). It IS an
   established product control (CivilPro ships Approve / Conditionally Approve / Reject) with
   proper ISO analogues (concession 3.12.5, deviation permit 3.12.6) and a strong spec analogue
   (TMR Indicative Conformance, MRTS50 10.1.2: proceed before results, statement that results
   are outstanding, accepted rework risk). **CIVOS builds it as a labelled CIVOS convention,
   never quoting it as spec language.**
5. **Release never confers conformance — in any spec** (VicRoads 160.A2, ATS 1120 relief
   clauses; ISO 9000 3.12.7 release = "permission to proceed"). Rev 2's framing ("conditional
   release withholds verification") implied unconditional release grants conformance. Restated
   below (R2): no release establishes conformance; a conditional release additionally blocks the
   lot advancing until conditions close.
6. **Rejected is not a terminal state.** Seven sources agree a refusal creates/continues a
   nonconformance: the hold point stays unreleased, a nonconformance record opens
   (authority→contractor, i.e. an NNC in TMR terms), and its closure is a precondition of
   eventual release. Rev 2's `status='rejected'` lifecycle survives only as the ROUND outcome;
   the HP itself returns to an unreleased state carrying an open linked NCR.
7. **A second, internal release class exists and we don't model it.** TMR MRTS50 8.3.2 / MRWA
   201.06.03(2): the contractor may designate additional hold points and nominate its own person
   to authorise continuation. Internal release, no token. Decisions need a class discriminator.
8. Two Rev 2 citation errors corrected: VicRoads §168 is OHS (QA is §160 Part A); ISO 9001 does
   not define "hold point" — the linkage is cl 8.6/8.7. Never claim otherwise in product copy.

## Design (Rev 3)

### R1. Decision rounds (unchanged from Rev 2, plus class + linkage)

`HoldPointDecisionRound` as in Rev 2 (immutable once decided; full provenance; round-bound
tokens with GET revocation for used/superseded rounds; exact guarded updates; `notified` is the
persisted requested state; three distinct predicates — decision-eligible / re-requestable /
lifecycle-terminal). Additions:
- `authorityClass`: `principal` (token flow — specification hold points) | `contractor_internal`
  (contractor-designated points, released in-app by the project's nominated internal releaser).
  The HP carries which class it is (from the ITP item / creation flow; specification points
  default `principal`).
- `linkedNcrId` on a rejected round (see R3).
- `withdrawnAt/withdrawnById/withdrawalReason`: the contractor-side recall of a pending request
  (round closes undecided; tokens die; HP returns to pre-request state). Role-gated internal
  (QM/PM/site manager). This is the ONLY internal verb on a `principal` round.

### R2. Outcomes and what they mean (the corrected framing)

All three outcomes are decided by the round's authority (token bearer for `principal`; the
nominated internal releaser for `contractor_internal`):
- **Release** — permission to proceed. Exactly today's mechanics, now stated honestly: the ITP
  completion records the point as passed/verified as it does today, and the PDF/record language
  says "released — permission to proceed past the hold point", never "conformed by the
  authority". (No spec lets release confer conformance; conformance remains the contractor's own
  certification through the existing lot machinery.)
- **Release with conditions** (labelled a CIVOS convention in UI copy): permission to proceed
  PLUS 1..N recorded conditions. The ITP completion is marked completed-with-conditions-pending
  (NOT verified); verification lands when the last condition is recorded satisfied, attributed
  to that recording. Consequence: the lot cannot reach conformed/claimable while the authority's
  conditions are open — mirroring TMR Indicative Conformance's "results outstanding, rework risk
  accepted" posture. UI copy for the authority: "You are granting permission to proceed subject
  to the conditions below."
- **Reject (refuse release)** — mandatory reasons (ATS 1120 wording: reasons including details
  of any nonconformance). Effect per R3.

### R3. Rejection opens a nonconformance; the HP goes back to unreleased

On reject: round records outcome+reasons; HP `status` returns to `pending` (not a new terminal
'rejected' status — spec-accurate and kills the guard-set conflation entirely); **an NCR is
auto-raised** (description prefilled from the authority's reasons, linked to the round via
`linkedNcrId`, flagged authority-originated). Re-request is the existing request flow gated on
that NCR being closed (precondition per the seven-source model) plus a required
`responseToPriorRejection`. The HP row/register shows "release refused — NCR-#### open" so it
reads as a to-do, not a dead end.

Note: the rejection NCR is raised by the SERVER on the public decision, not by the anonymous
bearer choosing to "raise an NCR" — this does not reopen the standing cut (no NCR-raising UI for
unauthenticated actors); it is the recorded consequence of a refusal, per spec.

### R4. Conditions and closure (Rev 2's R3, copy sharpened)

`HoldPointReleaseCondition` exactly as Rev 2 (round-scoped, sequenced, bounded; guarded
`recordedSatisfiedAt IS NULL` update; audit row in-transaction; evidence reference nudged;
closure actor text survives user deletion). Verb and copy: **"Record satisfaction"** —
contractor RECORDS, CIVOS never asserts the authority accepted. Internal roles PM/QM/site
manager.

### R5. Authority model (replaces Rev 2's R4)

- `principal` rounds: decisions only via round-bound tokens (identity-keyed: named recipient,
  server-bound actor name, signature = asserted provenance, labelled as such). The existing
  per-project `requiresSuperintendentApproval` recipient-eligibility mechanism stays the gate on
  WHO can be sent a token. **No in-app release/reject buttons for principal rounds** — the
  authenticated release path that exists today remains only for `contractor_internal` points and
  for projects that deliberately run without external authority involvement (existing behavior,
  now named: the project setting already distinguishes these).
- `contractor_internal` rounds: released/rejected in-app by the project's nominated internal
  releaser(s) — a per-project designation (user picker), defaulting to QM. Per TMR/MRWA the
  nomination is a person, so it is stored as user ids, not a role.
- Withdraw: QM/PM/site manager, any pending `principal` round.

### R6. Surfaces (Rev 2 minus the authenticated-reject surface)

- Public token page: outcome selector → progressive disclosure → decision-specific confirmation
  (Rev 2's R6 shape). Reject requires reasons (25-char minimum, matching the market control).
- Batch room: release-only in v1 (unchanged descope).
- Internal remediation surface: rejected-round state + linked NCR + re-request affordance.
- Readiness: `hp_conditions_open` reason code; lot blocked from conformed while open (via the
  unverified ITP item, R2).
- Evidence PDF: immutable round terms + "condition status as at <generatedAt>"; refused rounds
  and their reasons never erased by later releases. Notice-period and TfNSW three-field block
  alignment noted for the build (research §bonus).
- Notifications: rejection + conditional release → requester + QM, needs-action (#1778 triage).

### Cut lines (v1)

Unchanged from Rev 2 (no authority accounts, no negotiation threads, no batch mixed verbs, no
raise-NCR UI on the public page) plus: no per-project configurable conformance semantics — the
R2 posture is fixed; a client who means full release releases unconditionally.

### Migration

As Rev 2 (round + condition tables, round-bound tokens, current-round pointer, synthetic round-1
backfill) plus `authorityClass`, `linkedNcrId`, withdraw fields, and the per-project internal
releaser designation. Additive; applied to prod BEFORE merge.

### Acceptance tests

Rev 2's list, updated: no authenticated principal-round decision path exists (403 for every
internal role); withdraw kills tokens and closes the round undecided; reject auto-raises the
linked NCR and re-request is blocked until it closes; conditional release leaves the ITP item
unverified and the lot unconformable until last-satisfaction; release copy never says
"conformed"; contractor_internal rounds decided only by nominated users. Plus Rev 2's
round/race/token/PDF/notification cases unchanged.

### Open items for the build spec

1. Exact ITP-completion status token for "completed, verification withheld" (unchanged).
2. Synthetic round-1 backfill timestamps (unchanged).
3. Where the `contractor_internal` designation lives in project settings UI.
4. The rejection-NCR's category default: server sets `other`, contractor refines on first edit —
   never fabricate a classification the authority didn't make.
