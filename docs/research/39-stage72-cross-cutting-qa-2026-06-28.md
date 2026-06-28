# Stage72 Cross-Cutting QA - Reports, Notifications, Documents

Date: 2026-06-28
Branch: `qa/stage72-cross-cutting-audit`

## Scope

This pass checked cross-cutting areas that can quietly break trust after the main lot, ITP, claims, docket, company-admin, and storage passes:

- Reports and printed/exported report detail views.
- Notification category preferences, daily digests, and hold-point release emails.
- Document/evidence attachment access where files later appear in ITP or hold-point evidence packages.

## Fixed in This Pass

1. Test and Diary reports could show a full summary total while the detail table only contained the first page. The backend already returned pagination metadata, but the UI did not surface it. Test and Diary detail tables now show the same truncation caption pattern used by Lot and NCR reports.

2. Daily digest emails now re-check current per-category email preferences at send time. If a user disables a category after an item was queued, that queued item is deleted and not emailed.

3. Hold-point release confirmation emails no longer bypass per-user hold-point release email preferences. The direct confirmation email is now sent only to users whose preference-aware hold-point release email was sent immediately.

4. ITP completion attachments now call the normal document read-access gate before linking an existing document. This prevents a user from adding a document they cannot otherwise read into ITP/hold-point evidence.

## Verified

- Frontend report caption test: passed.
- Backend hold-point release confirmation helper tests: passed.
- Backend notification digest tests: passed.
- Full backend ITP route suite: passed.
- Frontend type-check: passed.
- Backend type-check: passed.
- Frontend lint: passed with one pre-existing warning in `frontend/src/lib/theme.tsx`.
- Backend lint: passed with one pre-existing warning in `backend/src/lib/dataRetention.test.ts`.

## Deferred Follow-Ups

- Claims report and NCR report aggregation can still be made more scalable with DB-level aggregates and export-specific endpoints.
- Report date filtering still mixes date strings and server-side date boundaries in some routes; a project-timezone report helper would reduce future mistakes.
- The legacy ITP/NCR path that accepts an already-stored `fileUrl` still trusts the reference shape rather than proving the object exists. The safer long-term direction is to require `documentId` from the normal upload endpoint or add storage existence checks before record creation.
