# Stage 54 Admin And Access QA

Date: 2026-06-23
Branch: `qa/stage54-admin-access-qa`
Base reviewed: `07b5e05e` (`master` after PR #1108)

## Scope

This pass focused on owner/admin and access setup surfaces:

- Company team members, invites, removal, leave-company, and ownership transfer.
- Project team membership and role selectors.
- Login/onboarding redirects that affect invite acceptance, especially magic-link login.
- Subcontractor invitation access setup at the route level.

Two read-only explorer agents reviewed backend and frontend areas independently. Confirmed code-level issues were fixed in this branch; schema-level risks that need a migration decision are listed below.

## Fixed In This Branch

### Ownership transfer rejected active OAuth-only members

`POST /api/company/transfer-ownership` treated a missing `passwordHash` as a pending invite, even when the user had an OAuth provider. Company invite/removal logic already treats `passwordHash || oauthProvider` as active.

Impact: a company using Google/OAuth login could not transfer ownership to a valid active admin.

Fix:

- Backend now rejects a transfer target only when both `passwordHash` and `oauthProvider` are missing.
- Frontend transfer modal filters candidates to active members, so pending invitees are not offered as valid new owners.
- Regression coverage added for OAuth-only transfer eligibility and transfer-candidate filtering.

### Ownership transfer allowed stale/concurrent owner sessions

The endpoint trusted the role embedded in the request session and updated the old owner plus new owner without locking/re-reading the current owner. A stale owner token, or two near-simultaneous transfer requests, could transfer ownership more than once and leave multiple company owners.

Impact: wrong company control/billing authority and awkward manual recovery.

Fix:

- Transfer now runs inside an interactive transaction.
- The company row is locked with `FOR UPDATE`.
- The current owner is re-read inside the transaction and must still be `owner`.
- The old owner demotion uses a conditional `updateMany` and must affect exactly one row.
- A stale second transfer now returns `409`.
- Regression coverage added for stale owner-token transfer.

### Magic-link login lost invite/onboarding redirects

Password login preserved `/login?redirect=...`, but the magic-link request body and emailed callback URL did not carry that redirect. Existing users who chose magic link from an invite flow could land on the default dashboard instead of returning to the invite acceptance page.

Fix:

- Login page now sends the safe requested redirect with magic-link requests.
- Backend accepts only safe relative redirects and includes them in the emailed magic-link URL.
- Unsafe redirects such as `//evil.example/...` are ignored.
- Magic-link callback now routes through the existing post-login redirect allowlist and shell mapping.
- Tests cover request submission, callback redirect handling, safe backend redirect inclusion, and unsafe backend redirect rejection.

### Project team UI omitted `site_manager`

The backend supports `site_manager` project membership, but both project team role pickers omitted it.

Fix:

- Added `Site Manager` to the project settings role options and the standalone project users page role list.
- Added role option coverage for the main project settings constant.

## Deferred / Needs A Migration Decision

### Concurrent subcontractor invites can create duplicate project access rows

The subcontractor invitation route checks for existing project/global-subcontractor links before creating, but the check/create sequence is not protected by a unique constraint. Two admins submitting the same directory subcontractor/contact at the same time can create duplicate access rows and duplicate emails.

Recommended fix:

- Add a unique index for the intended invariant, likely `(projectId, globalSubcontractorId)` where `globalSubcontractorId` is present.
- Add a defensive pre-dedup migration before creating the unique index.
- For manual invites without `globalSubcontractorId`, define the product invariant first: whether normalized `(projectId, companyName)` should be unique, or whether multiple contacts per named subcontractor are allowed.
- Then update the route to handle unique-conflict races cleanly.

This was not patched in Stage 54 because it needs data-shape/product confirmation and a reviewed Prisma migration.

## Verification

Passed locally:

- `frontend npm run test:unit -- LoginPage.test.tsx MagicLinkPage.test.tsx companySettingsData.test.ts types.test.ts`
- `frontend npm run type-check`
- `frontend npm run lint` (existing `theme.tsx` fast-refresh warning only)
- `backend npx prisma generate` with local Windows TLS workaround
- `backend npm run type-check`
- `backend npm run lint`
- `git diff --check`
- `fallow audit --base origin/master --format json --quiet` returned `warn`: no new dead code and no introduced complexity; introduced duplication warnings are confined to regression-test setup/cleanup patterns.

Blocked locally:

- Backend DB-backed route tests for auth/company transfer could not run in this fresh worktree because no `DATABASE_URL` is configured. The command failed safely before touching any database. CI should run these tests with its configured test database.
