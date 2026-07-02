# Ship Readiness Deep Audit - 2026-06-13

## Verdict

SiteProof is a real, complex product with several strong foundations already in place: route auth coverage, production runtime config checks, database-backed rate limiting, CI coverage, and much better domain modelling than a thin prototype. It is not ready for open self-serve users yet.

The gap is not that the app is "messy". The gap is that several field-critical workflows can tell a user work is saved, approved, or viewable when the server state does not actually match that. Those are the issues that create trust problems on construction sites.

I would treat the app as close to a controlled pilot after the first four fix groups below are completed and tested end to end:

1. ITP/offline save truth.
2. External hold-point evidence links.
3. Subcontractor/NCR access consistency.
4. Transactional workflow state for ITP, dockets, claims, and lot progression.

## Audit Method

This pass was done against a clean `origin/master` worktree at commit `157b6b3` on 2026-06-13. I did not mutate production services or run destructive database commands.

I split the audit across focused areas:

- Auth, project scoping, tenant boundaries, role checks.
- External links, evidence packages, document access.
- Signup, invites, onboarding, password reset, company setup.
- Mobile/offline save paths and shell readiness.
- Workflow state machines: lots, ITPs, hold points, NCRs, dockets, claims.
- Operations and security posture: runtime config, uploads, rate limiting, backups, dependencies.

Local verification focused on reading the actual route, hook, and offline-sync code rather than relying on tests alone. Findings below are ranked by user impact and likelihood.

## What Looks Good

- Production runtime config rejects several dangerous deployments: weak JWT/encryption secrets, memory rate limits, localhost public URLs, local upload storage, mock OAuth, test endpoints, and unsafe trust proxy settings.
- Route auth coverage is actively tested in `backend/src/lib/routeAuthCoverage.test.ts`.
- Production rate limiting defaults to the database-backed store and blocks memory-store production use unless configuration is explicitly invalid.
- Static private upload directories are guarded in production.
- CI appears to be in a much healthier place than earlier in the project.
- The app has meaningful domain coverage: lots, ITPs, NCRs, hold points, dockets, claims, diary, photos, subcontractor access, and external superintendent release flows.

## Launch Blockers

### 1. Subbie mobile ITP can show "saved" even when the API failed

Severity: Critical

Files:

- `frontend/src/shell/subbie/screens/useSubbieItpRun.ts`
- `frontend/src/pages/lots/hooks/useItpCompletionActions.ts`
- `frontend/src/shell/subbie/screens/SubbieItpRunScreen.tsx`

Problem:

`useSubbieItpRun.pass()` awaits `handleToggleCompletion()` and then returns success. The shared completion hook catches errors internally and does not throw or return failure. That means a subcontractor can tap Pass, the API can fail, and the UI can still advance as though the item was saved.

Why it matters:

This is exactly the kind of rare "I got access/saved state wrong" field bug that breaks trust. A subbie can believe an inspection point was completed when the server never accepted it.

Fix:

Make the shared ITP completion action return a real success/failure result, or route subbie mobile completion through the same offline write primitive used by foreman flows. The UI should only advance after confirmed server save or confirmed local offline queue write.

### 2. Offline ITP evidence can upload but fail to attach to the real completion

Severity: Critical

Files:

- `frontend/src/pages/lots/lib/itpCompletionWrite.ts`
- `frontend/src/shell/screens/lots/useShellItpRun.ts`
- `frontend/src/pages/lots/hooks/useLotPhotoUpload.ts`
- `frontend/src/lib/offline/syncWorker.ts`

Problem:

Offline completions use synthetic ids like `offline-...`. Evidence queued against that synthetic id later syncs to `/api/itp/completions/{offline-id}/attachments`, but the backend only knows the real database id created during completion sync.

Why it matters:

Evidence can appear captured locally, upload later, and then dead-letter because it is attached to an id the server can never resolve.

Fix:

Queue evidence by stable domain keys such as `lotId + checklistItemId`, or persist an offline-to-server completion id mapping after completion sync. Evidence sync must resolve the real completion id before attaching.

### 3. Public Supabase object URLs bypass app access controls

Severity: Critical

Files:

- `backend/src/lib/supabase.ts`
- `backend/src/routes/documents/storage.ts`
- `backend/src/routes/documents/fileHelpers.ts`
- `frontend/src/components/comments/CommentsSection.tsx`

Problem:

Some uploads are stored and exposed as public Supabase object URLs. The backend has access checks, but once a public object URL is copied into comments, evidence, email, PDF output, or browser history, the app can no longer revoke access through its own authorization layer.

Why it matters:

Construction evidence, photos, NCR attachments, and hold-point proof can be commercially sensitive. Public bucket URLs are not acceptable for launch unless the product intentionally treats those files as public.

Fix:

Move to private buckets, store object keys instead of public URLs, and serve downloads through backend authorization or short-lived signed URLs. Existing public URLs need migration or expiry planning.

### 4. Failed ITP completion can persist without its NCR

Severity: High

Files:

- `backend/src/routes/itp/completions.ts`

Problem:

The route can save a failed ITP completion first, then create the NCR afterward. If the NCR creation path fails, a retry can see the existing failed completion and skip the NCR creation path.

Why it matters:

The system can record a failed inspection item without opening the corrective-action workflow that should follow.

Fix:

Create failed completion, NCR, and lot status transition in one transaction. Also add a repair-on-retry path: if a failed completion exists without an NCR, create the missing NCR.

### 5. Lot status can advance before subcontractor verification is complete

Severity: High

Files:

- `backend/src/routes/itp/completions.ts`
- `backend/src/routes/itp/helpers/lotProgression.ts`

Problem:

Lot progression counts completion status values like `completed` or `not_applicable`, but does not consistently require `verificationStatus` to be verified where subcontractor verification is required.

Why it matters:

A lot can appear completed or ready for the next stage before a foreman or required verifier has actually accepted the subcontractor's work.

Fix:

When verification is required, lot progression should only count verified completions. Pending verification should keep the lot in an intermediate state.

### 6. External hold-point release can approve stale evidence

Severity: High

Files:

- `backend/src/routes/holdpoints/requestReleaseRoutes.ts`
- `backend/src/routes/holdpoints.ts`

Problem:

The request-release path checks prerequisites and evidence when the email link is created. The public release POST checks token/status, but does not fully re-run the evidence/prerequisite gate at approval time.

Why it matters:

An external superintendent can approve a package that was valid when emailed but no longer represents the current state.

Fix:

Re-run the same gate used at request time inside the public release transaction before changing hold-point state.

### 7. External hold-point evidence package does not reliably expose attachments

Severity: High

Files:

- `backend/src/routes/holdpoints/evidencePackage.ts`
- `frontend/src/pages/holdpoints/PublicHoldPointReleasePage.tsx`
- `frontend/src/lib/pdf/holdPointEvidencePdf.ts`

Problem:

The public package maps raw file URLs for photos/attachments, but the public page and PDF mainly expose filenames. The PDF tells the superintendent that full photos are available in SiteProof, which an external superintendent may not be able to access.

Why it matters:

This matches the earlier bug report: the email lands, but the links to view evidence do not work for the external party.

Fix:

Generate token-scoped, public evidence URLs tied to the hold-point release token. The public page and PDF should expose those URLs for each attachment/photo, while keeping normal project auth intact elsewhere.

### 8. NCR evidence access is stricter than NCR read access

Severity: High

Files:

- `backend/src/routes/ncrs/ncrEvidence.ts`
- `backend/src/routes/ncrs/ncrCore.ts`
- `backend/src/routes/ncrs/ncrAccess.ts`

Problem:

The main NCR detail route uses the shared NCR read helper, which can allow assigned subcontractors. The evidence-list route uses active project-user access, which can reject subcontractors even when they can read the NCR.

Why it matters:

A subcontractor can open an NCR but receive access denied when trying to view its evidence.

Fix:

Use the same NCR read authorization helper for NCR evidence reads. Then separately check write permission for upload/delete actions.

### 9. Sync status can say all saved while failed offline work exists

Severity: High

Files:

- `frontend/src/shell/components/syncChipState.ts`
- `frontend/src/shell/components/SyncChip.tsx`
- `frontend/src/lib/useOfflineStatus.ts`

Problem:

Offline status tracks `failedSyncCount`, but the shell sync chip does not use it when deriving the visible state.

Why it matters:

Field users need to know when work is stuck. "All saved" while failures exist is a serious trust bug.

Fix:

Include failed sync count in the sync chip state model and render an explicit failed/retry state.

### 10. Failed offline photos disappear from the photo shell

Severity: High

Files:

- `frontend/src/lib/offline/photos.ts`
- `frontend/src/shell/screens/photos/usePhotosShellData.ts`
- `frontend/src/shell/screens/photos/photosShellState.ts`

Problem:

Failed photo sync marks a photo as `syncStatus = 'error'`. The photo shell reads only pending photos, so errored photos can disappear from the queue.

Why it matters:

A user can lose visibility of evidence that needs attention.

Fix:

Photo shell data should include both pending and errored unsynced photos, with retry/remove actions.

## High Priority Queue

### ITP and Offline Trust

Issues:

- Subbie Pass/Fail can look successful after failed API save.
- Offline evidence can attach to synthetic completion ids.
- Offline ITP cache drops witness/evidence semantics and can remap non-hold items as standard/no-evidence.
- Sync chip ignores failed offline count.
- Failed offline photos disappear from the photo shell.

Suggested PR:

`fix/itp-offline-save-truth`

Notes:

This touches `frontend/src/shell/**`, which overlaps the foreman shell workstream. Coordinate before editing those files.

### Hold-Point External Evidence

Issues:

- Email link can land, but evidence attachments are not reliably accessible to the external superintendent.
- Public release can approve stale evidence.
- Used hold-point tokens block later read-only evidence package access.
- Hold-point release does not always recalculate lot status afterward.
- Concurrent request-release actions can create duplicate hold points because no unique `(lotId, itpChecklistItemId)` constraint exists.

Suggested PR:

`fix/holdpoint-public-evidence-release`

### NCR and Subcontractor Access

Issues:

- NCR evidence route can reject assigned subcontractors who can read the NCR.
- Global NCR list can drop NCRs for multi-project subcontractors when no `projectId` filter is supplied.
- Global subcontractor admin role can override per-project link role in company management UI/route decisions.

Suggested PR:

`fix/subcontractor-ncr-access-consistency`

### Workflow Transactions

Issues:

- Failed ITP completion can persist without its NCR.
- Lot status can advance before subcontractor verification.
- Docket approval race can duplicate diary rows.
- Concurrent partial claims can overclaim a lot.
- Reversing ITP items can leave stale advanced lot status.

Suggested PR:

`fix/workflow-state-transactions`

### Signup and Invitations

Issues:

- Signup can create the user, then report failure if verification email delivery fails.
- Company/member invite delivery errors are swallowed while UI says the invite was sent.
- Company setup or invite accept can appear failed if a follow-up auth refresh fails after the main write succeeded.
- Project creation UI requires project number even though the API can generate one.
- Company ABN handling is less consistent than subcontractor ABN handling.

Suggested PR:

`fix/onboarding-delivery-states`

### Document Security

Issues:

- Public Supabase URLs bypass app authorization.
- ITP attach-existing-document can attach project-level documents with `lotId = null` to any lot if the actor can access the document.
- Signed document download links are authorized when created, not when consumed. This may be acceptable for short-lived external sharing, but should be explicit policy.

Suggested PR:

`fix/private-document-access`

This is likely a larger migration than the other fixes because existing stored URLs may need migration.

### Operations Hardening

Issues:

- MFA setup/disable routes do not appear to have the same rate-limit/lockout posture as login verification.
- Off-host backup automation/retention was not evident from repository automation.
- Backend Dockerfile uses mutable `node:20-slim` rather than a pinned digest.
- Conformance PDF misses some secure-link hold-point release attribution.
- Subbie mobile dockets are online-only while offline docket helper code is partial/lossy.
- Offline diary delay/plant quick-add can drop `lotId`.

Suggested PR:

`chore/production-hardening-audit-fixes`

## Recommended Fix Order

1. Fix ITP/offline save truth first. This protects the core field workflow and prevents false "saved" states.
2. Fix hold-point public evidence links next. This directly addresses the superintendent evidence bug and external approval trust.
3. Fix NCR/subcontractor access consistency. This addresses the rare access-denied class of bug the user has already observed.
4. Fix workflow transactions. This prevents impossible domain states: failed ITP with no NCR, overclaimed lots, duplicate diary rows, stale lot progression.
5. Fix onboarding delivery states. This reduces first-user friction and support noise.
6. Plan the private-document migration. Do not rush this without a migration path for existing files and links.
7. Complete ops hardening before opening beyond controlled pilot users.

## Release Readiness Call

Controlled pilot readiness is realistic after the first four fix groups are implemented, tested, and merged through CI.

Open user readiness requires the document privacy migration, onboarding delivery hardening, backup verification, and browser-based end-to-end tests for:

- Register, verify email, login.
- Create company/project.
- Invite internal user.
- Invite subcontractor.
- Assign ITP to lot.
- Subbie completes ITP item with evidence.
- Foreman verifies subbie work.
- Fail ITP item and confirm NCR creation.
- Request hold-point release.
- External superintendent opens email link, views evidence, releases hold point.
- Docket submit/approve flows into diary.
- Partial claim prevents overclaim under concurrent attempts.

