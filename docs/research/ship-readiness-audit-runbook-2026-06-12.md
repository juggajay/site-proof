# Ship Readiness Audit Runbook - 2026-06-12

Purpose: repeat the same audit after fixes land, without relying on memory or one-off browser poking.

This runbook covers the audit used for `ship-readiness-live-audit-2026-06-12.md`.

## Safety Rules

- Do not read, print, commit, or paste production secrets, cookies, JWTs, database URLs, or browser session data.
- Do not run Prisma schema-changing commands against production.
- Do not run destructive cleanup against production fixtures until the audit is complete.
- Use throwaway audit accounts and a throwaway audit project.
- Keep credential JSON local under an ignored directory such as `.deepsec/data/`.
- Record only non-secret fixture IDs and results in docs.

## Required Inputs

- Production frontend URL.
- Production backend URL.
- A way to create or reuse throwaway audit users.
- One throwaway company/project.
- One subcontractor company linked to that project.
- Role accounts for:
  - Owner
  - Admin
  - Project manager
  - Quality manager
  - Site manager
  - Foreman
  - Site engineer
  - Viewer
  - Subcontractor admin

## Fixture Setup

Create a stable audit dataset:

1. Create a company named like `Audit Civil <run-id>`.
2. Create a project named like `Audit Highway <run-id>`.
3. Add the head-contractor role accounts to the company/project.
4. Invite/register the subcontractor admin through the subcontractor portal flow.
5. Enable subcontractor portal access for:
   - Lots
   - ITPs
   - Hold points
   - Test results
   - NCRs
   - Documents
6. Create an ITP template with:
   - Standard contractor item.
   - Photo evidence item.
   - Witness point item.
   - Hold point item.
   - Subcontractor-responsible item.
   - At least one `verification` point-type item, to catch mobile checklist crashes.
7. Create at least two lots:
   - Head-contractor-only lot.
   - Subcontractor-assigned lot with `canCompleteITP: true`.

Record non-secret IDs in a fixture doc like:

- Company ID.
- Project ID.
- Subcontractor company ID.
- Template ID.
- Lot IDs.

Do not record passwords or tokens in docs.

## Static Audit Lanes

Run these as separate lanes so independent areas can be reviewed in parallel.

### Access And Permission Lane

Inspect:

- Auth storage and `/api/auth/me` behavior.
- Project route guards.
- Role protected routes.
- Subcontractor portal identity checks.
- Backend project access helpers.
- Notification links for subcontractor recipients.
- UI actions that call endpoints the current role cannot use.

Report:

- Role mismatch.
- Stale cached permission risk.
- Internal route links shown to portal users.
- Frontend route allows role but backend mutation denies.

### Lots, ITPs, Hold Points, NCR Lane

Inspect:

- Lot creation and assignment.
- ITP template, instance, completion, photo, N/A, fail paths.
- Hold-point release request and public release token paths.
- Hold-point chase/reminder emails.
- NCR creation and evidence linking.
- Audit log coverage for quality events.

Report:

- Any role that can view but cannot act unexpectedly.
- Any item that cannot be passed, failed, marked N/A, or released.
- Any uploaded evidence not durably linked to the target record.
- Any public evidence package over-sharing data.

### Dockets, Diary, Documents, Claims Lane

Inspect:

- Docket submit/review/approval.
- Diary auto-population from dockets.
- Document upload/delete/re-file paths.
- Progress claim submission, certification, dispute, payment, evidence package.
- Notification and email links for these flows.

Report:

- Silent failures.
- Evidence/document links that disappear after a status transition.
- Attachment response shape mismatches.
- Missing UI refresh after mutation.

### Operations And Safety Lane

Inspect:

- GitHub workflows.
- Deployment config.
- Production API URL config.
- Backup scripts.
- Retention scripts.
- Hard-delete routes.
- `.gitignore` coverage for generated dumps and local credentials.

Report:

- Anything that can leak production data into the repo.
- Anything destructive that lacks confirmation.
- Any deploy config that contradicts documentation.
- CI checks that do not match production behavior.

## Live Browser QA Matrix

Use an isolated browser session or headless Playwright. Do not rely on personal browser storage.

For each role, record:

- Login result.
- Final URL after login.
- Route URL.
- Final URL after navigation.
- Page classification:
  - `loaded`
  - `access-warning`
  - `login-redirect`
  - `not-found`
  - `error-page`
  - `navigation-error`
- Console/page errors.
- Failed API responses.

### Owner Routes

- `/dashboard`
- `/projects`
- `/projects/:projectId`
- `/projects/:projectId/lots`
- `/projects/:projectId/lots/:headLotId`
- `/projects/:projectId/itp`
- `/projects/:projectId/hold-points`
- `/projects/:projectId/ncr`
- `/projects/:projectId/documents`
- `/projects/:projectId/dockets`
- `/projects/:projectId/claims`
- `/projects/:projectId/subcontractors`

### Foreman Routes

- `/dashboard`
- `/projects/:projectId/foreman/today`
- `/projects/:projectId/lots`
- `/projects/:projectId/lots/:headLotId`
- `/projects/:projectId/lots/:subcontractorLotId`
- `/projects/:projectId/hold-points`
- `/projects/:projectId/ncr`
- `/projects/:projectId/documents`
- `/projects/:projectId/dockets`

### Viewer Routes

- `/dashboard`
- `/projects/:projectId/lots`
- `/projects/:projectId/lots/:headLotId`
- `/projects/:projectId/itp`
- `/projects/:projectId/claims`

### Subcontractor Routes

- `/subcontractor-portal`
- `/subcontractor-portal/work`
- `/subcontractor-portal/itps`
- `/subcontractor-portal/lots/:subcontractorLotId/itp`
- `/subcontractor-portal/holdpoints`
- `/subcontractor-portal/tests`
- `/subcontractor-portal/ncrs`
- `/subcontractor-portal/documents`
- `/projects/:projectId/lots/:subcontractorLotId`
- `/projects/:projectId/lots/:headLotId`

Expected result:

- Portal routes should load.
- Internal `/projects/...` routes should deny subcontractors unless a deliberate bridge route exists.
- Notifications should not send subcontractors to denied internal routes.

## Live API Workflow Checks

Run against throwaway workflow lots, not the original baseline lots.

### Foreman ITP

1. Create a head-contractor workflow lot with the audit ITP template.
2. Fetch `/api/itp/instances/lot/:lotId`.
3. Complete a normal item with `POST /api/itp/completions`.
4. Fail a different normal item with NCR details.
5. Attempt direct completion of a hold-point item.

Expected:

- Normal pass succeeds.
- Failed item succeeds and creates an NCR.
- Direct hold-point completion is blocked until release flow records release.

### Subcontractor ITP

1. Create a subcontractor-assigned workflow lot with `canCompleteITP: true`.
2. Fetch `/api/itp/instances/lot/:lotId?subcontractorView=true`.
3. Complete a subcontractor-responsible item.
4. Fail an allowed item and confirm NCR creation.
5. Attempt access to an unassigned lot.

Expected:

- Assigned-lot pass/fail succeeds.
- Unassigned lot is denied.
- If project/assignment requires verification, returned verification state is correct.

### Hold-Point External Link

1. Request hold-point release to an external superintendent email.
2. Open the generated `/hp-release/:token` link.
3. Confirm evidence package loads without login.
4. Trigger/send chase reminder.
5. Confirm chase recipient/link also uses public token flow.

Expected:

- External user never needs an account.
- Evidence links use public token route.
- Evidence package includes only evidence relevant up to that hold point.

### NCR Evidence

1. Create NCR through normal API/UI path.
2. Upload evidence through the NCR evidence endpoint.
3. For foreman quick capture, confirm upload is followed by NCR evidence linking.

Expected:

- Evidence appears on NCR.
- Audit log records evidence attachment.

### Docket To Diary

1. Create/submitted or locked diary for a project/date.
2. Approve a docket for that same project/date.
3. Inspect response and diary.

Expected:

- Approval either blocks with a clear conflict or returns an explicit diary sync warning.
- It must not silently approve while omitting diary evidence.

### Claim Certification

1. Submit claim.
2. Certify with certificate document.
3. Confirm certificate link appears immediately and after reload.
4. Dispute certified claim.
5. Confirm certificate link is still recoverable.

Expected:

- Certification document linkage survives dispute.

## Report Format

For each finding record:

- Severity: P0, P1, P2, or P3.
- Area.
- Exact file/line references when static.
- Live route/API evidence when dynamic.
- User impact.
- Repro steps.
- Fix direction.
- Whether this blocks controlled beta.

## Re-Audit Exit Criteria

Controlled beta can start when:

- No P0 findings remain.
- No P1 findings remain in lot, ITP, hold-point, NCR, subcontractor portal, auth, or evidence flows.
- Production live QA matrix has no unexpected `error-page`, `not-found`, or background 403s.
- Foreman/subcontractor ITP pass/fail flows work through UI and API.
- External superintendent hold-point links work without login.
- NCR evidence attachment is durable.
- Docket approval cannot silently lose diary evidence.
- Backups and retention scripts have production safety rails.

Open signup should wait until:

- Deletion/retention/backup safety is complete.
- CI and branch protection are enforced.
- A full production smoke test passes after deployment.
