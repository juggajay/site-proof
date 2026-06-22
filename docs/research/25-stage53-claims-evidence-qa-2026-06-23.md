# Stage 53 Claims Evidence QA

Date: 2026-06-23  
Branch: `qa/stage53-claims-evidence-qa`  
Base: `origin/master` at `d4196d7548c368d37f14d55bd33eb120149f08a4`

## Scope

Audited the progress-claims evidence package path after the reporting/export pass:

- Backend evidence-package route contract.
- Claim evidence PDF output.
- Claim submit/export ordering and timestamps.
- Evidence package modal failure/retry behavior.
- Certification document access from the claims register.

Two read-only subagents reviewed backend and frontend claims/evidence behavior independently. Their useful findings were verified against the branch before changes were made.

## Fixed In This PR

1. Claim evidence PDFs now include an evidence manifest.
   - The PDF now lists per-lot document filenames, document types, captions, upload dates, and document IDs when photo/document evidence is present.
   - This turns the previous count-only PDF into a usable evidence index.

2. Claim evidence PDFs now read hold points from the backend's actual contract.
   - Backend returns `lot.holdPoints`.
   - PDF code previously looked for `lot.itp.holdPoints`, so released hold-point counts could be omitted.

3. Evidence package section options no longer silently suppress selected sections.
   - If a user selects test results, NCRs, hold points, ITP, or photos while detailed lot metadata is off, the selected section still renders under the relevant lot.

4. Declaration wording no longer falsely states all lots are completed.
   - The fixture intentionally includes an in-progress lot at 75%.
   - The declaration now says the package describes the work claimed and evidence available at generation time.

5. Claim submit cache updates now use the server `submittedAt`.
   - Previously the UI used the browser clock, which can skew payment schedule/payment due calculations until refetch.

6. Claim submit no longer reports "submission failed" when only CSV download fails.
   - The server mutation and local CSV download now have separate handling.

7. Evidence package generation failures keep the modal open.
   - The modal now shows inline error text, preserves selected options, disables controls while generating, and supports retry.

8. Certification document link failures are visible.
   - The claims register now shows an error toast if the signed document access flow fails.

9. Backend evidence-package contract coverage was tightened.
   - The route test now creates a real claimed-lot document and asserts document metadata is included in the response.

## Deferred Findings

These were valid but intentionally not folded into this small PR:

1. Persisted immutable evidence artifacts.
   - The current evidence package is generated client-side from transient JSON.
   - Schema fields such as `ProgressClaim.evidencePackageUrl`, `ClaimedLot.evidencePackageUrl`, and `sopaStatementGenerated` are not populated by the evidence route.
   - A future fix should define a backend artifact workflow with storage key, hash, generatedBy/generatedAt, audit event, and signed access.

2. Actual bundled evidence files.
   - This PR adds a PDF manifest/index, not a ZIP or embedded document bundle.
   - A future package should include signed document references or a generated bundle for photos, certificates, ITP attachments, and test certificates.

3. Submit should eventually require a persisted package artifact.
   - This PR improves UI truthfulness and error handling, but submit still does not require a stored evidence package.

4. Backend access-control expansion.
   - Existing route code uses `requireCommercialProjectAccess`.
   - Additional 403 tests for `/evidence-package`, `/completeness-check`, `/certify`, and `/payment` should be added in a broader claims security pass.

## Verification

Passed locally:

- `frontend`: `npm run test:unit -- pdfGenerator.characterization.test.ts -t "Claim evidence package"`
- `frontend`: `npm run test:unit -- ClaimsPageSections.test.tsx`
- `frontend`: `npm run type-check`
- `frontend`: `npm run lint`  
  Note: one pre-existing warning remains in `frontend/src/lib/theme.tsx`.
- `backend`: `npx prisma generate`
- `backend`: `npm run type-check`
- `backend`: `npm run lint`
- repo: `git diff --check`

Not run locally:

- `backend`: `npm run test -- claims.test.ts -t "evidence package"`
  - Blocked by the repo safety guard because the available local `DATABASE_URL` points at Railway (`shinkansen.proxy.rlwy.net`).
  - The new backend route assertion should run in CI where the test database is disposable.
