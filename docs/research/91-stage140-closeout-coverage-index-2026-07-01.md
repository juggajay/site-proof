# Stage 140 - QA Loop Closeout Coverage Index

Date: 2026-07-01

Branch: `qa/stage140-closeout-coverage`

Base: `origin/master` at `f42911f87c2346ad187940fe269a96a72343c1b3`
after PR #1302.

## Scope

Stage 140 answers the closeout question for the long-running full-app QA loop:

Can the browser-led audit/fix loop be closed, and are there any user workflow
areas that have not been meaningfully tested?

This was a read-only closeout audit plus documentation pass. It did not change
application behavior.

## Evidence Checked

Current source/test inventory on `origin/master`:

- Backend mounted route statements found by static scan: 97.
- Backend test files under `backend/src`: 264.
- Playwright E2E specs under `frontend/e2e`: 43.
- Frontend unit/component test files under `frontend/src`: 349.
- Latest `master` CI run for commit `f42911f8`: success.

Release-gate evidence:

- `docs/research/89-release-candidate-gate-2026-07-01.md`
- `docs/research/90-stage139-plant-lot-allocation-qa-2026-07-01.md`
- Stage reports 119 through 139, especially:
  - endpoint and frontend route map,
  - mobile shell direct route coverage,
  - hold point/docket/ITP branch coverage,
  - documents/drawings/test-results coverage,
  - reports/export coverage,
  - role journey coverage,
  - subbie mobile and docket depth coverage,
  - storage/evidence/document versioning coverage,
  - plant lot allocation coverage.

Two read-only subagents checked the current state independently:

- Backend/API explorer: no current pilot-blocking endpoint coverage gap found.
- Frontend/browser explorer: no confirmed browser-workflow pilot blocker left
  open on current `origin/master`.

## Current Judgment

The infinite QA loop can be closed as a general audit/fix workstream.

That does not mean every endpoint has been browser-tested or that the product is
mathematically perfect. It means the remaining known items are not evidence of a
broken controlled-pilot workflow.

Recommended state:

- Controlled pilot: reasonable once Jay accepts the remaining non-pilot-blocking
  risks below and runs/records one clean release-candidate smoke.
- Broad paid launch: still needs operational, legal/commercial, support, and
  scale sign-offs.

## User Workflow Coverage

### Owner / Admin

Meaningfully covered by browser, backend, and stage evidence:

- Login and app entry.
- Company/project selection.
- Project creation and project settings.
- Project user/role administration.
- Company/account settings.
- Documents, drawings, reports, scheduled reports, claims, costs, lots, ITPs,
  hold points, NCRs, dockets, test results, dashboard, support, audit log, and
  notification surfaces.

Remaining gap classification:

- `Coverage-only evidence gap`: some dashboard branch depth and real-provider
  OAuth behavior are not fully browser-proven.

### Foreman

Meaningfully covered:

- `/m` mobile shell routing.
- Assigned lots.
- ITP run path.
- Hold point blocked/release paths.
- Diary path and work items.
- Docket list/detail/adjust/query/reject surfaces.
- NCR/issues path.
- Documents/photos navigation.

Remaining gap classification:

- `Coverage-only evidence gap`: offline/online boundaries are not exhaustively
  browser-proven for every foreman action.
- `Product decision`: public hold-point token evidence visibility after release
  remains a policy choice rather than a confirmed correctness bug.

### Subcontractor

Meaningfully covered:

- Classic subcontractor portal routing and access.
- `/p` mobile shell routing and core actions.
- Assigned-work visibility.
- Docket create/edit/submit/query response/delete behavior.
- Labour and plant docket costs, including lot allocation after Stage 139.
- ITP, hold point, NCR, documents, and test-result access at the route/test
  level.

Remaining gap classification:

- `Coverage-only evidence gap`: deeper seeded browser proof for `/p/docs`,
  `/p/quality`, `/p/ncrs`, multi-subcontractor scoping, and access-readiness
  race behavior would improve confidence.
- `Product decision`: plant entries currently support a single selected lot in
  the UI; multi-lot split UI is deferred.

### External Superintendent

Meaningfully covered:

- Public hold-point release token behavior.
- Evidence package/link access paths.
- Release/sign-off state propagation into ITP/lot conformance after previous
  fixes.
- Release attribution clarity.

Remaining gap classification:

- `Coverage-only evidence gap`: real inbox delivery and every email-client link
  variant are not fully proven by browser automation.
- `Product decision`: token/evidence visibility until expiry after release
  should be explicitly accepted or changed later.

### Documents, Evidence, Reports

Meaningfully covered:

- Backend-mediated document access.
- Private storage reference handling.
- Document versioning UI.
- Drawing lifecycle.
- Report generation and scheduled report artifact access.
- Evidence storage cleanup and release guards.

Remaining gap classification:

- `Coverage-only evidence gap`: more seeded browser proof for every signed URL,
  evidence read-back, and historical version branch would improve confidence.
- `Product decision`: scheduled report artifacts are available to active project
  report users, not only schedule owners/managers.

### Money, Claims, Dockets

Meaningfully covered:

- Claims create/submit/export/review surfaces.
- Docket money rounding and submitted/approved cost consistency.
- Docket adjustment reason enforcement.
- Docket query/respond and delete total consistency.
- Labour and plant lot allocations.

Remaining gap classification:

- `Scale hardening`: claims/account/audit exports need caps or date-window
  contracts before large imported histories.
- `Product decision`: scheduled report cadence-window semantics remain a later
  decision.

### Production Operations

Meaningfully covered:

- CI on current `master` is green.
- Post-merge E2E has run green on `master`.
- Production health was probed successfully after Stage 139.
- Sentry and backup/restore work has dedicated tests and stage history.

Remaining gap classification:

- `Broad launch blocker`: broad launch still needs accepted evidence for backup
  restore drills, monitoring alert behavior, support process, legal/commercial
  wording, and pilot feedback.
- `Scale hardening`: retention automation and large-export caps remain accepted
  follow-ups unless large histories are imported before first users.

## Areas Not Proven To The Original Literal Standard

The original goal asked to test "every single endpoint" and make the app "work
perfectly." Current evidence does not prove that literal standard.

Not fully proven:

- Every backend endpoint through a real browser flow.
- Every branch of MFA, OAuth, magic-link, reset, and email verification against
  real third-party providers.
- Every email template in a real inbox/client.
- Every offline conflict scenario across diary, ITP, docket, NCR, photos, and
  evidence.
- Every large-data export/import/performance case.
- Every legal/commercial statement in every jurisdiction.

Those are not current pilot blockers, but they are why this should close as a
controlled-pilot readiness loop, not as a claim of perfect software.

## Closeout Recommendation

Close the broad browser-led audit/fix loop.

Do not mark the product as broadly launched yet. Move to a finite
release-candidate pilot checklist:

1. Record one clean release-candidate smoke against production.
2. Confirm Sentry backend/frontend alert visibility.
3. Confirm backup restore evidence is saved.
4. Have Jay accept or assign the remaining scale/product/legal follow-ups.
5. Start with controlled pilot users.

No new pilot blocker was found in this closeout pass.
