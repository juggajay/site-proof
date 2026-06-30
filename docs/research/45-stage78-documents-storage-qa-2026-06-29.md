# Stage 78 Documents, Storage, Evidence, Drawings, and Photos QA - 2026-06-29

## Scope

Focused audit of document storage and evidence surfaces:

- Backend document signed URL minting, validation, download, storage path
  ownership, and response scrubbing.
- Claim certification document selection.
- Desktop Documents and Drawings pages.
- Foreman shell Docs and Photos data loaders.
- Document access URL behavior for previews vs downloads.
- Existing document/drawing/photo browser coverage and storage-adjacent tests.

Stage numbering note: the active staged QA sequence is Stage 78. Any older
`Stage 14` / `Stage 15` wording in historic ledgers or scratch notes is stale
local numbering, not the current audit sequence.

## Subagent Coverage

- Backend storage/access explorer reviewed document upload, signed URL,
  download, Supabase/local storage guards, drawing storage, NCR/ITP/hold-point
  evidence serializers, comments, and claims evidence paths.
- Frontend documents/drawings/photos explorer reviewed desktop Documents,
  Drawing Register, mobile shell Docs, mobile shell Photos, preview/download
  behavior, and pagination/discoverability.
- Test coverage explorer reviewed route-level, unit, and Playwright coverage for
  document access, evidence attachments, current-set downloads, NCR evidence,
  and shell storage behavior.

## Fixes Made

- Public signed URL validation now re-checks the token owner's current document
  access before returning `valid: true`. A token becomes invalid if the user
  loses project/document access after it is minted.
- Claim certification now only accepts same-project documents whose
  `documentType` is `certificate` and `category` is `certification`. Same-project
  photos or other documents can no longer be attached as the certification
  document.
- Desktop Documents now uses backend pagination metadata and exposes
  Previous/Next controls, so records beyond the first 100 are reachable.
- Desktop Documents write controls now use the loaded project-scoped role. Viewer
  users keep read/download access but do not see upload, favourite, or delete
  controls.
- Document upload drag/drop and modal entry points now no-op when the current
  project role cannot upload documents.
- Desktop Drawings write controls now use the loaded project-scoped role. Viewer
  users can still download the current set but cannot upload, supersede, delete,
  or change status.
- Mobile shell Docs now walks drawing-register pagination instead of silently
  stopping after page 1.
- Mobile shell Photos now walks photo document pagination instead of silently
  stopping after page 1.
- Mobile shell document preview now requests inline signed URLs rather than
  forcing attachment downloads.

## Verification

- Frontend format:
  - `npm run format:check`
  - Result: passed.
- Frontend type check:
  - `npm run type-check`
  - Result: passed.
- Frontend lint:
  - `npm run lint`
  - Result: passed with the inherited `src/lib/theme.tsx`
    `react-refresh/only-export-components` warning.
- Frontend targeted unit tests:
  - `npm run test:unit -- src/pages/documents/DocumentsPage.test.tsx src/pages/documents/components/DocumentsPageChrome.test.tsx src/lib/documentAccess.test.ts src/shell/screens/docs/test/useDocsShellData.test.tsx src/shell/screens/photos/test/usePhotosShellData.test.tsx`
  - Result: 20 passed.
- Frontend targeted Playwright E2E:
  - `npm run test:e2e -- e2e/documents.spec.ts e2e/drawings.spec.ts`
  - Result: 8 passed.
- Backend format:
  - `npm run format:check`
  - Result: passed.
- Backend type check:
  - `npm run type-check`
  - Result: passed after generating Prisma Client with
    `NODE_EXTRA_CA_CERTS=C:\Users\jayso\.avg-web-shield-root.pem npx prisma generate`.
- Backend lint:
  - `npm run lint`
  - Result: passed.
- Backend non-DB storage/access tests:
  - `npm test -- src/routes/documents/storage.test.ts src/routes/documents/fileHelpers.test.ts src/routes/documents/access.test.ts`
  - Result: 12 passed.
- Advisory changed-code audit:
  - `fallow audit --base origin/master --format json --quiet`
  - Result: failed advisory gate. Investigated. Fallow counted the two
    AVG-deleted research docs as local changes even in a clean detached
    worktree, but the committed PR diff is 23 files and does not delete those
    docs. No dead code was introduced. Remaining new-only findings are inherited
    duplicated E2E/test setup touched by this PR and a reduced `DrawingsPage`
    complexity finding (cyclomatic 21, cognitive 12) after helper extraction.

## Local Verification Gap

- DB-backed backend route tests were not run locally because this isolated
  worktree has no `DATABASE_URL` configured. I did not point tests at production.
  CI should run the new route regressions against its safe test database:
  - `npm test -- src/routes/documents.test.ts src/routes/claims.test.ts`

## Deferred Findings

- Drawing "Download Current Set" still opens multiple files through scripted
  anchor clicks. A backend ZIP endpoint would be more reliable for browser
  popup/download policies.
- Public hold-point evidence document downloads need a dedicated backend route
  regression proving released evidence links mint/download through the
  backend-mediated document access path.
- NCR evidence has good serializer coverage, but route-level list/signed-url
  coverage should pin photo vs document evidence access and category separation.
- Some Playwright document/drawing mocks still include raw `fileUrl` values even
  though production responses increasingly strip storage locators. Continue
  tightening mocks so browser tests fail if UI relies on raw storage URLs.
- The legacy ITP attachment path can still create a document from a client
  supplied same-project stored `fileUrl`. Existing project ownership checks
  reduce exposure, but a broader response-sanitization and intake hardening pass
  is still worth scheduling.

## Next Suggested Area

Stage 79 should audit project switching and layout-route continuity end to end:
project selector behavior, stale project IDs in URLs, redirects when switching
from a restricted module to a lower-permission project, mobile bottom nav state,
and dashboard quick links.
