# Stage 64 Claims Browser Gap QA

Date: 2026-06-28
Branch: `qa/stage64-claims-browser-gaps`
Base: `origin/master` at `05bbf9d2`

## Scope

This pass closed the claims browser gaps left by Stage 63:

- evidence package PDF generation and download
- certification with an uploaded certificate document
- read-back link for the recorded certification document
- partial payment followed by final payment
- direct route denial for non-commercial project roles

## Findings

The underlying product paths already had implementation coverage, but several high-value browser/user regressions were not directly exercised. The biggest practical risk was a silent break in claim evidence package download or certificate-document attachment, because both depend on browser-only behaviours around downloads, file inputs, and signed-document links.

No new production blocker was found in this pass. The changes are regression coverage and fixture hardening.

## Changes Made

- Added a Playwright regression for generating and downloading a claim evidence package PDF.
- Added a Playwright regression for uploading a certification document, recording certification, then opening the read-back certificate link.
- Added a Playwright regression for partial payment followed by final payment on the same certified claim.
- Extended the seeded claims API mock to persist certification document IDs, variation notes, document upload requests, signed-url requests, and evidence package requests.
- Added unit coverage that `RecordCertificationModal` uploads the attached certificate and passes the resulting document ID to the certification mutation.
- Added unit coverage that the claims table opens the recorded certification document through the signed-document helper.
- Added explicit route-guard regression coverage showing `quality_manager` and `site_manager` are blocked from direct project claims routes.

## Verification

Passed locally:

- `cd frontend && npm run test:unit -- src/pages/claims/components/RecordCertificationModal.test.tsx src/pages/claims/ClaimsPageSections.test.tsx src/App.projectScopedCommercialRoutes.test.tsx --runInBand`
- `cd frontend && npm run test:e2e -- e2e/claims.spec.ts --reporter=list`
- `cd frontend && npm run test:e2e -- e2e/claims.spec.ts --grep "generates a claim evidence package PDF download|certifies a claim with an uploaded certificate|records a partial payment" --headed --reporter=list`
- `cd frontend && npm run type-check`
- `cd frontend && npm run lint`
- `cd frontend && npm run format:check`

Notes:

- ESLint still reports the existing Fast Refresh warning in `src/lib/theme.tsx`; this pass did not touch that file.
- The Playwright headed command still executed the full claims file under the current npm script argument handling, so the result is stronger than the requested focused run.

## Remaining Manual Checks

The mocked browser coverage now exercises the risky UI behaviours. A later live-data pass should still validate the same flows against a disposable seeded project in production or staging, especially the real Supabase document URL and generated PDF content.
