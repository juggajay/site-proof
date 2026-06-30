# Stage 100 Multi-User Journey QA

Date: 2026-06-30
Branch: `qa/stage100-multi-user-journey`

## Scope

Stage 100 starts the fresh full-app multi-user loop across:

- owner/admin project setup and reporting surfaces
- foreman lot, ITP, hold point, diary, NCR, and mobile-shell surfaces
- subcontractor portal and subbie mobile shell
- external superintendent secure hold-point release links

Three scout agents mapped the owner/admin, foreman/subbie, and external
superintendent paths before the first fix in this stage.

## Finding Fixed

Public superintendent releases were recorded by the backend, but release
identity was not carried consistently into downstream read surfaces:

- subcontractor classic hold-point cards only showed a name
- subbie shell quality cards only showed a name
- public already-released secure links dropped organisation and method
- authenticated/public hold-point evidence packages dropped organisation and method
- hold-point evidence PDFs omitted organisation and release method
- conformance report data preferred ITP completion users, so public secure-link
  releases without an internal SiteProof user could display as `Unknown`
- conformance reports only included literal `hold_point` items, missing other
  superintendent release-gated ITP items

## Change

- Preserved `releasedByOrg` and `releaseMethod` in authenticated and public
  hold-point evidence-package payloads.
- Displayed full release identity on subcontractor classic and subbie shell
  hold-point cards.
- Displayed full release identity on already-released public secure links.
- Added release organisation and method to hold-point evidence PDFs and
  conformance reports.
- Updated conformance report assembly to prefer `holdPointRelease` attribution
  and include all release-gated checklist items.
- Extracted shared subcontractor hold-point API normalisation so the classic
  portal and subbie shell cannot drift on release fields again.

## Verification

Passed locally:

- `frontend: npm run test:unit -- src/shell/subbie/screens/test/QualityScreen.test.tsx src/lib/pdf/__tests__/pdfGenerator.characterization.test.ts src/pages/lots/lib/buildConformanceReportData.test.ts`
- `frontend: npx playwright test e2e/holdpoints.spec.ts e2e/subcontractors.spec.ts --project=chromium --grep "Public hold point secure release page|shows full release identity"`
- `frontend: npm run type-check`
- `frontend: npm run lint` with the existing `src/lib/theme.tsx` fast-refresh warning only
- `frontend: npm run format:check`
- `backend: NODE_EXTRA_CA_CERTS=C:\Users\jayso\.avg-web-shield-root.pem npm run db:generate`
- `backend: npm run type-check`
- `backend: npm run lint`
- `backend: npm run format:check`
- `fallow audit --base origin/master --format json --quiet`

Local gap:

- `backend: npm test -- src/routes/holdpoints.test.ts --runInBand` could not run
  in this worktree because `DATABASE_URL` is not configured. I did not point
  the test suite at production. CI should cover the DB-backed route suite with
  its safe test database.

## Remaining Stage 100 Coverage

Still to run in browsers after this fix lands:

- owner creates/manages project, team, subcontractor access, lots, ITP assignment
- foreman completes a lot path including ITP, hold point, diary, photos, NCR
- subcontractor works assigned lots, ITPs, dockets, NCRs, hold/test visibility
- external superintendent receives/reuses/invalidates secure hold-point links
- generated PDFs/reports are checked from the final user-visible state
- access-denied boundaries are checked between owner, foreman, subbie, and public links
