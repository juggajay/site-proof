# Stage 137 - Document Versioning QA

Date: 2026-07-01
Branch: `qa/stage137-user-settings-notifications`
Base: `origin/master` at `9ba4b7a8` (`Fix evidence storage cleanup and release guards`)

## Scope

Audited the document register versioning path that remained open after the
Stage 136 document/evidence cleanup work:

- Generic document version upload and history endpoints.
- Documents page visibility of uploaded versions.
- Reader vs editor behavior for document versions.
- Evidence-linked ITP/NCR documents that must not be silently superseded by the
  generic document register version endpoint.

Two read-only subagents covered backend document-version access and frontend
document/drawing UI coverage before implementation.

## Findings Fixed

1. Document versioning existed in the backend but had no Documents-page workflow.
   - Added a `DocumentVersionsModal` on the Documents page.
   - Every document card now exposes version history.
   - Editors can upload a new version from the register.
   - Readers can inspect and download/open historical versions without upload controls.
   - Current document cards now show a version badge when the latest version is greater than v1.

2. Historical versions could be downloaded but not opened inline from the UI.
   - Added a View action for previewable version records.
   - The View action requests an inline signed URL for that specific historical document id.
   - Browser coverage asserts the v1 signed-url call uses `disposition=inline`.

3. Generic document version upload could create a new latest document for workflow evidence while the workflow still pointed at the old document.
   - Added a backend guard that rejects generic version uploads for documents linked as ITP completion attachments.
   - Added the same guard for documents linked as NCR evidence.
   - Rejection happens before transaction/write and cleans the uploaded temp file.
   - Users must replace those files from the owning ITP/NCR workflow instead.

## Confirmed Existing Behavior

- Existing document access signed URLs are still generated per document version id.
- Drawings continue to use their separate drawing-revision workflow.
- Frontend readers already have access to document registers and now get read-only version history.

## Deferred / Notes

- The version endpoint response still does not expose a dedicated `rootDocumentId`; current UI can operate from the selected document id and returned version list.
- This stage did not broaden the full cross-role live-browser loop; it closed the remaining document-versioning gap from the endpoint inventory.
- `docs/research/07-onboarding-implementation.md` is deleted in the local worktree but unrelated to this stage and should not be staged in this PR.

## Verification

- `backend`: disposable local Postgres `siteproof_test` on localhost, Prisma migrations applied successfully.
- `backend`: `npm test -- src/routes/documents.test.ts` - 83 passed.
- `backend`: `npm run type-check` - passed.
- `backend`: `npm run lint` - passed.
- `backend`: `npm run format:check` - passed.
- `frontend`: `npm run test:unit -- src/pages/documents/DocumentsPage.test.tsx src/pages/documents/components/DocumentGrid.test.tsx` - 12 passed.
- `frontend`: `npm run type-check` - passed.
- `frontend`: `npm run lint` - passed with one existing warning in `frontend/src/lib/theme.tsx`.
- `frontend`: `npm run format:check` - passed.
- `frontend`: `npx playwright test e2e/documents.spec.ts --project=chromium --reporter=list` - 6 passed.
- `git diff --check` - passed.
- `fallow audit --base origin/master --format json --quiet` - advisory warn: 0 dead code introduced, 0 complexity introduced, 6 test-duplication groups introduced by additional document route fixtures.
