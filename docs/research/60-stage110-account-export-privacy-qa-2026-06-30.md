# Stage 110 - Account Export Privacy QA

Date: 2026-06-30
Branch: `qa/account-export-privacy`

## Scope

Focused account/settings pass covering:

- `/api/auth/export-data`
- `/api/auth/delete-account`
- Settings privacy/export browser flow
- Settings destructive delete error/retry browser flow

Two read-only subagents audited the backend account/export surface and the frontend
settings/profile/session surface in parallel.

## Findings Fixed

### Raw storage locators in account export

`accountPrivacyRoutes.ts` returned raw `avatarUrl`, comment attachment `fileUrl`,
and uploaded document `fileUrl`. Those values can contain Supabase storage
references, legacy public object URLs, local upload paths, or token-bearing query
strings.

Fix:

- Replaced profile `avatarUrl` with `hasAvatar`.
- Removed comment attachment `fileUrl` and added authenticated comment attachment
  `downloadUrl`.
- Removed uploaded document `fileUrl` and added authenticated document
  `downloadUrl`.
- Redacted URL/token-like values inside stored sync queue payloads.
- Redacted webhook URL query values.
- Replaced push subscription endpoint with `endpointOrigin`.
- Replaced scheduled report `recipients` with `recipientCount`.

### Deleted accounts could leave scheduled reports sending

Account deletion removed the user but left user-created scheduled reports active
because `createdById` is nullable and the scheduler processes active due reports.

Fix:

- During account deletion, scheduled reports created by the deleted user are
  deactivated, their recipients are cleared, and `createdById` is nulled before
  the user row is deleted.

### Browser coverage gaps

Settings E2E covered successful data export but did not inspect the downloaded JSON,
and delete-account browser coverage only covered the happy path.

Fix:

- Settings E2E now parses the downloaded JSON and checks that obvious secret fields
  are absent.
- Settings E2E now proves export API failures show an error and produce no download.
- Settings E2E now proves delete-account API failures keep the modal open,
  show the API message, re-enable the button, and avoid navigating to login.

## Verification

Backend:

- `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/siteproof_test npx vitest run src/routes/auth.test.ts --testNamePattern "bearer authentication|privacy-relevant"` - 3 passed
- `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/siteproof_test npx vitest run src/routes/auth/accountDeletionRoutes.test.ts` - 2 passed
- `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/siteproof_test npx vitest run src/routes/auth.test.ts` - 95 passed
- `npm run type-check` - passed
- `npm run lint` - passed

Frontend:

- `npm run lint` - passed with existing `theme.tsx` fast-refresh warning
- `npm run type-check` - passed
- `npm run test:e2e -- e2e/settings.spec.ts --project=chromium --reporter=list` - 13 passed

## Deferred

- The data export endpoint is still a synchronous in-memory JSON response with
  several unbounded collections. For large paying customers, this should become an
  async export job or paged/streamed export with retention and download audit logs.
- Third-party PII minimisation may need a product/legal decision beyond this fix.
  This pass removed scheduled report recipient emails and push endpoint capability
  URLs from the export, but other user-created configuration fields can still
  reference other people.
- The settings E2E mock now covers failure handling. A future live-browser pass
  should exercise the same flows against seeded accounts and real backend routes.
