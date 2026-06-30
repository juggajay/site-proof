# Stage 113 QA: Project Settings, Project Users, Access Management

Date: 2026-06-30
Branch: `qa/project-settings-access`
Base: `origin/master` after Stage 112 notification preferences

## Scope

This pass covered the owner/admin project-settings surfaces and project user access management:

- `GET/PATCH/DELETE /api/projects/:id`
- `GET/POST/PATCH/DELETE /api/projects/:id/users`
- project settings tabs: general, team, notifications, modules, danger zone
- project users page, including invite, role edit, remove, archived/read-only states
- company API-key inventory because it is an adjacent admin access-management surface

Two read-only subagents split the audit:

- backend explorer: project/team/company access rules, API-key auth, transactional safety, audit logging
- frontend explorer: settings tabs, stale UI state, destructive-dialog retry states, a11y/state consistency

## Fixed In This Stage

1. Project-user removal failure closed the confirmation flow.

   If `DELETE /api/projects/:id/users/:userId` failed, the UI only showed a toast and cleared the pending user. The user had to reopen the row action to retry. The confirmation dialog now stays open, shows the server error inline, and only closes after a successful remove.

2. Project settings could visually revert and later overwrite saved settings.

   `ModulesTab` and `NotificationsTab` saved local state, but the parent `ProjectSettingsPage` kept stale parsed settings. Switching away and back could show old values, and the next full nested setting write could undo a previous save. Child tabs now report successful settings patches back to the parent, which merges them into the local project settings state.

3. Hold-point recipient add/remove writes could race.

   Add and remove both write the full `hpRecipients` array. Remove did not share the add in-flight lock, so fast interactions could lose or resurrect a recipient. Recipient add/remove now share one in-flight guard and remove buttons are disabled during recipient writes.

4. Project managers could grant project-manager access.

   Backend rules blocked project managers from managing/granting `admin`, but allowed them to invite or promote another user to `project_manager`, which is itself a project-admin role. Backend now protects both `admin` and `project_manager` unless the actor is project `admin` or same-company owner/admin. The frontend project-users and settings-team role pickers now hide both protected roles for project managers.

5. Company API-key inventory was readable through API-key auth.

   `DELETE /api/company/api-keys/:keyId` required a browser session, but `GET /api/company/api-keys` did not. The inventory route now requires `requireBrowserSession`, with a regression proving API-key-authenticated inventory requests are rejected.

6. Danger-zone delete mislabeled all 401s as bad passwords.

   Expired sessions and browser-session failures could show "Incorrect password." The delete dialog now displays the server-provided auth/session error and only shows "Incorrect password" when that is the actual response message.

## Deferred Follow-Up

- Privileged audit logging is still mixed between transactional and best-effort paths. Project team role changes and invites already use transactional audit writes, but some broader project/company settings and invitation paths still persist first and audit afterward. This needs a separate structural hardening pass because the right fix is not just UI-level: move privileged audit writes into the same transaction or add a durable outbox/rollback policy.

- The settings Team tab still reads more like a full role-management surface than it is. It can invite and list project users, while full edit/remove management lives on `/projects/:id/users`. No data bug was found after the protected-role filtering fix, but the copy/navigation should be tightened in a later UX polish pass.

- Settings tabs use ARIA tab roles with only partial tab semantics. Current click flows are covered; keyboard tablist behavior should either be implemented fully or the roles should be simplified to ordinary button navigation.

## Verification

Passed:

- `backend`: `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/siteproof_test npx vitest run src/routes/projects.test.ts --testNamePattern "project managers managing project administrators"`
- `backend`: `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/siteproof_test npx vitest run src/routes/company.test.ts --testNamePattern "API-key-authenticated company API key inventory"`
- `backend`: `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/siteproof_test npx vitest run src/routes/projects.test.ts src/routes/company.test.ts`
- `backend`: `npm run type-check`
- `backend`: `npm run lint`
- `frontend`: `npx vitest run src/pages/projects/settings/components/DangerZone.test.tsx src/pages/projects/settings/components/TeamTab.test.tsx src/pages/projects/settings/components/ModulesTab.test.tsx`
- `frontend`: `npx playwright test e2e/project-users.spec.ts e2e/project-settings.spec.ts --project=chromium --reporter=list`
- `frontend`: `npm run type-check`
- `frontend`: `npm run lint`

Notes:

- Frontend lint has the existing `frontend/src/lib/theme.tsx` fast-refresh warning only.
- Playwright emitted expected console errors from tests that intentionally mock failed project/settings/team/template loads.
