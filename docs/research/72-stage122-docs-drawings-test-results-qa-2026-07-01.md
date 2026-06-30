# Stage 122 - Documents, Drawings, Test Results QA

Date: 2026-07-01
Branch: `qa/stage122-docs-drawings-tests`
Base: `d22f03cb fix: guard hold point escalation resolution (#1284)`

## Scope

This stage covered the document register, drawing register, subcontractor document access, and test-results quality evidence flows.

Read-only explorer agents reviewed:

- documents/storage upload, signed URL, versioning, classification, delete, and permission behavior
- drawing upload, revision/supersede, current-set, signed open/download, and permission behavior
- test-results create/update/verify/reject/upload/batch confirm, request forms, NCR linkage, and report coverage

The local browser baseline covered 17 Playwright tests:

- `frontend/e2e/documents.spec.ts`
- `frontend/e2e/subcontractor-documents.spec.ts`
- `frontend/e2e/drawings.spec.ts`
- `frontend/e2e/test-results.spec.ts`

## Findings Fixed

### 1. Already-superseded drawings could be superseded again by direct API call

`POST /api/drawings/:drawingId/supersede` hid this path in the UI, but the backend did not reject a source drawing that already had `supersededById`.

Impact: a direct API caller could create an invalid revision chain and leave the drawing register with ambiguous current revision history.

Fix:

- `backend/src/routes/drawings.ts` now rejects supersede requests unless the source drawing is still current.
- `backend/src/routes/drawings.test.ts` now proves the rejected request does not create a document, does not store a file, and leaves the old revision link unchanged.

### 2. Read-only users could trigger AI photo classification

`POST /api/documents/:documentId/classify` checked read access, then sent the image to Anthropic before checking mutation access. Saving the classification already required write access.

Impact: a viewer could trigger external AI processing for customer documents even though they cannot edit the document.

Fix:

- `backend/src/routes/documents/classificationRoutes.ts` now requires document mutation access before classification.
- `backend/src/routes/documents.test.ts` now proves a project viewer can read documents but cannot trigger classification, and the Anthropic fetch is not called.

### 3. Browser document/drawing mocks were looser than production

The desktop documents/drawings E2E fixtures included raw `fileUrl` values even though backend responses intentionally strip stored file URLs.

Impact: tests could accidentally pass even if the UI started relying on raw storage URLs.

Fix:

- `frontend/e2e/documents.spec.ts` and `frontend/e2e/drawings.spec.ts` now omit raw `fileUrl` from seeded list/current-set responses.
- `frontend/src/pages/documents/DocumentsPage.tsx` now models `fileUrl` as optional/null, matching production response shape.

## Verification

Backend:

```powershell
cd backend
$env:DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5432/siteproof_stage122_test'
$env:JWT_SECRET='local-stage122-jwt-secret-at-least-32-chars'
npm test -- --run src/routes/drawings.test.ts src/routes/documents.test.ts
```

Result: 146 passed.

Frontend/browser:

```powershell
cd frontend
npx playwright test e2e/documents.spec.ts e2e/subcontractor-documents.spec.ts e2e/drawings.spec.ts e2e/test-results.spec.ts --project=chromium --reporter=list
```

Result: 17 passed.

Static checks:

- `backend npm run format:check`: passed
- `backend npm run type-check`: passed
- `backend npm run lint`: passed
- `frontend npm run format:check`: passed
- `frontend npm run type-check`: passed
- `frontend npm run lint`: passed with the existing `src/lib/theme.tsx` fast-refresh warning only
- `git diff --check`: passed

Local note: `npm run db:generate` still fails on this Windows machine because certificate verification fails against `binaries.prisma.sh`. TLS was not weakened. The local verification used generated Prisma client/engine artifacts copied from Stage 121 after confirming the Prisma schema hash matched.

## Remaining Follow-Ups

These are not blockers from this stage, but they are good future coverage/hardening targets:

- Add direct signed-download tests after document delete and after permission revocation, not only signed URL validation.
- Decide whether versioning unlocked attached evidence should be blocked or should migrate attachments to the latest version.
- Add a full browser batch-certificate flow for test results: batch upload, review edit, batch confirm, failed-test NCR prompt.
- Add browser coverage for classic subcontractor test-results scope and module-off behavior.
- Add browser coverage for the mobile drawing register card layout on `/projects/:projectId/drawings`.
- Add explicit API coverage for null drawing revisions under the `NULLS NOT DISTINCT` unique index.
