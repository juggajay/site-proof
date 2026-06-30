# Stage 114 - Company/Admin Access QA

Date: 2026-06-30
Branch: `qa/company-admin-access`
Base: `origin/master` at `cf7bec4b`

## Scope

Audited company/admin/account surfaces adjacent to the Stage 113 project-access work:

- Company profile and logo settings.
- Company team list, invites, role changes, removal, leave-company, ownership transfer.
- Company-wide API-key inventory and revocation.
- Self-service API-key creation/list/revocation.
- Webhook management surfaces.
- Account privacy export/delete.
- Audit log page filtering and project-scoped copy.
- Project settings Team tab handoff to full project-user management.

Two read-only subagents inspected backend and frontend surfaces in parallel. The local pass then verified and fixed confirmed issues.

## Fixed Issues

### 1. Company member list accepted API-key authentication

`GET /api/company/members` is a browser team-management endpoint that returns company member emails, names, roles, and pending/active status. It was guarded by owner/admin role checks but did not reject API-key-authenticated requests.

Fix:

- Added `requireBrowserSession(req, 'Company member list')` in `backend/src/routes/company/memberRoutes.ts`.
- Added regression coverage in `backend/src/routes/company.test.ts` proving an owner read-scope API key receives `403` and cannot list the team directory.

Impact:

- External/read-only API keys can no longer scrape company team membership data.
- Normal owner/admin browser sessions still list members.

### 2. Pre-existing personal API keys inherited company access after invite

A verified user with no company could create an API key, then later be invited into a company. Because API keys resolve the user's current `companyId` dynamically, that old key silently started authenticating inside the newly joined tenant.

Fix:

- When `POST /api/company/members/invite` attaches an existing user whose `companyId` is changing, active API keys for that user are revoked inside the invite transaction.
- The invite audit metadata now records `revokedKeyCount` when keys are revoked.
- Added regression coverage proving a pre-attach API key becomes inactive and can no longer call `GET /api/company` after the user is attached.

Impact:

- Inviting a credentialed no-company account no longer turns old personal integration keys into company-scoped credentials.

### 3. Audit log filters were stale after URL/history navigation

`AuditLogPage` initialized local filter state from `useSearchParams()` once, but did not resync if the URL changed later via browser back/forward or direct navigation.

Fix:

- Added a URL-to-filter sync effect in `frontend/src/pages/admin/AuditLogPage.tsx`.
- Added Playwright coverage for navigating between filtered audit-log URLs and using browser Back.

Impact:

- The controlled filter inputs and results now follow the URL, which makes shared audit-log links and browser history reliable.

### 4. Audit log header overclaimed global visibility

The audit log route can be opened by project-scoped roles such as quality managers, but the header said activity was shown "across all projects."

Fix:

- Changed copy to "View system activity and changes you have access to."
- Added component coverage.

Impact:

- Copy now matches scoped access instead of implying company-wide/global visibility.

### 5. Project settings Team tab promised controls it did not provide

The settings Team tab said users could manage roles and configure role permissions, but the tab mainly lists/invites. Full edit/remove controls live at `/projects/:projectId/users`.

Fix:

- Updated the Team tab copy.
- Added a `Manage project team` link to the full Project Users route.
- Updated component coverage for the link.

Impact:

- Admins have a clear path to the full management page.
- The tab no longer implies role-permission editing that does not exist there.

## Checked And Ruled Out

- Company profile update/logo upload/ownership transfer/leave-company already reject API-key-authenticated requests.
- Company-wide API-key inventory and revocation already reject API keys and scope through the key owner's company.
- Company role controls already prevent non-owner admins from managing/granting admin roles.
- Account export does not expose raw API-key hashes, webhook secrets, or signed URL token values.
- Account deletion blocks company owners until ownership is transferred and requires password or a fresh passwordless session.
- Webhook secret list rendering remains masked; raw secret is only shown on create/regenerate.

## Verification

Backend:

- `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/siteproof_test npm test -- src/routes/company.test.ts`
  - Result: 119 passed.
- `npm run type-check`
  - Result: passed.
- `npm run lint`
  - Result: passed.

Frontend:

- `npx vitest run src/pages/admin/components/AuditLogControls.test.tsx src/pages/projects/settings/components/TeamTab.test.tsx`
  - Result: 11 passed.
- `npx playwright test e2e/audit-log.spec.ts --project=chromium --grep "restores audit log filters" --reporter=list`
  - Result: 1 passed.
- `npm run type-check`
  - Result: passed.
- `npm run lint`
  - Result: passed with existing `src/lib/theme.tsx` fast-refresh warning only.

Tooling notes:

- Fresh worktree required `npm ci` in `backend/` and `frontend/`.
- `npm run db:generate` initially hit local certificate verification while downloading Prisma's query engine; reran with `NODE_TLS_REJECT_UNAUTHORIZED=0` only for that local generation step.
- Playwright emitted existing Browserslist/PostCSS warnings during the local E2E run.

## Deferred / Watchlist

- Webhook management intentionally supports `admin` API keys. That is useful for automation, but it means webhook config mutation is integration-callable by design. Keep this as an explicit product/security decision.
- Self-service API keys remain user-bound rather than tenant-bound. The immediate tenant-inheritance bug is fixed by revocation on company attach, but a future schema hardening pass could add `companyId` to `ApiKey` and reject use if the key's recorded tenant no longer matches the user's current tenant.
- Audit-log filter changes still push URL updates as the user types. This is functional, but replacing history entries for keystroke-level search changes may make browser Back feel cleaner.
