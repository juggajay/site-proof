# Stage 139 Setup - Release Candidate Gate

Date: 2026-07-01

Branch: `qa/stage139-plant-lot-allocation`

Base: `origin/master` at `53748325` after PR #1301.

## Why This Exists

The full-app QA loop has found and fixed real issues, but "keep looking until
nothing else is flagged" is not a useful finish line. A construction management
app will always have another edge case, scale hardening item, or product
improvement.

This document defines a finite release-candidate gate for first real users.
Future QA stages should either:

1. Prove one part of this gate.
2. Fix a launch-critical failure found while proving it.
3. Record a non-blocking follow-up with a clear reason it does not block a
   controlled pilot.

## Current Readiness Judgment

The app is close to controlled pilot readiness, not "everything is perfect"
readiness.

Recommended user exposure:

- Controlled pilot users: reasonable once the gate below passes in one clean
  release-candidate run.
- Broad paid launch: wait until pilot feedback, support process, backup restore
  evidence, monitoring, and any legal/commercial wording sign-offs are all
  explicitly accepted.

## Release Candidate Gate

### 1. Owner / Admin Core Loop

Evidence required:

- Owner can log in, select a company/project, and reach the dashboard.
- Owner/admin can create or manage projects, users, roles, lots, documents,
  ITP templates/instances, NCRs, dockets, claims, reports, and account settings
  without console errors or access drift.
- Project-scoped access is enforced across owner, admin, project manager,
  quality manager, foreman, subcontractor admin, subcontractor user, viewer, and
  external superintendent paths.

### 2. Foreman Field Loop

Evidence required:

- Foreman mobile shell can open assigned lots, run ITP items, attach evidence,
  manage hold points, create diary records, raise NCRs, and work with dockets.
- Offline-supported claims are truthful. Any online-only action must fail with
  clear copy and no data loss.
- Hold-point status, ITP completion state, and lot conformance stay in sync
  after request/release/signoff paths.

### 3. Subcontractor Loop

Evidence required:

- Subcontractor can log in through the portal/mobile shell and see only assigned
  work.
- Subcontractor can create, edit, submit, respond to queries, and delete daily
  dockets where allowed.
- Labour and plant entries calculate cost consistently across subbie, foreman,
  and owner views.
- Lot-scoped docket allocations either work for all supported entry types or
  are deliberately limited and clearly documented.

### 4. External Superintendent Loop

Evidence required:

- External superintendent receives the hold-point email.
- Email links open without requiring the wrong account context.
- The superintendent can review evidence, release/sign off, and the release is
  attributed clearly enough for audit use.
- The release affects the ITP/lot completion state that depends on it.

### 5. Documents, Evidence, And Reports

Evidence required:

- Uploaded documents, evidence, drawings, document versions, and generated PDFs
  are accessible only through the intended backend-mediated access paths.
- Historical document versions can be viewed/downloaded where intended.
- Generated reports and exports complete for realistic launch-size data.
- Report wording avoids legal over-claims unless signed off.

### 6. Money And Claims

Evidence required:

- Docket submitted and approved costs are rounded and displayed consistently.
- Docket reductions require and preserve adjustment reasons.
- Claims can be created, submitted, exported, and reviewed without stale totals.
- SOPA-related wording is clearly indicative unless legal sign-off exists for
  the exact jurisdiction and scenario.

### 7. Production Operations

Evidence required:

- CI is green on the release-candidate branch.
- Post-merge E2E is green on `master`.
- Production `/ready` returns 200 after deploy.
- Sentry receives a controlled backend and frontend test event.
- Database backups run off-host.
- At least one restore drill has been recorded against a disposable database.
- Required production secrets are present in the deployment targets and GitHub
  environment gates where the preflight expects them.

## Stop Conditions For The Loop

Stop fixing immediately and discuss if a finding is:

- A product-policy decision rather than a clear correctness bug.
- A large architecture change that is not needed for controlled pilot users.
- A scale hardening issue that requires expected customer volume assumptions.
- A legal/compliance claim requiring lawyer sign-off.

Do not stop for:

- Clear data loss bugs.
- Incorrect access control.
- Broken user-visible launch-critical flows.
- Broken production monitoring, backup, restore, or CI gates.
- Incorrect money calculations.

## Accepted Follow-Up Style

Every remaining issue should be recorded as one of:

- `Pilot blocker`: real users should not start until fixed.
- `Broad launch blocker`: pilot can start, public launch should wait.
- `Scale hardening`: safe at small launch volume, needs owner sign-off before
  large imports or high usage.
- `Product decision`: needs Jay's direction before implementation.
- `Polish`: does not block launch.

## Next Candidate Stage

Stage 139 should audit the Stage 138 follow-up:

Plant lot allocation support is inconsistent. The schema has
`DocketPlantLot`, but the plant entry API and subcontractor docket UIs may not
expose plant lot allocation. The stage should decide whether this is:

- A pilot blocker because plant costs must be lot-scoped for conformance/cost
  reporting.
- A product decision because plant entries are intentionally unscoped.
- A broad launch hardening item because labour allocation is enough for the
  first controlled pilots.

No plant allocation code should be changed until the stage proves the intended
contract from current code, tests, and user-facing behavior.
