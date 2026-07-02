# Ship Readiness Live Audit - 2026-06-12

Scope: report-only audit across production UI/API, role access, lots/ITPs/hold points/NCRs, dockets/diary, documents/claims, CI/deploy, and operational safety.

Live fixture: `docs/research/live-production-audit-fixture-2026-06-12.md`.

## Executive Summary

SiteProof is close to controlled beta, but not ready for real production users yet.

The core product surfaces load and the current production API can complete the main ITP pass/fail paths:

- Owner, foreman, and viewer login and route loading worked.
- Foreman API pass/fail ITP completion worked.
- ITP failure created NCRs.
- Subcontractor API pass/fail worked on an assigned lot.
- Subcontractor API access was correctly denied on an unassigned lot.
- Subcontractor portal list pages loaded for work, ITPs, hold points, tests, NCRs, and documents.

The blockers are now narrower and more concrete:

- Subcontractor ITP detail crashes in the production frontend for `pointType: verification`.
- Several frontend links/nav paths send subcontractors into internal `/projects/...` routes they cannot access.
- Foreman/viewer lot detail fires forbidden subcontractor-assignment requests in the background.
- Foreman NCR capture evidence can upload without being linked to the NCR.
- Hold-point external/chase/evidence link handling is inconsistent.
- Dockets and progress claims have silent evidence/link loss edge cases.
- Operational safety around backups/deletion/retention needs tightening before customer data exists.

## Live QA Findings

### P0: Subcontractor assigned-lot ITP detail crashes in production

Evidence:

- Route: `/subcontractor-portal/lots/7aaf7053-aba4-483d-9e4c-d1b6a066f093/itp`
- Result: app error page, no failed API responses.
- Console error: `TypeError: Cannot read properties of undefined (reading 'color')` in `MobileITPChecklist`.

Cause:

Production bundle does not handle `pointType: verification` in the mobile ITP badge config.

Current local worktree appears to already contain the right fix:

- `frontend/src/components/foreman/MobileITPChecklist.tsx`
- `frontend/src/components/foreman/MobileITPChecklistSections.tsx`
- `frontend/src/components/foreman/MobileITPItemSheet.tsx`

The diff adds `verification` handling and fallback badge/label logic. This needs to be merged and deployed before beta.

### P1: Foreman/viewer lot detail fires forbidden subcontractor-assignment requests

Evidence:

- Foreman opening lot detail triggers `403` from `/api/lots/:id/subcontractors`.
- Viewer opening lot detail triggers the same.
- Backend response: `You do not have permission to view subcontractor assignments`.

Code:

- `frontend/src/pages/lots/hooks/useLotSubcontractorAssignments.ts` fetches all lot assignments whenever `lotId` exists.
- `frontend/src/pages/lots/LotDetailPage.tsx` computes `canManageLot`, but does not pass it into that hook.
- `backend/src/routes/lots/subcontractorAssignments.ts` correctly limits assignment viewing to owner/admin/project manager/site manager.

Impact:

This matches the rare "access denied where I should have access" symptom. The user can access the lot, but one background panel request is forbidden and can leak as UI noise, logs, or false error state.

Fix direction:

Only fetch `/api/lots/:id/subcontractors` for users allowed to view/manage assignments. Keep `/mine` for subcontractors.

### P1: Subcontractor notifications can link to routes subcontractors cannot open

Code:

- `backend/src/routes/notifications/access.ts`
- `backend/src/routes/notifications/links.ts`
- `backend/src/routes/notifications/alerts.ts`
- `frontend/src/pages/NotificationsPage.tsx`
- `frontend/src/components/auth/ProjectProtectedRoute.tsx`

Impact:

Backend can validly notify subcontractors, but generated links point to internal `/projects/:projectId/...` routes. The portal user is then denied by project route guards.

Fix direction:

Generate recipient-aware notification links. Subcontractors should receive `/subcontractor-portal/...` URLs.

### P1: Mobile nav uses raw subcontractor role instead of active portal identity

Code:

- `frontend/src/components/layouts/MobileNav.tsx`
- `frontend/src/lib/subcontractorIdentity.ts`
- `frontend/src/components/auth/RoleProtectedRoute.tsx`

Impact:

A stale/suspended/malformed subcontractor-role user can see portal nav even when route/backend access denies them.

Fix direction:

Drive portal nav from `hasSubcontractorPortalIdentity(user)`, not raw role.

### P1: Cached auth fallback can show stale permissions

Code:

- `frontend/src/lib/auth.tsx`
- `backend/src/middleware/authMiddleware.ts`

Impact:

If `/api/auth/me` is unavailable, frontend uses cached user state while backend rehydrates live DB permissions. After role or subcontractor changes, UI may show actions/routes that backend denies.

Fix direction:

For access-sensitive routes/nav, distinguish verified identity from cached identity. On 403 from project/portal APIs, refresh `/me` and invalidate access queries.

## Workflow Findings

### P0: Foreman NCR photo evidence is uploaded but not linked to the NCR

Code:

- `frontend/src/components/foreman/CaptureModal.tsx`
- `frontend/src/lib/offline/syncWorker.ts`
- `backend/src/routes/documents/uploadRoutes.ts`
- `backend/src/routes/ncrs/ncrEvidence.ts`

Impact:

Quick capture can create an NCR and upload the photo, but the photo is not attached through the NCR evidence route. The NCR evidence package can be missing the most important proof.

Fix direction:

After document upload, if queued photo target is NCR, call `POST /api/ncrs/:id/evidence` with the uploaded document id before marking sync complete.

### P1: Superintendent-gated non-hold-point ITP items can be impossible to complete

Code:

- `backend/src/routes/itp/completions.ts`
- `backend/src/routes/holdpoints/readRoutes.ts`
- `backend/src/routes/holdpoints/requestReleaseRoutes.ts`
- `frontend/src/pages/lots/components/ITPChecklistItemRow.tsx`

Impact:

Backend blocks superintendent-responsible items unless released, but hold-point listing/release only recognizes `pointType === 'hold_point'`. A `verification` item assigned to superintendent can become impossible to pass or release.

Fix direction:

Centralize one "release-gated item" predicate and use it in completion, hold-point read, release request, and UI.

### P1: Hold-point chase reminders lose secure external links

Code:

- `backend/src/routes/holdpoints/requestReleaseRoutes.ts`
- `backend/src/routes/holdpoints/actionRoutes.ts`
- `backend/src/routes/holdpoints/chaseNotifications.ts`

Impact:

Initial request emails use `/hp-release/:token`, but chase reminders can use authenticated `/projects/...` links and wrong recipient assumptions. External superintendents can receive links that do not work for them.

Fix direction:

Reuse or mint `HoldPointReleaseToken` records for chase recipients and send `/hp-release/:token` links for both release and evidence.

### P1: Hold-point evidence packages can over-share lot evidence

Code:

- `backend/src/routes/holdpoints/readRoutes.ts`
- `backend/src/routes/holdpoints/evidencePackage.ts`

Impact:

Checklist rows are bounded to the hold-point sequence, but tests/photos/documents can come from wider lot data. Public evidence packages may expose unrelated or future evidence.

Fix direction:

Filter tests/completion attachments/documents to the bounded checklist item ids included in that evidence package.

### P1: ITP fail-to-NCR misses dedicated audit records

Code:

- `backend/src/routes/itp/completions.ts`
- `backend/src/routes/ncrs/ncrCore.ts`
- `backend/src/routes/lots/qualityRoutes.ts`

Impact:

Failing an ITP item can create an NCR and flip lot status, but only the ITP item completion is audited. NCR creation and lot status changes should be first-class audit records.

Fix direction:

Write explicit `NCR_CREATED` and `LOT_STATUS_CHANGED` audit records in the ITP failure path.

### P1: Docket approval can silently fail to populate the daily diary

Code:

- `backend/src/routes/dockets/review.ts`
- `backend/src/routes/diary/diaryAccess.ts`

Impact:

Docket approval succeeds before diary population. If the diary is submitted/locked, diary population is rejected and swallowed. The approved docket exists, but diary labour/plant evidence is missing.

Fix direction:

Return a `diarySyncStatus` warning or fail approval with a clear conflict when diary sync is required but blocked.

### P1: Certified claim certificate links can be lost on dispute

Code:

- `backend/src/routes/claims/postEvidenceWorkflowRoutes.ts`
- `backend/src/routes/claims/workflowRoutes.ts`
- `frontend/src/pages/claims/components/ClaimsTable.tsx`

Impact:

Certification metadata is stored in `disputeNotes`. Disputing a certified claim overwrites that metadata, so the certificate link can disappear even though the document still exists.

Fix direction:

Move certification metadata into dedicated fields/table, or preserve/merge JSON when writing dispute notes.

## Operations And Safety

### High: Backup dumps can land inside the repo and are not ignored

Code:

- `backend/scripts/backup.ts`
- `.gitignore`

Impact:

`BACKUP_DIR` defaults to `./backups`. A production database dump could become an untracked repo file and be accidentally committed.

Fix direction:

Ignore `backups/`, `backend/backups/`, `*.dump`, `*.dump.sha256`; require backup output outside the repo for production.

### High: Frontend `/api` production mode does not match Vercel config

Code:

- `README.md`
- `SECURITY.md`
- `.github/workflows/ci.yml`
- `frontend/vercel.json`
- `frontend/src/lib/config.ts`

Impact:

Docs/CI allow `VITE_API_URL=/api`, but checked-in Vercel config does not proxy `/api` to Railway. A deployment using that value would send API calls to Vercel and break.

Fix direction:

Require absolute Railway/API origin in production env, or add explicit Vercel `/api/:path*` rewrite. Add readiness test for the chosen mode.

### Medium: Permanent subcontractor deletion is too easy

Code:

- `backend/src/routes/subcontractors/adminRoutes.ts`
- `backend/prisma/schema.prisma`

Impact:

After status is `removed`, manager-level callers can permanently delete subcontractor company data and cascaded records without fresh confirmation or delete-specific audit.

Fix direction:

Prefer archive/soft delete. Require typed confirmation and elevated role for hard delete, and audit before deletion.

### Medium: Retention apply can delete against any DATABASE_URL

Code:

- `backend/scripts/data-retention.ts`

Impact:

`apply` only gives a 5-second delay before deleting from whatever database URL is present.

Fix direction:

Require explicit production confirmation and recent verified backup.

## What Passed

- Production backend health responded.
- Owner, foreman, viewer login worked through browser QA.
- Owner project routes loaded.
- Foreman dashboard, today, lots, hold points, NCRs, documents, dockets loaded.
- Viewer dashboard, lots, lot detail loaded.
- Subcontractor portal work, ITP list, hold points, tests, NCRs, documents loaded.
- Subcontractor internal project route access was denied, as expected.
- Foreman API ITP pass worked.
- Foreman API ITP fail created NCR `NCR-0001`.
- Foreman API hold-point direct completion was blocked, as expected.
- Subcontractor API ITP pass worked on assigned lot.
- Subcontractor API ITP fail created NCR `NCR-0002`.
- Subcontractor API access to unassigned lot was denied, as expected.

## Fix Order

1. Deploy the mobile ITP `verification` point-type fallback already present in the local worktree, after coordinating with the foreman UI workstream.
2. Fix lot detail assignment fetch gating for foreman/viewer.
3. Fix subcontractor notification links and mobile nav to use portal identity/routes.
4. Fix foreman NCR capture evidence linking.
5. Fix hold-point external chase/evidence links and over-sharing.
6. Add ITP failure audit records.
7. Fix docket approval diary-sync status.
8. Fix claim certification metadata storage.
9. Add backup ignore/safety rules and retention confirmation.
10. Align production API URL docs/config/tests.

## Beta Readiness Call

Controlled beta: close, but only after items 1 to 5 are fixed and smoke-tested.

Open user signup: not yet. The app is functional, but the current blockers touch evidence, external access links, and audit trail integrity. Those are core trust paths for construction QA.
