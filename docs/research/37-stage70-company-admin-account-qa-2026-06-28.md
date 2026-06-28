# Stage 70 Company Admin And Account QA

Date: 2026-06-28
Branch: `qa/stage70-company-admin-audit`
Base: `origin/master` at PR #1205

## Scope

Audited company administration, account settings, profile security actions, project team management, API keys, and usage messaging. This was a code-first QA slice with focused route and component checks rather than a live browser pass.

## Issues Fixed

1. Company admins could see owner-level member actions in the company team UI.
   - Non-owner actors no longer get the `admin` role option.
   - Admins can manage ordinary company members, but not owners, themselves, or peer admins.

2. Browser-created company API keys had no visible or enforced expiry choice.
   - Create form now defaults to 90 days.
   - Key lists and reveal modal show expiry.

3. Usage warning copy implied a hard product limit even where enforcement is advisory.
   - Project/user usage warnings now tell users to plan capacity or review seats instead of implying a guaranteed block.

4. Project team UI allowed demoting/removing the last active project lead.
   - Added shared frontend guards for active `admin`/`project_manager` coverage.
   - Role dropdown and remove action now prevent leaving a project with no active lead.

5. Project managers could directly call the API to grant project `admin`, demote an `admin`, or remove an `admin`.
   - Backend now distinguishes company-admin/project-admin authority from project-manager authority.
   - Added a DB-backed route test for project-manager attempts to manage project administrators.

6. Passwordless/magic-link accounts saw a broken `Change Password` action.
   - Profile overview now explains that passwordless users should use password reset to set a password.

7. Company owners could start account deletion or leave-company flows even though backend policy rejects them.
   - Settings UI now blocks both flows and explains that ownership must be transferred first.

## Verification

- `frontend npm run test:unit -- --run ...` focused company/project/profile/settings tests: 54 passed.
- `frontend npm run type-check`: passed.
- `frontend npm run lint`: passed with the existing `src/lib/theme.tsx` fast-refresh warning.
- `backend npm run type-check`: passed.
- `backend npm run lint`: passed with the existing `src/lib/dataRetention.test.ts` unused-disable warning.
- `backend npm run test -- --run src/routes/projects.test.ts`: not run locally because this worktree has no `DATABASE_URL`; CI is expected to run the DB-backed route test.

## Follow-Ups

1. Decide the policy mismatch for company settings access.
   - `CLAUDE.md` says owner-only, but backend and UI allow owners/admins. If admin access is intended, update docs. If owner-only is intended, tighten backend.

2. Decide whether owner-transfer audit rows should be redacted from company admins.
   - Current access may be acceptable, but it should be a deliberate policy.

3. Expose backend preflight data for account delete/leave when a user is the last active project lead.
   - This stage blocks the company-owner case in UI. Last-project-lead account exit still needs a clean backend signal to avoid a failed final submit.

4. Decide whether browser-created API keys should support `admin` scope.
   - This stage keeps the current scope options. If external integrations need admin writes, define the approval and expiry policy first.
