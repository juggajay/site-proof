# Ship Readiness Deep Audit - 2026-06-13

This is a read-only readiness audit of `origin/master` at commit
`157b6b3 fix: surface docket diary sync warnings (#866)`, using the clean
worktree at `.worktrees/readiness-audit-2026-06-13`.

Scope covered:

- Authorization and project/subcontractor scoping.
- Hold point release and public evidence package flows.
- ITP completion, evidence, NCR, lot status, claims, dockets, and diary state.
- Mobile/offline sync trust and data durability.
- Signup, invitations, onboarding, and first-project setup.
- Production/security/ops basics: storage model, MFA, backups, Docker, audit posture.

No code was changed as part of this pass.

## Readiness Verdict

SiteProof is in a much better state than the first audit pass. CI is green, route auth coverage is strong, production runtime config is stricter than expected, rate limiting uses the database in production, and public/private route boundaries are tested.

It is not ready for broad self-serve users yet.

It is close to a controlled pilot with known limitations if the field/offline and evidence-link issues below are fixed first. The main risk is not "the app is broken everywhere". The risk is trust: users can be told work is saved when it is not, subcontractors can lose access to evidence they should see, and some workflow state can drift under failures or concurrency.

## Priority 0 - Fix Before Users

### 1. Subbie mobile ITP can show "saved" when the API failed

Refs:
- `frontend/src/shell/subbie/screens/useSubbieItpRun.ts`
- `frontend/src/pages/lots/hooks/useItpCompletionActions.ts`
- `frontend/src/shell/subbie/screens/SubbieItpRunScreen.tsx`

The subbie mobile `pass()` action awaits `handleToggleCompletion()`, but that shared handler catches API errors internally and does not return failure. `pass()` then returns `true`, so the run screen can advance as if the item was saved.

User impact: a subcontractor can pass an ITP item during a 5xx/offline moment and believe it is saved, while no server write and no offline queue item exists.

Fix direction:
- Make the shared toggle return `true | false`, or throw on failure.
- Add a regression where `/api/itp/completions` fails and the subbie run screen does not advance.
- Coordinate before editing `frontend/src/shell/**`, because that area is owned by the foreman shell workstream.

### 2. Offline ITP evidence can upload but fail to attach

Refs:
- `frontend/src/pages/lots/lib/itpCompletionWrite.ts`
- `frontend/src/pages/lots/hooks/useLotPhotoUpload.ts`
- `frontend/src/lib/offline/syncWorker.ts`
- `frontend/src/shell/screens/lots/useShellItpRun.ts`

Offline ITP completions use synthetic ids like `offline-...`. Offline photo capture stores that id as `completionId`. Later sync uploads the document, then calls `/api/itp/completions/{offline-id}/attachments`, which cannot find a real server completion.

User impact: a photo can be safely uploaded as a document but never linked to the checklist item. The user sees "saved offline", then the item can dead-letter during sync.

Fix direction:
- Queue evidence intent by `lotId + checklistItemId`, not by synthetic completion id.
- After completion sync, resolve the real server completion id and attach the document.
- Add a sync-worker regression covering offline completion plus offline evidence.

### 3. Public hold-point evidence package does not give external reviewers usable evidence links

Refs:
- `backend/src/routes/holdpoints/evidencePackage.ts`
- `backend/src/routes/holdpoints.ts`
- `frontend/src/pages/holdpoints/PublicHoldPointReleasePage.tsx`
- `frontend/src/lib/pdf/holdPointEvidencePdf.ts`

The public hold-point release link loads a package, but the package maps attachment/photo rows as raw `fileUrl` values. The public page mostly lists filenames, and the generated PDF says full photos are available in SiteProof. That is not useful for an external superintendent who does not have app access.

User impact: the superintendent can receive the email and open the release page, but cannot inspect the actual evidence trail from the public link.

Fix direction:
- Public evidence packages should include tokenized attachment URLs generated for that release token, or a backend proxy route scoped to the hold-point token.
- The public page should render "View" links for each attachment/photo.
- The PDF should include either embedded images where practical or tokenized links that remain valid for the release review window.

### 4. Public hold-point release can approve stale evidence

Refs:
- `backend/src/routes/holdpoints/requestReleaseRoutes.ts`
- `backend/src/routes/holdpoints.ts`

Prerequisites are checked when the release link is requested. They are not rechecked when the public token is used to release the hold point.

User impact: if evidence/checklist state changes after the email is sent, the external recipient can still release based on stale state.

Fix direction:
- Re-run the same prerequisite/evidence gate immediately before or inside the public release transaction.
- Return a clear "evidence changed, request a new release" response.

### 5. Failed ITP item can persist without its NCR

Refs:
- `backend/src/routes/itp/completions.ts`

The completion write commits before NCR creation. If NCR creation fails, a retry sees the existing `failed` completion and skips NCR creation because the status is already failed.

User impact: the lot can show a failed ITP item without the NCR that should drive rectification and traceability.

Fix direction:
- Put failed completion, NCR creation, and lot status update in one transaction.
- Or repair on retry when a failed completion has no linked NCR marker.

### 6. Lot status can advance before subcontractor verification

Refs:
- `backend/src/routes/itp/completions.ts`
- `backend/src/routes/itp/helpers/lotProgression.ts`

Subcontractor completions requiring verification still have status `completed` while `verificationStatus` is `pending_verification`. `updateLotStatusFromITP()` counts `completed` and `not_applicable` only, so lots can move to `completed` or `awaiting_test` before head-contractor verification.

User impact: claims/conformance state can look ahead of actual approved evidence.

Fix direction:
- Lot progression should count only verified completions when verification is required.
- Add tests for a lot with subcontractor verification enabled.

## High Priority

### 7. NCR evidence routes reject subcontractors who can read the NCR

Refs:
- `backend/src/routes/ncrs/ncrCore.ts`
- `backend/src/routes/ncrs/ncrEvidence.ts`
- `backend/src/routes/ncrs/ncrAccess.ts`

The main NCR detail route uses `canReadNcr()`, which understands assigned subcontractors and assigned lots. The evidence list route uses `requireActiveProjectUser()`, which explicitly rejects subcontractor users after checking portal access.

User impact: a subcontractor can be allowed to see an NCR but blocked from seeing its evidence.

Fix direction:
- Use `canReadNcr()` or a shared NCR read-access helper for `GET /api/ncrs/:id/evidence`.
- Separately define which subcontractor users can mutate NCR evidence.

### 8. Global subcontractor admin role overrides selected project link role

Refs:
- `backend/src/routes/subcontractors/myCompanyRoutes.ts`
- `frontend/src/pages/subcontractors/MyCompanyPage.tsx`
- `backend/prisma/schema.prisma`

The UI gates roster controls using global `user.role === 'subcontractor_admin'`. Backend mutations call a scoped link helper, but the response does not expose the selected link role clearly enough for the UI to gate per project.

User impact: a portal user who is admin on Project A but a normal user on Project B can be shown admin controls for Project B, leading to incorrect permissions or failed actions.

Fix direction:
- Return selected project link role from `my-company` and `availableProjects`.
- Gate UI from selected link role.
- Add backend regression with one user linked as admin to Project A and user to Project B.

### 9. Global NCR list can drop NCRs for multi-project subcontractors

Refs:
- `backend/src/routes/ncrs/ncrListRoute.ts`
- `frontend/src/pages/ncr/hooks/useNCRData.ts`

When `/api/ncrs` is called without `projectId`, allowed projects are computed, but the subcontractor filter then loads only one `subcontractorUser` link. A multi-project subcontractor can miss NCRs from other linked projects.

User impact: the NCR dashboard can randomly look incomplete depending on which subcontractor link the database returns first.

Fix direction:
- Build an `OR` per `(projectId, subcontractorCompanyId)` pair.
- Scope assigned lot ids per project.

### 10. Shell sync badge can say "All saved" while failed work exists

Refs:
- `frontend/src/lib/useOfflineStatus.ts`
- `frontend/src/shell/components/syncChipState.ts`
- `frontend/src/shell/components/SyncChip.tsx`

The offline hook tracks `failedSyncCount`, but the shell sync chip derives state only from online, pending, and syncing.

User impact: field users can leave site thinking all work synced while dead-lettered ITP/photo/docket/diary items remain local.

Fix direction:
- Add a `failed` sync state.
- Show retry/action copy when `failedSyncCount > 0`.

### 11. Failed offline photos can disappear from the photo shell

Refs:
- `frontend/src/lib/offline/photos.ts`
- `frontend/src/shell/screens/photos/usePhotosShellData.ts`
- `frontend/src/shell/screens/photos/photosShellState.ts`

Failed photo sync marks the photo `syncStatus: 'error'`. The photo shell reads `getPendingPhotos()`, which only returns `pending`.

User impact: a failed field photo can vanish from the mobile photo surface even though it still needs attention.

Fix direction:
- Add `getUnsyncedPhotosForProject()` returning `pending + error`.
- Render error photos with retry/attention state.

### 12. Docket approval can duplicate diary rows under concurrent approval

Refs:
- `backend/src/routes/dockets/review.ts`

The approval route checks status, then updates, then writes diary personnel/plant rows. Two approvers can both pass the initial status check and both auto-populate diary rows.

User impact: approved docket labour/plant can appear twice in the daily diary.

Fix direction:
- Use guarded `updateMany({ id, status: 'pending_approval' })` inside a transaction.
- Make diary sync delete/upsert by `docketId`.

### 13. Concurrent partial claims can overclaim a lot

Refs:
- `backend/src/routes/claims/workflowRoutes.ts`
- `backend/src/routes/claims/cumulativeClaims.ts`
- `backend/prisma/schema.prisma`

Partial claims leave lots `conformed`. Cumulative percentage is read during claim creation, but selected lot rows are not serialized. Two concurrent 60 percent claims can both pass and persist 120 percent.

User impact: payment claims can exceed the intended cumulative claim percentage.

Fix direction:
- Lock selected lot rows with `FOR UPDATE`, or maintain a per-lot claimed accumulator with guarded updates.

### 14. Public Supabase object URLs bypass app access controls

Refs:
- `backend/src/lib/supabase.ts`
- `backend/src/routes/documents/storage.ts`
- `backend/src/routes/comments/attachmentStorage.ts`
- `frontend/src/components/comments/CommentsSection.tsx`

Documents and comment attachments are stored as public Supabase object URLs. The app has backend authorization routes, but direct public object URLs remain accessible if copied or leaked.

User impact: document access cannot be fully revoked by the app once a raw object URL is known.

Fix direction:
- Make the bucket private.
- Store object keys, not public URLs.
- Serve reads through backend auth or short-lived Supabase signed URLs.
- Plan a migration for existing public URLs.

## Onboarding And First-Use Friction

### 15. Signup can create the user then report registration failure

Refs:
- `backend/src/routes/auth/registrationRoutes.ts`
- `frontend/src/lib/auth.tsx`
- `frontend/src/pages/auth/RegisterPage.tsx`

User creation and verification-token creation happen before `sendVerificationEmail()`. If the email send fails, the account exists but the API returns an error.

User impact: the user sees "Registration failed", retries, then gets "Email already in use".

Fix direction:
- Decouple account creation from synchronous email delivery.
- Return a usable state with resend verification when mail fails.
- Add delivery status/outbox or queue semantics.

### 16. Invite delivery failures are swallowed while UI says sent

Refs:
- `backend/src/routes/company/memberRoutes.ts`
- `backend/src/routes/subcontractors/invitationRoutes.ts`
- `frontend/src/pages/company/components/CompanyTeamMembersSection.tsx`
- `frontend/src/pages/subcontractors/SubcontractorsPage.tsx`

Invite email send failures are logged, but the API still returns success and the UI treats the invite as sent.

User impact: members or subcontractors can remain pending forever with no clear retry path.

Fix direction:
- Track invitation delivery state.
- Show resend/retry actions.
- Avoid "sent" copy unless send/queue succeeded.

### 17. Mutation succeeds, auth refresh fails, UI says failed

Refs:
- `frontend/src/pages/onboarding/CompanyOnboardingPage.tsx`
- `frontend/src/pages/subcontractor-portal/AcceptInvitePage.tsx`
- `backend/src/routes/company.ts`

Company setup and logged-in invite acceptance call the mutation, then `refreshUser()`. If refresh fails after the mutation succeeded, the user sees failure and retries into "already belongs" or "already accepted" states.

Fix direction:
- Treat mutation failure and auth-refresh failure separately.
- Use returned user/company state where available.
- Recover duplicate/already-accepted responses by refreshing and navigating.

### 18. Project creation UI requires project number even though API can generate it

Refs:
- `frontend/src/pages/projects/ProjectsPage.tsx`
- `backend/src/routes/projects/writeRoutes.ts`

The backend supports generated project numbers, but the UI requires the field.

User impact: first project setup can be blocked for users who do not already have an internal numbering convention.

Fix direction:
- Make project number optional in the UI.
- Display the generated number after creation.

## Lower Priority Hardening

### 19. MFA setup/disable routes lack auth failure lockout protections

Refs:
- `backend/src/routes/mfa.ts`
- `backend/src/middleware/rateLimiter.ts`

MFA login verification uses `authRateLimiter`, lockout checks, and failed-attempt recording. Setup verification and disable use normal authenticated routes and the broad global API limiter.

Fix direction:
- Apply auth-style limiter and failed-attempt tracking to setup verification and disable.
- Consider recent-auth requirements for disabling MFA.

### 20. Released hold-point link blocks later evidence package access

Refs:
- `backend/src/routes/holdpoints.ts`
- `frontend/src/pages/holdpoints/PublicHoldPointReleasePage.tsx`

After a public token is used to release a hold point, reopening the same link returns 410, so the external reviewer loses access to the package they approved.

Fix direction:
- Allow used-but-unexpired tokens to return read-only package data with `canRelease: false`.
- Keep POST release blocked.

### 21. Hold-point release requests can create duplicate rows under concurrency

Refs:
- `backend/src/routes/holdpoints/requestReleaseRoutes.ts`
- `backend/prisma/schema.prisma`

There is no unique constraint on `(lotId, itpChecklistItemId)`, and the route chooses update/create from a pre-transaction read.

Fix direction:
- Add `@@unique([lotId, itpChecklistItemId])`.
- Use `upsert` or row locking.

### 22. Backend production image uses mutable base tag

Refs:
- `backend/Dockerfile`

The Dockerfile uses `node:20-slim` without a digest.

Fix direction:
- Pin by digest.
- Automate digest updates and image scanning.

### 23. Backup automation is not visible in repo

Refs:
- `backend/scripts/backup.ts`
- `.github/workflows/production-preflight.yml`

Backup tooling exists, but repo-level scheduled production/off-host retention was not evident.

Fix direction:
- Document Railway-managed backups if they are the source of truth.
- Otherwise add scheduled encrypted off-host backups, RPO alerting, and restore drills.

## Recommended Fix Order

1. Subbie mobile ITP save honesty and failed API behavior.
2. Offline ITP evidence attachment resolution.
3. Public hold-point evidence links, stale-release recheck, and read-only post-release package access.
4. Failed ITP transaction/NCR repair.
5. Subcontractor verification-aware lot status progression.
6. NCR evidence access for assigned subcontractors.
7. Subcontractor per-project role scoping and global NCR list scoping.
8. Sync badge failed state and failed-photo visibility.
9. Docket approval and partial-claim concurrency fixes.
10. Signup/invite delivery state and first-use friction.
11. Storage privacy migration from public Supabase URLs.
12. MFA/backup/Docker hardening.

## Notes For Fix PRs

- Keep one risk area per PR so CI stays cheap and failures are easy to isolate.
- Coordinate before editing `frontend/src/shell/**` because the foreman shell workstream owns that area.
- Add regression tests for every backend workflow-state fix. The existing test suite already has good patterns for route auth and workflow behavior.
- For storage privacy, do not try to combine the migration with small evidence-link fixes. First make public evidence review work with current storage. Then plan the private-bucket migration separately.
