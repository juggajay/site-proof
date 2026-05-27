# SiteProof User Guide

SiteProof is a civil construction quality and commercial control app. The core
workflow is:

1. Create the company and project.
2. Break the project into lots.
3. Collect evidence while work happens.
4. Resolve Evidence Readiness blockers.
5. Conform work, create claims, and report from the same evidence trail.

This guide mirrors the first-party in-app documentation available at `/docs`.

## Projects And Lots

Projects are the workspace. Lots are the unit of control.

Use projects for:

- project number, client, status, and enabled modules
- users, areas, roles, and settings
- reports, costs, claims, subcontractors, and audit context

Use lots for:

- location and work package tracking
- ITPs, hold points, test results, NCRs, documents, and photos
- subcontractor assignment
- conformance and claim eligibility

Good practice:

- Match lot numbers to site records and progress claim schedules.
- Set budget amount before conformance when a lot will be claimed.
- Assign subcontractors at lot level when they need portal work or docket
  access.

## Evidence Readiness

Evidence Readiness explains whether a lot or claim line is ready.

The vocabulary is:

- `blocker`: stops the action
- `warning`: does not stop the action, but should be reviewed
- `support`: strengthens the evidence story

Use it to find missing ITPs, unverified tests, unreleased hold points, missing
budgets, already-claimed lots, or other items that affect conformance and
claims.

Important rule: hold points are claim evidence blockers, not conformance
blockers. Force Conform is an admin override, requires a reason, and records the
reason in the audit log.

## ITPs, Hold Points, And Test Results

ITPs define inspection and test requirements for the work.

Typical flow:

1. Assign an ITP template to the lot.
2. Complete checklist items as work progresses.
3. Attach evidence where required.
4. Record test results and verify them.
5. Request and release hold points.

Seeded jurisdictional ITP templates are global. They can be copied into a
project before use. Verified ITP and test records are protected from unsafe
edits.

## Subcontractor Portal And Dockets

Subcontractor workflows use a separate portal identity from head-contractor
company users.

Typical head-contractor setup:

1. Invite the subcontractor from the project Subcontractors page.
2. Approve the subcontractor row.
3. Confirm portal access toggles.
4. Assign the subcontractor company to the relevant lot.

Typical subcontractor flow:

1. Accept the invite.
2. Open Portal or Assigned Work.
3. Submit labour and plant dockets against assigned lots.
4. Respond to queries where needed.

Typical head-contractor docket flow:

1. Review submitted dockets in Docket Approvals.
2. Query, approve, or reject.
3. Approved dockets feed cost and reporting views.

## Documents, Drawings, And Photos

Use Documents for project files, photos, quality evidence, and handover records.
Use Drawings for controlled drawing records and revisions.

Supported production uploads are handled through the backend and stored in
Supabase Storage. Unsupported file types return a specific rejection reason.

Do not upload credentials, private keys, connection strings, or unrelated
personal data.

## NCRs And Daily Diary

NCRs track quality non-conformance. Create the NCR, add evidence, rectify the
issue, send it for verification, then close only after the workflow allows it.
NCR state changes and evidence actions are audited.

Daily diaries record work areas, labour, plant, weather, delays, and addendums.
Submitting locks the main diary record. Use addendums for late clarification
without rewriting the original record.

## Claims, Costs, And Reports

Claims are created from lots that are:

- conformed
- budgeted
- unclaimed
- not blocked by claim-readiness rules

The claim lifecycle is draft, submitted, certified, and paid. Reports bring
together lot status, evidence, dockets, NCRs, claims, and project progress for
review and handover.

## Admin, Audit, And Support

Owners and admins manage company settings, project settings, users, areas,
modules, specification sets, and commercial access.

Audit Log records critical events across lots, dockets, hold points, claims,
subcontractor access, auth, and settings. Search covers actions, entities,
users, projects, and details.

Use Help & Support for configured support contact details and support requests.
Use `/docs` for workflow help.
