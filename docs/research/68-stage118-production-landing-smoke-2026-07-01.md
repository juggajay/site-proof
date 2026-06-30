# Stage 118 Production Landing And Public Auth Smoke

Date: 2026-07-01 Australia/Sydney
Stage owner: Codex
Scope: production-facing public domain browser smoke, logged-out root route, login route, protected-route redirect behavior, mobile install-nudge gating, backend health, and PR/CI verification.

## Summary

Stage 118 found and fixed a real production-facing issue:

Logged-out visitors opening the public domain root, `https://www.civos.com.au/`, were redirected to `/login` instead of seeing the marketing landing page. The landing page existed at `/landing`, but the root route was inside the authenticated app shell.

This mattered because the public domain looked like a private login wall to first-time visitors.

Fix shipped:

- PR #1190: `fix(landing): show landing page at / for logged-out visitors + gate install nudge to signed-in users`
- Merge commit: `bbd6f6e8071257663a2093b7ca36f814b4d97bd0`

## Before Fix

Production browser smoke before refreshing and merging PR #1190:

| URL | Result |
| --- | --- |
| `https://www.civos.com.au/` | redirected to `https://www.civos.com.au/login` |
| `https://www.civos.com.au/login` | login page loaded |
| `https://www.civos.com.au/landing` | landing page loaded |
| `https://site-proof.vercel.app/` | redirected to `/login` |

The broken behavior was isolated to the public root route.

## Root Cause

On master before PR #1190, `/` was mounted inside `ProtectedAppShell`.

`ProtectedAppShell` wraps app routes in `ProtectedRoute`, and `ProtectedRoute` redirects logged-out users to `/login`. That was correct for private app routes like `/projects`, but wrong for the public domain root.

The fix adds an auth-aware public root route:

- logged-out `/` renders `LandingPage`
- logged-in `/` redirects to `/dashboard`
- `/landing` remains public for direct links

The same PR also gates `InstallNudge` behind authentication, matching the component intent that it is only for signed-in app users.

## PR Refresh Work

PR #1190 had been open for several days and was behind master.

Refresh work:

- Created isolated worktree: `C:\Users\jayso\siteproof-wt\fix-landing-logged-out-refresh`
- Merged current `origin/master` into the PR branch.
- Resolved the only merge conflict in `frontend/src/App.tsx`.
- Preserved master's newer route guard changes:
  - `ProtectedRoute`
  - `ProjectProtectedRoute`
  - `ShellRouteGuard`
  - `SubbieShellRouteGuard`
  - protected invitation route
  - project-scoped route protections

Subagent review agreed the conflict surface was limited to the root route import/route table and the app route test harness.

## Local Verification

From `C:\Users\jayso\siteproof-wt\fix-landing-logged-out-refresh\frontend`:

```powershell
npm run test:unit -- App.projectScopedCommercialRoutes.test.tsx InstallNudge.test.tsx
npm run format:check
npm run type-check
npm run lint
npm run test:readiness
```

Results:

- `App.projectScopedCommercialRoutes.test.tsx` and `InstallNudge.test.tsx`: 34 tests passed.
- `format:check`: passed.
- `type-check`: passed.
- `lint`: passed with the existing `frontend/src/lib/theme.tsx` fast-refresh warning.
- `productionReadiness.spec.ts`: 87 tests passed.

Non-blocking warnings still observed:

- Browserslist/caniuse-lite data is old.
- PostCSS plugin warning about missing `from` option.
- Existing `theme.tsx` fast-refresh lint warning.

These were not introduced by this fix.

## PR And Master CI

PR #1190 after refresh:

- Detect changes: passed.
- Frontend: passed.
- Frontend PR E2E smoke: passed.
- Backend: skipped because no backend changes.
- Merge state: clean.

After merge to master:

- Detect changes: passed.
- Backend: passed.
- Frontend: passed.
- Full Frontend E2E: passed.

## Production Verification After Merge

Browser smoke after deploy:

| URL | Final URL | Result |
| --- | --- | --- |
| `https://www.civos.com.au/` | `https://www.civos.com.au/` | landing page loaded |
| `https://www.civos.com.au/login` | `https://www.civos.com.au/login` | login page loaded |
| `https://www.civos.com.au/landing` | `https://www.civos.com.au/landing` | landing page loaded |
| `https://site-proof.vercel.app/` | `https://site-proof.vercel.app/` | landing page loaded |

Mobile logged-out smoke:

- `https://www.civos.com.au/` loaded the landing page.
- Landing copy was present.
- Login copy was not present.
- Install nudge copy was not present.

Protected route smoke:

- `https://www.civos.com.au/projects` redirected to `https://www.civos.com.au/login`, which is correct for a logged-out user.

Backend production health:

- `GET https://site-proof-production.up.railway.app/health` returned 200.
- `GET https://site-proof-production.up.railway.app/ready` returned 200.

## Stage 118 Result

Status: passed.

The public-root landing issue is fixed, merged, deployed, and verified in production. The app still protects authenticated routes correctly, and the logged-out mobile landing page no longer shows the authenticated install nudge.

## Current Overall Loop Position

The launch-readiness loop has now completed:

- Stage 115: final local rehearsal.
- Stage 116: live production/CORS confidence.
- Stage 117: authenticated seeded role browser loop.
- Stage 118: public production landing/auth smoke.

This does not mean the product can never have another bug. It means the current broad launch-readiness loop has reached its defined finish line:

1. Core app flows have passing local browser coverage.
2. Production public domains are reachable.
3. Public logged-out routes behave correctly.
4. Protected routes still redirect unauthenticated users.
5. Backend health/readiness are green.
6. Master CI is green, including full frontend E2E.
7. Findings are documented.

Further work should move into targeted hardening stages rather than continuing the same broad loop indefinitely.

## Suggested Next Targeted Stages

- Real production/staging account journey using disposable owner, foreman, and subcontractor accounts.
- Backup restore drill status review.
- Sentry event verification after the latest deploy.
- Performance pass on landing, login, project dashboard, lot detail, reports, and mobile shell.
- Browser QA using the visible Chrome-controlled workflow if manual visual oversight is needed.
