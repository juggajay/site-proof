# Paying User Readiness Audit Results - Agent B

Date: 2026-06-13, completed 2026-06-14 Australia/Sydney  
Auditor: Codex Agent B  
Audited commit: `origin/master` at `4f6b61b` (`Fix production preflight when secrets are missing (#870)`)

## 1. Executive Summary

This is a current `origin/master` audit. The source review and verification were run from a clean detached worktree at `C:\Users\jayso\AppData\Local\Temp\siteproof-audit-master-b`, with `HEAD == origin/master == 4f6b61b` and `git status --short --branch` reporting only `## HEAD (no branch)`.

Verdict: **Not ready** for paying construction customers.

The app has strong guardrail coverage in several areas: frontend static checks pass, production readiness guardrails pass, PR-smoke and full mocked E2E pass, and many historical launch blockers are closed. But the audit found multiple P1 issues in core paying-user workflows: public storage URLs can outlive app tokens, project/account deletion can destroy compliance evidence, subcontractors can mutate hidden ITP items by direct API, verified ITP completions can be rewritten, released hold points can be re-notified, docket totals mix hours and dollars, concurrent claims can overclaim, and NCR client notification records success without sending email.

This audit did not use production credentials, production customer data, Railway/Supabase dashboards, browser cookies, JWTs, or `.deepsec/data/**/files/**`. It was code-backed and test-backed, but it did not complete live manual browser QA against real storage/email/DB services. Because there are confirmed P1s, lack of live validation does not soften the verdict.

## 2. Launch Readiness Verdict

**Not ready.**

Reasons:

- Confirmed P1 data/evidence integrity failures exist in ITPs, hold points, dockets, claims, project deletion, account deletion, storage privacy, subcontractor access control, and NCR notification.
- Several P2 operational gates can appear green while required production checks did not actually run.
- Critical browser E2E coverage is mostly mocked UI-contract coverage, not real browser-to-backend integration.
- Live manual workflows with sacrificial data still need to verify email delivery, storage access, backups, retention, and role-specific mobile flows.

Expected next verdict after P1s are fixed: likely **Close, but not ready** until P2 operational gaps and live manual checks are closed.

## 3. Branch, Workspace, and Evidence Provenance

Clean audit worktree:

```text
Audit root: C:\Users\jayso\AppData\Local\Temp\siteproof-audit-master-b
git rev-parse --short HEAD: 4f6b61b
git rev-parse --short origin/master: 4f6b61b
git branch --show-current: <empty, detached HEAD>
git status --short --branch: ## HEAD (no branch)
```

Local main workspace was dirty and was not audited. An earlier worktree under `C:\Users\jayso\siteproof-audit-master` developed local metadata/file issues during tool execution and was abandoned for provenance. Final command evidence and subagent lanes 7-12 used the clean temp worktree above. Lanes 1-6 inspected the same commit; their results were accepted only where code refs matched the clean `4f6b61b` snapshot.

Prisma note: `prisma generate` was blocked locally by TLS certificate verification while fetching Prisma engines. The generated Prisma client was copied into ignored `node_modules` from the main checkout after confirming the Prisma schema hash and Prisma package versions matched. No DB migration, `db push`, production DB access, or destructive production command was run.

## 4. Top Blocking Issues

1. **Private evidence can become permanent public links**: Supabase-backed documents, drawings, photos, certificates, and comment attachments store/expose `/object/public/` URLs. Signed app-token expiry does not revoke the final storage URL.
2. **Compliance evidence can be destroyed**: project deletion hard-deletes project records and audit logs; account deletion deletes ITP completions.
3. **Assigned subcontractors can mutate hidden ITP checklist items**: backend write routes do not enforce the same item visibility/action filter as read routes.
4. **Verified ITP evidence can be rewritten**: primary completion POST updates verified completions without verifier revision context.
5. **Released hold points can be put back into notified state**: request-release overwrites existing released hold points.
6. **Docket totals mix hours and dollars**: approvals, PDFs, and subcontractor reports can understate or mislabel approved work.
7. **Concurrent partial claims can overclaim lots**: no serialization/lock prevents two 60% claims from both succeeding.
8. **NCR client notification is a false positive**: the endpoint marks the client notified without sending email.
9. **Production preflight can go green without checking integrations**: missing secrets on push/schedule skip live checks.
10. **CI can skip substantive jobs for production-preflight-only changes**.

## 5. Findings by Severity

### P1 Findings

**SP7-01 - P1 - Storage/evidence privacy**  
Impact: Private project files are stored and returned as permanent public Supabase object URLs. A user or external token holder can copy the final storage URL and potentially access evidence after the app signed token expires.  
Refs: `backend/src/lib/supabase.ts:51`, `backend/src/routes/documents/storage.ts:136`, `backend/src/routes/documents/fileAccessRoutes.ts:81`, `backend/src/routes/documents/publicRoutes.ts:59`, `backend/src/routes/documents/fileHelpers.ts:318`, `backend/src/routes/comments/attachmentStorage.ts:252`, `backend/src/routes/drawings/readRoutes.ts:57`, `backend/src/routes/testResults/presentation.ts:99`.  
Repro/test gap: Create a Supabase-backed document, generate a 1-minute signed URL, follow the 302, save the storage URL, then retry the storage URL after app token expiry. Existing tests assert the redirect rather than preventing it.  
Status: confirmed in code/tests; direct bucket behavior needs live storage validation.  
Fix scope: Move private customer assets to a private bucket or store paths and serve via backend/Supabase signed URLs only; stop returning raw storage URLs for private records.  
Regression test: Supabase-backed document/comment download never redirects to `/object/public/`; expired app token and raw object URL fail.

**SP11-DM-001 - P1 - Project deletion/retention**  
Impact: Admin project deletion hard-deletes projects and cascades lots, ITPs, documents, claims, dockets, and audit logs, contradicting retention expectations for contractual records.  
Refs: `backend/src/routes/projects/writeRoutes.ts:380`, `backend/src/routes/projects/writeRoutes.ts:436`, `backend/src/routes/projects/writeRoutes.ts:437`, `backend/prisma/schema.prisma:1406`, `backend/scripts/data-retention.ts:9`, `backend/scripts/data-retention.ts:402`.  
Repro/test gap: Existing sample-project tests expect deletion, not archive/preservation.  
Status: confirmed.  
Fix scope: Replace hard delete with archive/soft delete or block deletion once records exist; preserve audit logs.  
Regression test: Delete/archive a project with lots, documents, and audit logs; assert records remain retained/retrievable according to policy.

**SP11-DM-002 - P1 - Account deletion destroys QA evidence**  
Impact: Account deletion deletes `ITPCompletion` rows completed by the user even though schema user FKs can be nulled. Lots can appear incomplete after a user is removed.  
Refs: `backend/src/routes/auth/accountDeletionRoutes.ts:89`, `backend/src/routes/auth/accountDeletionRoutes.ts:111`, `backend/src/routes/auth/accountDeletionRoutes.ts:112`, `backend/prisma/schema.prisma:553`, `backend/prisma/schema.prisma:555`, `backend/src/routes/auth.test.ts:2825`.  
Repro/test gap: Account deletion tests do not assert preservation of ITP completions.  
Status: confirmed.  
Fix scope: Anonymize user references and scrub PII, but retain completion rows and attachments.  
Regression test: Create completed ITP item, delete completing account, assert completion remains with `completedById = null`.

**SUB-AC-001 - P1 - Subcontractor hidden ITP item mutation**  
Impact: A subcontractor with `canCompleteITP` can directly mutate hidden superintendent/signoff checklist items if they know the hidden `checklistItemId` or completion ID. They can submit N/A/fail/notes/attachments, and failure can raise NCRs.  
Refs: read filter `backend/src/routes/itp/instances.ts:353-360`; write access `backend/src/routes/itp/helpers/access.ts:202-230`; completion write `backend/src/routes/itp/completions.ts:188-198`, `backend/src/routes/itp/completions.ts:200-232`, `backend/src/routes/itp/completions.ts:301-360`; patch/attachment routes `backend/src/routes/itp/completionUpdateRoutes.ts:77-90`, `backend/src/routes/itp/completionAttachmentRoutes.ts:100-145`.  
Repro/test gap: Existing tests cover read hiding and disabled-module writes, not write denial for hidden items.  
Status: confirmed by code inspection.  
Fix scope: Enforce a shared subcontractor-actionable checklist predicate in create, patch, attachment, and offline completion paths.  
Regression test: Assigned subcontractor with `canCompleteITP:true` gets 403 for superintendent item completion/patch/attachment, but can complete contractor/subcontractor/general items.

**LITP-01 - P1 - Lot create with ITP template misses frozen snapshot**  
Impact: Lots created with `itpTemplateId` get an ITP instance without a frozen `templateSnapshot`; later template edits can change assigned checklists and evidence.  
Refs: `backend/src/routes/lots/createRoutes.ts:134`, `backend/src/routes/lots/createRoutes.ts:135`, `backend/src/routes/lots/createRoutes.ts:140`; canonical snapshot path `backend/src/routes/itp/instances.ts:163`, `backend/src/routes/itp/instances.ts:187`.  
Repro/test gap: POST `/api/lots` with `itpTemplateId`, inspect null snapshot, edit template, reload ITP.  
Status: confirmed.  
Fix scope: Share snapshot builder between lot create and ITP instance creation; backfill null snapshots where possible.  
Regression test: Lot-created ITP stores snapshot and remains unchanged after template edits.

**LITP-02 - P1 - Hold points/readiness use live template instead of snapshot**  
Impact: Even when an ITP instance has a snapshot, hold-point and conformance/readiness code reads live template items, so template edits can alter release gates and closeout state for assigned lots.  
Refs: `backend/src/routes/holdpoints/readRoutes.ts:121`, `backend/src/routes/holdpoints/requestReleaseRoutes.ts:79`, `backend/src/routes/holdpoints/requestReleaseRoutes.ts:110`, `backend/src/lib/conformancePrerequisites.ts:123`, `backend/src/lib/conformancePrerequisites.ts:185`; snapshot-first precedent `backend/src/routes/itp/helpers/lotProgression.ts:38`.  
Repro/test gap: Assign ITP, mutate template before signoff, compare ITP tab against hold-point/readiness routes.  
Status: confirmed.  
Fix scope: Central snapshot resolver for ITP checklist data in hold-point and conformance/readiness paths.  
Regression test: Mutated live template does not alter hold-point detail/request/readiness for existing ITP instance.

**LITP-03 - P1 - Verified ITP completions can be rewritten**  
Impact: Primary `POST /api/itp/completions` updates verified completions without verifier role or revision reason, changing status/notes/completer after verification.  
Refs: unguarded update `backend/src/routes/itp/completions.ts:321`, `backend/src/routes/itp/completions.ts:326`, `backend/src/routes/itp/completions.ts:333`; guarded notes path `backend/src/routes/itp/completionUpdateRoutes.ts:102`, `backend/src/routes/itp/completionUpdateRoutes.ts:109`.  
Repro/test gap: Seed verified completion, then POST same instance/item with `status:'failed'` or `isCompleted:false`.  
Status: confirmed.  
Fix scope: Reject status-changing POST for verified completions unless verifier revision path and reason are supplied.  
Regression test: Verified completion cannot be changed via POST without verifier revision reason.

**LITP-04 - P1 - Released hold point can be re-notified**  
Impact: `/api/holdpoints/request-release` updates an existing hold point to `status:'notified'` regardless of current status. A released hold point can be reopened/re-notified, corrupting readiness state and tokens.  
Refs: `backend/src/routes/holdpoints/requestReleaseRoutes.ts:257`, `backend/src/routes/holdpoints/requestReleaseRoutes.ts:269`, `backend/src/routes/holdpoints/requestReleaseRoutes.ts:285`; release guard exists elsewhere at `backend/src/routes/holdpoints/actionRoutes.ts:255`, `backend/src/routes/holdpoints/actionRoutes.ts:301`.  
Repro/test gap: Create released hold point, POST request-release for same lot/item, observe status becomes `notified`.  
Status: confirmed.  
Fix scope: Return conflict when existing hold point is released; add explicit resend confirmation if needed.  
Regression test: Request-release on released hold point preserves status/tokens.

**SP5-DKT-001 - P1 - Docket totals mix hours and dollars**  
Impact: Labour/plant total fields are used as both hours and cost, so approvals, PDFs, audit values, and subcontractor reporting can underreport cost or mislabel dollars as hours.  
Refs: submitted totals `backend/src/routes/dockets/entryTotals.ts:42`, `backend/src/routes/dockets/entryTotals.ts:66`; desktop approval payload `frontend/src/pages/dockets/components/DocketActionModal.tsx:51`, `frontend/src/pages/dockets/components/DocketActionModal.tsx:108`; backend approval `backend/src/routes/dockets/review.ts:80-90`; mobile one-tap `frontend/src/shell/screens/dockets/DocketDetailScreen.tsx:93-94`; fallback `backend/src/routes/dockets/approvalResponse.ts:10-20`; subcontractor report `backend/src/routes/subcontractors.ts:434-437`; PDF labels `frontend/src/lib/pdf/docketDetailPdf.ts:153-185`.  
Repro/test gap: 8h labour at $50/h can be reported as cost `8` via desktop approval, or `$400` as hours via shell approval.  
Status: confirmed.  
Fix scope: Split persisted/API fields into hour totals and cost totals; derive costs from entries; backfill existing records.  
Regression test: Approve same costed docket via desktop and shell; assert hours, cost, PDF labels, and subcontractor cost are consistent.

**SP6-P1-001 - P1 - Concurrent partial claims overclaim lots**  
Impact: Two concurrent partial claims can each read the same prior claimed percentage and create 120% total claimed value.  
Refs: `backend/src/routes/claims/workflowRoutes.ts:166`, `backend/src/routes/claims/workflowRoutes.ts:185`, `backend/src/routes/claims/workflowRoutes.ts:224`, `backend/prisma/schema.prisma:1261`.  
Repro/test gap: Existing tests cover sequential overclaim, not concurrent same-lot partial claims.  
Status: confirmed by code; needs DB concurrency regression.  
Fix scope: Lock selected lot rows or serialize cumulative updates before inserting claimed lots.  
Regression test: Two simultaneous 60% claims against one lot produce one success and one `OVER_CLAIM`.

**NCR-001 - P1 - Client notification records sent without sending email**  
Impact: `POST /api/ncrs/:id/notify-client` records `clientNotifiedAt` and returns "sent" without sending email; retries are blocked once marked.  
Refs: `backend/src/routes/ncrs/ncrClosureWorkflow.ts:219`, `backend/src/routes/ncrs/ncrClosureWorkflow.ts:231`, `backend/src/routes/ncrs/ncrClosureWorkflow.ts:292`, `backend/src/routes/ncrs/ncrClosureWorkflow.ts:309`, `backend/src/routes/ncrs/ncrWorkflowResponses.ts:18`, `frontend/src/pages/ncr/components/NotifyClientModal.tsx:61`.  
Repro/test gap: Tests cover audit metadata, not email delivery.  
Status: confirmed.  
Fix scope: Implement real delivery with failure handling before setting `clientNotifiedAt`, or rename the action to "record client notification."  
Regression test: Spy email service; failure does not mark notified and retry remains possible.

### P2 Findings

**SP9-001 / SP12-004 - P2 - Production preflight can pass while integrations are skipped**  
Impact: Push/scheduled production-preflight runs can emit warnings and skip migration, Resend, Supabase, Google, and VAPID checks when secrets are missing, yet still appear green.  
Refs: `.github/workflows/production-preflight.yml:124-133`, `.github/workflows/production-preflight.yml:138-146`, `docs/production-readiness-audit.md:34`.  
Repro/test gap: Trigger push/schedule with one required secret missing.  
Status: confirmed.  
Fix scope: Fail automatic production runs when required secrets are missing, or make the result unmistakably non-release.  
Regression test: Workflow/static test asserts missing-secret path exits nonzero for push/schedule.

**SP12-001 - P1/P2 - CI skips substantive jobs for preflight-only workflow edits**  
Impact: A PR that changes only `.github/workflows/production-preflight.yml` can skip backend/frontend jobs; the preflight workflow itself has no pull-request trigger.  
Refs: `.github/workflows/ci.yml:47`, `.github/workflows/ci.yml:53`, `.github/workflows/ci.yml:66`, `.github/workflows/ci.yml:173`, `.github/workflows/ci.yml:226`, `.github/workflows/production-preflight.yml:3`.  
Repro/test gap: PR touching only production-preflight sets backend/frontend false.  
Status: confirmed.  
Fix scope: Include workflow files in CI filters or add PR validation for preflight.  
Regression test: Guard that production-preflight changes trigger CI validation.

**HP-02 - P2 - Hold-point request email failure is swallowed**  
Impact: Request-release can return success and mark external notification state even when outbound email failed.  
Refs: DB/token commit `backend/src/routes/holdpoints/requestReleaseRoutes.ts:257-305`; email after commit `backend/src/routes/holdpoints/requestReleaseRoutes.ts:307-345`; swallowed failure `backend/src/routes/holdpoints/requestReleaseRoutes.ts:342-344`; success response `backend/src/routes/holdpoints/requestReleaseRoutes.ts:365`.  
Repro/test gap: Mock `sendHPReleaseRequestEmail` to throw.  
Status: confirmed.  
Fix scope: Return explicit degraded/non-success state or queue retry; UI must not imply email was sent.  
Regression test: Email failure does not produce a plain success state.

**HP-04 / SP11-DM-003 - P2 - Authenticated hold-point release race**  
Impact: Concurrent authenticated release requests can both pass pre-check, producing last-write-wins attribution and duplicate side effects.  
Refs: `backend/src/routes/holdpoints/actionRoutes.ts:299-301`, `backend/src/routes/holdpoints/actionRoutes.ts:309-325`, `backend/src/routes/holdpoints/actionRoutes.ts:348`; safer public token path `backend/src/routes/holdpoints.ts:282-322`.  
Repro/test gap: No concurrent authenticated release test.  
Status: confirmed static risk; runtime validation needed for exact side effects.  
Fix scope: Conditional update on unreleased state inside transaction; lock ITP instance; consider unique `[itpInstanceId, checklistItemId]`.  
Regression test: Two parallel releases yield exactly one success and one conflict, one audit, one completion.

**HP-01 - P2 - Hold-point chase creates multiple live tokens**  
Impact: Each chase can create another valid external bearer token without revoking earlier unused tokens.  
Refs: `backend/src/routes/holdpoints/actionRoutes.ts:94-113`, `backend/src/routes/holdpoints/actionRoutes.ts:154-166`; initial request does revoke stale tokens at `backend/src/routes/holdpoints/requestReleaseRoutes.ts:285-290`.  
Repro/test gap: Existing chase test only proves new link works.  
Status: confirmed.  
Fix scope: Revoke old unused token per recipient during chase.  
Regression test: Old token returns 404/410 after chase; only latest token releases.

**LITP-05 - P2 - Bulk subcontractor assignment creates view-only ITP access silently**  
Impact: Bulk assignment makes lots visible but defaults `canCompleteITP:false`; UI has no permission controls, so crews see work but cannot complete ITPs.  
Refs: `backend/src/routes/lots/validation.ts:230`, `backend/src/routes/lots/bulkMutationRoutes.ts:151`, `backend/src/routes/lots/assignmentHelpers.ts:88`, `frontend/src/pages/lots/components/BulkActionModals.tsx:142`, `frontend/src/pages/lots/hooks/useLotsActions.ts:252`, ITP requirement `backend/src/routes/itp/helpers/access.ts:212`.  
Repro/test gap: Bulk assign and attempt subbie ITP completion.  
Status: confirmed.  
Fix scope: Add bulk permission controls or explicitly label view-only assignment.  
Regression test: Bulk assignment with completion enabled lets subbie complete; default view-only is clear.

**LITP-06 - P2 - Mobile/offline ITP is partial and conflict-blind**  
Impact: Pass queues offline, but N/A/Fail/notes use online API; stale queued pass can overwrite later server changes.  
Refs: `frontend/src/pages/lots/lib/itpCompletionWrite.ts:53`, `frontend/src/pages/lots/lib/itpCompletionWrite.ts:86`, `frontend/src/pages/lots/hooks/useItpMobileActions.ts:32`, `frontend/src/pages/lots/hooks/useItpMobileActions.ts:64`, `frontend/src/pages/lots/hooks/useItpInstance.ts:312`, `frontend/src/lib/offline/syncWorker.ts:116`, `frontend/src/lib/offline/syncWorker.ts:146`, contrast lot conflicts `frontend/src/lib/offline/syncWorker.ts:622`.  
Repro/test gap: Offline N/A/Fail/notes and stale replay are not covered.  
Status: confirmed.  
Fix scope: Queue all ITP actions with base server state and conflict handling.  
Regression test: Offline N/A/Fail/notes sync; stale queued completion is blocked/conflict-marked.

**SP5-DIA-001 - P2 - Offline diary duplicate submit retry remains in error**  
Impact: If offline submit succeeds server-side but client loses response, retry sees `Cannot modify submitted diary` and remains in local error state.  
Refs: backend guard `backend/src/routes/diary/diarySubmission.ts:152`, `backend/src/routes/diary/diaryAccess.ts:102`; offline queue `frontend/src/lib/offline/diaries.ts:67-79`; stale accepted string `frontend/src/lib/offline/syncWorker.ts:189-200`, test `frontend/src/lib/offline/syncWorker.test.ts:310-327`.  
Repro/test gap: Mock retry error text `Cannot modify submitted diary`.  
Status: confirmed.  
Fix scope: Make submit idempotent or verify submitted status before treating duplicate error as hard failure.  
Regression test: Retry after already-submitted server diary clears queue.

**SP6-P2-002 / RBAC-01 - P2 - Project-scoped commercial users blocked by frontend**  
Impact: Backend allows effective project managers to claims/cost APIs, but frontend route guards use company role only, causing false Access Denied.  
Refs: `backend/src/routes/claims.ts:35`, `backend/src/lib/dashboardRole.ts:19`, `backend/src/routes/projects/readRoutes.ts:229-249`, `frontend/src/components/auth/RoleProtectedRoute.tsx:46`, `frontend/src/App.tsx:347-364`.  
Repro/test gap: Company `member` with project `project_manager` opens `/projects/:id/claims` or `/costs`.  
Status: confirmed.  
Fix scope: Add `allowProjectScopedRole` to claims/costs routes/nav or make backend company-only.  
Regression test: Project-scoped PM renders Claims/Costs page.

**NCR-002 - P2 - Mobile NCR list has no usable detail/actions**  
Impact: Mobile `/ncr` users can create NCRs but cannot inspect/respond/rectify/close from the card list; tap/swipe only sets local selected state.  
Refs: `frontend/src/pages/ncr/NCRPage.tsx:253`, `frontend/src/pages/ncr/hooks/useNCRModals.ts:37`, `frontend/src/pages/ncr/components/NCRMobileList.tsx:108`, `frontend/src/pages/ncr/components/NCRMobileList.tsx:151`.  
Repro/test gap: No `NCRMobileList` action test found.  
Status: confirmed.  
Fix scope: Wire mobile cards to detail/action sheet or route with role-aware actions.  
Regression test: Mobile tap opens details and permitted workflow buttons.

**NCR-003 - P2 - UI-used NCR closeout path lacks audit log**  
Impact: Frontend submits rectification through `/submit-for-verification`, which changes status without the audit coverage present on `/rectify`.  
Refs: `frontend/src/pages/ncr/components/RectifyNCRModal.tsx:113`, `backend/src/routes/ncrs/ncrClosureWorkflow.ts:396`, `backend/src/routes/ncrs/ncrClosureWorkflow.ts:443`, `backend/src/routes/ncrs/ncrClosureWorkflow.ts:459`, audited contrast `backend/src/routes/ncrs/ncrWorkflow.ts:355`.  
Repro/test gap: Audit tests cover `/rectify`, not UI-used endpoint.  
Status: confirmed.  
Fix scope: Audit `/submit-for-verification` or remove duplicate route.  
Regression test: UI-used endpoint writes `NCR_STATUS_CHANGED` audit metadata.

**NCR-004 - P2 - NCR PDF/report omits real workflow/evidence context**  
Impact: Exported NCRs can omit responsible subcontractor, real root cause/corrective action/evidence links, and closeout context.  
Refs: `frontend/src/pages/ncr/components/NCRTable.tsx:55`, `frontend/src/pages/ncr/components/NCRTable.tsx:67`, `frontend/src/lib/pdf/ncrDetailPdf.ts:109`, `frontend/src/lib/pdf/ncrDetailPdf.ts:152`, `frontend/src/lib/pdf/types.ts:360`, current data `frontend/src/pages/ncr/types.ts:17`.  
Repro/test gap: Characterization fixture uses legacy fields.  
Status: confirmed.  
Fix scope: Map current API fields and fetch detail/evidence before generating.  
Regression test: PDF fixture includes subcontractor, corrective action, verification notes, and evidence links.

**NCR-005 - P2 - NCR frontend shows actions users cannot perform**  
Impact: Desktop workflow buttons are status-based, not permission-based, so viewers/non-responsible users get backend rejections.  
Refs: `frontend/src/pages/ncr/components/NCRTable.tsx:299`, `frontend/src/pages/ncr/components/NCRTable.tsx:366`, `frontend/src/pages/ncr/components/NCRTable.tsx:393`, `frontend/src/pages/ncr/components/NCRTable.tsx:413`; backend denial tests `backend/src/routes/ncrs.test.ts:2329`, `backend/src/routes/ncrs.test.ts:2408`.  
Repro/test gap: Component tests do not cover role-specific visibility.  
Status: confirmed.  
Fix scope: Centralize frontend NCR permission predicates matching backend.  
Regression test: Role matrix action visibility for viewer, foreman, assignee, PM/QM.

**NCR-006 - P2 - NCR reassignment has no audit trail**  
Impact: User/subcontractor responsibility changes are not traceable in compliance history.  
Refs: `backend/src/routes/ncrs/ncrCore.ts:433`, `backend/src/routes/ncrs/ncrCore.ts:576`, `backend/src/routes/ncrs/ncrCore.ts:591`, audit action list `backend/src/lib/auditLog.ts:157`.  
Repro/test gap: Assignment tests cover notifications/state, not audit.  
Status: confirmed.  
Fix scope: Add `NCR_ASSIGNMENT_CHANGED` audit action with old/new metadata.  
Regression test: Patch user-to-user, user-to-subcontractor, and clear assignment; assert audit entries.

**F10-001 - P1/P2 - Subcontractor mobile `/p` drops selected project**  
Impact: After a subcontractor selects a non-default project, many mobile hub CTAs omit `projectId`, so time/dockets/work/docs can reopen against the backend default project.  
Refs: `frontend/src/shell/subbie/subbieShellData.ts:68`, `frontend/src/shell/subbie/subbieShellData.ts:74-79`, `frontend/src/shell/subbie/subbieShellData.ts:91-92`, `frontend/src/shell/subbie/screens/HomeScreen.tsx:320-335`, missing query links `frontend/src/shell/subbie/screens/HomeScreen.tsx:351-353`, `:381`, `:390`, `:403`, `:415`, `:426`, `:437`, `:448`, `:459`, `:469`; docket read `frontend/src/shell/subbie/screens/dockets/DocketScreen.tsx:85`, `:102`, `:105`, `:110`.  
Repro/test gap: Existing Home test starts only at `/p`.  
Status: confirmed from source; needs live mobile validation.  
Fix scope: Preserve selected project in all `/p` navigation or shell state.  
Regression test: `/p?projectId=p2` CTA matrix preserves `projectId=p2`.

**F10-002 - P2 - Mobile nav ignores enabled module flags**  
Impact: Mobile users can see/tap disabled modules that desktop hides.  
Refs: desktop filter `frontend/src/components/layouts/Sidebar.tsx:152-159`, `:209-226`, `:292-299`; mobile items `frontend/src/components/layouts/MobileNav.tsx:89-103`, role-only filter `:155-175`, render `:253-278`.  
Repro/test gap: Disable `costTracking`, `dockets`, or `dailyDiary`; mobile still shows links.  
Status: confirmed.  
Fix scope: Share module-filtering logic with MobileNav.  
Regression test: Mobile drawer hides disabled Costs, Docket Approvals, Daily Diary.

**F10-003 - P2 - Linked portal identities get internal mobile nav**  
Impact: Linked portal users on mobile see head-contractor Dashboard/Projects/Lots navigation instead of portal-first navigation.  
Refs: portal identity helper `frontend/src/lib/subcontractorIdentity.ts:42-47`; MobileNav computes but does not use `hasPortalIdentity` for nav selection `frontend/src/components/layouts/MobileNav.tsx:147-152`, `:253-254`, `:313`; desktop hides project nav at `frontend/src/components/layouts/Sidebar.tsx:390-391`.  
Repro/test gap: Linked portal member fixture at mobile width.  
Status: confirmed source mismatch.  
Fix scope: Treat `hasPortalIdentity` like subcontractor for mobile nav.  
Regression test: Linked portal member sees Docket/Home/My Company and no Projects section.

**SP12-002 - P2 - Backend readiness guards run only in frontend job**  
Impact: Backend-only PRs skip backend-facing readiness guards covering runtime config, diagnostic endpoints, Docker/readiness, logging, uploads, fetch timeouts, and runtime IDs.  
Refs: `.github/workflows/ci.yml:53`, `.github/workflows/ci.yml:173`, `.github/workflows/ci.yml:214`, `frontend/e2e/productionReadiness.spec.ts:860`, `:1348`, `:1500`, `:1735`.  
Repro/test gap: Backend-only PR sets frontend false, so `npm run test:readiness` is skipped.  
Status: confirmed.  
Fix scope: Split static readiness into its own CI job or run when backend/frontend/workflow changes.  
Regression test: CI condition includes backend/preflight paths.

**SP12-003 - P2 - Full E2E is mocked UI-contract coverage**  
Impact: Browser tests seed/start backend but specs mock APIs; API/schema/auth integration regressions are not exercised by Playwright.  
Refs: `.github/workflows/ci.yml:287`, `.github/workflows/ci.yml:323`, `frontend/e2e/helpers.ts:17`, `frontend/e2e/helpers.ts:30`, `frontend/e2e/projects.spec.ts:93`, `frontend/e2e/projects.spec.ts:110`, `frontend/e2e/lot-detail.spec.ts:140`, `frontend/e2e/lot-detail.spec.ts:164`.  
Repro/test gap: No real-login helper usage found; only six `@pr-smoke` titles.  
Status: confirmed.  
Fix scope: Add small live-backend Playwright smoke with no API mocks.  
Regression test: `@integration-smoke` login and one critical create/read path against seeded backend.

### P3 / Lower-Severity Confirmed and Suspected Findings

- **AUTH-01 - P3 - Logout is client-side only**: `POST /api/auth/logout` does not revoke current JWT (`backend/src/routes/auth/sessionRoutes.ts:58-62`; JWT 24h at `backend/src/lib/auth.ts:137-139`). Add current-session revocation test.
- **MFA-01 - P3 - Public MFA verifier**: `/api/mfa/verify` is an unauthenticated TOTP oracle for known user IDs (`backend/src/routes/mfa.ts:323-383`; test asserts no auth at `backend/src/routes/mfa.test.ts:656-674`). Require password-bound challenge token.
- **AUTH-02 - P3 - Magic link clears password reset tokens**: magic-link request deletes all `passwordResetToken` rows for that user (`backend/src/routes/auth/magicLinkRoutes.ts:79-83`). Separate token purposes.
- **SP6-P2-003 - P2/P3 - Draft claim deletion lacks audit**: draft deletion resets lots and deletes claim without audit (`backend/src/routes/claims/postEvidenceWorkflowRoutes.ts:489`, `:520`; audit list `backend/src/lib/auditLog.ts:191`). Add `CLAIM_DELETED`.
- **SP6-P3-004 - P3 - Claim evidence maps 0% as 100%**: `percentageComplete || 100` (`backend/src/routes/claims/evidenceRoutes.ts:166`). Use nullish fallback.
- **SP6-P3-005 - P3 - $0 certified amount hides variance**: truthy `certifiedAmount` check (`backend/src/routes/reports/claimRoutes.ts:190`). Use nullish checks.
- **SP9-002 - P3 - Preflight secret list mismatches runtime**: workflow requires `API_URL` and Google OAuth even when runtime accepts `BACKEND_URL` or OAuth disabled (`.github/workflows/production-preflight.yml:113-122`, `backend/src/lib/runtimeConfig.ts:57-69`, `:278-285`).
- **SP9-003 - P3 - Error monitoring endpoint not validated at startup/preflight**: lazy validation only on 500 logging (`backend/src/middleware/errorHandler.ts:198-218`, `:295-305`; `backend/scripts/preflight-production-integrations.ts:281-287`).
- **SP9-004 - P2/P3 - Backup/retention not scheduled in repo**: manual scripts exist but no scheduled backup/restore drill; Docker image lacks `pg_dump`/`pg_restore` (`backend/scripts/backup.ts:147-180`, `backend/scripts/data-retention.ts:339-447`, `backend/Dockerfile:6-8`).
- **SP11-DM-004 - P2/P3 - Drawing revision uniqueness is preflight only**: index not unique (`backend/prisma/schema.prisma:1346`, `:1364`; `backend/src/routes/drawings.ts:98`, `:135`, `:314`, `:357`). Add DB uniqueness/idempotency.
- **SP11-DM-005 - P3 - ITP evidence attachment duplicate race**: no unique `(completionId, documentId)` (`backend/prisma/schema.prisma:566`; routes `backend/src/routes/itp/completionAttachmentRoutes.ts:247`, `:263`; `backend/src/routes/documents/itpEvidenceAttachment.ts:137`, `:141`).
- **SP7-02 - P3 - Document image preview object URL can leak on unmount**: object URL revoked only on image load/error (`frontend/src/pages/documents/useDocumentUpload.ts:101`, `:103`, `:111`). Add cleanup ref.
- **SP7-03 - P3 - PDF filenames are not consistently sanitized**: `doc.save(...)` uses business identifiers in several PDF generators (`frontend/src/lib/pdf/claimEvidencePackagePdf.ts:466`, `conformanceReportPdf.ts:546`, `dailyDiaryPdf.ts:468`, `docketDetailPdf.ts:299`, `holdPointEvidencePdf.ts:401`, `testCertificatePdf.ts:232`, `ncrDetailPdf.ts:289`).
- **SP7-04 - P3 - Office/email/text MIME spoofing relies on declared type**: allowed types plus early return for unknown signatures (`backend/src/routes/documents/fileHelpers.ts:26`, `backend/src/routes/comments/attachmentStorage.ts:22`, `backend/src/lib/imageValidation.ts:224`).
- **F10-004 - P3 - PM admin route/nav mismatch**: PM can direct-open admin routes but primary nav hides them (`frontend/src/appRouteRoles.ts:1`, `frontend/src/App.tsx:198-204`, `:410-417`, `:434-441`, `frontend/src/lib/roles.ts:49-53`, `frontend/src/components/layouts/Sidebar.tsx:96-100`, `:132-133`, `:241`, `:252-254`).

## 6. Workflow Coverage Matrix

| Workflow | Audit coverage | Status |
| --- | --- | --- |
| Project setup and deletion | Source audit plus tests/static checks | Blocked by P1 hard-delete retention issue |
| Lot creation, ITP attachment, closeout | Source audit | Blocked by P1 snapshot/live-template and verified-completion issues |
| Hold-point release and external email links | Source audit plus readiness guards | Blocked by re-notify, token, email-failure, release-race issues |
| Subcontractor portal and assignments | Source audit plus E2E pass | Blocked by hidden ITP write issue and mobile project selection issue |
| NCR lifecycle | Source audit plus targeted pure tests from subagent | Blocked by false client notification; P2 audit/UX/report gaps |
| Dockets and diary | Source audit plus E2E pass | Blocked by P1 total field semantics; P2 offline retry |
| Claims/commercial | Source audit plus targeted tests | Blocked by concurrent overclaim and frontend RBAC mismatch |
| Documents/drawings/photos/storage | Source audit plus targeted tests | Blocked by public raw storage URL exposure |
| Auth/MFA/session | Source audit | No P1 found; P3 session/MFA hardening remains |
| CI/preflight | Source audit plus readiness run | P1/P2 gaps in workflow path detection and preflight missing-secret behavior |
| Frontend mobile/navigation | Source audit plus full mocked E2E | P1/P2 mobile project/nav defects need live validation |

## 7. Role and Permission Matrix

| Role | Expected access | Audit result |
| --- | --- | --- |
| Owner/admin | Full company/project administration | Can hard-delete project evidence; fix retention before paying users |
| Project manager | Project/commercial workflows | Backend may allow project-scoped commercial access while frontend blocks it |
| Site manager/foreman | Field workflows, ITP, diary, dockets, NCRs | Mobile/offline ITP and NCR mobile actions are incomplete |
| Subcontractor | Assigned work, permitted ITP/docket/NCR/document views | Can mutate hidden ITP items by direct API; mobile `/p` may lose selected project |
| External superintendent/token user | Hold-point release and evidence package only | Multiple live tokens, email-failure false success, and public raw storage URLs weaken boundary |
| Unauthenticated user | Public auth/invite/token routes only | MFA verifier and token expiry tests need hardening; no direct P1 found in auth source audit |

## 8. External Integration Matrix

| Integration | Current evidence | Risk |
| --- | --- | --- |
| Railway Postgres | Runtime/preflight source inspected; no live DB access | Production DB URL validation and backup/PITR proof need live/manual confirmation |
| Supabase Storage | Source/tests inspected | P1: private evidence stored/exposed as public permanent URLs |
| Resend email | Source/tests inspected | Hold-point email failures swallowed; NCR client email not sent |
| Google OAuth | Runtime/preflight inspected | Workflow requires secrets even when OAuth may be intentionally disabled |
| VAPID/push | Readiness guards pass | Manual production config validation still required |
| Error monitoring webhook | Source inspected | Endpoint not validated at startup/preflight; external visibility not guaranteed |
| Backups/retention | Manual scripts inspected | No scheduled backup/restore drill proven by repo |

## 9. Test/Command Evidence

Clean temp worktree command evidence:

```text
git fetch origin master: completed
git rev-parse --short HEAD: 4f6b61b
git rev-parse --short origin/master: 4f6b61b
git branch --show-current: <empty>
git status --short --branch: ## HEAD (no branch)
```

Backend:

- `npm ci --no-audit --no-fund`: passed.
- `npm run format:check`: passed.
- `npm run type-check`: passed after generated Prisma client workaround.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm test`: not completed as a full suite. Without a safe disposable `DATABASE_URL`, DB-backed tests fail on missing DB env; an earlier full run timed out and was stopped. Targeted pure/backend tests were run by subagents:
  - Claims workflow/presentation: 42 passed.
  - NCR validation/response tests: 28 passed.
  - Runtime/email/supabase/error/preflight/backup/retention tests: 53 passed.
  - Storage/upload/static tests: 49 passed across the reported groups.

Frontend:

- `npm ci --no-audit --no-fund`: passed.
- `npm run format:check`: passed.
- `npm run type-check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run test:coverage`: 260 files passed, 2,349 tests passed; coverage statements 42.91%, branches 38.27%, functions 39.12%, lines 43.52%. Warnings: nested `vi.mock("@/hooks/useMediaQuery")` in `NCRActionModals.test.tsx`; jsdom canvas `getContext()` not implemented warnings.
- `npm run test:readiness`: 87 passed.
- `npx playwright test --grep '@pr-smoke'`: 6 passed.
- `npm run test:e2e`: 316 passed. This suite is primarily mocked UI-contract coverage.

Advisory code intelligence:

- `fallow audit --base origin/master --format json --quiet`: pass, changed files count 0, no new dead code/complexity/duplication.

## 10. Creative/Adversarial Audit Results

Abuse-case role matrix:

- Confirmed subcontractor direct API abuse against hidden superintendent ITP items.
- Confirmed frontend/backend commercial RBAC mismatch for project-scoped PMs.
- Confirmed mobile linked portal identity gets internal nav.

State-machine breakage:

- Verified ITP completions can be rewritten through primary POST.
- Released hold points can be returned to `notified`.
- Authenticated hold-point release has a race.
- Concurrent partial claims can overclaim.

Time/expiry attacks:

- Hold-point chase creates multiple live tokens.
- Raw storage URLs can outlive app signed-token expiry.
- Expired hold-point token backend coverage is a test gap.

Link/evidence chain:

- Public Supabase object URLs are the largest evidence-chain risk.
- Conformance report omits secure-link hold-point release attribution.
- NCR PDFs omit live evidence/responsibility context.

Offline/retry chaos:

- ITP offline support is partial and conflict-blind.
- Diary duplicate submit retry can remain in error.
- Offline NCR capture likely saves photos without queued NCR creation.

Input/boundary:

- PDF filenames need central sanitizer.
- Office/email/text MIME spoofing needs stronger validation or attachment-only serving.
- `$0` and `0%` commercial values have truthy/fallback bugs.

Production chaos:

- Preflight can pass without secrets and skip live checks.
- Backend readiness guards can be skipped by backend-only PRs.
- Backups/restore are not proven by repo automation.

## 11. Fix Plan, PR-Sized Batches

**Batch 1 - Evidence privacy blocker**

- Move private customer files away from raw public URLs or serve via backend/private signed URLs.
- Stop exposing raw file URLs in document/drawing/test result/comment/hold-point evidence payloads.
- Add token-expiry/raw-url regression tests.

**Batch 2 - ITP and hold-point integrity**

- Snapshot lot-created ITP instances.
- Make hold-point/readiness/conformance resolve checklist from snapshots.
- Block verified completion rewrites outside revision flow.
- Block request-release on released hold points.
- Add hidden-subbie-item write denial tests.

**Batch 3 - Retention and destructive workflow safety**

- Replace project hard delete with archive/blocking policy.
- Preserve ITP completions on account deletion.
- Add retention/audit preservation tests.

**Batch 4 - Docket and claim financial correctness**

- Split docket hours and cost totals; backfill/migrate carefully.
- Serialize/lock claim cumulative percentage creation.
- Fix 0% and $0 truthy bugs.

**Batch 5 - Notification truthfulness**

- Implement or rename NCR client notification.
- Make hold-point request-release email failures explicit/retryable.
- Add delivery failure tests.

**Batch 6 - Mobile and frontend permission UX**

- Preserve `/p?projectId=...` across subcontractor mobile navigation.
- Apply module flags in MobileNav.
- Treat linked portal identity as portal user in mobile nav.
- Align claims/cost route guards with backend project-scoped access.
- Add role/nav parity tests.

**Batch 7 - CI/preflight hardening**

- Make workflow/preflight-only changes trigger substantive validation.
- Run readiness guards on backend/workflow changes.
- Fail automatic production preflight when secrets are missing.
- Add small real backend Playwright integration smoke.

**Batch 8 - P3 hardening**

- Current-session logout revocation.
- MFA verifier challenge token.
- Magic-link/password-reset token separation.
- Error monitoring startup/preflight validation.
- Scheduled backup/restore drill documentation or automation.
- MIME/filename/object URL cleanup tests.

## 12. Residual Risks and Required Manual Checks

Required before any paying customer:

- Live sacrificial-data browser run for owner/admin, PM/QM, foreman, subcontractor, and external superintendent.
- Real Supabase storage validation: copied raw URLs after app token expiry, private bucket policy, delete/replacement cleanup.
- Real Resend email validation: hold-point request/chase/release and NCR client notification after fixes.
- Real Railway operational validation: start command/predeploy command blank, backup/PITR enabled, restore drill documented, migration status checked safely.
- Manual mobile QA for `/p`, `/m`, NCR, ITP, diary, dockets, and documents on narrow viewport with poor-network simulation.
- Real browser console/pageerror fixture on at least one smoke per role.
- DB-backed backend test run against a disposable local Postgres database, never production.

Final recommendation: **Not ready** until the P1 blockers above are fixed and verified. After that, run a live sacrificial-data launch rehearsal and re-audit P2 operational risks before considering a limited pilot.
