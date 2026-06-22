# Stage 51 Subcontractor QA Sweep

Date: 2026-06-23  
Branch: `qa/stage51-subcontractor-browser-qa`  
Base: `origin/master` at `3872c9c7 Fix foreman shell E2E mutation races`

## Scope

This pass focused on subcontractor-facing workflows and cross-surface access assumptions:

- Subcontractor portal RBAC and documents.
- Dockets, docket reachability, and subbie mobile docket shell tests.
- NCR evidence access paths for responsible subcontractors.
- Code review of `/p` shell company/lot scoping and ITP completion scoping.

Baseline browser/E2E command:

```powershell
npx playwright test e2e/subcontractor-portal-rbac.spec.ts e2e/subcontractors.spec.ts e2e/dockets.spec.ts e2e/subcontractor-documents.spec.ts e2e/subcontractor-docket-reachability.spec.ts e2e/subbie-mobile-shell.spec.ts --project=chromium
```

Result: `41 passed`.

## Fixed In This Stage

### NCR evidence could link an unreadable same-project document

Severity: High

Responsible subcontractors were correctly authorized against the NCR before adding evidence, but when they supplied an existing `documentId`, the route only checked that the document belonged to the same project. It did not verify the subcontractor could read that document under the existing document access rules.

Impact: a responsible subcontractor could attach another lot's same-project document to an NCR if they knew or obtained the document ID, causing the NCR evidence list to expose document metadata/file URL through the NCR surface.

Fix:

- `backend/src/routes/ncrs/ncrEvidence.ts` now runs the existing `canReadDocument()` check before linking an existing evidence document.
- New uploads keep the existing behavior and continue to store `uploadedById` as the authenticated user.
- `backend/src/routes/ncrs.test.ts` adds a regression test for a responsible subcontractor attaching an unassigned-lot same-project document.

Verification:

- `npm run type-check` passed in `backend/`.
- Local DB-backed route test could not be completed because the worktree had no disposable local Postgres. The safety guard correctly refused the Railway database from the copied local env, Docker was not running, and `psql` was not available. This regression is ready for CI's Postgres-backed backend test job.

## Deferred Findings

These are valid findings but were not edited in this stage because `frontend/src/shell/**` is currently owned by the foreman shell workstream.

### Subbie docket lot picker drops selected company scope

Severity: High

`frontend/src/shell/subbie/screens/dockets/DocketScreen.tsx` calls `useAssignedLotsQuery(userId, company?.projectId)` without passing the selected `subcontractorCompanyId`. The classic subcontractor portal edit page passes the company ID correctly.

Risk: a subbie linked to multiple companies in the same project can see lots outside the selected company context, then hit backend rejection later when saving entries.

Recommended fix: pass `company?.id` through the shell lot query and add a shell-level regression test for multi-company lot scoping.

### Subbie ITP completion writes do not preserve selected company scope

Severity: Medium

The subbie shell reads ITP runs in a company-scoped way, but completion writes use shared checklist mutations that do not include the selected subcontractor company. Backend logic can collapse multiple assigned companies into a generic "Multiple subcontractors" path and infer verification incorrectly when assignments differ.

Recommended fix: thread selected `subcontractorCompanyId` into subbie ITP completion mutations, then assert the backend applies the matching assignment's `itpRequiresVerification` behavior.

## Follow-Ups

- Add integrated `/p` shell Playwright coverage for selected-company dockets and ITP completions once the shell owner is clear to touch those files.
- Add an explicit error state to `frontend/src/pages/subcontractor-portal/DocketsListPage.tsx`; query failures can currently look like an empty docket list.
