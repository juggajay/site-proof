# Stage 111 - Account Export Scale QA

Date: 2026-06-30
Branch: `qa/account-export-scale`

## Scope

Focused follow-up to Stage 110 covering:

- `/api/auth/export-data` synchronous response size and heap risk.
- Large transient `syncQueue` payloads.
- Operational account-export collections that can grow without being core records.
- Download response privacy/cache headers.
- Settings export success copy.
- Database indexes for export predicates over large tenant tables.

Two read-only subagents inspected backend and frontend export paths in parallel.

## Findings Fixed

### Oversized sync payloads could dominate the export response

`syncQueue.payload` is arbitrary stored JSON. The export route parsed and sanitized
the full string regardless of size. A stale offline payload or embedded base64 body
could create a very large JSON response and extra CPU/heap pressure.

Fix:

- Added a 20,000 character export ceiling for individual sync payload bodies.
- Oversized payloads now export only:
  - `truncated: true`
  - `originalLength`
  - `maxExportedChars`
- Regression coverage proves oversized payload secrets and large bodies are absent
  from the exported JSON.

### Operational collections were unbounded

Several transient or operational account collections were loaded without caps:
notifications, digest items, alerts, signed URL tokens, sync queue items, and audit
logs. Audit logs already had a 1,000 row cap, but without explicit truncation
metadata.

Fix:

- Added a shared 1,000 record export cap for operational collections.
- Queries fetch `limit + 1` so the response can honestly report truncation.
- Added `exportLimits` metadata:
  - `operationalRecordLimit`
  - `syncPayloadMaxChars`
  - `truncatedCollections`
- Kept canonical construction records complete in this stage: NCRs, diaries, ITP
  completions, test results, lots, comments, documents, consent records, API keys,
  scheduled reports, and webhooks.

### Sensitive download headers were missing

The export returned JSON as an attachment but only set content type and disposition.
Scheduled report artifacts already use stricter no-store style headers.

Fix:

- Added `Cache-Control: private, no-store, max-age=0`.
- Added `Pragma: no-cache`.
- Added `Referrer-Policy: no-referrer`.
- Added `X-Content-Type-Options: nosniff`.

### Success copy overclaimed completion

The settings UI said the data was exported successfully after creating a browser
object URL. The app can know that the download started, but not that the browser
finished saving it.

Fix:

- Changed the success text to `Your data export download has started.`
- Updated unit and E2E assertions.

### Export predicates lacked supporting indexes

The account export filters several large tables by user attribution:

- lots created by the user
- ITP completions completed by the user
- test results entered by the user
- NCRs raised by or assigned to the user
- diaries submitted by the user
- comments authored by the user

Fix:

- Added Prisma schema indexes and migration
  `20260630110000_add_account_export_user_indexes`.
- Local `prisma migrate deploy` applied the migration successfully against
  `siteproof_test`.

## Verification

Backend:

- `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/siteproof_test npm run test -- src/routes/auth.test.ts --testNamePattern "GET /api/auth/export-data"` - 96 passed
- `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/siteproof_test npx vitest run src/routes/auth.test.ts --testNamePattern "caps operational export collections|exports privacy-relevant"` - 2 passed
- `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/siteproof_test npx prisma validate` - passed
- `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/siteproof_test npx prisma migrate deploy` - applied the new migration successfully
- `npm run type-check` - passed
- `npm run lint` - passed

Frontend:

- `npx vitest run src/pages/settings/components/SettingsSections.test.tsx` - 7 passed
- `npm run type-check` - passed
- `npm run lint` - passed with existing `theme.tsx` fast-refresh warning
- `npm run test:e2e -- e2e/settings.spec.ts --project=chromium --reporter=list` - 13 passed

## Deferred

- The complete product shape for very large customers is an async export job:
  `POST` to start, status polling, durable artifact, authenticated download,
  cancellation/retry, and audit trail. That should reuse the scheduled-report
  artifact pattern rather than extending this synchronous route forever.
- Canonical construction records remain synchronous and complete. If customer data
  grows beyond what one request can safely return, move those sections to paged
  generation inside the async export job rather than silently truncating them.
- Frontend can add a richer retry/progress UI after the backend has async jobs.
