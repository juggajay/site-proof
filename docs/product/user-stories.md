# SiteProof User Stories And Buyer Context

Source: extracted and condensed from
`docs/research/03-buyer-journey-sales.md` and
`docs/research/RESEARCH-SUMMARY.md`.

Status: product planning source of truth. The research file remains the raw
sales and market report. This file is the version agents should use when making
product, UX, onboarding, and QA decisions.

## Product Thesis

SiteProof is for Australian civil contractors who need to prove that work is
ready to be claimed, handed over, and audited.

The wedge is not "more construction software." The wedge is one evidence
pipeline:

1. Create the project and lots.
2. Attach the right ITP and quality requirements.
3. Collect field evidence, tests, hold point releases, diaries, dockets, NCRs,
   drawings, and documents.
4. Show the blockers clearly.
5. Resolve the blockers.
6. Claim or hand over the work with a defensible record.

Every product decision should reduce the gap between work happening on site and
a customer being able to prove that work is ready.

## Target Market

Primary segment:

- Australian civil contractors with roughly 10-200 employees.
- Roads, bridges, earthworks, drainage, pavements, structures, and related
  infrastructure work.
- Companies that are too serious for paper and Excel, but too lean for a heavy
  enterprise platform.

Common current stack:

- Excel or Word ITPs.
- Paper or email hold point sign-offs.
- Word/PDF NCRs.
- SharePoint, Dropbox, USB drives, or email for document control.
- Paper daily diaries or generic diary apps.
- Manual progress claim collation from dockets, tests, photos, and emails.

Core pain:

- Quality evidence is scattered.
- Claims take days to assemble.
- Audits are stressful.
- Rework and payment disputes eat margin.
- Project managers and quality managers spend too much time chasing paperwork.

## Primary Personas

### Dave The Director, Owner-Operator

Company size: 10-50 employees.

Role: owner, director, managing director.

What he cares about:

- Winning tenders.
- Avoiding audit failures.
- Avoiding rework.
- Keeping admin low.
- Seeing ROI fast.

Current behaviour:

- Uses basic Excel, Word, email, and paper.
- Trusts what other civil contractors recommend.
- Makes decisions quickly when the pain is acute.

Product implication:

- Show value in plain language.
- Avoid abstract quality jargon unless the action is obvious.
- Give him a dashboard that answers: "Are we exposed?" and "Can we claim?"
- Make setup feel lightweight.

Winning message:

> Save admin time, avoid audit surprises, and claim with evidence.

### Sarah The Quality Manager

Company size: 30-200 employees.

Role: quality manager, senior project manager, quality and safety manager.

What she cares about:

- ITP status.
- Hold point release tracking.
- NCR close-out.
- Test certificates.
- Audit evidence.
- Repeatable processes across projects.

Current behaviour:

- Owns complex Excel templates.
- Chases foremen, subcontractors, and project managers for evidence.
- Needs a business case to convince directors.
- Cares whether the software matches real civil workflows.

Product implication:

- Evidence Readiness is for Sarah.
- Every blocker should explain the missing evidence and the next action.
- Avoid generic task language. Use civil quality language.
- Reports and audit logs must be trustworthy.

Winning message:

> SiteProof is ITP-native. Hold points, NCRs, tests, and claims are first-class,
> not generic forms.

### Mark The Operations Manager

Company size: 50-200 employees.

Role: operations manager, construction manager, general manager.

What he cares about:

- Visibility across projects.
- Consistency between project teams.
- Scaling without hiring another quality manager for every project.
- Knowing which projects have risk before the client does.

Current behaviour:

- May already use Procore, Aconex, Payapps, or another project system.
- Wants proof on a real project before standardising.
- Does not want another tool that needs heavy configuration.

Product implication:

- Portfolio, dashboard, and reports must show risk and readiness clearly.
- Status semantics must be consistent everywhere.
- Empty states should show the workflow, not just "No records found."

Winning message:

> See quality and claim readiness across projects without adding headcount.

### Lisa The Procurement Or IT Buyer

Company size: 100-200 employees.

Role: procurement manager, IT manager, CFO, or board-adjacent evaluator.

What she cares about:

- Security.
- Data ownership.
- Data residency.
- Exportability.
- Vendor risk.
- Total cost of ownership.

Current behaviour:

- Uses evaluation matrices.
- Compares vendors.
- May not understand civil quality deeply.

Product implication:

- Keep security and export docs easy to find.
- Make data ownership and export paths explicit.
- Avoid overpromising compliance.

Winning message:

> Australian civil workflows, clear access control, exportable records, and a
> defensible audit trail.

### Field Foreman Or Site Supervisor

Role: foreman, supervisor, site manager.

What they care about:

- Getting today’s work done.
- Avoiding double entry.
- Fast mobile actions.
- Not having to understand admin workflows.

Current behaviour:

- Works from phone or tablet.
- May have patchy reception.
- Will abandon anything that feels like office paperwork.

Product implication:

- Mobile screens must be simple and forgiving.
- Field actions should be obvious: complete item, upload photo, request release,
  submit diary, submit docket.
- The app should not ask the foreman to understand the full claim lifecycle.

Winning message:

> Capture proof once, on site, while the work is still fresh.

### Subcontractor Admin Or Supervisor

Role: subcontractor company admin, supervisor, leading hand.

What they care about:

- Seeing only their assigned work.
- Submitting dockets.
- Responding to queries.
- Uploading required evidence.
- Knowing what the head contractor expects.

Current behaviour:

- Uses email, texts, paper dockets, and ad hoc forms.
- Often has no patience for another contractor’s portal.

Product implication:

- Subbie portal must be narrow, safe, and obviously scoped.
- No head-contractor admin surfaces.
- Docket and assigned-lot flows must be frictionless.
- Access denied states should be clear, not blank or misleading.

Winning message:

> See assigned work, submit dockets, and respond to the head contractor without
> chasing emails.

## Purchase Triggers

1. Audit failure or near-miss.
   - Missing ITP records.
   - Incomplete hold point evidence.
   - ISO or client audit pressure.

2. Rework cost becomes visible.
   - One painful project makes the cost of weak QA obvious.
   - Management starts asking why the same defects repeat.

3. Progress claim dispute.
   - Claim evidence takes days to assemble.
   - Client disputes quantities, tests, hold points, or completion state.

4. Business scaling.
   - More projects than the current admin process can handle.
   - Quality manager becomes the bottleneck.

5. Tender or client requirement.
   - Government or tier-one client expects stronger digital QA records.
   - Contractor needs to prove quality capability to win work.

6. Leadership transition.
   - New quality manager, graduate engineer, or next-generation owner pushes
     for modern workflows.

## Product Principles

### 1. Make The Evidence Pipeline Visible

Users should always know:

- What work exists.
- What evidence exists.
- What is missing.
- What can be claimed.
- What is blocked.
- What action fixes the blocker.

This is the main UX rule.

### 2. Keep Status Language Consistent

Use the same meaning everywhere:

- Not Started: work has not begun.
- In Progress: work is underway.
- Awaiting Test: test evidence is needed.
- Hold Point: inspection or release is required.
- NCR Raised: non-conformance must be resolved.
- Completed: field work is done.
- Conformed: quality evidence is approved.
- Claimed: included in a progress claim.

Do not invent local status wording on one page that conflicts with another page.

### 3. Do Not Hide The Next Action

Bad empty state:

> No dockets found.

Better empty state:

> No dockets yet. Assign a subcontractor to a lot, approve their roster rate,
> then they can submit today’s docket.

The product should teach the workflow while the user is stuck.

### 4. Subbie UX Must Be Narrower Than HC UX

Subcontractors should not see head-contractor navigation, project settings,
commercial admin, or unrelated project routes.

The subbie portal should answer:

- What projects am I invited to?
- What lots are assigned to me?
- What dockets need action?
- What evidence can I upload or respond to?

### 5. Field UX Beats Admin Completeness

For foremen and subbies, one fast action beats a perfect data model exposed in
the UI. Capture the evidence first. Let office users reconcile later.

### 6. Every Claim Should Be Evidence-Backed

Progress claims are the commercial proof point. If SiteProof makes claims easier
and more defensible, the product has a clear reason to exist.

## Role-Based User Stories

### Owner Or Director

- As an owner, I want to create my company and first project without manual
  database setup, so I can trial SiteProof without waiting for support.
- As an owner, I want to see which projects have unclaimed, unconformed, or
  blocked lots, so I know where money or risk is stuck.
- As an owner, I want a simple evidence pipeline explanation, so I understand
  why lots, ITPs, hold points, dockets, NCRs, and claims are connected.
- As an owner, I want to invite my project team and subcontractors safely, so the
  right people can contribute evidence without seeing the wrong data.
- As an owner, I want exportable records, so I can prove work quality to clients,
  auditors, and adjudicators.
- As an owner, I want clear pricing and ROI framing, so I can decide if the tool
  is worth standardising across projects.

### Quality Manager

- As a quality manager, I want to configure project ITP templates from a civil
  library, so my project starts with the right state-authority quality checks.
- As a quality manager, I want to see every lot’s readiness blockers, so I know
  what prevents conformance or claiming.
- As a quality manager, I want hold point releases to be tracked with date,
  method, releaser, and audit trail, so I can defend the release later.
- As a quality manager, I want failed or missing tests to block evidence
  readiness, so weak lots do not move into claims silently.
- As a quality manager, I want NCRs linked to lots and evidence, so defects do
  not disappear in email chains.
- As a quality manager, I want reports that use the same status semantics as the
  dashboard and lot page, so I can explain project health without reconciling
  different views.
- As a quality manager, I want audit logs for critical events, so I can answer
  who changed what and when.

### Operations Manager

- As an operations manager, I want a portfolio view across projects, so I can
  see risk without opening every project.
- As an operations manager, I want consistent lot lifecycle reporting, so project
  teams cannot use different definitions for complete, conformed, and claimed.
- As an operations manager, I want project setup to reuse templates and defaults,
  so new projects do not depend on one expert manually configuring everything.
- As an operations manager, I want dashboard counts to reflect real project
  data, so I can trust them in meetings.
- As an operations manager, I want subcontractor access controls that are hard
  to misuse, so one forgotten toggle does not make the portal look broken.

### Project Manager Or Commercial Manager

- As a project manager, I want to create lots, assign specs, and attach ITPs, so
  quality evidence starts at the workfront level.
- As a project manager, I want to assign subcontractors at lot stage, so docket
  and portal workflows are tied to actual work.
- As a project manager, I want to approve, query, and reject dockets, so costs
  are controlled before they flow into commercial decisions.
- As a commercial manager, I want claim lines to show conformance and evidence
  readiness, so I know why a lot can or cannot be claimed.
- As a commercial manager, I want claim certification and payment states to be
  auditable, so claim history is defensible.
- As a project manager, I want force-conformance override to require a reason,
  so urgent admin actions still leave a clear record.

### Foreman Or Site Supervisor

- As a foreman, I want today’s assigned lots and quality tasks visible on mobile,
  so I know what needs attention on site.
- As a foreman, I want to complete ITP checklist items quickly, so quality
  capture does not slow the work.
- As a foreman, I want to request hold point release from the lot or ITP context,
  so inspections happen before work continues.
- As a foreman, I want to upload photos or documents against the right lot, so
  evidence is not lost in my camera roll or chat messages.
- As a foreman, I want to submit a daily diary with weather, labour, plant,
  activities, and delays, so the day’s record is complete.
- As a foreman, I want error messages that tell me exactly what to fix, so I do
  not have to call the office for every blocked action.

### Subcontractor User

- As a subcontractor, I want to accept a project invitation in the app, so I can
  start without digging through email or asking the head contractor.
- As a subcontractor, I want to see only projects and lots assigned to my
  company, so I know the portal is safe and relevant.
- As a subcontractor, I want to manage or select approved labour and plant rates,
  so I can submit a docket that the head contractor can approve.
- As a subcontractor, I want to submit a daily docket against an assigned lot, so
  my work and cost are captured.
- As a subcontractor, I want to respond to docket queries, so rejected or queried
  dockets can be fixed without email chains.
- As a subcontractor, I want clear access-denied pages for unrelated projects,
  so I understand I am blocked by permissions, not a broken app.
- As a subcontractor, I want a mobile-friendly portal, so I can use it from site.

### Procurement, IT, Or Finance Buyer

- As an IT reviewer, I want clear data residency and security information, so I
  can approve the vendor without chasing the founder.
- As a finance buyer, I want predictable pricing and exportability, so the
  company is not locked into a risky system.
- As a procurement lead, I want audit logs and access control documented, so I
  can compare SiteProof with larger platforms.
- As a finance buyer, I want progress claim support to reduce disputes and
  admin time, so the software has a measurable commercial case.

## Workflow User Stories

### Company And Project Setup

- A new owner signs up, verifies email, creates a company, creates a project,
  selects the relevant specification set, and lands on a useful next step.
- A project manager creates lots individually or in bulk and sees what evidence
  each lot needs.
- A quality manager imports or assigns ITP templates from the global library.
- A head contractor invites subcontractors and controls portal access by module.

Acceptance signals:

- No manual database seeding required for normal owner onboarding.
- Empty states explain the next action.
- Setup defaults prevent a blank or confusing project.

### Evidence Collection

- A foreman completes ITP checklist items from the lot.
- A project manager records or requests hold point releases.
- A tester uploads or references test results and certificates.
- A document controller attaches drawings, documents, and evidence to the
  correct project, lot, or workflow.
- A quality manager raises, rectifies, reviews, and closes NCRs.

Acceptance signals:

- Evidence is linked to the work item, not floating in a generic file list.
- Missing evidence appears as a readiness blocker.
- Upload and validation errors are specific.

### Subbie Dockets

- A head contractor invites a subcontractor.
- The subcontractor accepts in-app.
- The head contractor assigns the subcontractor to a lot.
- The subcontractor creates labour or plant records where allowed.
- The head contractor approves rates.
- The subcontractor submits a docket.
- The head contractor queries or approves it.
- The subcontractor sees the current docket state.

Acceptance signals:

- Subbie portal shows assigned lots after lot-stage assignment.
- The subbie does not see HC-only surfaces.
- Query, response, resubmit, and approve paths are testable end to end.

### Progress Claims

- A project manager opens a claim and sees eligible lots.
- Non-conformed lots are visible but not selectable.
- Already-claimed lots are clearly disabled.
- Evidence Review explains what supports or blocks each lot.
- The claim moves draft -> submitted -> certified -> paid with audit trail.

Acceptance signals:

- Claim readiness and lot readiness use the same vocabulary.
- The user can tell what action makes a blocked lot claimable.
- Commercial records are not implied by vague status changes.

### Audit And Handover

- A quality manager can search and filter audit logs by action, user, project,
  and entity.
- A project manager can export evidence for a lot or claim.
- A director can show a client or auditor the chain from work item to evidence
  to claim.

Acceptance signals:

- Critical events are logged.
- Report dates use Australian formats.
- Exports are safe for CSV and spreadsheet workflows.

## UX Checks For Future PRs

Before merging user-facing work, ask:

1. Does this help one of the personas above finish a real job?
2. Does the user know the next action when the page is empty?
3. Does the language match the evidence pipeline?
4. Does this preserve the difference between completed, conformed, and claimed?
5. Does a subcontractor see only the portal scope they should see?
6. Does the feature work on mobile for field users?
7. Does it make claims or audits easier to defend?
8. Is there a clear audit event for important state changes?
9. Can a fresh tenant understand this without Jay manually explaining it?
10. Would a quality manager trust this in front of a client?

## Sales And Onboarding Implications

Highest-value onboarding assets:

- A civil-specific demo project.
- State-specific ITP templates.
- Champion enablement kit for quality managers.
- ROI calculator showing admin and rework reduction.
- 30-day guided pilot checklist using the customer’s real project data.
- Case study showing progress claim assembly and audit readiness.

Highest-risk adoption blockers:

- Field users feeling the app is too complex.
- Subbie portal looking broken because access or assignment is incomplete.
- Status labels being unclear.
- Evidence being captured but not connected to claims.
- Too many empty states saying only "No records found."

## What Not To Build Yet

Avoid adding large new modules before the core evidence pipeline feels simple.

Defer unless a pilot proves urgency:

- Heavy procurement workflows.
- Deep ERP integrations beyond export/import basics.
- Broad generic project management features.
- Complex AI features that do not directly reduce evidence or claim friction.
- Enterprise security paperwork beyond what the first pilots actually require.

The product should first feel obvious to a tier 2/3 civil contractor running one
real project.
