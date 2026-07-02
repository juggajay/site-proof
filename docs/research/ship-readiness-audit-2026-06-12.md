# SiteProof Ship-Readiness Audit - 2026-06-12

Baseline audited: `origin/master` at `cf9fa8fdacfa6431beba08288e8aa714877b3beb`.

Scope: full codebase review across backend/API/data integrity, frontend product flows, foreman mobile shell/offline, security, performance/scalability, and CI/release. Six parallel read-only audit agents were used, then findings were spot-checked in the clean audit worktree.

No production credentials, connection strings, cookies, JWTs, or private session data were included in this report.

## Verification Run

Latest GitHub Actions state on audited commit:

- `master` CI run `27402969964` passed for Backend, Frontend, and Frontend E2E.

Local checks run in a clean worktree:

- Backend `npm ci`: passed.
- Backend `npx prisma generate`: passed after local Windows TLS workaround.
- Backend `npm run type-check`: passed after Prisma client generation.
- Backend `npm run lint`: passed.
- Backend `npm run build`: passed.
- Frontend `npm ci`: passed.
- Frontend `npm run type-check`: passed.
- Frontend `npm run lint`: passed.
- Frontend `npm run build`: passed.

Limitations:

- Local `npm audit` for backend and frontend was blocked by local npm certificate verification: `unable to verify the first certificate`. CI dependency checks should remain the source of truth until local certificate trust is fixed.
- The audit worktree unexpectedly showed `docs/research/03-buyer-journey-sales.md` missing, but the file exists in the main checkout. This was not treated as an app finding.

## Executive Summary

The app is in much better shape than before the last bug-fix batch: CI is green, security posture has no high-confidence emergency finding, runtime config validation is strong, and the previously fixed lot/ITP/hold-point/public-evidence issues appear to have landed.

The remaining work is mostly in three categories:

1. Evidence preservation and workflow correctness.
   Some deletion and release paths can still damage quality records or create duplicate state.

2. Permission clarity.
   Backend access control is generally stricter than the UI. Several screens show actions that the current user cannot actually submit, producing confusing 403/access-denied flows.

3. Scale and release hardening.
   Daily registers work for small data, but some pages load full project graphs or all lots and then paginate/filter client-side. Also, `master` is not branch-protected, and full E2E is skipped on PRs.

## P0 - Ship Gates Before Serious Production Use

### 1. `master` is not branch-protected

Evidence:

- `gh api repos/juggajay/site-proof/branches/master/protection` returned `Branch not protected`.
- `.github/workflows/ci.yml` has good checks, but GitHub is not currently forcing every change through them.

Impact:

- Someone can direct-push or merge without the required CI/review path.
- This makes the process weaker than the code.

Recommended action:

- Enable branch protection for `master`.
- Require Backend, Frontend, and Frontend E2E or an agreed PR E2E smoke gate.
- Block force pushes and deletion.
- Require PRs before merge.

### 2. Account deletion can delete ITP completion evidence

Evidence:

- `backend/src/routes/auth/accountDeletionRoutes.ts:112` deletes `ITPCompletion` rows where `completedById` is the deleted user.
- `backend/prisma/schema.prisma` is already designed to preserve related rows with nullable user attribution via `onDelete: SetNull`.

Impact:

- If a staff member deletes their account, signed-off ITP completion rows and attachments can be removed from active projects.
- This is a legal/compliance and trust issue for construction QA records.

Recommended action:

- Preserve completion rows.
- Null/anonymize `completedById` and `verifiedById`.
- Add a regression test for deleting a user who completed and verified an ITP item.

### 3. Lot deletion can erase completed quality records

Evidence:

- `backend/src/lib/lotDeletion.ts` blocks conformed/claimed lots, unreleased hold points, and docket allocations.
- It does not block deletion once a lot has released hold points, ITP completions, NCR links, test results, or documents.
- Prisma relations cascade from lot to ITP instance/hold points.

Impact:

- An in-progress lot with released hold points or completed ITP items can be deleted, removing quality evidence.

Recommended action:

- Short-term: block lot deletion once any quality/commercial/evidence record exists.
- Longer-term: move to soft-delete/archive for lots.
- Add regression coverage for completed ITP item, released hold point, linked NCR, test result, and document cases.

## P1 - High Priority Product Bugs

### 4. Assigned subcontractor NCR access is internally inconsistent

Evidence:

- `backend/src/routes/ncrs/ncrAccess.ts` detects subcontractors and verifies NCR portal module access, then still throws `Access denied`.
- Workflow/evidence guards accept project roles or `responsibleUserId`, but assigned subcontractors are modeled separately.

Impact:

- A subcontractor-assigned NCR can be visible and portal-enabled, but the responsible subcontractor cannot respond, upload/view evidence, or rectify.

Recommended action:

- Add responsible-subcontractor authorization to NCR workflow and evidence guards.
- Verify assigned subcontractor respond/evidence/rectify paths.

### 5. Hold-point release has a concurrency race

Evidence:

- `backend/src/routes/holdpoints/actionRoutes.ts` checks release state before the transaction.
- The transaction updates the hold point by `id` only.
- It then performs find-then-create for `ITPCompletion`.
- `ITPCompletion` has an index, not a unique constraint, for `(itpInstanceId, checklistItemId)`.

Impact:

- Two concurrent release requests can overwrite release attribution and create duplicate completion rows for the same checklist item.

Recommended action:

- Use an in-transaction conditional update or row lock.
- Add/dedupe then enforce a unique constraint on `(itpInstanceId, checklistItemId)`.
- Add a concurrency regression test.

### 6. NCR action buttons ignore responsible-party permissions

Evidence:

- `frontend/src/pages/ncr/components/NCRTable.tsx` renders Respond, Submit Rectification, Close, and Request Concession mostly from status.
- Backend gates those actions by responsible party and quality-management/project roles.

Impact:

- Users see buttons they cannot submit, then hit 403/access denied.
- This matches the rare testing experience where the app appears to allow access but the backend denies it.

Recommended action:

- Derive per-NCR action permissions from backend data.
- Prefer returning action permissions from the API instead of duplicating complex role logic in the UI.

### 7. Test Results controls ignore creator/verifier permissions

Evidence:

- `frontend/src/pages/tests/TestResultsPage.tsx`
- `frontend/src/pages/tests/components/TestResultsTable.tsx`
- `frontend/src/pages/tests/components/TestResultsMobileList.tsx`

The UI shows Add, Upload, Batch Upload, Attach Certificate, status, Verify, and Reject controls without matching backend creator/verifier rules.

Impact:

- `site_manager`, `foreman`, `site_engineer`, and `quality_manager` can see different controls that may fail after submit depending on backend role.

Recommended action:

- Add explicit create/verify/reject permission gates.
- Verify desktop and mobile for `site_manager`, `foreman`, `site_engineer`, and `quality_manager`.

### 8. Lot detail ITP desktop controls are active for viewers

Evidence:

- `frontend/src/pages/lots/LotDetailPage.tsx` treats every non-subcontractor as allowed to complete ITP items.
- `frontend/src/pages/lots/components/ITPChecklistItemRow.tsx` allows notes and photo controls without a write permission prop.

Impact:

- Read-only viewers can edit local notes or interact with controls, then hit backend denial or lose optimistic local changes on refresh.

Recommended action:

- Compute `canCompleteITPItems` from the same write-role set as backend ITP mutation access.
- Pass it into desktop rows and disable/hide mutation controls for viewers.

### 9. Docket approval can silently fail to populate the diary

Evidence:

- `backend/src/routes/dockets/review.ts` writes approved docket labour/plant into the diary.
- Errors are swallowed.
- `requireEditableDiaryForWrite` rejects submitted/locked diaries.

Impact:

- A commercial docket can be approved while the daily diary is not reconciled, with no audit/notification to the user.

Recommended action:

- Surface the failure to the approver, record an audit/notification, or block approval when diary population is required but impossible.

## P1 - Mobile Shell V2 Launch Blockers

These are behind `?shell=v2`, so they are not blockers for the old default app unless shell v2 is being launched.

### 10. Shell can pass evidence/witness-required ITP items without required data

Evidence:

- `frontend/src/shell/screens/lots/ItpRunScreen.tsx` calls `run.pass(...)` after checking only hold-point release.
- Older mobile ITP guards are not applied in this shell path.

Impact:

- A foreman can mark an item complete from shell v2 with no required photo/evidence or witness details.

Recommended action:

- Port the existing guard logic into a shared ITP action path used by shell v2.
- Test `evidenceRequired='photo'`, missing attachments, and `pointType='witness'`.

### 11. Shell offline N/A and Fail do not queue

Evidence:

- `frontend/src/shell/screens/lots/useShellItpRun.ts` delegates N/A/Fail to mobile actions that post online and return `false` on failure.
- Pass uses the offline-capable path.

Impact:

- Offline foremen can pass items, but cannot reliably mark N/A or Fail.

Recommended action:

- Route N/A and Fail through `updateChecklistItemOffline`.
- Include `ncrDescription` in failed offline payloads.

### 12. First offline evidence photo fails on untouched ITP items

Evidence:

- Shell and subcontractor ITP add-photo paths create a server completion before using the offline photo upload path.

Impact:

- If the first action offline is adding evidence to an untouched item, the preliminary completion create fails and the photo is not saved locally.

Recommended action:

- Queue/create the completion locally first, then attach the photo to that local reference.
- Verify shell and subcontractor portal.

### 13. Failed offline photo uploads disappear from Photos shell

Evidence:

- `frontend/src/lib/offline/photos.ts` returns only `syncStatus === 'pending'`.
- `syncWorker.ts` marks upload failures as `error`.
- The Photos shell only surfaces pending records.

Impact:

- Failed local photos become invisible and cannot be retried or re-filed from the shell.

Recommended action:

- Include pending and error offline photos in shell data.
- Show retry/error state.

### 14. Offline Defect capture can create unattached invisible evidence

Evidence:

- `CaptureModal.tsx` stores Defect captures as `documentType='ncr_evidence'`, `entityType='ncr'`.
- Offline defects often have no NCR `entityId`.
- Photos shell only fetches `documentType=photo`.

Impact:

- Offline defect photos can upload later as unattached NCR evidence and not appear in the Photos shell.

Recommended action:

- Either queue NCR creation plus evidence attachment, or store unraised defect photos in the visible photo inbox until attached.

### 15. Hold-point locked shell screen points to a missing mobile route

Evidence:

- `ItpRunScreen.tsx` tells users to request release from the Hold Points screen.
- `ShellRoutes.tsx` has no `/m/holdpoints` route.
- `LotHubScreen.tsx` has no hold-point tile/action.

Impact:

- A blocked foreman is directed to a screen that does not exist in shell v2.

Recommended action:

- Add a shell hold-points route/tile or inline CTA to the existing hold-point release flow.

### 16. Shell links write `projectId` but project resolution ignores query params

Evidence:

- Shell links append `?projectId=...`.
- `useEffectiveProjectId.ts` reads route params and dashboard fallback, but not the shell query param.

Impact:

- Deep links or multi-project foreman navigation can fetch the wrong project.

Recommended action:

- Make `useEffectiveProjectId` honor `searchParams.projectId`, or put project id in the shell route path.

## P2 - Scale And Performance Risks

### 17. Hold-point register paginates after loading the full project graph

Evidence:

- `backend/src/routes/holdpoints/readRoutes.ts`
- `frontend/src/pages/holdpoints/holdPointsApi.ts`

Each page request loads all project lots, ITP templates, checklist items, completions, and hold points, then slices in memory. The frontend requests every page.

Impact:

- A 10-page register can repeat a full project graph load 10 times.

Recommended action:

- Move pagination/filtering into DB-backed hold-point rows or create a purpose-built register projection.

### 18. Claim readiness has N+1 conformance checks

Evidence:

- `backend/src/routes/claims/readRoutes.ts`
- `backend/src/lib/conformancePrerequisites.ts`
- `backend/prisma/schema.prisma` lacks a standalone `ClaimedLot.lotId` index.

Impact:

- Opening claim readiness across large projects can load every lot and run readiness per lot.

Recommended action:

- Batch readiness inputs by project/lot ids.
- Use grouped counts.
- Add an index on `ClaimedLot.lotId`.
- Profile with 500, 1,000, and 5,000 lots.

### 19. Lot register bypasses server pagination

Evidence:

- `frontend/src/pages/lots/hooks/useLotsData.ts`
- `backend/src/routes/lots/readRoutes.ts`

Backend supports `page`/`limit`, but the daily-use lot register downloads every page up to 10,000 lots and then filters/sorts client-side.

Impact:

- Large projects pay high initial network cost, memory cost, and repeated client-side sorting.

Recommended action:

- Make the register server-driven for search/filter/sort/page.
- Keep full-register export as a separate export endpoint.

### 20. Lot detail duplicates conformance work and polls heavy graphs

Evidence:

- `frontend/src/pages/lots/LotDetailPage.tsx`
- `backend/src/routes/lots/qualityRoutes.ts`
- `frontend/src/pages/lots/hooks/useItpReleasePolling.ts`
- `backend/src/routes/itp/instances.ts`

Impact:

- Initial open calls readiness and conform-status separately.
- The page then polls readiness and ITP instance graphs every 20 seconds while visible.

Recommended action:

- Consolidate readiness/conform-status.
- Invalidate after mutations instead of fixed polling, or poll a lightweight version endpoint.

### 21. Docket approvals poll nested rows every 30 seconds

Evidence:

- `frontend/src/pages/dockets/docketApprovalsData.ts`
- `backend/src/routes/dockets.ts`

Impact:

- List polling repeatedly fetches labour and plant entries when the list mostly needs totals/counts.

Recommended action:

- Split list and detail shapes.
- Return summary totals/counts from `/api/dockets`; keep entries for `/api/dockets/:id`.

### 22. Dashboard chunk imports all role dashboards

Evidence:

- `frontend/src/pages/DashboardPage.tsx`

Impact:

- `/dashboard` is route-lazy, but once loaded it pulls foreman, quality manager, project manager, and subcontractor dashboard code before role branching.

Recommended action:

- Lazy-load role dashboards behind the role branch.

## P2 - CI And Release Hardening

### 23. Full Playwright E2E does not run on PRs

Evidence:

- `.github/workflows/ci.yml` skips `Frontend E2E` when `github.event_name == 'pull_request'`.

Impact:

- A PR can pass backend/frontend/unit/readiness checks and only fail E2E after merge to `master`.

Recommended action:

- Run a targeted real-backend E2E smoke subset on PRs.
- Keep full E2E required before production deploy.

### 24. Production preflight is manual-only

Evidence:

- `.github/workflows/production-preflight.yml` is `workflow_dispatch` only.
- CI production readiness spec does not run the live preflight.

Impact:

- Green CI does not prove live production env contracts, Supabase storage, Resend, OAuth metadata, VAPID shape, or live migration status are valid.

Recommended action:

- Require a successful Production Preflight run on the exact commit before production deploy.

### 25. Production startup smoke is documented but not automated

Evidence:

- `backend/package.json` includes `smoke:production`.
- README tells operators to run it manually.

Impact:

- Broken compiled startup or production-only runtime validation can fail at deploy despite green CI.

Recommended action:

- Add production startup smoke to CI or production preflight with production-shaped non-secret env.

### 26. Workflow path filters miss production preflight changes

Evidence:

- `.github/workflows/ci.yml` treats only `.github/workflows/ci.yml` as CI-impacting workflow file.

Impact:

- A PR changing `.github/workflows/production-preflight.yml` can avoid backend/frontend validation.

Recommended action:

- Include all workflow files in CI path filters or add a workflow validation job for `.github/workflows/**`.

### 27. Frontend coverage floor is too low

Evidence:

- `frontend/vitest.config.ts` thresholds are around 8-15 percent.

Impact:

- Coverage can stay green while most changed frontend behavior is untested.

Recommended action:

- Add changed-file coverage or ratchet thresholds per domain after each coverage PR.

## Security Result

No verified security finding met the high-confidence threshold in this audit.

Areas checked:

- Secrets in tracked files and high-signal git history patterns.
- JWT/session/auth/MFA shape.
- Protected/public route boundaries.
- Upload and Supabase storage controls.
- Webhook SSRF controls and delivery bounds.
- CI trigger safety, pinned Actions, and permissions.
- Raw SQL and command execution patterns.
- XSS escape hatches such as `dangerouslySetInnerHTML`, `innerHTML`, and `document.write`.
- CORS/runtime config validation.

Strong signs:

- Production runtime config validation is fail-closed.
- GitHub Actions are SHA-pinned.
- CI blocks Prisma unsafe raw query patterns.
- Test DB safety checks exist.
- No `TODO`, `FIXME`, or `HACK` markers were found under `backend/src`, `frontend/src`, or `.github`.

Caveat:

- This is a code audit, not a formal penetration test or professional security certification.

## Recommended Fix Sequence

1. Repo settings: enable `master` branch protection and required checks.

2. Evidence preservation PR:
   account deletion must preserve ITP completions; lot deletion must block or archive once quality evidence exists.

3. NCR subcontractor workflow PR:
   responsible subcontractors must be able to respond, attach/view evidence, and rectify assigned NCRs.

4. Permission metadata/UI gating PR:
   align NCR, Test Results, and desktop Lot ITP controls with backend mutation permissions.

5. Hold-point concurrency/data-integrity PR:
   conditional in-transaction release, dedupe, and unique completion constraint.

6. Docket diary reconciliation PR:
   stop swallowing diary population failures during docket approval.

7. Shell v2 ITP/offline PR:
   evidence/witness guards, offline N/A/Fail queueing, first-photo offline flow, failed photo visibility, defect evidence inbox behavior, missing hold-point route/CTA, and shell project id resolution.

8. CI/release hardening PR:
   PR E2E smoke, production preflight gate, production startup smoke, and workflow path filters.

9. Performance/scaling series:
   server-driven lot register, hold-point register projection, batched claim readiness plus index, lot-detail polling reduction, docket list summary endpoint, and role-dashboard lazy loading.

## Bottom Line

The current codebase is not in a broken emergency state: master CI is green, the security audit did not find a high-confidence exploit, and the core architecture has solid guardrails.

It is not yet "everything works perfectly" for a broad production launch. The highest-risk remaining work is preserving construction evidence, removing confusing access-denied workflows, hardening merge/deploy gates, and fixing scale paths before real projects grow into thousands of lots and hold points.
