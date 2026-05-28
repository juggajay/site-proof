# SiteProof Pilot Journey Map

Source: distilled from `docs/product/user-stories.md`, target-user research,
competitor research, and the May 2026 production dogfood reports.

Status: product planning source of truth for pilot UX, onboarding, QA plans,
and small polish PRs.

This document focuses on the four users that matter most for the first paid or
warm-intro pilots:

1. Owner / Director
2. Project Manager / Quality Manager
3. Foreman / Site Supervisor
4. Subcontractor

Procurement, IT, finance, client representatives, and auditors still matter,
but they are secondary for the first product loop. They should be served by
exports, security docs, audit trail, and clean reports rather than by new core
workflows.

## The Shared Pilot Story

SiteProof should feel like one evidence pipeline:

1. Create a project.
2. Create lots.
3. Assign the right quality requirements.
4. Capture proof from site and subcontractors.
5. Resolve blockers.
6. Claim or hand over with confidence.

The app is broad, so the pilot UX must keep users oriented around that pipeline.
Every page should answer at least one of these questions:

- What work exists?
- What proof exists?
- What is missing?
- What is blocked?
- What action fixes the blocker?
- What can be claimed or handed over?

If a page cannot answer one of those questions, it is probably either secondary
or needs stronger empty-state guidance.

## Role 1: Owner / Director

### Job To Be Done

The owner wants confidence that projects are under control and that the company
can claim, defend quality, and avoid audit surprises without adding another
admin-heavy system.

The owner does not want to manage every ITP item. They want to know where money,
risk, or client trust is stuck.

### First-Session Journey

1. Sign up or log in.
2. Create company, if not already attached to one.
3. Create first project.
4. See a simple explanation of the evidence pipeline.
5. Create or import first lots.
6. Invite project team or subcontractor only when there is assigned work ready.
7. Land on a dashboard that makes the next setup step obvious.

### Daily / Weekly Journey

Owner usage is not a daily data-entry loop. It is a control loop:

- Check dashboard for blocked lots, open NCRs, pending dockets, and claimable
  value.
- Open reports before client or internal meetings.
- Review claim readiness before month-end.
- Confirm audit trail and evidence exports are credible.
- Check that project teams and subcontractors are using the system.

### Trust Moments

- The dashboard reconciles with real project data.
- Lot status counts match the reports and lot register.
- Claims show why value can or cannot be claimed.
- Evidence Readiness explains risk in plain civil language.
- Reports look like something that could go to a client.
- Audit logs show who changed what, not vague system noise.

### Likely Confusion Points

- Too many modules on first login.
- Difference between Completed, Conformed, and Claimed.
- Empty dashboards or zero states that look broken.
- Seeing subbie or portal concepts before understanding the lot pipeline.
- Old or stale modal content that suggests the product is unfinished.

### UX Implications

- The owner dashboard should prioritise readiness and commercial risk over
  generic activity metrics.
- Status glossary should be available from the Dashboard, Lots, and Reports
  surfaces.
- Empty states should teach setup sequence: project -> lot -> ITP/evidence ->
  subbie -> claim.
- Owner-facing copy should avoid internal implementation language.
- Owner should see enough detail to trust the system, but not be forced into
  field-entry workflows.

### Downstream Product Implications

- Do not add new dashboard widgets unless they connect to risk, readiness,
  claimability, or audit confidence.
- If a future feature creates more statuses, the Dashboard, Lots, Reports,
  Claims, and Evidence Readiness vocabulary must be updated together.
- If a setup step blocks project value, surface it as a next action instead of
  leaving an empty page.
- The owner journey depends on clean reports and exports. Any change to reports
  must preserve client-ready presentation, Australian date formats, and
  defensible audit language.

### Acceptance Signals

- A first-time owner can create a project and understand the next action without
  Jay explaining the app.
- Within five minutes, the owner can explain what a lot needs before it can be
  claimed.
- The owner can find project risk and claim blockers from the dashboard or
  project page.

## Role 2: Project Manager / Quality Manager

### Job To Be Done

The PM/QM wants to keep the project evidence complete enough to conform lots,
support claims, and survive client or audit review.

They are the main user for Evidence Readiness. They care about the details, but
only if the system turns those details into action.

### First-Session Journey

1. Open the project.
2. Confirm project specification set and quality context.
3. Create areas and lots.
4. Assign ITP templates from the civil library.
5. Check Evidence Readiness on the first lot.
6. Invite project team and subcontractors once workfronts exist.
7. Confirm reports and audit log are available.

### Daily / Weekly Journey

- Review lot readiness blockers.
- Complete or verify ITP checklist items.
- Track hold point requests and releases.
- Upload or review test certificates and supporting documents.
- Raise, rectify, review, and close NCRs.
- Approve or query subcontractor dockets.
- Prepare progress claims from conformed lots.
- Export reports or evidence packs for meetings, audits, and handover.

### Trust Moments

- Evidence Readiness points to the exact blocker.
- Claim modal shows unsupported or non-conformed lots without hiding them.
- Force Conform requires a reason and leaves an audit trail.
- Docket query and response loop works without email.
- Audit search finds relevant user, project, action, and reason text.
- Reports use the same status language as the lot page.

### Likely Confusion Points

- Whether a hold point blocks conformance, claim evidence, or both.
- Whether a lot is Completed, Conformed, or Claimed.
- Whether a subcontractor must be invited, approved, assigned to a lot, and
  given portal access before dockets appear.
- Whether a failed upload is a file type issue, permission issue, or storage
  issue.
- Whether an override is an exception path or the normal path.

### UX Implications

- PM/QM surfaces should show blockers with direct action links.
- Empty states should name the missing prerequisite, not just say no records.
- Docket Approvals should explain that dockets come from subcontractors and
  need assigned lots plus approved rates.
- Project Settings and setup screens should be clear about what changes future
  evidence and what only changes metadata.
- Audit and Reports should use customer-facing action names.

### Downstream Product Implications

- Shared readiness logic must remain the single source for blocker language.
  If a blocker appears on Lot Detail and Claim Evidence Review, the severity and
  action text must agree.
- New evidence types should plug into readiness and reports, not live only in
  Documents.
- Any workflow that changes conformance, claim status, hold point state, docket
  status, NCR status, or portal access should produce a useful audit event.
- Any direct action link from readiness must focus or scroll to the destination
  on desktop and mobile.

### Acceptance Signals

- A PM/QM can answer "why is this lot not claimable?" within five seconds.
- A PM/QM can move one lot from setup to conformed or explain the blockers.
- A PM/QM can approve, query, and re-approve a docket without leaving the app.
- A PM/QM can produce a report or audit trail that looks client-defensible.

## Role 3: Foreman / Site Supervisor

### Job To Be Done

The foreman wants to record what happened today without fighting office
software.

They should not have to understand the full claim lifecycle. They need fast,
forgiving field capture tied to the correct lot.

### First-Session Journey

1. Log in on mobile or tablet.
2. See assigned project and today's relevant work.
3. Open a lot.
4. Complete ITP items or capture evidence.
5. Request hold point release if work cannot proceed.
6. Submit diary, photos, delays, labour, plant, or notes where required.

### Daily / Weekly Journey

- Open today's project.
- Check assigned or active lots.
- Tick ITP items as work proceeds.
- Upload photos or documents against the right lot.
- Request or record hold point release.
- Raise issues or NCRs when work does not meet requirements.
- Submit daily diary with weather, labour, plant, activities, and delays.
- Hand incomplete evidence back to PM/QM with clear context.

### Trust Moments

- Mobile pages do not overflow or hide critical buttons.
- The next action is obvious on the lot page.
- Upload errors explain exactly what type or field is wrong.
- Evidence stays attached to the lot, not a generic file bucket.
- The app saves time compared with sending photos and notes by message.

### Likely Confusion Points

- Too many office/admin tabs in the project sidebar.
- Field user sees claims, costs, settings, or commercial language before their
  actual work.
- Evidence-required prompts feel like blockers without explaining why.
- Hold point release path is unclear while crew is waiting.
- Daily diary or docket terminology overlaps with what subcontractors submit.

### UX Implications

- Foreman pages should prioritise Today, Lots, ITP actions, hold points,
  documents/photos, NCRs, and diary.
- Field actions should be large, short, and mobile-safe.
- Advanced project admin should be visually secondary or hidden for field roles.
- Empty states should say what the foreman can do now.
- Offline or poor reception cases should fail gently and preserve typed text
  where possible.

### Downstream Product Implications

- Any new field capture flow must be tested at 390px mobile width.
- Buttons and labels should use site language, not database or compliance
  shorthand.
- If an action affects claimability or conformance, the field user should see a
  simple explanation of why the evidence matters.
- Do not push broad admin setup into foreman workflows to make office workflows
  easier.

### Acceptance Signals

- A foreman can open a lot and take the next useful action within one tap or
  click.
- A foreman can upload evidence or complete an ITP item in under a minute.
- Mobile pages have no horizontal overflow and no hidden primary actions.
- The field user never has to understand "claim readiness" to capture evidence
  that later supports the claim.

## Role 4: Subcontractor

### Job To Be Done

The subcontractor wants to see assigned work, submit dockets and evidence, and
respond to head-contractor queries without being dragged into the head
contractor's admin system.

The subbie portal must feel narrow, safe, and obviously relevant.

### First-Session Journey

1. Receive or find invitation.
2. Accept invitation in app.
3. Land in the subbie portal, not the HC workspace.
4. Select the project if they have more than one.
5. See assigned lots.
6. Confirm labour and plant rates are visible or understand what needs HC
   approval.
7. Submit a docket against an assigned lot.

### Daily / Weekly Journey

- Open portal.
- See assigned lots and today's docket state.
- Add or select labour and plant records.
- Submit a docket.
- Respond to docket queries.
- Upload requested evidence if enabled.
- Track approved, queried, rejected, or paid/claim-adjacent states that matter
  to them.

### Trust Moments

- Subbie sees only their company, projects, lots, and allowed actions.
- Assigned lots appear after lot-stage assignment.
- Docket submit, query, response, resubmit, and approval are clear.
- Access Denied pages explain permission boundaries without looking broken.
- HC-only navigation is absent.
- The portal works on mobile.

### Likely Confusion Points

- Accepting an invitation but seeing no assigned lots.
- Being approved at project level but not assigned to a lot yet.
- Employee or plant records created by subbie but not yet approved by HC.
- Seeing HC project workspace or "New Project" actions.
- Route redirects that look like the app lost context.
- Rate, roster, and portal-access toggles not explaining who must act next.

### UX Implications

- Subbie dashboard should be a Today view: assigned lots, dockets needing
  action, queried dockets, and missing approvals.
- Project switcher should be obvious for subbies working across multiple HC
  projects.
- Docket empty states should explain the prerequisites: accepted invite,
  portal access, lot assignment, approved rates.
- HC-only links must be hidden, not merely server-rejected.
- Subbie access errors should say "This project is not assigned to your
  subcontractor company" or equivalent.

### Downstream Product Implications

- Project invitation, approval, portal access, lot assignment, and rate approval
  are separate concepts. UI must not imply one automatically completes all the
  others.
- Tests for subbie workflows need clean subbie-only accounts. Corrupted
  dual-identity QA accounts should not be used for portal validation.
- Any future module exposed to subbies must filter commercial and HC-only
  fields server-side, not only hide them in the UI.
- Subbie workflow quality directly affects claims because dockets are part of
  commercial proof.

### Acceptance Signals

- A clean subbie can accept an invite and land on useful work.
- The subbie can submit, respond to query, resubmit, and see approved docket
  state.
- The subbie cannot create projects or access unrelated HC projects.
- The subbie portal never shows HC-only project settings, claims/costs admin,
  or subcontractor management.

## Cross-Role Journey Map

This is the core pilot path. It should be the default live dogfood script.

| Step | Owner | PM / QM | Foreman | Subbie | Good state |
| --- | --- | --- | --- | --- | --- |
| Company setup | Creates company | Invited later | Not involved | Not involved | Owner can reach project creation without manual DB seeding. |
| Project setup | Creates or approves | Creates specs, areas, lots | Sees assigned project | Not involved yet | First project has clear next action. |
| Lot setup | Reviews progress | Creates lots, assigns ITPs | Opens lot on mobile | Sees assigned lots after invite and lot assignment | Lots show readiness, status, and next action. |
| Evidence capture | Checks risk | Reviews blockers | Completes ITP, uploads evidence, requests HP release | Uploads allowed evidence or docket support | Evidence is attached to lot/workflow, not floating. |
| Dockets | Checks cost/risk | Invites, assigns, approves or queries | May review field context | Submits and responds | Docket state is obvious to both HC and subbie. |
| NCRs / issues | Checks exposure | Raises, rectifies, verifies | Reports issue from site | Sees only allowed evidence/actions | Defects do not disappear in email. |
| Claim | Wants cash certainty | Builds claim from conformed lots | Not responsible | Sees relevant docket status, not claim admin | Claim modal explains blockers and support. |
| Audit / report | Wants defensible proof | Exports and explains evidence | Not responsible | Not responsible | Report and audit trail can be shown externally. |

## Current Product Strengths To Preserve

These are not theoretical. They were validated in recent production dogfood:

- Evidence Readiness reduces complexity by naming blockers and actions.
- Claim modal correctly shows non-conformed lots and explains why they cannot
  be selected.
- Subbie docket loop can pass end to end when the account and lot-stage
  assignment are correct.
- Force Conform now requires a reason and preserves it in audit details.
- Dashboard lot status pipeline now matches the broader lifecycle.
- Mobile overflow checks have been strong in recent retests.
- Notifications route and documentation page now exist.

Do not regress these while simplifying the app.

## Current Product Friction To Keep Testing

These areas have caused repeated dogfood friction and should remain in QA plans:

- Fresh tenant setup and empty states.
- Whether first-session modals or banners help or distract.
- Subbie invite, approval, portal access, lot assignment, and rate approval
  sequence.
- Role-specific navigation, especially HC-only surfaces leaking into subbie or
  field contexts.
- Docket Approvals empty state and pending/query/approve language.
- Evidence Readiness action links on desktop and mobile.
- Report/export trust and consistency.

## Design Rules For Next UI PRs

1. Start from the role.
   - Owner: risk, money, readiness, proof.
   - PM/QM: blockers, approvals, evidence, reports.
   - Foreman: today's work and fast evidence capture.
   - Subbie: assigned work and docket actions.

2. Make the next action visible.
   - Empty states should teach the workflow.
   - Blocked states should say who must act next.
   - Action links should land on the actual control.

3. Keep status words consistent.
   - Completed means field work done.
   - Conformed means quality evidence is approved.
   - Claimed means included in a progress claim.
   - Do not invent page-local synonyms.

4. Hide irrelevant power.
   - Subbies do not need HC project admin.
   - Foremen do not need commercial admin by default.
   - Owners do not need every field task as a first-session action.

5. Keep evidence tied to money and audit.
   - If a workflow captures proof, show where that proof helps conformance,
     claims, reports, or handover.

## Recommended Next PR Themes

These are product themes, not exact implementation tickets.

### 1. Role-Aware Dashboard And Landing

Goal: each user lands on the right version of "what needs attention?"

- Owner: blocked lots, claimable value, open NCRs, pending dockets, project risk.
- PM/QM: readiness blockers, approvals, NCRs, test/hold point gaps.
- Foreman: today's lots, ITP actions, diary/delay/evidence capture.
- Subbie: assigned lots, docket status, queried dockets, pending rate issues.

Downstream check: this should reduce visible complexity without hiding data that
the role legitimately needs.

### 2. Empty-State Workflow Guidance

Goal: replace "No records found" dead ends with the prerequisite chain.

Examples:

- No dockets: invite subbie, assign lot, approve rates, then subbie can submit.
- No assigned lots for subbie: HC must assign your company to a lot.
- No claimable lots: conform a lot or resolve blockers in Evidence Readiness.
- No ITP: assign a template from the lot quality section.

Downstream check: empty states should not promise actions the current role
cannot take.

### 3. Foreman Today View

Goal: make mobile field capture feel like the fastest path.

Focus on lots, ITP items, hold point requests, evidence uploads, NCRs, and
diary. Avoid claims/costs/admin language unless the user has that role.

Downstream check: this should not create a second data model. It should be a
filtered/action-oriented view over existing project, lot, ITP, diary, document,
hold point, and NCR data.

### 4. Subbie Today View

Goal: make the portal explain assigned work and docket obligations.

Focus on assigned lots, today's docket, queried dockets, employee/plant approval
state, and project switcher.

Downstream check: must preserve server-side filtering. UI polish is not a
security boundary.

### 5. Evidence Pack / Report Trust

Goal: make the output feel like the product.

Reports and exports should prove the pipeline: lot -> evidence -> approval ->
claim/handover.

Downstream check: do not build heavy integrations until export packs are
credible enough for the first pilots.

## QA Scenarios For Future Dogfood

### Fresh Owner Pilot

- Create company.
- Create project.
- Create two lots.
- Assign ITP to one lot.
- Confirm empty states guide next actions.
- Create one claim and verify non-conformed lot explanation.

### PM / QM Evidence Pilot

- Create lot.
- Assign ITP.
- Complete partial ITP.
- Request and release hold point.
- Upload test certificate or document.
- Raise and close NCR.
- Confirm readiness and audit log reflect changes.

### Foreman Mobile Pilot

- Open project on 390px mobile viewport.
- Open active lot.
- Complete an ITP item.
- Upload evidence.
- Request hold point release.
- Submit diary.
- Confirm no horizontal overflow and no hidden primary action.

### Subbie Docket Pilot

- Use a clean subbie-only account.
- Accept invite.
- Confirm portal landing.
- Confirm assigned lot appears only after lot-stage assignment.
- Create or select approved rate.
- Submit docket.
- HC queries docket.
- Subbie responds and resubmits.
- HC approves.
- Subbie sees final approved state.

## What Success Looks Like For First Pilots

SiteProof does not need every possible construction module to be successful.
It needs four users to believe the evidence pipeline:

- Owner believes risk and claimability are visible.
- PM/QM believes blockers and proof are controllable.
- Foreman believes capture is fast enough to use on site.
- Subbie believes the portal is narrow, fair, and useful.

If those four users can complete the pilot path with minimal explanation, the
product is ready to learn from real customers.
