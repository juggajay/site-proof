# Live Sacrificial-Data Dogfood QA Plan

Last updated: 2026-05-21

## Purpose

This plan is for a fresh Codex session to test SiteProof like a brand-new paying
customer would. It is a live end-to-end QA pass using a fresh sacrificial
account and sacrificial data only.

This is report-only QA. The QA agent must not fix code, commit, open PRs, run
migrations, inspect secrets, or touch customer/real data.

## Core Safety Rules

- Create a new QA account through the app UI. Use a unique timestamped identity,
  for example `SiteProof QA 2026-05-21 <timestamp>`.
- Use a visible browser that Jay can watch. Prefer the Codex in-app browser if
  it is visible to Jay. If using gstack/browser automation, use the visible
  Chrome/Side Panel flow rather than a purely headless browser. Do not continue
  a live mutating QA run in an invisible browser unless Jay explicitly approves
  that fallback.
- Use only test names clearly prefixed with `QA DOGFOOD <timestamp>`.
- Mutate only records created during this QA run.
- Do not delete or alter existing non-QA projects, users, files, templates,
  dockets, reports, settings, or storage objects.
- Do not inspect, print, save, or log secrets, cookies, JWTs, HTTP headers,
  `DATABASE_URL`, Supabase keys, Railway variables, or browser session values.
- Do not use Prisma, SQL, migrations, `prisma db push`, `prisma db execute`,
  Supabase API, Railway writes, backups, restores, or service-role keys.
- Browser/UI only unless read-only source inspection is needed to understand
  expected behavior.
- If email verification or invite links are required, pause and ask Jay to
  complete the email step or provide only the safe app link. Do not ask for
  mailbox credentials.
- If the intended live app is invite-only and public registration is disabled,
  that is not a QA failure by itself. Pause and ask Jay for one of these safe
  unblocks:
  - a QA invite/acceptance link for the new timestamped QA account, or
  - Jay logs in as an owner/admin in the visible browser and creates the QA
    invite while the agent watches but does not inspect secrets.
- If a destructive action is useful, only perform it against QA-created data and
  record before/after evidence.
- If a blocker appears, capture repro steps, screenshot, console/request
  evidence if available, then continue to the next independent workflow.

## Required Output

Create a timestamped folder:

```text
.gstack/dev-browser/live-dogfood-qa-YYYY-MM-DD/
```

Write:

- `findings-report.md`
- `qa-matrix.md`
- `account-and-data-manifest.md`
- `screenshots/`
- `browser-console-and-network-summary.json` if supported by the browser tool

Do not include credentials, tokens, cookies, headers, or private signed URLs in
any artifact.

The final report must include:

- Health score `/100`
- Blockers
- High issues
- Medium issues
- Low issues
- Workflow matrix with `Pass`, `Fail`, `Partial`, or `Skipped`
- Repro steps for every issue
- Screenshot path for every visual issue
- Exact account/data created, using non-secret identifiers only
- Cleanup recommendation listing QA data that can be deleted later, without
  deleting it unless Jay explicitly approves cleanup

## Phase 0 — Setup And Baseline

1. Confirm current repo branch/status for context only.
2. Confirm the live app loads while logged out.
3. Capture public pages:
   - `/landing`
   - `/login`
   - `/register`
   - `/forgot-password`
   - `/privacy-policy`
   - `/terms-of-service`
   - `/this-route-should-not-exist`
4. Check desktop and mobile widths:
   - Desktop: `1440x900`
   - Mobile: `390x844`
5. Record console errors and request failures.

## Phase 1 — New Account, Auth, Profile

Create a new QA owner/admin-style user through the UI.

If public self-registration is unavailable:

1. Confirm the canonical live app URL with Jay.
2. Ask Jay to open the visible browser and log in as an owner/admin.
3. Have Jay create or send a QA invite for a timestamped QA email.
4. Use only the safe invite/acceptance link. Do not inspect mailbox credentials,
   cookies, headers, auth storage, or dashboard environment variables.
5. Continue the same Phase 1 checks from the accepted QA account.

Test:

1. Register new account.
2. Email verification flow if enforced.
3. Logout.
4. Login with the new account.
5. Bad password login.
6. Forgot password request, but do not change the password unless Jay approves
   email flow.
7. Magic link if available.
8. Profile page:
   - Update name/phone if available.
   - Avatar upload if safe and supported.
   - Confirm changes persist after refresh.
9. Settings page:
   - Notification preferences.
   - Privacy/data export if available.
   - MFA setup only if it does not require exposing an authenticator secret in
     logs. If unsafe, mark skipped.
10. Logout and login again.

Evidence:

- Confirm session survives refresh.
- Confirm logout clears access.
- Confirm validation messages are understandable.

## Phase 2 — Company And Admin Setup

Using the QA account only:

1. Company settings page.
2. Company profile update.
3. Logo upload if safe.
4. Company users/member area.
5. Invite user flow if available.
6. Role-change UI if available.
7. Audit log page renders and filters.

Do not invite real users. Use timestamped QA emails. If an invite email link is
required, pause for Jay.

## Phase 3 — Project Creation And Project Shell

Create a new project named:

```text
QA DOGFOOD <timestamp> Civil Test Project
```

Use realistic Australian civil details:

- State: `NSW` first if selectable
- Specification set: `TfNSW` if selectable
- Project number: `QA-<timestamp>`
- Location/address: safe test address

Test:

1. Project create.
2. Project list.
3. Project detail.
4. Dashboard project counts reflect the project.
5. Project settings:
   - General settings
   - Modules
   - Notifications
   - Areas
   - Users
   - ITP templates tab
6. Project navigation side/menu behavior on desktop and mobile.

## Phase 4 — Lots And Areas

Create test areas and lots.

Minimum data:

- Area: `QA Area A`
- Lot 1: `QA-Lot-001`, Earthworks or Pavement activity
- Lot 2: `QA-Lot-002`, Concrete or Structures activity

Test:

1. Create lot.
2. Edit lot.
3. Lot list filters/search/sort.
4. Mobile lot list.
5. Lot detail tabs.
6. Assign ITP template to lot.
7. Try invalid lot data and confirm validation.
8. Bulk actions only on QA lots.
9. Print/export lot register if available.
10. QR/label print preview if available, but do not print physically.

## Phase 5 — ITP Workflow

Use the seeded global templates if visible.

Test:

1. Open ITP templates/library.
2. Confirm correct state/spec templates appear for project.
3. Copy or assign template if workflow expects it.
4. Open lot ITP checklist.
5. Complete normal item.
6. Complete item requiring evidence if available.
7. Upload attachment/photo if supported.
8. Mark hold point/witness point item.
9. Verify completed item as authorised user.
10. Try to reject/modify after verify and record expected behavior.
11. Confirm audit/history entries if visible.

## Phase 6 — Hold Points

Test authenticated and public release paths.

1. Request hold point release from QA lot/ITP if available.
2. Chase/reminder action if available.
3. Release as authenticated user.
4. Create or use public release link if the app exposes one.
5. In a separate logged-out context, open `/hp-release/:token`.
6. Submit public release with QA identity only.
7. Confirm status updates in main app.
8. Confirm invalid/used/expired token behavior if safely testable.

## Phase 7 — Test Results

Create QA test results.

1. Create test result for QA lot.
2. Enter numeric result and pass/fail.
3. Upload certificate/document if supported.
4. Verify result.
5. Reject result if flow supports it.
6. Try invalid transition after verified.
7. Export/download test results CSV/PDF if available.
8. Confirm Australian date formatting and file names.

## Phase 8 — NCR Lifecycle

Create an NCR against QA lot.

1. Create NCR.
2. Add evidence/photo/document.
3. Respond/investigate.
4. QM review.
5. Rectify.
6. Submit for verification.
7. Reject rectification path if available.
8. Approve/close.
9. Reopen if available.
10. Export/download NCR PDF.
11. Confirm evidence-required behavior.
12. Confirm audit/history entries if visible.

## Phase 9 — Daily Diary And Delay Register

For today’s date and one past date:

1. Open diary.
2. Weather auto-population.
3. Add personnel.
4. Add plant.
5. Add activities.
6. Add delays.
7. Add deliveries/events if available.
8. Save draft.
9. Refresh and confirm persistence.
10. Submit diary.
11. Try editing submitted diary.
12. Add addendum if available.
13. Export diary PDF if available.
14. Open delay register and export CSV.
15. Confirm date formatting is Australian and reports are branded SiteProof,
    not SiteProof v2.

## Phase 10 — Dockets

Use subcontractor portal if needed.

As internal/admin:

1. Open docket approvals page.
2. Confirm empty state or existing QA dockets.

As subcontractor account:

1. Create new docket.
2. Add labour.
3. Add plant.
4. Add lot allocations.
5. Submit docket.

Back as internal/admin:

1. Approve docket.
2. Reject/query another QA docket if feasible.
3. Confirm approved docket populates diary where expected.
4. Confirm audit/history if visible.

## Phase 11 — Documents, Drawings, Photos

Use small harmless generated files only.

Create local test files under:

```text
.gstack/dev-browser/live-dogfood-qa-YYYY-MM-DD/files/
```

Files:

- `qa-test.pdf`
- `qa-image.png`
- `qa-drawing.pdf`

Test:

1. Upload project document.
2. Upload lot document.
3. Download document.
4. Replace/version document if supported.
5. Favorite/tag/filter document.
6. Delete only QA-created document if testing delete.
7. Upload drawing.
8. Supersede drawing.
9. Download current set.
10. Photo upload/classification if available.
11. Confirm storage URLs/downloads work without exposing signed URLs in report.

## Phase 12 — Claims, Costs, Reports

Use QA lots only.

1. Confirm lots can become claimable only after required quality steps.
2. Create progress claim.
3. Submit claim.
4. Record certification.
5. Record payment.
6. Dispute if safely testable on separate QA claim.
7. Evidence package download.
8. Completeness check.
9. Claims CSV export.
10. Costs page loads and reflects QA data if applicable.
11. Reports page:
    - Lot status
    - NCR
    - Test results
    - Diary
    - Claims
    - Advanced analytics if available
12. Export PDFs/CSVs.
13. Confirm:
    - SiteProof branding
    - AU date format
    - Sensible filenames
    - CSV formula injection safety if a QA value starting with `=`, `+`, `-`,
      or `@` can be created without harming data

## Phase 13 — Subcontractor Portal And Role Boundaries

Create at least one QA subcontractor company and one QA subcontractor user.

If invite email link is required, pause for Jay to supply or complete the link.

Test subcontractor:

1. Accept invite.
2. Login/logout as subcontractor.
3. Subcontractor dashboard.
4. My Company page.
5. Assigned work.
6. Dockets list/create/edit.
7. ITP list.
8. Lot ITP page.
9. Hold points.
10. Tests.
11. NCRs.
12. Documents.

Role boundary checks:

1. Subcontractor cannot open `/company-settings`.
2. Subcontractor cannot open `/audit-log`.
3. Subcontractor cannot open unrelated project routes.
4. Subcontractor cannot see another subcontractor’s QA data if Subbie B can be
   created safely.
5. Viewer/foreman/site engineer roles, if safely created, can access only
   expected pages.
6. Direct URL attempts should show access denied or redirect, not leak data.

## Phase 14 — Mobile Field-User Pass

At `390x844` mobile viewport:

1. Login.
2. Dashboard.
3. Project detail.
4. Foreman today route: `/projects/:projectId/foreman/today`
5. Lots list.
6. Lot detail.
7. ITP checklist.
8. Diary quick entry.
9. Dockets.
10. NCR list/detail.
11. Documents.
12. Reports.
13. Header/menu/navigation.
14. Cookie banner if visible.
15. Confirm no overlapping text, clipped buttons, inaccessible actions, or
    hidden critical controls.

## Phase 15 — Negative And Resilience Checks

Perform safe negative tests only:

1. Invalid login.
2. Expired/invalid public hold point token if possible.
3. Invalid projectId route.
4. Invalid lotId route.
5. Upload invalid file type if safe.
6. Oversized file attempt only if using a tiny fake file with wrong extension;
   do not upload huge files.
7. Refresh during form workflow.
8. Browser back/forward after submit.
9. Network failure simulation only if browser tooling supports local request
   blocking without touching production services.
10. Confirm error messages are helpful and do not leak stack traces or secrets.

## Phase 16 — Audit Log Verification

As admin/owner QA account, open audit log.

Verify audit entries exist for QA actions where expected:

- Login/register if logged
- Project create/update
- Lot create/update/conform
- ITP complete/verify/reject
- Hold point request/release
- Test result create/verify
- NCR lifecycle
- Diary submit/addendum
- Docket approve/reject/query
- Claim submit/certify/payment
- User/subbie invite and portal access changes
- Document/drawing uploads/deletes if logged

Record missing audit rows as findings. Do not query the database.

## Phase 17 — Cleanup / Preservation

Do not blindly delete all QA data.

Preferred:

1. Leave the QA project and accounts in place for Jay to inspect.
2. Mark names clearly with `QA DOGFOOD <timestamp>`.
3. In `account-and-data-manifest.md`, list every created record and whether it
   is safe to delete later.

Only delete QA-created data if Jay explicitly approves cleanup during the
session.

## Final Answer Requirements

The fresh Codex session should finish with:

- Health score
- Whether the app is paying-user ready
- Top 5 issues
- Workflows that passed end-to-end
- Workflows skipped and why
- Manual Jay actions required
- Paths to all artifacts
