# Stage 79 - Project Switching And Route Continuity QA

Date: 2026-06-29
Branch: `qa/stage79-project-switching`
Base: `origin/master` at `3d7bc13c` (`Fix document storage access and pagination (#1234)`)

## Stage Numbering Note

This is global audit stage 79. Any local notes, branch names, or reports labelled stage 14/15 belong to narrower workstreams and should not be read as a reset of the full-app audit count.

## Scope

- Project route switching and selected-project continuity.
- Desktop/mobile project navigation role gating.
- Foreman shell redirect continuity.
- Subcontractor classic-to-shell route mapping.
- Subcontractor project bridge routing.
- Notification deep links that cross internal/subcontractor surfaces.
- Commercial/budget UI access on project routes.

## Findings Fixed

1. Mobile subcontractor login redirects had duplicated classic-to-shell route maps. `/my-company?projectId=...` could briefly enter the classic route before the shell corrected it.
   - Added one shared route mapper in `frontend/src/shell/subbieShellRoutes.ts`.
   - Reused it from login redirects, `SubbieShellGuard`, and `SubbieShellRouteGuard`.

2. Sidebar/mobile drawer and budget UI could briefly use an aggregate dashboard role before the selected project role loaded.
   - Project navigation now defaults to viewer-level while the project role is loading.
   - `useCommercialAccess` now uses the current project role on project routes and grants no commercial access while that role is unresolved.

3. Foreman shell redirect dropped selected-project context.
   - `/dashboard?projectId=p2#...` now redirects to `/m?projectId=p2#...`.

4. Post-login redirects allowed role-incompatible active-shell paths.
   - Internal users are no longer sent into `/p/*`.
   - Subcontractor portal users are no longer sent into `/m/*`.

5. Subcontractor project bridge dropped `subcontractorCompanyId`.
   - `/projects/:projectId?subcontractorCompanyId=...` now checks and redirects with both project and subcontractor company scope preserved.

6. Docket review notifications sent to subcontractor users used internal `/projects/:projectId/dockets` links.
   - Approved/rejected/queried docket notifications now link to `/subcontractor-portal/docket/:docketId` with project/company scope.

7. Generic alerts assigned to subcontractor portal users stored internal links.
   - Alert creation now builds portal-safe links for standalone subcontractor recipients and keeps internal links for internal users.

## Follow-Ups

- If a subcontractor user has multiple company links for the same project and opens `/projects/:projectId` without `subcontractorCompanyId`, the backend correctly refuses to guess. The next UX improvement is a selector or clearer redirect for that ambiguous case.
- `https://siteproof.com.au` and `https://www.siteproof.com.au` were still showing the placeholder site during the Stage 78 production check; the app is currently live at `https://site-proof.vercel.app`.

## Verification

Passed locally:

- `frontend`: `npm run test:unit -- src/pages/auth/postLoginRedirect.test.ts src/shell/subbieShellRoutes.test.ts src/shell/test/ShellGuard.test.tsx src/shell/test/SubbieShellGuard.test.tsx src/shell/test/SubbieShellRouteGuard.test.tsx src/components/layouts/Sidebar.test.tsx src/components/layouts/MobileNav.test.tsx src/hooks/useCommercialAccess.test.ts src/appProjectRoutes.test.tsx`
- `backend`: `npm test -- src/routes/dockets/notifications.test.ts src/routes/notifications/links.test.ts src/routes/dockets/reviewNotificationDelivery.test.ts`
- `frontend`: `npm run type-check`
- `backend`: `npm run db:generate`, then `npm run type-check`
- `frontend`: `npm run lint` (passes with one pre-existing warning in `src/lib/theme.tsx`)
- `backend`: `npm run lint`
- `git diff --check`

Not run locally:

- `backend/src/routes/notifications.test.ts` needs `DATABASE_URL`. The local shell intentionally does not have a database URL set. CI should run the DB-backed integration path.
