# Evidence Readiness Design

Date: 2026-05-21
Status: Draft for Jay review
Owner: SiteProof product/engineering

## Context

The target-user research says SiteProof should become the evidence control
system for Australian Tier 2/3 civil contractors. The core buyer question is
simple:

> For this lot, inspection, hold point, test certificate, NCR, docket, diary,
> claim, or handover record, what happened, who approved it, what proof exists,
> and what is still blocking payment or conformance?

The competitor research points in the same direction. SiteProof should not try
to beat broad platforms by becoming a generic construction management suite.
The wedge is the civil-native object graph from field evidence to signed
progress claim.

The current app already has most of the raw workflow pieces:

- Lots
- ITP assignment and checklist completion
- Hold point request/release
- Test results and certificates
- NCR lifecycle
- Daily diaries
- Subcontractor dockets
- Documents/photos
- Progress claims
- Audit logs
- Conformance reports and evidence package exports

The main product risk is not missing modules. The risk is that users have to
know too much about the app to understand whether a lot or claim is ready. That
makes the product feel more complex than the underlying workflow needs to feel.

## Product Goal

Make SiteProof feel like one connected workflow:

```text
Create lots -> collect proof -> resolve blockers -> conform -> claim -> handover
```

Evidence Readiness v1 should make two questions answerable within five seconds:

1. On a lot: "Can this lot be conformed or claimed? If not, what exactly blocks it?"
2. In a claim: "Does this claim line have enough proof to survive client review?"

## Guiding Decision

Evidence Readiness v1 is additive and no-migration.

It should explain and rearrange existing rules before creating new rules. It
must not silently change conformance, claim creation, role access, audit
meaning, or commercial policy.

## Non-Goals For V1

- No new database tables.
- No Prisma migration.
- No new standalone Evidence module.
- No broad dashboard rewrite.
- No pricing, packaging, or marketing work.
- No accounting, Aconex, Procore, SharePoint, or ERP integration.
- No hard requirement that every lot must have photos, dockets, or diary entries
  before claiming unless that is already enforced by existing backend rules.
- No AI scoring or generated judgement language.
- No new customer-visible "score" unless it is easy to explain and defend.

## User Outcomes

### Owner

The owner should see which work is commercially blocked and why. The owner
does not need every field detail first. They need to know whether payment risk
exists and who needs to act.

### Project Manager / Site Engineer

The PM or site engineer should open a lot and immediately see the next action:
assign ITP, complete ITP, verify test, release hold point, close NCR, add
budget, or include in claim.

### Quality Manager

The quality manager should see conformance blockers in defensible language.
The panel should support audit readiness, not just task management.

### Contract Administrator

The CA should see whether a claim line is supported. Unsupported quantities,
missing budgets, missing QA proof, open NCRs, and weak supporting records should
be visible before the claim is sent to the client.

### Foreman

The foreman should see practical field actions, not commercial analysis. The
same readiness data can power simple language such as "2 ITP items left" or
"hold point waiting for release."

### Subcontractor

The subcontractor should only see assigned-work readiness relevant to their
portal permissions. They must not see internal budget, claim value, or unrelated
project evidence.

## Existing Implementation To Build On

### Lot Conformance

Backend:

- `backend/src/lib/conformancePrerequisites.ts`
- `backend/src/routes/lots.ts`
- Existing endpoint: `GET /api/lots/:id/conform-status`

Current conformance prerequisites:

- ITP assigned
- ITP completed
- Passing verified test result
- No open NCRs

Frontend:

- `frontend/src/pages/lots/components/QualityManagementSection.tsx`
- `frontend/src/pages/lots/LotDetailPage.tsx`
- Existing panel displays prerequisite checks and blocks the Conform Lot button.

### Claim Creation

Backend:

- `backend/src/routes/claims.ts`
- Existing endpoint: `GET /api/projects/:projectId/lots?status=conformed&unclaimed=true`
- Existing claim creation validates selected lots are conformed, unclaimed, and
  have a positive `budgetAmount`.

Frontend:

- `frontend/src/pages/claims/components/CreateClaimModal.tsx`
- Existing modal lists conformed, unclaimed lots and shows budget amount.

### Claim Completeness / Evidence Package

Backend:

- `backend/src/routes/claims.ts`
- Existing endpoint: `GET /api/projects/:projectId/claims/:claimId/completeness-check`

Frontend:

- `frontend/src/pages/claims/components/CompletenessCheckModal.tsx`
- Existing modal analyzes claimed lots after a claim exists.

Current completeness signals:

- ITP completion
- Hold points
- Test results
- NCRs
- Photo evidence

## Conceptual Model

Evidence Readiness has three user-facing categories.

### 1. Blockers

A blocker prevents an existing workflow step from being completed now, or makes
the evidence package not client-ready even though the app still allows the
workflow to proceed.

Examples:

- No ITP assigned blocks normal conformance.
- ITP incomplete blocks normal conformance.
- No passing verified test blocks normal conformance.
- Open NCR blocks normal conformance.
- Lot is not conformed blocks claim creation.
- Lot has no positive budget amount blocks claim creation.
- Lot is already claimed blocks claim creation.
- User lacks permission blocks the action.
- Unreleased hold points block the claim evidence review, but do not block claim
  creation in v1 unless the backend claim rules are changed in a separate PR.

Every blocker must declare whether it blocks the action itself. UI code may only
disable selection/submission when `blocksAction` is true. This prevents evidence
warnings from becoming accidental business-rule changes.

### 2. Warnings

A warning weakens the evidence pack, but does not stop the workflow in v1.

Examples:

- No photos linked to the lot.
- No approved docket linked to the lot.
- No diary entry linked to the lot.
- Pending test results exist.
- Minor NCRs have been raised historically but closed.
- Evidence exists but is not linked to the lot.

### 3. Supporting Evidence

Supporting evidence tells the user what proof already exists.

Examples:

- ITP assigned and completion count.
- Hold points released.
- Passing verified tests.
- Closed NCRs.
- Approved dockets.
- Diary entries.
- Uploaded documents/photos.
- Audit events for conformance, release, docket approval, claim creation, claim
  certification, and payment.

## Data Contract

Create a shared readiness response shape for frontend use. The exact file names
can be refined during implementation, but the contract should be stable.

```ts
type EvidenceReadinessSeverity = 'blocker' | 'warning' | 'support';

type EvidenceReadinessArea =
  | 'conformance'
  | 'claim'
  | 'itp'
  | 'hold_point'
  | 'test'
  | 'ncr'
  | 'docket'
  | 'diary'
  | 'document'
  | 'budget'
  | 'permission';

interface EvidenceReadinessItem {
  code: string;
  severity: EvidenceReadinessSeverity;
  area: EvidenceReadinessArea;
  title: string;
  detail: string;
  blocksAction: boolean;
  actionLabel?: string;
  actionHref?: string;
  count?: number;
  relatedIds?: string[];
}

interface LotEvidenceReadiness {
  lotId: string;
  lotNumber: string;
  status: string;
  conformance: {
    state: 'ready' | 'blocked' | 'already_conformed' | 'already_claimed';
    blockers: EvidenceReadinessItem[];
    warnings: EvidenceReadinessItem[];
    support: EvidenceReadinessItem[];
  };
  claim: {
    state: 'ready' | 'blocked' | 'warning' | 'already_claimed' | 'not_conformed';
    blockers: EvidenceReadinessItem[];
    warnings: EvidenceReadinessItem[];
    support: EvidenceReadinessItem[];
  };
  summary: {
    blockerCount: number;
    warningCount: number;
    supportCount: number;
    nextActionLabel: string;
    nextActionHref?: string;
  };
}
```

Notes:

- Avoid a single percentage score for v1. Percent scores feel precise but can be
  hard to defend. A civil PM needs named blockers more than a number.
- If a score is later needed for dashboard sorting, keep it internal until it
  has been validated with real users.
- `actionHref` should deep-link to existing tabs where possible: ITP, Tests,
  NCRs, Documents, History, Claims.

## Feature Slice 1: Lot Readiness Panel

### Purpose

Give every lot detail page a compact, plain-language summary of conformance and
claim readiness.

### Placement

On `LotDetailPage`, place the readiness panel near the top of the page, below
the lot header and status summary, before the deeper tab content.

The existing Quality Management section should not disappear. It should either:

1. Consume the new readiness contract, or
2. Sit below the readiness panel as the action surface for users with conform
   permissions.

For admin/owner viewers, the readiness panel may mention that an admin override
exists when normal conformance is blocked, but the actual "Force Conform Lot"
button should remain in the existing quality-management action area. Override
must read as an exception path, not the default next action.

### Content

The panel should show:

- Current lot state.
- "Conformance" readiness status.
- "Claim" readiness status.
- Top blockers, limited to the most important three by default.
- Warnings collapsed or visually secondary.
- Supporting evidence counts.
- Next action button.

Example copy:

```text
Evidence readiness

Conformance: Blocked
- ITP incomplete: 18 of 33 items complete
- No passing verified test result
- 1 open NCR must be closed

Claim: Not ready
- Lot must be conformed before it can be claimed
- Budget amount is set: $48,000

Supporting proof
- 2 hold points released
- 1 verified test
- 3 documents/photos linked
```

### Downstream Impact

User impact:

- PMs and QMs get a single place to see next actions.
- Field users see fewer scattered prerequisites.
- Owners understand why a lot is not claim-ready without reading all tabs.

Workflow impact:

- No change to conformance rules.
- No change to force-conform behavior.
- No change to claim creation rules.
- Existing conformance and claim endpoints remain authoritative.

Permission impact:

- Commercial values such as `budgetAmount` must only show to users who can
  already view budget/commercial fields.
- Subcontractor users must not see claim value or internal budget blockers.
  They may see non-commercial blockers such as ITP, hold point, test, NCR, and
  assigned-work evidence if they already have project/lot access.

Data impact:

- Reads existing lot, ITP, completion, test result, NCR, hold point, document,
  docket, diary, claim, and audit data.
- No schema change.

API impact:

- Prefer a new additive endpoint such as `GET /api/lots/:id/evidence-readiness`.
- Keep `GET /api/lots/:id/conform-status` working for compatibility.
- Implementation may internally reuse `checkConformancePrerequisites`.

UI impact:

- The lot page becomes more action-oriented.
- Existing tabs remain.
- The old prerequisite checklist should not duplicate the new panel in a way
  that makes the page feel heavier.

Performance impact:

- The lot detail page already fetches related counts and tabs lazily.
- The readiness endpoint should return a compact summary, not full records.
- Avoid loading every document or diary body. Counts and key statuses are
  enough for v1.

Audit/report impact:

- Viewing readiness does not write audit logs.
- Readiness state should not be written to the audit log as a separate event.
- Future evidence pack exports can reuse the same support/blocker language.

Test impact:

- Backend tests should prove the readiness panel mirrors existing conformance
  logic.
- Frontend tests should prove the panel shows blockers and action links without
  breaking conform/force-conform flows.

## Feature Slice 2: Claim Readiness Before Claim Creation

### Purpose

Make the Create Claim flow show claimable lots and near-miss lots clearly.

Today, the modal lists conformed, unclaimed lots. If a lot is missing a budget,
claim creation rejects it. That is correct but late. Users should see the reason
before they submit.

### Placement

In `CreateClaimModal`, replace the basic selectable lot list with a readiness
aware list:

- Ready to claim
- Needs attention
- Not claimable

V1 can start by showing only conformed, unclaimed lots plus budget blockers.
If query complexity allows, add a secondary collapsed section for "not claimable
yet" lots so the CA sees what is blocking next month's claim.

"Not claimable" is reserved for action blockers that match existing backend
claim-creation rules: not conformed, already claimed, missing/non-positive
budget, or insufficient permission. Evidence blockers such as unreleased hold
points should appear under "Needs attention" unless a later backend policy
change makes them hard claim-creation blockers.

### Content

For each lot:

- Lot number and activity
- Budget amount if permitted
- Claim percentage input for ready lots
- Readiness badge
- Blocker/warning summary
- Supporting proof counts

Example:

```text
DOCK-LOT-001    Ready to claim
Budget: $48,000
Support: conformed, 1 approved docket, 1 verified test, 2 released hold points

DOCK-LOT-002    Needs budget
Blocked: budget amount missing
Action: Edit budget

ROAD-LOT-003    Not claimable
Blocked: lot not conformed, 1 open NCR
Action: Open lot

DRAIN-LOT-004   Needs attention
Evidence blocker: 1 hold point not released
Action: Open hold points
```

### Downstream Impact

User impact:

- Contract admins see claim risk before submission.
- PMs can fix missing budget or evidence before month-end.
- Owners can understand why claimable value is lower than expected.

Workflow impact:

- Existing claim creation remains authoritative.
- Missing budget remains a hard blocker because backend claim creation already
  enforces it.
- Unreleased hold points are evidence blockers in v1. They should be shown
  before claim creation because the existing post-claim evidence review treats
  them as critical, but they should not disable claim creation unless the
  backend claim policy is explicitly changed.
- No photo, docket, or diary evidence remains a warning unless a future policy
  decision makes it a hard requirement.

Permission impact:

- Only commercial roles should see claim amount, budget, and payment-oriented
  readiness.
- Non-commercial users may see quality readiness but not claim values.

Data impact:

- Reads existing lots and supporting evidence.
- No new claim records are created by readiness checks.

API impact:

- Option A: extend `GET /api/projects/:projectId/lots` with
  `includeReadiness=true`.
- Option B: add `GET /api/projects/:projectId/claim-readiness`.
- Recommended: add a claim-specific endpoint to avoid overloading the generic
  lots route.

UI impact:

- Create Claim becomes slightly more information dense.
- Keep the modal scannable: first show ready lots, then blocked lots.
- Do not turn the modal into a report builder.

Performance impact:

- Claim readiness can span many lots. It needs pagination or compact selects if
  projects can contain hundreds of lots.
- For v1, query only active project lots with statuses relevant to claiming.
- Return counts and issue summaries, not full evidence payloads.

Audit/report impact:

- Running readiness does not write audit logs.
- Claim creation, submission, certification, and payment audit logs remain the
  durable events.

Test impact:

- Backend tests must prove missing budget appears before create but still fails
  at create if ignored or raced.
- Frontend tests must prove unready lots cannot be selected for claim creation.

## Feature Slice 3: Claim Evidence Review After Claim Creation

### Purpose

Make the existing claim completeness check feel like a standard claim readiness
review, not an optional "AI" modal.

The current implementation already has useful deterministic logic. The label
"AI Completeness Analysis" overstates what the app is doing and may reduce trust
with civil users.

### Proposed Change

Rename the user-facing concept to "Claim Evidence Review" or "Claim Readiness
Review."

Keep the existing deterministic checks:

- ITP completion
- Hold points
- Test results
- NCRs
- Photo evidence

Rephrase copy away from AI:

- "Reviewing claim evidence..."
- "Checking ITPs, hold points, test results, NCRs, and supporting documents."
- "Recommended action" instead of "AI Suggestions."

### Contract Translation

PR4 should normalize the existing claim completeness UI toward the Evidence
Readiness language, but it does not need to break the existing endpoint path in
one step.

Recommended v1 approach:

- Keep `GET /api/projects/:projectId/claims/:claimId/completeness-check` as the
  endpoint path for compatibility.
- Extract the analysis logic into a shared helper that can emit readiness-style
  blockers, warnings, and support.
- Map existing `critical` issues to readiness `blocker`, existing `warning`
  issues to readiness `warning`, and existing `info` issues to readiness
  `support` or low-priority `warning` depending on the message.
- Remove the prominent customer-facing percentage score from the modal. Keep
  any numeric completeness score internal or secondary until it has been tested
  with real users.
- Keep `recommendation` only as an internal implementation detail if needed;
  user-facing language should say "Ready", "Needs review", or "Blocked".

This avoids two competing user-facing contracts: the lot panel and claim review
should use the same blocker/warning/support language even if the route path and
legacy TypeScript names are cleaned up over multiple PRs.

### Downstream Impact

User impact:

- Users can trust the report as rule-based and auditable.
- Avoids the impression that a model is making commercial recommendations.

Workflow impact:

- No change to claim lifecycle.
- No change to claim values or certification/payment transitions.

Permission impact:

- Same as existing claim/commercial access.

Data impact:

- No schema change.
- Existing endpoint can stay in place, but response names may eventually be
  cleaned up.

API impact:

- Keep current endpoint path for compatibility in v1.
- Add a frontend translation layer if backend response names still say
  completeness.

UI impact:

- More professional, less novelty language.
- Better aligned with "client-ready evidence pack" positioning.

Performance impact:

- No material change.

Audit/report impact:

- No audit event for running the review.
- Future exported evidence packs should use the same issue wording.

Test impact:

- Frontend regression should assert the modal no longer uses "AI" language.
- Existing backend completeness tests should continue passing.

## Feature Slice 4: Project-Level Readiness Summary

### Purpose

Give project users a simple view of what blocks payment and conformance without
creating a new dashboard.

### V1 Scope

Keep this minimal:

- Add small summary cards or a compact panel on project detail/dashboard if the
  current page already loads relevant counts.
- Show:
  - Lots blocked from conformance
  - Lots claim-ready
  - Lots missing budget
  - Open NCRs
  - Unreleased hold points

### Downstream Impact

User impact:

- Owners and PMs get a short list of next project-level blockers.
- Avoids the "generic SaaS dashboard" problem.

Workflow impact:

- No change to underlying workflows.
- Project summary is navigational, not authoritative.

Permission impact:

- Commercial claim-ready value/counts only for commercial roles.
- Non-commercial users get quality blockers only.

Data impact:

- Aggregate counts only.
- No schema change.

API impact:

- This can wait until after lot and claim readiness are stable.
- Avoid adding a heavy project summary endpoint first.

UI impact:

- This should not become a new mega-dashboard.
- Show top 3 blockers and links into lots/claims.

Performance impact:

- Aggregates must be bounded. Avoid fetching every lot's full evidence payload
  on dashboard load.

Audit/report impact:

- No audit log event for viewing summary.

Test impact:

- Project summary tests should focus on role-gated counts and navigation links.

## Readiness Rules

### Hold Point Alignment

V1 should treat unreleased hold points as claim evidence blockers, not
conformance blockers and not claim-creation blockers, unless an existing backend
action already enforces the hold point.

Reasoning:

- Current normal conformance logic in `checkConformancePrerequisites` does not
  include lot-level hold points.
- Current post-claim completeness logic treats unreleased ITP hold points and
  unreleased lot-level hold points as critical claim evidence issues.
- Showing unreleased hold points as claim evidence blockers keeps the pre-claim
  readiness panel aligned with the post-claim evidence review without silently
  changing conformance or claim-creation business rules.

Consequence:

- A lot can still be conformed under the existing backend rules.
- The claim-readiness surface should flag the issue before the lot is added to a
  claim if unreleased hold points remain, but should not disable selection in v1.
- Any future decision to make unreleased hold points block conformance is a
  separate business-rule change and should not be smuggled into this workstream.

### Lot Conformance Rules

Hard blockers:

- No ITP assigned.
- ITP checklist incomplete.
- No passing verified test result.
- Open NCR.

Warnings:

- No photos.
- No documents.
- No approved dockets.
- No diary entries.
- Pending tests.

Support:

- ITP assigned.
- Completed ITP item count.
- Passing verified tests.
- Released hold points.
- Closed NCRs.
- Linked photos/documents.

### Lot Claim Rules

Action blockers:

- Lot not conformed.
- Lot already claimed.
- Missing or non-positive budget amount.
- User lacks commercial permission.

Evidence blockers:

- Unreleased ITP or lot-level hold point.

Warnings:

- No approved docket linked.
- No diary evidence.
- No photos or document support.
- Tests exist but some are pending.
- Minor NCR history exists.

Support:

- Lot conformed by and date.
- Budget amount.
- Approved dockets.
- Verified tests.
- Released hold points.
- Closed NCRs.
- Documents/photos.

### Claim Line Rules

Action blockers:

- Lot is no longer conformed.
- Lot is now claimed elsewhere.
- Missing budget.
- Invalid percentage complete.

Evidence blockers:

- Unreleased hold point.

Warnings:

- Evidence support is thin.
- Pending tests.
- No approved dockets or diary support.

Support:

- Claim amount.
- Percent complete.
- Evidence counts.
- Key proof links.

## Role And Permission Rules

Evidence Readiness must respect existing access boundaries.

### Commercial Data

Budget amount, claim amount, certified amount, paid amount, and commercial
readiness should only show to users who already have commercial access.

Implementation should reuse existing backend gates where they fit:

- `requireCommercialProjectAccess` for endpoints returning budget, claim, paid,
  certified, or payment-readiness data.
- `isSubcontractorPortalRole` and `requireSubcontractorPortalModuleAccess` for
  subcontractor portal callers.

Backend authorization remains the source of truth. Any frontend role switcher or
development-only role override must not affect server-side permission checks for
readiness data.

### Subcontractor Portal

Subcontractors should see only their assigned work and evidence obligations.

Allowed examples:

- ITP items assigned to the subcontractor.
- Dockets they need to submit.
- Hold point status relevant to their work.
- Whether a lot is blocked by their missing submission.

Disallowed examples:

- Internal budget amount.
- Claim value.
- Other subcontractors' evidence.
- Unrelated project lots.

The server response must physically omit commercial fields for subcontractor
callers. Returning the fields as hidden UI-only values, or returning them as
`null` with enough surrounding context to infer commercial state, is not
sufficient.

### Admin Override

Admin force-conform remains a separate action. Evidence Readiness can show that
admin override exists, but it must not make override feel like the normal path.

## Error Handling

Readiness endpoints should fail closed:

- 401 if unauthenticated.
- 403 if the user lacks project/lot access.
- 404 if the lot/claim does not exist in the accessible scope.
- 422 only for invalid query parameters or unsupported readiness scope.

Frontend failure should not block the rest of the page:

- Show "Readiness unavailable" with a retry action.
- Do not hide existing lot tabs or claim actions if the readiness panel fails.
- Log through existing frontend logger without exposing secrets.

## Performance And Query Strategy

V1 should avoid heavyweight graph loading.

Recommended backend strategy:

- Start with lot-level readiness first.
- Use explicit Prisma `select`/`include` fields.
- Return counts and short issue lists, not full evidence records.
- Avoid document body/content.
- Avoid loading every diary or docket detail unless only counts are needed.
- Add project-level aggregation only after lot/claim endpoint shape is proven.

Potential risk areas:

- Claims modal on large projects.
- Project dashboard summaries.
- Evidence package exports if readiness is later included there.

Mitigation:

- Keep v1 endpoint payloads compact.
- Consider separate endpoints for lot readiness and claim readiness.
- Add backend tests around query behavior where practical.
- Frontend readiness fetching should use TanStack Query with stable query keys.
  For lot detail, align refresh cadence with the existing hold-point polling
  need instead of adding an independent polling loop. A 20-second refetch
  interval is acceptable where the page already expects hold-point status to
  change while open.

If a later project-level readiness summary needs denormalized counters for
large projects, that is a separate schema/performance decision. Do not introduce
that table in v1.

## UI Principles

- The panel should reduce cognitive load, not add another dashboard.
- Use civil workflow language, not generic SaaS language.
- Prefer "Blocked by..." and "Supported by..." over abstract scores.
- Show the next action.
- Keep warnings visually secondary.
- On mobile, show status plus top three blockers first, then expand.
- Do not use "AI" labels for deterministic checks.
- Do not show commercial values to roles that should not see them.

## Recommended Implementation Sequence

### PR 1: Shared Lot Readiness Contract

Build a backend helper and endpoint for lot readiness.

Scope:

- Reuse `checkConformancePrerequisites`.
- Add claim readiness blockers: not conformed, already claimed, missing budget.
- Add unreleased hold points as claim evidence blockers without changing
  conformance or claim-creation rules.
- Add warnings for existing support signals if cheap to query.
- Use `claimedInId IS NULL` as the source of truth for "unclaimed" to match the
  existing `unclaimed=true` filter.
- Server-filter commercial fields for subcontractor callers.
- Add backend tests.

No frontend changes beyond types if needed.

### PR 2: Lot Readiness Panel

Add the panel to lot detail.

Scope:

- Fetch lot readiness.
- Display conformance and claim blockers.
- Link actions to existing tabs.
- Ship desktop and mobile variants in the same PR. On mobile, show the readiness
  state and top three blockers first, with details expandable.
- Keep existing conform/force-conform actions working.
- Add frontend test coverage.

### PR 3: Claim Readiness Before Claim Creation

Improve Create Claim modal.

Scope:

- Add claim readiness endpoint or extend existing claim lots fetch.
- Extract the current claim completeness scoring logic from
  `backend/src/routes/claims.ts` into a shared helper consumed by both the
  existing post-claim review endpoint and the new pre-create claim readiness
  endpoint. The helper should emit the readiness shape directly so the existing
  completeness-check endpoint returns the new shape after PR3; PR4 should then
  be UI wording and presentation cleanup only.
- Show ready, needs attention, not claimable sections.
- Keep claim creation backend validation unchanged.
- Add regression tests for missing budget and unclaimable lots.
- Add a regression proving an unreleased hold point is shown as an evidence
  blocker but does not disable claim selection unless a later backend rule
  explicitly changes that policy.

### PR 4: Rename Claim Completeness UI

Reframe current "AI Completeness Analysis" as deterministic claim evidence
review.

Scope:

- Copy changes only unless backend naming needs a compatibility wrapper.
- Add frontend regression that "AI" label is absent.

### PR 5: Project-Level Summary, If Still Needed

Only after users see lot and claim readiness working.

Scope:

- Compact project-level counts.
- Role-gated commercial summary.
- No mega-dashboard.

## Testing Strategy

### Backend

Add tests for:

- Lot with no ITP.
- Lot with incomplete ITP.
- Lot with no verified passing test.
- Lot with open NCR.
- Lot conformed but missing budget.
- Lot conformed and claim-ready.
- Lot already claimed.
- Subcontractor access cannot see commercial readiness.
- Forbidden users cannot inspect readiness for inaccessible lots/projects.

### Frontend

Add tests for:

- Lot readiness panel shows top blockers.
- Lot readiness panel action links switch/open correct tab.
- Conform button behavior is unchanged.
- Force-conform UI remains available only to permitted roles.
- Create Claim modal shows missing budget before submit.
- Not-claimable lots cannot be selected.
- Mobile panel does not overflow.

### Dogfood

Run one sacrificial-data pass:

1. Create a project.
2. Create a lot with no ITP and confirm readiness says no ITP.
3. Assign ITP and complete part of it.
4. Upload/verify test result.
5. Raise and close NCR.
6. Release hold point.
7. Force or normally conform a lot.
8. Confirm missing budget blocks claim readiness.
9. Add budget.
10. Create claim and run evidence review.

## Known Gaps Not Addressed In V1

Evidence Readiness v1 should not be described as a complete audit or reporting
rewrite. It is an organising layer over existing workflows.

Known gaps to keep outside this workstream:

- Claim certification and payment metadata currently reuse the `disputeNotes`
  field in parts of the claim workflow. That storage debt should be cleaned up
  in a separate claim-data-model pass, not hidden inside readiness work.
- Readiness views do not create audit events. Existing workflow transitions
  such as claim creation, claim status change, claim certification, claim
  payment, lot conformance, and hold-point release remain the durable audit
  events.
- Public hold-point release currently passes `req` into `createAuditLog`, so the
  shared audit helper can capture request IP and user-agent. Evidence Readiness
  does not change public-release audit semantics.
- Reports and exported evidence packs should not include readiness language
  until the UI wording has been dogfooded and the blocker/warning taxonomy is
  stable.

## Downstream Product Implications

### Evidence Pack Export

Evidence Readiness should become the language for future evidence packs:

- Blockers explain exclusions.
- Warnings explain residual risk.
- Support lists proof included in the pack.

V1 should not build Evidence Pack export, but it should avoid wording or data
structures that make export harder later.

### Subcontractor Today View

The same readiness contract can later power a subbie-specific view:

- Dockets due.
- Assigned lots.
- ITP items requiring subbie input.
- Hold points waiting.
- Evidence missing from the subbie.

Do not add this in v1, but keep role-gated fields clean enough to reuse.

### Project Setup Wizard

Readiness will expose missing setup. That may make the setup gaps more visible:

- No areas
- No ITP templates
- No budget
- No subbies
- No reporting cadence

Do not solve setup in this workstream. Treat repeated readiness blockers as
input to a later setup wizard.

### Claims And Commercial Policy

Be careful not to accidentally turn soft support into hard commercial rules.

Example:

- No approved docket is a strong warning.
- It should not block claiming unless Jay explicitly decides that SiteProof
  should enforce docket-backed claims.

### Customer Trust

The readiness layer becomes a trust surface. It must be boring, deterministic,
and explainable.

Avoid:

- Unexplained percentages.
- Black-box "AI" wording.
- Scary blockers that are only suggestions.
- Hiding the underlying evidence.

## Open Decisions

These are intentionally left as product decisions before implementation:

1. Should unreleased lot-level hold points become a hard conformance blocker if
   they are not already enforced by `checkConformancePrerequisites`?
2. Should no approved docket remain a warning, or should it become a hard claim
   blocker for certain activity types?
3. Should diary evidence be counted as claim support in v1, or deferred until
   diary-to-lot linking is stronger?
4. Should project-level readiness ship in the first implementation batch, or
   wait until lot and claim readiness are proven?
5. Should Evidence Readiness appear in reports immediately, or only after the
   UI behavior is stable?

Recommended answers for v1:

1. Do not change hold point conformance rules in this workstream. Show
   unreleased hold points as claim evidence blockers, not action blockers.
2. Keep approved dockets as warnings/support, not hard blockers.
3. Count diary evidence only when it is already linked reliably.
4. Defer project-level readiness until after lot and claim readiness.
5. Do not add readiness to reports until the UI wording is validated.

## Success Criteria

Evidence Readiness v1 is successful if:

- A PM can open a lot and identify the top blocker within five seconds.
- A CA can open Create Claim and see why each lot can or cannot be claimed.
- Existing conformance and claim behavior is unchanged except for clearer
  pre-submit explanations.
- Subcontractors do not gain visibility into budgets, claim values, or unrelated
  project data.
- No schema migration is required.
- Existing dogfood paths for conformance, force-conform, dockets, claims, and
  audit logs still pass.
- The UI feels simpler because existing modules are connected by one readiness
  language.
