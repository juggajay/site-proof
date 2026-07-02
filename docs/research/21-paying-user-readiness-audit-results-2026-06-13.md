# Paying User Readiness Audit Results

Date: 2026-06-13

Scope: report-only audit of the current dirty workspace on branch
`perf/audit-2026-06-10` at `25557e4`. The audit used twelve read-only lanes
plus local command evidence. No source fixes were made. Production credentials,
browser-session data, database URLs, keys, cookies, and `.deepsec/data/**/files/**`
were not inspected or printed.

Important limitation: this is not a clean `origin/master` certification. The
workspace already had substantial modified and untracked files when the audit
started, and several local gates currently fail on that branch.

## 1. Executive Summary

SiteProof is not ready for paying construction customers.

The strongest blockers are not cosmetic. They hit evidence privacy, field QA
workflow correctness, subcontractor permissions, auth token safety, operational
guardrails, and test confidence. Two confirmed P0 issues mean copied Supabase
object URLs can bypass app-level signed URL expiry and authorization for
documents, drawings, test certificates, and comment attachments. Multiple P1
issues can corrupt or stall critical workflows: subcontractors can mutate hidden
ITP checklist items, mobile/offline ITP flows can mark unreleased hold points
complete locally, NCR and docket workflows have permission/race gaps, hold-point
emails can fail silently, and one-time auth links are not consumed atomically.

The product has meaningful readiness work already in place: production runtime
config validation, backend coverage gates, frontend source guardrails, sanitized
logging patterns, Supabase origin checks, and CI that runs build/lint/type/unit
and full Playwright. Those are not enough for launch because the current branch
has failing readiness checks, unverified full E2E, many mocked E2E flows, and
several server-side gaps in workflows that paying users would rely on daily.

## 2. Launch Readiness Verdict

Verdict: `Not ready`.

Reasons:

- Confirmed P0 public-object URL bypasses for evidence/document access.
- Multiple confirmed P1 blockers in ITP, hold point, NCR, docket, claims, auth,
  storage cleanup, project retention, email readiness, and E2E confidence.
- Required manual browser journeys were not completed.
- Local gates are not clean: format checks fail, production readiness guardrails
  fail 2 tests, full E2E timed out, and the requested `@pr-smoke` grep finds no
  tests.
- Production preflight exists but is manual-only in the repo and can skip
  email, OAuth, and push conditions depending on env.

The realistic next milestone is a limited internal pilot only after the P0
storage privacy work and the top P1 workflow blockers are fixed, regression
tested, and manually verified with sacrificial users.

## 3. Top Blocking Issues

1. Public Supabase object URLs bypass signed app access.
   Documents, drawings, test certificates, and comment attachments can expose
   permanent public URLs. Signed URL expiry and app authorization protect only
   the first hop when the backend redirects to public storage.

2. ITP and hold-point flows can record misleading or unauthorized QA state.
   Subcontractors can write hidden checklist items by ID, and mobile/offline
   PASS actions can mark unreleased hold points complete locally before sync
   failure.

3. External evidence workflows are unreliable and over-broad.
   Hold-point release emails can fail after tokens are created while the UI sees
   success, and public evidence packages can include unrelated same-lot evidence
   plus raw file URLs.

4. Subcontractor NCR and docket flows are not launch-safe.
   Assigned subcontractors can read NCRs but cannot complete the response,
   evidence, or verification loop; docket review/create routes have concurrency
   and duplicate-submission gaps.

5. Auth and operational controls are under-proven.
   One-time auth tokens are vulnerable to concurrent reuse, normal logout does
   not revoke copied JWTs, production can be configured with email disabled,
   monitoring is a no-op, backup/retention guardrails need hardening, and full
   E2E is largely mocked.

## 4. Findings by Severity

### P0

#### SP-L7-001 - P0 - Document/drawing/test-certificate signed URL bypass

- Affected workflow: document, drawing, and test-certificate download via signed
  URLs.
- Impact: A signed URL can redirect to a permanent public Supabase object URL.
  Anyone who captures that `Location` can keep using it after app token expiry
  or access revocation until the object is deleted.
- Evidence: `backend/src/lib/supabase.ts:51`, `backend/src/routes/documents/storage.ts:117`,
  `backend/src/routes/documents/fileHelpers.ts:294`, `backend/src/routes/documents/fileHelpers.ts:318`,
  `backend/src/routes/documents/publicRoutes.ts:71`, `frontend/src/lib/documentAccess.ts:121`,
  `frontend/src/pages/documents/DocumentsPage.tsx:296`, `frontend/src/pages/drawings/DrawingsPage.tsx:368`.
- Repro/test gap: Create a Supabase-backed document, request a 1-minute signed
  URL, fetch it as an attachment, capture the 302 location, wait for expiry,
  then fetch the captured Supabase URL directly.
- Status: confirmed.
- Suggested fix scope: Stop exposing public object URLs for controlled files.
  Stream downloads through the backend or move the bucket/private paths behind
  server-issued storage signed URLs after auth/token validation.
- Suggested regression test: Expired app signed URLs cannot be bypassed with a
  previously captured storage URL, and download responses do not 302 to public
  Supabase for protected content.

#### SP-L7-002 - P0 - Comment attachments expose public storage URLs

- Affected workflow: comment attachment upload/download.
- Impact: Comment attachment DTOs return public Supabase URLs and the frontend
  opens them directly, bypassing backend auth/download mediation for anyone who
  copies the URL.
- Evidence: `backend/src/routes/comments/attachmentStorage.ts:85`,
  `backend/src/routes/comments/selects.ts:10`,
  `frontend/src/components/comments/commentsSectionHelpers.ts:33`,
  `frontend/src/components/comments/CommentsSection.tsx:323`.
- Repro/test gap: Upload a comment attachment, inspect the comment payload or
  click the attachment, copy the Supabase URL, then access it outside the app
  session.
- Status: confirmed.
- Suggested fix scope: Return attachment IDs or API download URLs, stream bytes
  from an authenticated comments attachment route, and keep raw storage URLs out
  of client payloads.
- Suggested regression test: Comment attachment payloads contain no raw
  Supabase URLs, download uses an authenticated API route with safe headers, and
  direct object URL access is not part of the customer-facing contract.

### P1

#### L1-ITP-001 - P1 - Hidden ITP checklist items are writable by subcontractors

- Affected workflow: subcontractor ITP completion and evidence.
- Impact: A completion-enabled subcontractor can mutate or attach evidence to
  checklist items hidden from their view if they know item/completion IDs,
  including superintendent or witness items.
- Evidence: `backend/src/routes/itp/instances.ts:339`,
  `backend/src/routes/itp/completions.ts:161`,
  `backend/src/routes/itp/helpers/access.ts:202`,
  `backend/src/routes/itp/completionAttachmentRoutes.ts:136`.
- Repro/test gap: Create a subcontractor assignment with `canCompleteITP=true`,
  confirm GET hides a superintendent/witness item, then POST completion or
  upload evidence using the hidden item ID.
- Status: confirmed.
- Suggested fix scope: Add a shared server-side item-writable guard matching
  read visibility rules and apply it to completion create/update and attachment
  routes.
- Suggested regression test: Hidden subcontractor-view items are absent from GET
  and return 403 for completion, notes update, and evidence upload.

#### L1-ITP-002 - P1 - Mobile/offline hold-point gating is inconsistent

- Affected workflow: mobile ITP hold-point PASS flow.
- Impact: Desktop disables unreleased hold-point rows, but mobile PASS controls
  do not. Offline can show false local completion until sync rejects.
- Evidence: `frontend/src/pages/lots/components/ITPChecklistItemRow.tsx:51`,
  `frontend/src/components/foreman/MobileITPChecklist.tsx:180`,
  `frontend/src/components/foreman/MobileITPItemSheet.tsx:112`,
  `frontend/src/pages/lots/hooks/useItpInstance.ts:300`,
  `backend/src/routes/itp/completions.ts:199`.
- Repro/test gap: On mobile/offline, open an unreleased hold point and tap PASS.
- Status: confirmed.
- Suggested fix scope: Mirror desktop hold-point lock logic in mobile checklist
  and item sheet, block offline queueing for unreleased hold points, and roll
  back sync rejections.
- Suggested regression test: Mobile online/offline PASS is disabled until hold
  point release.

#### L1-ITP-003 - P1 - Offline ITP support is incomplete and conflict-prone

- Affected workflow: offline/mobile ITP actions.
- Impact: Pass/unpass are partially queued, but N/A, fail, comments, and
  evidence are direct calls or incomplete payloads. Failed offline sync lacks
  backend-required NCR description and has no stale conflict handling.
- Evidence: `frontend/src/pages/lots/hooks/useItpInstance.ts:266`,
  `frontend/src/pages/lots/hooks/useItpMobileActions.ts:23`,
  `frontend/src/pages/lots/hooks/useItpCompletionActions.ts:129`,
  `frontend/src/lib/offline/syncWorker.ts:102`,
  `backend/src/routes/itp/completionWorkflow.ts:36`.
- Repro/test gap: Go offline and attempt N/A, fail, comments, or photo evidence,
  then reload/reconnect and verify persistence.
- Status: confirmed.
- Suggested fix scope: Either disable unsupported offline actions explicitly or
  implement durable payloads for N/A/fail/comments/evidence with conflict
  detection.
- Suggested regression test: Sync worker tests for N/A, fail with NCR
  description, notes, evidence, and stale server conflict handling.

#### L2-HP-001 - P1 - Hold-point email delivery can fail silently

- Affected workflow: external superintendent release request email.
- Impact: If email sending fails, the API still returns success after creating
  hashed tokens and marking the hold point notified, leaving no usable raw link
  for the external reviewer.
- Evidence: `backend/src/routes/holdpoints/requestReleaseRoutes.ts:256`,
  `backend/src/routes/holdpoints/requestReleaseRoutes.ts:284`,
  `backend/src/routes/holdpoints/requestReleaseRoutes.ts:320`,
  `frontend/src/pages/holdpoints/HoldPointsPage.tsx:292`.
- Repro/test gap: Mock `sendHPReleaseRequestEmail` to throw during
  `POST /api/holdpoints/request-release`; current code catches and returns
  success.
- Status: confirmed.
- Suggested fix scope: Return explicit delivery status/failure, avoid marking
  notified on zero successful sends, and revoke newly generated inaccessible
  tokens on failure.
- Suggested regression test: Email failure yields non-success or
  `deliveryStatus=failed`, no notified state, and no orphaned raw-linkless
  tokens.

#### L2-HP-002 - P1 - Public hold-point evidence package over-shares evidence

- Affected workflow: public hold-point evidence package.
- Impact: Public token API includes every same-lot `photo` or `itp_evidence`
  document, not just evidence relevant to the hold point, and exposes raw
  `fileUrl` values.
- Evidence: `backend/src/routes/holdpoints.ts:108`,
  `backend/src/routes/holdpoints/evidencePackage.ts:115`,
  `backend/src/routes/holdpoints/evidencePackage.ts:142`,
  `backend/src/routes/holdpoints/readRoutes.ts:287`.
- Repro/test gap: Create a lot with a hold point and later unrelated evidence,
  then call `GET /api/holdpoints/public/:token`.
- Status: confirmed.
- Suggested fix scope: Define evidence-package scope, filter to relevant
  attachments/photos, and issue per-document mediated links instead of raw URLs.
- Suggested regression test: Public package excludes unrelated evidence and raw
  storage URLs.

#### SP-AC-02 - P1 - ITP portal switch can produce guaranteed 403s

- Affected workflow: subcontractor portal module access.
- Impact: `itps=true,lots=false` is a valid frontend state, but backend lot APIs
  used by ITP pages still require `lots`, so users are shown ITP access and
  receive 403s.
- Evidence: `frontend/src/pages/subcontractor-portal/portalAccessModel.ts:1`,
  `frontend/src/pages/subcontractor-portal/SubcontractorITPsPage.tsx:95`,
  `frontend/src/pages/subcontractor-portal/SubcontractorLotITPPage.tsx:48`,
  `backend/src/routes/lots/access.ts:23`,
  `backend/src/routes/lots/readRoutes.ts:118`.
- Repro/test gap: Set `portalAccess={ lots:false, itps:true }`, then open
  `/subcontractor-portal/itps` or call lots API with `portalModule=itps`.
- Status: confirmed.
- Suggested fix scope: Either let `portalModule=itps` require only ITP access
  plus assigned-lot scope, or make `itps` dependent on `lots` in product/UI.
- Suggested regression test: Module matrix for `lots=false,itps=true` and
  direct assigned/unassigned ITP routes.

#### NCR-L4-001 - P1 - Assigned subcontractors cannot complete NCR response loop

- Affected workflow: NCR responsible subcontractor response/evidence/verification.
- Impact: Responsible subcontractors can read assigned NCRs but cannot respond,
  upload/list/delete evidence, rectify, or submit for verification, stalling
  the workflow.
- Evidence: `backend/src/routes/ncrs/ncrAccess.ts:96`,
  `backend/src/routes/ncrs/ncrEvidence.ts:127`,
  `backend/src/routes/ncrs/ncrWorkflow.ts:56`,
  `backend/src/routes/ncrs/ncrClosureWorkflow.ts:421`,
  `frontend/src/pages/subcontractor-portal/SubcontractorNCRsPage.tsx:180`.
- Repro/test gap: Create NCR with `responsibleSubcontractorId`, enable NCR
  portal access, then POST response/evidence/submit as that subcontractor.
- Status: confirmed.
- Suggested fix scope: Add responsible subcontractor authorization with portal
  access and company/lot scoping, then expose portal actions.
- Suggested regression test: Assigned subcontractor can respond/upload/submit
  only its NCR; unrelated or portal-disabled subcontractors remain 403.

#### NCR-L4-002 - P1 - Foreman defect photo is uploaded but not linked to NCR evidence

- Affected workflow: foreman mobile defect capture and offline sync.
- Impact: A defect photo can be uploaded as a document but not linked as
  `NCREvidence`, so verification/reporting can miss the image.
- Evidence: `frontend/src/components/foreman/CaptureModal.tsx:123`,
  `frontend/src/lib/offline/syncWorker.ts:274`,
  `frontend/src/lib/offline/syncWorker.ts:293`,
  `backend/src/routes/documents/uploadRoutes.ts:111`.
- Repro/test gap: Save a defect photo, sync, and observe no
  `/api/ncrs/:id/evidence` call or `NCREvidence` row.
- Status: confirmed.
- Suggested fix scope: Link NCR evidence transactionally on upload or enqueue a
  retry-safe NCR evidence creation step after upload.
- Suggested regression test: Offline NCR photo sync uploads plus creates
  `NCREvidence`, and retries safely if linking fails.

#### NCR-L4-003 - P1 - Client notification is recorded without sending

- Affected workflow: client-notifiable NCRs.
- Impact: UI says client notification sent, but backend only records
  `clientNotifiedAt` and audit metadata; no email/notification service is
  called.
- Evidence: `backend/src/routes/ncrs/ncrClosureWorkflow.ts:219`,
  `backend/src/routes/ncrs/ncrClosureWorkflow.ts:275`,
  `frontend/src/pages/ncr/components/NotifyClientModal.tsx:47`.
- Repro/test gap: Call `/notify-client` with a recipient email; timestamp is
  set with no mailer/queue call.
- Status: confirmed.
- Suggested fix scope: Send the NCR client notification before setting
  timestamp, or clearly separate manual-record mode from email-send mode.
- Suggested regression test: Mocked mailer is called; send failure prevents
  timestamp; blank email records manual notification only.

#### NCR-L4-004 - P1 - Major concession closeout lacks server-side validation

- Affected workflow: NCR closeout with concession/client approval.
- Impact: Direct API can close a major NCR with concession without concession
  justification, risk assessment, or persisted client approval reference.
- Evidence: `backend/src/routes/ncrs/ncrWorkflowValidation.ts:75`,
  `backend/src/routes/ncrs/ncrClosureWorkflow.ts:144`,
  `backend/src/routes/ncrs/ncrClosureWorkflow.ts:151`,
  `frontend/src/pages/ncr/components/ConcessionModal.tsx:64`.
- Repro/test gap: POST `/close` with `{ "withConcession": true }` after major
  NCR reaches verification/QM approval.
- Status: confirmed.
- Suggested fix scope: Enforce required concession fields server-side and
  persist/validate client approval reference/document.
- Suggested regression test: Reject incomplete concession close; accept complete
  payload and audit/store all fields.

#### DDFO-C1 - P1 - Docket review transitions are race-prone

- Affected workflow: docket approve/reject/query/respond.
- Impact: Concurrent actions can pass stale status checks, producing duplicate
  audit/notification side effects, last-write-wins status, and duplicate diary
  personnel/plant rows.
- Evidence: `backend/src/routes/dockets/review.ts:48`,
  `backend/src/routes/dockets/review.ts:115`,
  `backend/src/routes/dockets/review.ts:235`,
  `backend/src/routes/dockets/review.ts:400`.
- Repro/test gap: Fire two concurrent approve requests, or approve and reject
  in parallel, against one pending docket.
- Status: confirmed.
- Suggested fix scope: Make status transitions atomic with conditional updates
  or row locking; make diary auto-population idempotent.
- Suggested regression test: Concurrent review returns one success and one
  conflict with exactly one audit row and one set of diary rows.

#### DDFO-C2 - P1 - Duplicate same-day subcontractor dockets are possible

- Affected workflow: subcontractor docket create/edit/mobile retry.
- Impact: Double tap, multiple tabs, or retry after lost response can create
  duplicate same-day project dockets for one subcontractor.
- Evidence: `backend/src/routes/dockets.ts:123`, `backend/src/routes/dockets.ts:158`,
  `backend/prisma/schema.prisma:1117`, `backend/prisma/schema.prisma:1145`,
  `frontend/src/pages/subcontractor-portal/DocketEditPage.tsx:140`.
- Repro/test gap: Send two concurrent `POST /api/dockets` with same project,
  date, and subcontractor.
- Status: confirmed.
- Suggested fix scope: Enforce idempotent create or a uniqueness policy for
  `(projectId, subcontractorCompanyId, date)` and guard frontend create calls.
- Suggested regression test: Concurrent creates return one docket or existing
  docket, never two drafts.

#### L6-CF-001 - P1 - Claim evidence PDF omits hold-point release evidence

- Affected workflow: claim evidence package PDF.
- Impact: The backend emits top-level `lot.holdPoints`, while the PDF renderer
  reads `lot.itp.holdPoints`, so real packages can omit hold-point release
  evidence even when selected.
- Evidence: `backend/src/routes/claims/evidenceRoutes.ts:206`,
  `frontend/src/lib/pdf/types.ts:298`,
  `frontend/src/lib/pdf/claimEvidencePackagePdf.ts:282`,
  `frontend/src/lib/pdf/__tests__/fixtures/claimEvidenceFixture.ts:44`.
- Repro/test gap: Generate PDF from actual `/evidence-package` shaped JSON with
  top-level `holdPoints`.
- Status: confirmed.
- Suggested fix scope: Align API/PDF contract, preferably rendering top-level
  `lot.holdPoints` or mapping backend data into the typed PDF shape.
- Suggested regression test: Contract fixture from real evidence-package JSON
  asserts released/total hold point text is present.

#### L8-AUTH-001 - P1 - One-time auth tokens are not consumed atomically

- Affected workflow: magic-link login, password reset, email verification.
- Impact: Concurrent requests can pass the same pre-check before `usedAt` is
  set, minting multiple JWTs from one magic link or allowing multiple reset
  writes.
- Evidence: `backend/src/routes/auth/passwordResetRoutes.ts:160`,
  `backend/src/routes/auth/passwordResetRoutes.ts:189`,
  `backend/src/routes/auth/magicLinkRoutes.ts:127`,
  `backend/src/routes/auth/magicLinkRoutes.ts:181`,
  `backend/src/routes/auth/emailVerificationRoutes.ts:52`.
- Repro/test gap: Create one reset or magic-link token and submit two parallel
  requests.
- Status: confirmed.
- Suggested fix scope: Consume tokens atomically with conditional
  update/delete-and-returning semantics, then perform the action only if one row
  was consumed.
- Suggested regression test: Concurrent double-submit tests for reset password,
  magic link, and email verification.

#### L9-C1 - P1 - Production can pass with email disabled

- Affected workflow: production email-dependent flows.
- Impact: Startup/preflight can pass with `EMAIL_ENABLED=false`, breaking or
  degrading invites, password reset, magic links, hold-point emails,
  notifications, and scheduled reports.
- Evidence: `backend/src/lib/runtimeConfig.ts:221`,
  `backend/src/lib/runtimeConfig.ts:394`,
  `backend/scripts/preflight-production-integrations.ts:97`,
  `.github/workflows/production-preflight.yml:93`,
  `backend/src/lib/email.ts:120`.
- Repro/test gap: Configure otherwise-valid production env with
  `EMAIL_ENABLED=false`; runtime skips Resend enforcement and preflight skips
  email.
- Status: confirmed.
- Suggested fix scope: Disallow disabled email in the production environment or
  require a clearly named staging-only override.
- Suggested regression test: Runtime/preflight fails production when email is
  disabled.

#### L11-F1 - P1 - Project deletion conflicts with retention requirements

- Affected workflow: project deletion and data retention.
- Impact: Admins can hard-delete a project, cascading regulated construction
  records and audit logs while the retention script states project records and
  audit logs are retained for 7 years. Polymorphic comments can be orphaned.
- Evidence: `backend/src/routes/projects/writeRoutes.ts:380`,
  `backend/src/routes/projects/writeRoutes.ts:428`,
  `backend/prisma/schema.prisma:1309`,
  `backend/prisma/schema.prisma:1505`,
  `backend/scripts/data-retention.ts:9`,
  `backend/scripts/data-retention.ts:175`.
- Repro/test gap: In a disposable DB, create project records/audit/comments,
  call `DELETE /api/projects/:id`, then inspect cascades and orphan comments.
- Status: confirmed.
- Suggested fix scope: Replace hard delete with archive/retention workflow or
  block deletion once regulated records exist; preserve audit trail outside
  project cascade.
- Suggested regression test: Populated project deletion archives or is rejected,
  preserves audit logs, and leaves no orphan comments.

#### L12-CF-01 - P1 - Full E2E is mostly mocked

- Affected workflow: CI evidence for critical customer flows.
- Impact: CI starts a real backend and seeded DB, but many Playwright specs
  inject fake auth and API responses, so route/API/schema/auth integration
  regressions can pass full E2E.
- Evidence: `.github/workflows/ci.yml:202`, `.github/workflows/ci.yml:218`,
  `.github/workflows/ci.yml:238`, `frontend/e2e/helpers.ts:17`,
  `frontend/e2e/lots.spec.ts:80`, `frontend/e2e/holdpoints.spec.ts:116`.
- Repro/test gap: Static search found many `page.route` API mocks and no real
  login helper usage in E2E specs.
- Status: confirmed.
- Suggested fix scope: Add a small unmocked Playwright project against seeded
  backend for owner and subcontractor critical paths.
- Suggested regression test: Owner login -> project -> lot -> ITP/hold point,
  and subcontractor login -> assigned/unassigned access, with no API route mocks.

#### SP-L7-003 - P1 - Storage delete failures leave orphaned public objects

- Affected workflow: delete/replacement cleanup for documents, drawings, test
  certificates, and comment attachments.
- Impact: DB deletion/replacement can succeed while Supabase removal failures
  are only logged, leaving old copied public URLs usable.
- Evidence: `backend/src/routes/documents/deleteRoutes.ts:93`,
  `backend/src/routes/documents/storage.ts:169`,
  `backend/src/routes/drawings/storage.ts:157`,
  `backend/src/routes/testResults/crudRoutes.ts:364`,
  `backend/src/routes/comments/attachmentStorage.ts:154`.
- Repro/test gap: Mock Supabase `remove` to fail during delete/replacement.
- Status: confirmed.
- Suggested fix scope: Add durable deletion retry/outbox or fail user operation
  unless cleanup completes or is queued.
- Suggested regression test: Storage-delete failure fails or persists retry job,
  and retry removes the object.

### P2

#### SP-AC-01 - P2 - Public invite endpoint exposes full invited contact details

- Affected workflow: subcontractor invite acceptance.
- Impact: Anyone with an invite URL can fetch full invited email/name before
  auth.
- Evidence: `backend/src/routes/subcontractors/invitationRoutes.ts:80`,
  `backend/src/routes/subcontractors/invitationResponses.ts:44`,
  `frontend/src/pages/subcontractor-portal/AcceptInvitePage.tsx:136`,
  `frontend/src/pages/subcontractor-portal/AcceptInvitePage.tsx:409`.
- Repro/test gap: Open `/api/subcontractors/invitation/:id` unauthenticated.
- Status: confirmed.
- Suggested fix scope: Split public invite summary from authenticated pending
  invite details; mask or omit PII on public route.
- Suggested regression test: Public invite JSON/page does not expose full email
  or name.

#### L1-LOT-004 - P2 - Lot edit/delete audit trail gaps

- Affected workflow: lot lifecycle auditability.
- Impact: Plain lot metadata edits and lot deletes do not write audit logs.
- Evidence: `backend/src/routes/lots.ts:201`,
  `backend/src/routes/lots/deleteRoutes.ts:74`,
  `backend/src/routes/lots/deleteRoutes.ts:161`,
  `backend/src/lib/auditLog.ts:150`.
- Repro/test gap: PATCH or delete a lot, then inspect audit logs.
- Status: confirmed.
- Suggested fix scope: Add sanitized audit entries for lot update, single
  delete, and bulk delete.
- Suggested regression test: Backend tests assert lot update/delete audit rows.

#### L2-HP-003 - P2 - Authenticated hold-point release can race

- Affected workflow: internal hold-point release.
- Impact: Concurrent internal releases can pass stale pre-checks and overwrite
  release metadata.
- Evidence: `backend/src/routes/holdpoints/actionRoutes.ts:110`,
  `backend/src/routes/holdpoints/actionRoutes.ts:116`,
  safer public route at `backend/src/routes/holdpoints.ts:299`.
- Repro/test gap: Fire two concurrent `POST /api/holdpoints/:id/release`.
- Status: likely.
- Suggested fix scope: Use conditional `updateMany` inside the transaction and
  fail when count is not 1.
- Suggested regression test: Parallel releases result in exactly one success.

#### NCR-L4-005 - P2 - NCR page lacks comments/discussion surface

- Affected workflow: NCR assignments and closeout discussion.
- Impact: Generic comments support exists, but NCR page does not mount it.
- Evidence: `frontend/src/pages/ncr/NCRPage.tsx:1`,
  `frontend/src/components/comments/CommentsSection.tsx:1`.
- Repro/test gap: Open NCR page and observe no comments API/UI usage.
- Status: confirmed.
- Suggested fix scope: Add NCR detail discussion with authorized attachments.
- Suggested regression test: Authorized users can create/read NCR comments;
  unrelated users are denied.

#### NCR-L4-006 - P2 - NCR reports/PDF omit evidence and subcontractor responsibility

- Affected workflow: NCR report/PDF output.
- Impact: Reports omit evidence/document links and undercount responsible
  subcontractor assignment.
- Evidence: `backend/src/routes/reports/ncrRoutes.ts:65`,
  `backend/src/routes/reports/ncrRoutes.ts:121`,
  `frontend/src/lib/pdf/ncrDetailPdf.ts:99`.
- Repro/test gap: Export report/PDF for an NCR with evidence and responsible
  subcontractor.
- Status: confirmed.
- Suggested fix scope: Include safe evidence metadata and subcontractor
  responsible fields in report/PDF contracts.
- Suggested regression test: Fixture with evidence/subcontractor asserts output
  includes both without leaking raw storage paths.

#### DDFO-C3 - P2 - Diary/docket offline UX is not wired end to end

- Affected workflow: field offline diary and docket use.
- Impact: Current pages mostly use direct API calls and do not wire offline
  queues; docket offline submit records pending state but sync refuses submit.
- Evidence: `frontend/src/pages/diary/hooks/useDiaryData.ts:236`,
  `frontend/src/pages/subcontractor-portal/DocketEditPage.tsx:140`,
  `frontend/src/lib/offline/dockets.ts:19`,
  `frontend/src/lib/offline/syncWorker.ts:208`.
- Repro/test gap: Set browser offline and create diary/docket entries.
- Status: confirmed.
- Suggested fix scope: Implement offline save/submit with clear sync states, or
  make these workflows explicitly online-only.
- Suggested regression test: Page-level offline create/submit tests.

#### L6-CF-002 - P2 - Draft claim deletion has no audit event

- Affected workflow: commercial claim deletion.
- Impact: Deleting a draft claim unlocks lots and removes the claim without
  commercial history.
- Evidence: `backend/src/routes/claims/postEvidenceWorkflowRoutes.ts:489`,
  `backend/src/routes/claims/postEvidenceWorkflowRoutes.ts:528`,
  `backend/src/lib/auditLog.ts:192`.
- Repro/test gap: Delete a draft claim and inspect audit logs.
- Status: confirmed.
- Suggested fix scope: Add `CLAIM_DELETED` audit action with released lot count.
- Suggested regression test: Draft delete writes one audit row; non-draft
  rejection writes none.

#### L6-CF-003 - P2 - Claim row CSV due date is inconsistent

- Affected workflow: claim CSV export.
- Impact: Row CSV can show `Payment Due Date` as `-` while UI/bulk export
  calculate a due date.
- Evidence: `backend/src/routes/claims/presentation.ts:176`,
  `frontend/src/pages/claims/ClaimsPage.tsx:129`,
  `frontend/src/pages/claims/components/ClaimsTable.tsx:120`,
  `frontend/src/pages/claims/utils.ts:96`.
- Repro/test gap: Export row CSV for a submitted claim.
- Status: confirmed.
- Suggested fix scope: Share UI due-date fallback or return `paymentDueDate`
  from backend.
- Suggested regression test: Row CSV contains calculated due date.

#### L6-CF-004 - P2 - Certification read-back can stay stale

- Affected workflow: claim certification.
- Impact: Mutation response lacks normalized `certification`, so certifier,
  variation notes, and certificate link can remain stale until reload.
- Evidence: `backend/src/routes/claims/presentation.ts:263`,
  `backend/src/routes/claims/readRoutes.ts:340`,
  `frontend/src/pages/claims/ClaimsPage.tsx:278`.
- Repro/test gap: Record certification with variation notes/document and
  observe read-back without reload.
- Status: confirmed.
- Suggested fix scope: Return same certification shape from `/certify` or
  refetch claims after certification.
- Suggested regression test: Certification details and certificate link appear
  without page reload.

#### L8-AUTH-002 - P2 - MFA setup/disable lacks auth lockout

- Affected workflow: MFA setup and disable.
- Impact: A stolen active session can brute-force invalid TOTP/password/backup
  disable attempts at general API limits.
- Evidence: `backend/src/routes/mfa.ts:173`, `backend/src/routes/mfa.ts:234`,
  `backend/src/routes/mfa.ts:302`.
- Repro/test gap: Repeat invalid `/api/mfa/disable` past auth lockout threshold.
- Status: confirmed.
- Suggested fix scope: Add auth-rate limiting and failed-attempt recording keyed
  by user/IP.
- Suggested regression test: Invalid setup/disable attempts lock out and success
  clears user-specific counter.

#### L8-AUTH-003 - P2 - Normal logout does not revoke copied JWTs

- Affected workflow: logout/session safety.
- Impact: Copied bearer token remains valid until 24h expiry after UI logout.
- Evidence: `backend/src/routes/auth/sessionRoutes.ts:58`,
  `backend/src/lib/auth.ts:137`, `frontend/src/lib/auth.tsx:398`.
- Repro/test gap: Log in, copy token, log out, then call `/api/auth/me` with
  copied token.
- Status: confirmed.
- Suggested fix scope: Add token revocation/jti or shorter access tokens with
  refresh rotation.
- Suggested regression test: Copied token is rejected after logout under chosen
  session policy.

#### L9-C2 - P2 - 5xx monitoring is a no-op

- Affected workflow: production incident detection.
- Impact: Errors are logged locally/console, but no external monitoring or
  webhook sends alerts.
- Evidence: `backend/src/middleware/errorHandler.ts:145`,
  `backend/src/middleware/errorHandler.ts:310`.
- Repro/test gap: Throw a production-shaped 500 and observe
  `sendToMonitoringService()` no-op.
- Status: confirmed.
- Suggested fix scope: Wire Sentry/DataDog or redacted monitoring webhook and
  check presence in preflight.
- Suggested regression test: Sanitized 5xx payload sent; transport failure does
  not break response.

#### L9-C3 - P2 - Production DATABASE_URL validation is shallow

- Affected workflow: production startup.
- Impact: Runtime validates only non-empty database URL, not scheme/parse/unsafe
  hosts.
- Evidence: `backend/src/lib/runtimeConfig.ts:358`, contrast
  `backend/scripts/backup.ts:44`.
- Repro/test gap: `DATABASE_URL=not-a-url` is not rejected by runtime config
  itself.
- Status: confirmed.
- Suggested fix scope: Add redacted production database URL parser and unsafe
  host/name checks.
- Suggested regression test: Missing, malformed, non-Postgres, localhost, and
  valid Postgres cases.

#### L9-C6 / L11-F4 - P2 - Retention apply lacks production-safe confirmation

- Affected workflow: maintenance script.
- Impact: `data-retention.ts apply` deletes eligible rows after a timed pause
  against whatever `DATABASE_URL` is active.
- Evidence: `backend/scripts/data-retention.ts:243`,
  `backend/scripts/data-retention.ts:322`.
- Repro/test gap: Run `apply` with any configured DB URL; no explicit
  confirmation token or target classification is required.
- Status: confirmed.
- Suggested fix scope: Require explicit confirmation and redacted target
  summary; fail closed for prod-like URLs without override.
- Suggested regression test: Env matrix where prod-like URLs refuse apply.

#### L11-F2 - P2 - ITP completion uniqueness is not enforced at DB layer

- Affected workflow: ITP completion and hold-point sign-off.
- Impact: DB permits multiple completions for same instance/checklist item if
  concurrent/future paths bypass route locking.
- Evidence: `backend/prisma/schema.prisma:534`,
  `backend/prisma/schema.prisma:560`,
  `backend/src/routes/itp/completions.ts:303`,
  `backend/src/routes/holdpoints/actionRoutes.ts:143`.
- Repro/test gap: Raw/concurrent inserts can create duplicates because there is
  no `@@unique([itpInstanceId, checklistItemId])`.
- Status: confirmed.
- Suggested fix scope: Dedupe existing rows, add unique constraint, convert
  writes to compound upsert.
- Suggested regression test: Duplicate insert fails and concurrent complete or
  release leaves one row.

#### L11-F3 - P2 - Expired hold-point tokens are not retained/cleaned deliberately

- Affected workflow: data retention and secure links.
- Impact: Expired or used hold-point release token rows and recipient metadata
  persist until parent deletion/replacement; no expiry index.
- Evidence: `backend/prisma/schema.prisma:623`,
  `backend/src/routes/holdpoints/tokens.ts:9`,
  `backend/scripts/data-retention.ts:77`.
- Repro/test gap: Seed expired `hold_point_release_tokens`, run retention
  check/apply in disposable DB, observe no action.
- Status: confirmed.
- Suggested fix scope: Add expiry index and retention reporting/deletion for
  expired/old-used hold-point tokens.
- Suggested regression test: Retention check reports and apply deletes eligible
  HP tokens.

#### L12-CF-02 - P2 - Project access endpoint denial coverage is thin

- Affected workflow: project permission boundary.
- Impact: New `/api/projects/:id/access` endpoint drives frontend route guards,
  but denial paths are not endpoint-specific in tests.
- Evidence: `backend/src/routes/projects/readRoutes.ts:99`,
  `backend/src/routes/projects.test.ts:670`,
  `frontend/src/components/auth/ProjectProtectedRoute.tsx:18`.
- Repro/test gap: Missing endpoint tests for same-company non-member,
  other-company admin, suspended subcontractor, unauthenticated.
- Status: confirmed.
- Suggested fix scope: Add backend denial tests and frontend real-403 route
  tests.
- Suggested regression test: Matrix of 401/403/access outcomes for project
  roles.

#### L12-CF-03 - P2 - Frontend coverage gate is too low for launch confidence

- Affected workflow: frontend test coverage.
- Impact: CI enforces global thresholds, but floors are low enough that major
  user-flow regressions can pass.
- Evidence: `frontend/vitest.config.ts:30`, `.github/workflows/ci.yml:149`.
- Repro/test gap: Thresholds are 14/8/9/15 at config time; current measured
  coverage is higher but not domain-specific.
- Status: confirmed.
- Suggested fix scope: Add critical-folder or changed-file coverage gates for
  auth, route guards, subcontractor portal, lots, ITP, and offline modules.
- Suggested regression test: Readiness guard asserts critical-folder thresholds.

#### L10-F01 - P2 - Project nav shows role-denied links

- Affected workflow: role-based project navigation.
- Impact: Viewer/site-manager users can be shown links that route guards deny.
- Evidence: `frontend/src/components/layouts/Sidebar.tsx:108`,
  `frontend/src/components/layouts/MobileNav.tsx:85`,
  `frontend/src/App.tsx:220`, `frontend/src/appRouteRoles.ts:6`.
- Repro/test gap: Mock project access as viewer/site manager and click
  ITP/Hold Points/Dockets/Settings links.
- Status: confirmed.
- Suggested fix scope: Centralize route/nav role metadata.
- Suggested regression test: Desktop/mobile nav matrix for every supported role.

#### L10-F02 - P2 - Mobile nav ignores disabled project modules

- Affected workflow: mobile navigation.
- Impact: Project settings can disable modules, but mobile drawer still lists
  them because only sidebar filters by `enabledModules`.
- Evidence: `frontend/src/pages/projects/settings/components/ModulesTab.tsx:79`,
  `frontend/src/components/layouts/Sidebar.tsx:201`,
  `frontend/src/components/layouts/MobileNav.tsx:274`.
- Repro/test gap: Disable `dockets` or `dailyDiary` and compare desktop/mobile
  nav.
- Status: confirmed.
- Suggested fix scope: Shared module-filter hook for sidebar and mobile nav.
- Suggested regression test: Mobile drawer hides each disabled module.

#### L10-F03 - P2 - Drawings route is mounted but not discoverable

- Affected workflow: drawing register navigation.
- Impact: `/projects/:projectId/drawings` works by direct URL but has no
  desktop or mobile project-nav entry.
- Evidence: `frontend/src/App.tsx:318`, `frontend/src/components/layouts/Sidebar.tsx:108`,
  `frontend/src/components/layouts/MobileNav.tsx:85`.
- Repro/test gap: Open project nav as report-capable role and observe no
  Drawings link.
- Status: confirmed.
- Suggested fix scope: Add Drawings nav item or clear Documents-to-Drawings CTA.
- Suggested regression test: Route reachability test for Drawings on desktop
  and mobile.

### P3

#### L12-CF-05 - P3 - `@pr-smoke` command finds no tests

- Affected workflow: PR smoke versus full E2E.
- Impact: The documented/suggested smoke command runs zero tests in this branch.
- Evidence: `.github/workflows/ci.yml:238`, `frontend/playwright.config.ts:7`;
  `rg "@pr-smoke"` found no markers.
- Repro/test gap: `npx playwright test --grep @pr-smoke` returns "No tests
  found".
- Status: confirmed.
- Suggested fix scope: Tag critical specs and add a `test:e2e:smoke` script if
  smoke is intended.
- Suggested regression test: Static guard that smoke set is non-empty.

#### L12-CF-06 - P3 - Playwright flake and latency risk

- Affected workflow: browser tests.
- Impact: Fixed sleeps and global retries can hide timing bugs and slow the
  suite.
- Evidence: `frontend/playwright.config.ts:10`,
  `frontend/e2e/auth.spec.ts:217`,
  `frontend/e2e/company-settings.spec.ts:349`.
- Repro/test gap: Search for `waitForTimeout` and `retries`.
- Status: confirmed.
- Suggested fix scope: Replace arbitrary sleeps with locator/event waits.
- Suggested regression test: Static guard against new `page.waitForTimeout`
  outside approved helpers.

#### L10-F06 - P3 - Some mobile controls lack accessible names/semantics

- Affected workflow: mobile docket and field controls.
- Impact: Icon-only controls and bottom sheets have weak accessibility naming or
  dialog semantics.
- Evidence: `frontend/src/pages/subcontractor-portal/components/DocketEntrySheet.tsx:67`,
  `frontend/src/pages/subcontractor-portal/components/DocketEditTabs.tsx:170`,
  `frontend/src/components/foreman/TodayWorklist.tsx:174`.
- Repro/test gap: Query buttons by accessible name in Testing Library.
- Status: confirmed.
- Suggested fix scope: Add `aria-label`s and use shared dialog/sheet semantics.
- Suggested regression test: Accessible-name and dialog-role assertions.

## 5. Workflow Coverage Matrix

| Workflow | Audit status | Main blockers |
| --- | --- | --- |
| Project setup and retention | Static review only | Hard project delete can violate retention and orphan comments; project access endpoint denial coverage is thin |
| Lots and ITPs | Static plus targeted tests | Hidden subcontractor item writes; mobile/offline hold-point gating; incomplete offline ITP actions; missing lot edit/delete audit |
| Hold points and external release | Static plus 28 focused backend tests | Silent email failure; public evidence over-sharing; internal release race |
| Subcontractor portal | Static plus unit coverage | ITP/lots module mismatch; invite PII exposure; missing resend recovery |
| NCRs and corrective action | Static only | Responsible subcontractors cannot complete loop; defect photos not linked; client notification not sent; concession validation gap |
| Dockets and diaries | Static only | Docket review races; duplicate same-day dockets; offline diary/docket UX not wired |
| Progress claims | Static only | Evidence PDF contract mismatch; certification/payment read-back gaps; delete audit gap |
| Documents, drawings, photos, storage | Static only | P0 public object URL bypass; comment attachments raw URLs; cleanup failure leaves public objects |
| Auth, MFA, sessions | Static plus focused frontend unit tests | One-time token race; MFA brute force gap; logout token not revoked |
| Frontend navigation/mobile UX | Static plus focused unit/E2E subset from subagent | Role/nav mismatches; mobile module filtering; drawings route not discoverable; hidden focus target |
| CI/test coverage | Static plus local command evidence | Full E2E timed out locally, readiness guard fails, E2E heavily mocked, no `@pr-smoke` |
| Manual browser QA | Not completed | Required role journeys and negative checks still need sacrificial-data validation |

## 6. Role and Permission Matrix

| Role/persona | Expected paying-user behavior | Readiness gaps |
| --- | --- | --- |
| Owner/admin | Configure company/projects, invite users/subcontractors, see all project and commercial data | Project hard delete can destroy retained records; production email can be disabled; project access denial tests thin |
| Project manager / quality manager | Manage lots, ITPs, hold points, NCRs, claims, reports | Claim evidence PDFs can omit hold points; NCR concession/client notification gaps; route/nav role mismatch |
| Site manager / foreman | Daily field workflows, mobile ITPs, dockets, diaries, evidence | Mobile ITP can attempt unreleased hold points; offline ITP/diary/docket gaps; defect photos not linked to NCR evidence |
| Site engineer / viewer | Read or limited project work depending on role | Nav can expose denied links; project access endpoint needs denial matrix coverage |
| Subcontractor admin/user | Accept invite, see assigned work, complete allowed ITP/docket/NCR/test/document actions only | ITP portal switch mismatch; hidden ITP item write risk; responsible NCR cannot be completed; duplicate dockets possible |
| External superintendent | Open emailed hold-point release link and review only relevant evidence | Email send can fail silently; public evidence package over-shares; raw file URLs can bypass token expiry |
| Unauthenticated user | Only public auth/legal/invite/hold-point token surfaces | Public invite leaks full contact details; public storage URLs can bypass app auth |

## 7. External Integration Matrix

| Integration | Current evidence | Readiness gap |
| --- | --- | --- |
| Railway Postgres | Runtime requires non-empty `DATABASE_URL`; CI uses local Postgres; migration status checked in CI/preflight | Production URL is not parsed/validated deeply; backup/restore policy not verified live |
| Supabase Storage | Runtime/preflight require Supabase for production storage and public bucket | Public bucket/object URL model creates P0 access bypass; cleanup failures leave public orphans |
| Resend email | Runtime/preflight validate Resend unless `EMAIL_ENABLED=false` | Production can pass with email disabled; hold-point email failure can be silent |
| Google OAuth | Runtime/preflight validate only when configured | Login UI can expose Google sign-in while production config skips OAuth |
| VAPID push | Runtime/preflight validate only when configured | Optional policy unclear for launch |
| Error monitoring | Sanitized error logging exists | External monitoring transport is a no-op |
| Backups/retention | Backup and retention scripts exist | No repo-visible scheduled backup/restore drill; retention apply lacks production confirmation; hard project delete conflicts with retention |
| Scheduled reports/notifications | Scripts exist in package scripts | Need deployment evidence that workers/jobs are actually scheduled in production |
| Production preflight | Manual GitHub workflow restricted to master for production | Not wired as a required deploy gate in repo |

## 8. Test/Command Evidence

Commands run from the current workspace:

| Command | Outcome |
| --- | --- |
| `git status --short --branch` | Dirty branch `perf/audit-2026-06-10...origin/perf/audit-2026-06-10` with many modified and untracked files |
| `git log --oneline -5` | Top commit `25557e4 Retrigger CI with GitHub author` |
| `cd backend; npm run format:check` | Failed. Prettier warnings in 6 backend files |
| `cd backend; npm run type-check` | Passed |
| `cd backend; npm run lint` | Passed |
| `cd backend; npm run build` | Passed |
| `cd backend; npm test` with DB env cleared | Timed out after 304 seconds; not a pass |
| `cd backend; npm test -- src/routes/holdpoints/tokens.test.ts src/routes/holdpoints/evidencePackage.test.ts src/routes/holdpoints/superintendentRecipients.test.ts` | Passed: 3 files, 28 tests |
| `cd frontend; npm run format:check` | Failed. Prettier warnings in 14 frontend/e2e files |
| `cd frontend; npm run type-check` | Passed |
| `cd frontend; npm run lint` | Passed |
| `cd frontend; npm run build` | Initially failed on unsafe local production public env; passed after setting `VITE_API_URL=/api` and blanking frontend Supabase env |
| `cd frontend; npm run test:coverage` | Passed: 158 files, 1110 tests. Coverage: statements 26.89%, branches 21.86%, functions 23.91%, lines 27.53% |
| `cd frontend; npm run test:readiness` | Failed: 85 passed, 2 failed. Failing route guard source checks still expect old `RoleProtectedRoute` patterns while branch uses `ProjectProtectedRoute` |
| `cd frontend; npx playwright test --grep @pr-smoke` | Failed: no tests found |
| `cd frontend; npm run test:e2e` | Timed out after 604 seconds; not a pass |
| `npm run fallow:audit -- --format json --quiet` | Failed advisory audit. 186 changed files, 0 dead-code issues, 22 complexity findings, max cyclomatic 54, 196 duplication clone groups, 7 introduced complexity findings, 28 introduced duplication groups |
| Focused frontend unit command for auth/project/portal route tests | Passed: 3 files, 7 tests |

Additional subagent evidence:

- Lane 10 ran focused frontend unit tests for mobile nav/project route/portal
  panels: 23 passed.
- Lane 10 ran focused Playwright subset for auth/dashboard/projects/subcontractor
  portal: 50 passed, 4 failed, due project access guard mocking gaps.
- Most lane agents intentionally did not run DB-backed tests to avoid local env
  risk and because this was report-only.

## 9. Fix Plan, PR-Sized Batches

### Batch 1 - Storage Privacy P0s

- Move protected documents, drawings, certificates, and comment attachments away
  from public object URL exposure.
- Stream/proxy protected downloads through backend or use private bucket/object
  signed URLs after app authorization.
- Remove raw storage URLs from comment attachment payloads.
- Add durable storage deletion retry/outbox or fail/queue cleanup on delete
  failure.
- Regression: signed URL bypass tests, comment attachment auth mediation tests,
  storage delete failure/retry tests, browser preview smoke.

### Batch 2 - ITP and Hold-Point Trust Boundaries

- Add server-side item-writable guard matching subcontractor read visibility.
- Fix mobile/offline unreleased hold-point gating and rollback sync failures.
- Decide offline ITP policy and implement or disable unsupported N/A/fail/comment
  evidence actions.
- Make hold-point request-release email delivery explicit and failure-aware.
- Scope public evidence packages and remove raw file URLs.
- Add ITP completion uniqueness migration after dedupe.

### Batch 3 - Subcontractor, NCR, and Docket Workflow Completion

- Resolve `itps=true,lots=false` portal policy and test module matrix.
- Allow responsible subcontractor NCR response/evidence/submit within strict
  portal/project/company scope.
- Link foreman/offline defect photos to `NCREvidence`.
- Implement real NCR client notification sending or distinct manual-record mode.
- Enforce concession closeout fields server-side.
- Make docket review transitions atomic and same-day docket creation idempotent.

### Batch 4 - Auth and Production Operations

- Consume reset/magic/email verification tokens atomically.
- Add MFA setup/disable failed-attempt lockout.
- Decide and implement logout revocation or shorter access-token/refresh-token
  policy.
- Fail production when email is disabled.
- Add strict redacted production `DATABASE_URL` validation.
- Add external monitoring transport/preflight.
- Harden backup/retention scripts to avoid raw connection string process args
  and require explicit confirmation for destructive retention apply.

### Batch 5 - Claims, Reports, Audit, and Retention

- Align claim evidence package API/PDF hold-point contract.
- Add claim delete audit event and payment-history/certification read-back.
- Fix claim CSV due-date consistency.
- Add lot update/delete audit logs.
- Replace hard project delete with archive/retention-safe behavior or block
  deletion for regulated projects.
- Add hold-point token retention cleanup.

### Batch 6 - Test, CI, and UX Confidence

- Fix formatting failures and current readiness guard failures.
- Add unmocked Playwright project for seeded owner/subcontractor critical paths.
- Add project access endpoint denial matrix.
- Add critical-folder frontend coverage gates.
- Add non-empty `@pr-smoke` set if smoke command remains documented.
- Align desktop/mobile navigation role/module filtering, add Drawings
  navigation, and fix hidden header focus.

### Batch 7 - Manual Pilot Verification

- Run the required browser journeys with sacrificial local/staging users:
  owner/admin setup, foreman mobile ITP/evidence/hold point, external
  superintendent token review, subcontractor invite/assigned/unassigned direct
  routes, PM/QM reports/NCR/docket/claims, and negative checks for wrong
  project, expired token, deleted evidence, and missing storage/email config.
- Capture screenshots only with non-sensitive test data.
- Re-run full CI, production preflight, and a clean full E2E run.

## 10. Residual Risks and Required Manual Checks

- Live Railway, Supabase, Resend, Google OAuth, VAPID, backup, restore, and
  monitoring settings were not validated in production or staging.
- No production customer data was inspected. No production database or storage
  mutation commands were run.
- Required manual browser QA was not completed because local gates are already
  failing/timing out and live credentials were intentionally not used.
- The current report reflects a dirty feature/audit branch. Re-run after fixes
  from a clean branch and compare against `origin/master`.
- Several findings are static-confirmed from code, but concurrency and storage
  cleanup issues need disposable-DB or mocked-integration tests to prove the
  final fixes.
- If the product intentionally allows public storage URLs, reusable signed
  document URLs, client-only logout, or optional production email/OAuth/push,
  those policies must be documented explicitly and reflected in UX copy,
  preflight, and risk acceptance. As written today, they are not suitable for
  paying customer QA evidence.

Final recommendation: `Not ready`.
