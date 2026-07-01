# User Testing Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Jay's 2026-07-01 manual user-testing feedback so company setup, project setup, lot creation, ITP completion, role shells, reports, and hold-point release workflows feel coherent for real users.

**Source Feedback:** `tasks/user-testing-feedback-2026-07-01.md`

**Architecture:** Keep the work split into PR-sized surfaces. Prefer small fixes that make existing concepts obvious before removing or redesigning larger workflow areas. Preserve existing desktop behavior, role permissions, shell feature flags, audit logs, and public hold-point token security.

**Tech Stack:** React/Vite frontend, Express/Prisma backend, Vitest/Jest-style unit and component tests, Playwright e2e, GitHub PR + CI flow.

---

## Scope Map

Feedback items covered:

- UTF-001: Archived projects counted inconsistently in plan usage.
- UTF-002: Company logo is unclear in the UI and missing from generated reports.
- UTF-003: Project team assignment should pick from existing company users.
- UTF-004: Foreman/subbie users briefly see the desktop UI before role shell.
- UTF-005: Foreman/subbie home cards need role-focused simplification.
- UTF-006: Lots page filters do not carry into Create Lot.
- UTF-007: Create Lot needs a lot value/budget field.
- UTF-008: Project state/spec selection should filter state-specific standards and keep national standards available.
- UTF-009: Desktop ITP checklist needs clearer Pass/Fail/N/A controls.
- UTF-010: Foreman/subbie ITP hold-point links must not drop into old desktop UI.
- UTF-011: Management needs guided lot/ITP readiness before field users receive blocked checklists.
- UTF-012: Superintendent sign-off items should not be normal foreman/subbie actions.
- UTF-013: Hold points need batch release request.
- UTF-014: Hold Points page needs lot filtering.
- UTF-015: Hold-point release request needs evidence upload.

## Parallel Work Rules

- Use separate worktrees and branches for each PR.
- Do not edit another worker's owned files unless explicitly coordinating.
- Open draft PRs early so CI can run while later workers continue.
- Keep each PR independently shippable; avoid one huge combined branch.
- Do not log public release tokens, signed upload URLs, credentials, cookies, or production secrets.

## Recommended Parallel Batches

### Batch 1 - Low-Risk Setup and Navigation Fixes

These can run at the same time because file ownership is mostly separate.

- Worker A: PR-1 project quota semantics.
- Worker B: PR-2 Create Lot budget and filter-prefill.
- Worker C: PR-3 project state/spec mapping.
- Worker D: PR-4 role-shell no-flash redirects.
- Worker E: PR-5 hold-point lot filter.

### Batch 2 - Medium UI/API Improvements

Start after Batch 1 branches are opened or merged, depending on file conflicts.

- Worker A: PR-6 project team member picker.
- Worker B: PR-7 desktop ITP Pass/Fail/N/A action strip.
- Worker C: PR-8 foreman/subbie superintendent sign-off gating and shell hold-point route.
- Worker D: PR-9 single hold-point request evidence persistence.
- Worker E: PR-10 company logo/report branding foundation.

### Batch 3 - Workflow Reshaping

These depend on the foundations above and should not be rushed into Batch 1.

- PR-11 batch hold-point release request.
- PR-12 lot/ITP management readiness guidance.
- PR-13 foreman/subbie home card simplification.
- PR-14 complete report branding rollout across all creatable reports.

---

## PR-1: Project Quota Semantics

**Feedback:** UTF-001

**Intent:** If archiving a project frees capacity to create a new project, the usage display should count active/non-archived projects the same way.

**Owned Files:**

- `backend/src/routes/projects/projectCreationLimit.ts`
- `backend/src/routes/projects/projectCreationLimit.test.ts`
- `backend/src/routes/company.ts`
- `backend/src/routes/company.test.ts`
- `frontend/src/pages/company/components/CompanyUsageSection.tsx` only if display copy needs clarification

**Tasks:**

- [ ] Change project quota count to exclude archived projects: `where: { companyId, status: { not: 'archived' } }`.
- [ ] Keep the response field name `projectCount` to avoid frontend churn.
- [ ] Update company settings copy only if it currently implies all historical projects are counted.
- [ ] Add/adjust backend tests proving archived projects do not count toward displayed quota usage.
- [ ] Confirm project creation limit tests still match the creation behavior.

**Verification:**

- [ ] `cd backend; npm test -- projectCreationLimit company`
- [ ] Manual or component-level check: Basic plan with 3 active + 1 archived displays `3 out of 3`, not `4 out of 3`.

---

## PR-2: Create Lot Budget and Filter Defaults

**Feedback:** UTF-006, UTF-007

**Intent:** Make the existing lot filters useful as create context, and allow permitted users to set lot budget/value during creation.

**Owned Files:**

- `frontend/src/pages/lots/LotsPage.tsx`
- `frontend/src/pages/lots/components/CreateLotModal.tsx`
- `frontend/src/pages/lots/components/createLotForm.ts`
- Lot create component tests/e2e tests

**Known Context:**

- Backend already accepts `budgetAmount` and gates it by role.
- `subcontractor=unassigned` must not prefill Create Lot.

**Tasks:**

- [ ] Add `canViewBudgets`, `initialActivityType`, and `initialAssignedSubcontractorId` props to `CreateLotModal`.
- [ ] Pass active `activityFilter` into Create Lot when it is a real activity value.
- [ ] Pass active `subcontractorFilter` into Create Lot when it is a real subcontractor ID and not `all` or `unassigned`.
- [ ] Add optional `budgetAmount` to `createLotForm` state and validation.
- [ ] Render `Budget Amount ($)` only for users with commercial/budget access.
- [ ] Parse budget with the existing optional nonnegative decimal helper.
- [ ] Include `budgetAmount` in `POST /api/lots` only when present and allowed.
- [ ] Leave the top lots filter bar in place for this PR; reconsider removal only after the prefill behavior is tested.

**Verification:**

- [ ] Frontend test: selected subcontractor filter appears preselected in Create Lot.
- [ ] Frontend test: `unassigned` filter does not prefill subcontractor.
- [ ] Frontend test: budget field appears for permitted users and is omitted for restricted users.
- [ ] E2E: create a lot with subcontractor + budget, then confirm budget appears in lot table/detail.

---

## PR-3: Project State/Specification Selection

**Feedback:** UTF-008

**Intent:** Project setup should guide users toward valid state-specific ITP/spec libraries while keeping the national option available.

**Owned Files:**

- `frontend/src/pages/projects/ProjectsPage.tsx`
- New frontend helper for state/spec mapping if no suitable helper exists
- `backend/src/routes/projects/writeRoutes.ts`
- Relevant frontend/backend tests

**Mapping:**

- `NSW -> TfNSW`
- `QLD -> MRTS`
- `VIC -> VicRoads`
- `SA -> DIT`
- `WA -> MRWA`
- `Austroads` remains available for every state as the national option.

**Tasks:**

- [ ] Create a single mapping helper used by project creation UI.
- [ ] When state changes, default the spec to the matching state spec unless the user intentionally selected `Austroads`.
- [ ] Disable or hide unrelated state-specific specs.
- [ ] Keep `Austroads` selectable for every state.
- [ ] Align backend create fallback with the same mapping when `specificationSet` is omitted.
- [ ] Decide whether the current data model supports multiple specs. If it does not, do not fake multi-select; log a follow-up for a future schema/product change.

**Verification:**

- [ ] Unit test the state/spec helper.
- [ ] Backend test: project created with `state=NSW` and no spec defaults to `TfNSW`.
- [ ] Backend test: project created with `state=QLD` and no spec defaults to `MRTS`.
- [ ] E2E: selected state disables unrelated state-specific specs and keeps `Austroads`.

---

## PR-4: Role-Shell No-Flash Redirects

**Feedback:** UTF-004

**Intent:** Foreman and subbie users should land directly in their dedicated UI without desktop shell chrome flashing first.

**Owned Files:**

- `frontend/src/App.tsx`
- `frontend/src/pages/auth/postLoginRedirect.ts`
- `frontend/src/shell/shellFlag.ts` only if needed
- `frontend/src/appProjectRoutes.tsx` only if project redirect targets classic paths first
- App-level routing tests

**Tasks:**

- [ ] Add route-level entry components for `/dashboard` and `/subcontractor-portal` before `ProtectedAppShell` mounts.
- [ ] Use `getActiveShellHomePath` or the existing shell flag helper to route eligible mobile foreman/subbie users to `/m` or `/p`.
- [ ] Preserve `?shell=off`.
- [ ] Preserve desktop viewport behavior.
- [ ] Preserve auth and onboarding gates.
- [ ] Update `RootRoute` so authenticated users route through `getDefaultPostLoginRedirect` rather than hardcoded `/dashboard`.
- [ ] Audit old foreman and subbie project redirects so they do not target classic paths first for shell users.

**Verification:**

- [ ] App route test: mobile foreman navigating to `/dashboard` redirects to `/m` without rendering `ProtectedAppShell`.
- [ ] App route test: mobile subbie navigating to `/subcontractor-portal` redirects to `/p` without rendering `ProtectedAppShell`.
- [ ] Route test: `?shell=off` keeps desktop/classic route.
- [ ] Manual browser check on mobile viewport for foreman and subbie logins.

---

## PR-5: Hold-Point Lot Filtering

**Feedback:** UTF-014

**Intent:** Make the Hold Points page manageable when a project has many lots.

**Owned Files:**

- `frontend/src/pages/holdpoints/types.ts`
- `frontend/src/pages/holdpoints/holdPointsPageData.ts`
- `frontend/src/pages/holdpoints/components/HoldPointStatusFilter.tsx`
- `frontend/src/pages/holdpoints/HoldPointsPageSections.tsx`
- `frontend/src/pages/holdpoints/HoldPointsPage.tsx`
- Hold-point page tests

**Tasks:**

- [ ] Derive a lot list from loaded hold points.
- [ ] Add an `All lots` / specific lot picker near existing status/search filters.
- [ ] Filter table and mobile list by selected lot.
- [ ] Keep selected status/search filters working with selected lot.
- [ ] Keep this frontend-only unless register size requires backend `?lotId=`.

**Verification:**

- [ ] Unit test `holdPointsPageData` lot filtering with mixed lots.
- [ ] Component test lot picker interaction.
- [ ] E2E: project manager can filter Hold Points page to one lot.

---

## PR-6: Project Team Member Picker

**Feedback:** UTF-003

**Intent:** Project users should be assigned from known company members instead of requiring typed email.

**Owned Files:**

- `backend/src/routes/projects/teamRoutes.ts`
- Backend team route tests
- `frontend/src/pages/projects/settings/components/TeamTab.tsx`
- `frontend/src/pages/projects/settings/ProjectUsersPage.tsx`
- Project settings e2e tests

**Tasks:**

- [ ] Add `GET /api/projects/:id/assignable-users`, gated by project admin access.
- [ ] Return same-company users not already assigned to the project.
- [ ] Include enough display data: `id`, `name`, `email`, company role.
- [ ] Update project team assignment POST to accept `{ userId, role }`.
- [ ] Keep `{ email, role }` fallback for compatibility.
- [ ] Replace typed email-first UI with searchable dropdown/picker of assignable users.
- [ ] Provide a fallback manual email/invite path only if the existing product intentionally allows assigning not-yet-existing users.

**Verification:**

- [ ] Backend test: project admin can list assignable same-company users.
- [ ] Backend test: already-assigned users are excluded.
- [ ] Backend test: user from another company cannot be assigned by ID.
- [ ] E2E: add a company member, assign them to a project via picker, confirm visible on project team.

---

## PR-7: Desktop ITP Pass/Fail/N/A Actions

**Feedback:** UTF-009

**Intent:** Desktop ITP item rows should expose the same clear status actions as mobile/shell: green Pass, red Fail, grey N/A.

**Owned Files:**

- `frontend/src/pages/lots/components/ITPChecklistItemRow.tsx`
- `frontend/src/pages/lots/components/ITPChecklistTab.tsx` if prop threading is needed
- New `frontend/src/pages/lots/components/ITPChecklistStatusActions.tsx`
- ITP checklist component tests

**Tasks:**

- [ ] Add a compact status action component with Pass, Fail, and N/A buttons.
- [ ] Wire Pass to existing `onToggleCompletion(item.id, isCompleted, notes)` behavior.
- [ ] Wire Fail to existing failed-item modal behavior.
- [ ] Wire N/A to existing N/A modal behavior.
- [ ] Hide or disable Pass when an unreleased hold point blocks completion.
- [ ] Preserve notes/photos/evidence controls below or near the primary actions.
- [ ] Make button styling visually align with shell pattern without introducing nested cards.

**Verification:**

- [ ] Component test: pass calls the existing completion handler.
- [ ] Component test: fail opens existing fail flow.
- [ ] Component test: N/A opens existing N/A flow.
- [ ] Component test: unreleased hold point cannot be passed.
- [ ] Browser check on desktop lot ITP tab.

---

## PR-8: Shell Hold-Point Route and Superintendent Sign-Off Gating

**Feedback:** UTF-010, UTF-012

**Intent:** Field shells should never drop users into the old desktop UI from an ITP flow, and superintendent sign-off items should be read-only/status-oriented for foreman/subbie users.

**Owned Files:**

- `frontend/src/shell/ShellRoutes.tsx`
- New `frontend/src/shell/screens/holdpoints/*`
- `frontend/src/shell/screens/lots/ItpRunScreen.tsx`
- `frontend/src/shell/subbie/screens/SubbieItpRunScreen.tsx`
- `frontend/src/shell/screens/lots/lotsShellState.ts`
- Shell tests

**Tasks:**

- [ ] Add a foreman shell-native hold-points route, likely `/m/holdpoints`.
- [ ] Reuse `frontend/src/pages/holdpoints/holdPointsApi.ts` for data fetching.
- [ ] Keep the new shell route small and mobile-native; do not import desktop page chrome.
- [ ] Ensure any “Open Hold Points” CTA from foreman ITP routes to `/m/holdpoints?...`.
- [ ] Ensure any subbie hold-point CTA routes to existing `/p/quality` or another subbie-native route.
- [ ] Treat `responsibleParty === 'superintendent' && pointType !== 'witness'` as read-only/sign-off-only in shell ITP screens.
- [ ] Remove Pass/Fail/N/A/photo actions from those superintendent-only items.
- [ ] Show status copy that points the user to request/release status.

**Verification:**

- [ ] Shell route test for `/m/holdpoints`.
- [ ] Foreman ITP test: hold-point CTA stays under `/m`.
- [ ] Subbie ITP test: hold-point CTA stays under `/p`.
- [ ] Shell state test: superintendent sign-off-only item is not field-actionable.
- [ ] Browser check: no old desktop UI appears when tapping hold-point actions from shell.

---

## PR-9: Single Hold-Point Request Evidence

**Feedback:** UTF-015

**Intent:** A release request should let users upload the evidence that the hold point asks for, and that evidence should stay attached to the relevant hold point/ITP item.

**Owned Files:**

- `backend/src/routes/holdpoints/validation.ts`
- `backend/src/routes/holdpoints/requestReleaseRoutes.ts`
- `backend/src/routes/holdpoints/actionRoutes.ts`
- New `backend/src/routes/holdpoints/evidenceAttachments.ts`
- `frontend/src/pages/holdpoints/components/RequestReleaseModal.tsx`
- Hold-point request tests

**Implementation Choice:** Start without a new Prisma table. Reuse `Document` plus `ITPCompletionAttachment` by attaching request/release evidence to the relevant hold-point checklist item completion. Distinguish request/release evidence by `documentType`, caption, and audit metadata.

**Tasks:**

- [ ] Add `evidenceDocumentIds` to request-release validation.
- [ ] Create a backend helper to validate documents belong to the same project/lot.
- [ ] Upsert a pending `ITPCompletion` for the hold-point item if needed.
- [ ] Attach evidence documents with `createMany(...skipDuplicates)`.
- [ ] Persist manual release evidence as an attachment, not only audit/webhook metadata.
- [ ] Add upload UI to `RequestReleaseModal`.
- [ ] Upload with `documentType='hold_point_request_evidence'` and `category='itp_evidence'`.
- [ ] Keep uploaded IDs in modal state so a failed request can be retried without losing file references.

**Verification:**

- [ ] Backend test: request-release attaches uploaded evidence to the relevant ITP completion.
- [ ] Backend test: document from another project/lot is rejected.
- [ ] Backend test: duplicate document IDs do not duplicate attachments.
- [ ] Frontend test: files upload and their IDs are included in request-release payload.
- [ ] E2E: request a hold-point release with evidence, then verify evidence appears in the ITP/hold-point evidence surfaces.

---

## PR-10: Company Logo and Report Branding Foundation

**Feedback:** UTF-002

**Intent:** Make company logo storage/use clear and create one shared way for generated PDFs to render company branding.

**Owned Files:**

- `frontend/src/lib/pdf/types.ts`
- New shared PDF branding helper under `frontend/src/lib/pdf/`
- `frontend/src/lib/pdfGenerator.ts` if still active
- `backend/src/routes/projects/readRoutes.ts`
- `backend/src/routes/holdpoints/evidencePackage.ts`
- `backend/src/routes/claims/evidenceRoutes.ts`
- `backend/src/routes/ncrs/ncrListRoute.ts`
- PDF tests

**Tasks:**

- [ ] Audit all creatable reports/PDFs and list them in the PR body.
- [ ] Add optional `company`/`branding` data to PDF data types.
- [ ] Add a shared helper that draws bounded logo + company name.
- [ ] Make logo fetch/decode non-blocking: PDF generation must continue if the logo URL is expired or image decode fails.
- [ ] Include company name/logo display URL in relevant backend responses.
- [ ] Add copy near Company Settings logo upload explaining where the logo appears.
- [ ] Wire the helper into one or two representative PDFs first.
- [ ] Leave full rollout to PR-14 if this PR gets too large.

**Verification:**

- [ ] PDF unit/characterization test for branded header.
- [ ] Backend response test includes company branding data where required.
- [ ] Browser/PDF check: uploaded logo appears in at least one generated report.
- [ ] PDF still generates when logo URL fetch fails.

---

## PR-11: Batch Hold-Point Release Request

**Feedback:** UTF-013

**Depends On:** PR-5, PR-9

**Intent:** A project manager should be able to select multiple hold points from one lot and send one consolidated release request email while preserving individual hold-point records/tokens/audit.

**Owned Files:**

- `backend/src/routes/holdpoints/requestReleaseRoutes.ts`
- `backend/src/lib/email/holdPointTemplates.ts`
- `frontend/src/pages/holdpoints/components/BatchRequestReleaseModal.tsx`
- `frontend/src/pages/holdpoints/components/HoldPointsTable.tsx`
- `frontend/src/pages/holdpoints/components/HoldPointsMobileList.tsx`
- Hold-point backend/frontend/e2e tests

**API Shape:**

```ts
POST /api/holdpoints/request-release/batch
{
  "lotId": "...",
  "items": [
    { "itpChecklistItemId": "...", "evidenceDocumentIds": ["..."] }
  ],
  "sharedEvidenceDocumentIds": ["..."],
  "scheduledDate": "...",
  "scheduledTime": "...",
  "recipientEmail": "...",
  "recipientName": "...",
  "noticeHours": 24
}
```

**Tasks:**

- [ ] Validate all selected items belong to the same lot.
- [ ] Validate each item is release-gated and eligible.
- [ ] Validate prerequisites, status, and not-already-released state per item.
- [ ] Create/update per-hold-point rows.
- [ ] Create per-hold-point secure tokens.
- [ ] Attach shared and per-item evidence to each item completion.
- [ ] Generate one email listing all hold points and secure links.
- [ ] Add table/mobile selection checkboxes limited to eligible hold points in the selected lot.
- [ ] Add shared evidence and per-hold-point evidence areas in the batch modal.
- [ ] Report partial email delivery clearly if email send fails after DB records are created.

**Verification:**

- [ ] Backend tests for all validation cases.
- [ ] Backend test: batch creates multiple hold points and tokens.
- [ ] Backend test: batch email contains all selected hold points.
- [ ] Frontend test: selection enables batch request only for one lot.
- [ ] E2E: batch request two hold points with shared evidence.

---

## PR-12: Lot/ITP Management Readiness Guidance

**Feedback:** UTF-011

**Depends On:** PR-9 and ideally PR-11

**Intent:** Managers should be guided to prepare evidence, recipients, hold-point releases, and setup before field users are handed a blocked checklist.

**Owned Files:**

- `backend/src/lib/evidenceReadiness.ts`
- `backend/src/routes/lots/qualityRoutes.ts`
- `frontend/src/pages/lots/components/LotReadinessPanel.tsx`
- Lot readiness tests

**Tasks:**

- [ ] Extend readiness response with a `managementPrep` or `fieldHandoff` bucket.
- [ ] Count release-gated hold points.
- [ ] Count hold points missing request evidence.
- [ ] Count hold points missing recipient/default release settings where detectable.
- [ ] Count field-actionable versus management/superintendent-only items.
- [ ] Add CTAs to filtered Hold Points page and batch request flow.
- [ ] Do not hide ITPs from foreman/subbie in this PR; that would require product sign-off and likely a new release-status field.

**Verification:**

- [ ] Backend readiness tests with an ITP containing many hold points.
- [ ] Frontend test: LotReadinessPanel shows management prep warnings and CTAs.
- [ ] Browser check on a lot with multiple unreleased hold points.

---

## PR-13: Foreman/Subbie Home Card Simplification

**Feedback:** UTF-005

**Depends On:** PR-4 and PR-8

**Intent:** Dedicated role shells should put daily work first and demote admin/noisy paths.

**Owned Files:**

- `frontend/src/shell/screens/HomeScreen.tsx`
- `frontend/src/shell/subbie/screens/HomeScreen.tsx`
- Shell home tests

**Recommended Foreman Home:**

- Diary hero/current day.
- Inspections: lots, ITPs, hold points due.
- Dockets.
- Issues/NCRs.
- Drawings/docs demoted off the home cards if accessible from lot hub.

**Recommended Subbie Home:**

- Today’s Docket hero.
- My Dockets.
- My Work.
- Inspections.
- Documents only if strongly needed.
- Move Holds & Tests/NCRs under a quality/inspection surface.
- Demote My Company to setup/admin rather than daily worker card.

**Tasks:**

- [ ] Reduce subbie home card count.
- [ ] Rename/reframe cards around actual user jobs, not internal modules.
- [ ] Keep all removed/demoted destinations reachable through role-appropriate secondary navigation.
- [ ] Update tests for visible cards and navigation targets.

**Verification:**

- [ ] Shell home tests for foreman and subbie card sets.
- [ ] Browser check on mobile viewport for both roles.

---

## PR-14: Complete Report Branding Rollout

**Feedback:** UTF-002

**Depends On:** PR-10

**Intent:** All user-creatable reports/PDF exports should consistently include company branding where appropriate.

**Report Surfaces To Audit and Wire:**

- Conformance report.
- Dashboard/project report.
- Docket report/export.
- Hold-point evidence package.
- Claim evidence package.
- Daily diary report/export.
- NCR detail/report.
- Test certificate.
- Any report/export reachable from `ReportsPage`.

**Tasks:**

- [ ] Use the shared PDF branding helper from PR-10 in every creatable PDF/report generator.
- [ ] Add tests for at least one PDF per generator family.
- [ ] Update Company Settings copy to list report usage.
- [ ] Add a manual report-generation checklist to the PR description.

**Verification:**

- [ ] PDF tests pass.
- [ ] Manual browser check: generate representative reports and confirm logo/company name appear.
- [ ] Confirm PDF generation still works for companies without a logo.

---

## Final End-to-End Validation

Run after all PRs are merged into the integration branch or master.

- [ ] Main user: create company/team member, create project with state/spec, create lot with subcontractor and budget.
- [ ] Main user: assign project member from company picker.
- [ ] Main user: open lot ITP on desktop and use Pass/Fail/N/A actions.
- [ ] Main user: open Hold Points page, filter by lot, upload evidence, request one release.
- [ ] Main user: batch request multiple hold-point releases from one lot.
- [ ] External superintendent: open email link and release/sign off.
- [ ] Foreman mobile: login lands directly in `/m`; no desktop flash.
- [ ] Foreman mobile: open inspection/ITP and hold-point CTA remains in shell.
- [ ] Foreman mobile: superintendent-only items are read-only/status-only.
- [ ] Subbie mobile: login lands directly in `/p`; no desktop flash.
- [ ] Subbie mobile: inspect simplified home cards and ITP/quality paths.
- [ ] Reports: upload company logo and generate every report/export listed in PR-14.

## Recommended First Move

Start Batch 1 with five workers because those fixes are independent and give immediate UX improvement with low migration risk:

1. PR-1 quota semantics.
2. PR-2 Create Lot budget/filter defaults.
3. PR-3 state/spec mapping.
4. PR-4 role-shell no-flash redirects.
5. PR-5 hold-point lot filtering.

After those draft PRs are open, begin Batch 2 while CI runs.
