# Stage 77 Project Admin Access QA - 2026-06-29

## Scope

Focused audit of project setup, company/team administration, project-scoped
roles, and cross-company access edges:

- Standalone project team management at `/projects/:projectId/users`.
- Embedded project settings team tab behavior.
- Desktop and mobile project navigation for mixed-role users.
- Project area setup mutations.
- Company member invite/update audit behavior.
- Reports advanced analytics upsell behavior for non-company-admin project
  managers.

Stage numbering note: the active staged QA sequence is Stage 77. Older
`Stage 14` / `Stage 15` wording in `22-live-stage-qa-ledger-2026-06-20.md`
belongs to an earlier ledger section and is not the current sequence.

## Subagent Coverage

- Backend/project-company access explorer reviewed company and project admin
  route scoping, browser-session gates, audit behavior, and cross-company
  membership checks.
- Frontend/project-admin UX explorer reviewed project users, project settings,
  reports upsells, and desktop/mobile navigation for role drift.
- Test coverage explorer reviewed existing backend, unit, and Playwright
  coverage around project users, project settings, company settings, and access
  boundaries.

## Fixes Made

- Standalone Project Team now filters the `Admin` role option for project
  managers who cannot grant project-admin access. Existing project admins also
  no longer show edit/remove actions to those project managers, matching the
  backend policy.
- The reusable project admin grant helper now lives in `projectPageAccess.ts`
  and is shared by Project Settings and Project Users.
- Desktop and mobile project navigation now prefers the loaded
  `project.currentUserRole` over the aggregate dashboard role. Mixed-role users
  no longer see project-manager/commercial links on a project where their
  actual role is only viewer.
- Basic-tier Advanced Analytics upsell is now role-aware: company admins still
  get the company settings upgrade link, while project managers see an
  instruction to ask a company admin instead of being sent to an access-denied
  route.
- Project area create/update/delete mutations now write project-area audit rows
  in the same transaction as the area mutation.
- Project team invites now create the project-user row and write the invite
  audit row in the same transaction, so the membership cannot persist without
  audit evidence.
- Company member invite-as-update now records existing same-company role
  changes as `USER_ROLE_CHANGED` with from/to role details instead of disguising
  them as a generic invitation.

## Verification

- Backend format:
  - `npm run format:check`
  - Result: passed.
- Backend type check:
  - `npm run type-check`
  - Result: passed.
- Backend lint:
  - `npm run lint`
  - Result: passed.
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
  - `npm run test:unit -- src/components/layouts/Sidebar.test.tsx src/components/layouts/MobileNav.test.tsx src/pages/projects/settings/projectUsersGuards.test.ts`
  - Result: 23 passed.
- Frontend targeted Playwright E2E:
  - `npm run test:e2e -- e2e/project-users.spec.ts e2e/reports.spec.ts`
  - Result: 15 passed.
- Prisma client generation:
  - `NODE_EXTRA_CA_CERTS=C:\Users\jayso\.avg-web-shield-root.pem npm run db:generate`
  - Result: passed.

## Local Verification Gap

- DB-backed backend route tests were not run locally because this worktree has
  no disposable local test database configured. Loading the main checkout
  `backend/.env` was correctly refused by `assertSafeTestDatabaseUrl()` because
  it points at Railway (`shinkansen.proxy.rlwy.net`). CI should run these
  backend route tests against its configured safe test database:
  - `npm test -- src/routes/projects.test.ts src/routes/company.test.ts`

## Deferred Findings

- Company Settings has strong backend/unit coverage for owner/admin rank rules,
  but still needs a browser negative journey for non-owner admins: billing and
  ownership transfer hidden, peer-admin controls absent, and ordinary member
  management still available.
- The project team roster read boundary is currently “any active project
  access can read names/emails/roles.” This may be intentional for assignment
  pickers, but should be pinned with a backend test for active viewer behavior.
- Project Users remains table-based and may overflow on narrow mobile screens
  with long names/emails. The Project Areas page already uses a safer
  horizontal overflow pattern.

## Next Suggested Area

Stage 78 should audit project switching and layout-route continuity end to end:
project selector behavior, stale project IDs in URLs, redirects when switching
from a restricted module to a lower-permission project, mobile bottom nav state,
and dashboard quick links.
