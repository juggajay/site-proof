# Stage 141 - Release Candidate Production Smoke

Date: 2026-07-01

Branch: `qa/stage141-rc-production-smoke`

Base: `origin/master` at `7bbcd534263c667e18b19cceda38459224dbcf2e`
after PR #1303.

## Scope

Stage 141 continued the full-app QA objective after the Stage 140 closeout
coverage index. The purpose was to record one clean release-candidate production
smoke against the live frontend/backend and the latest `master` CI signal.

This was a read-only verification stage. No application code was changed.

## Production Targets Checked

- Frontend: `https://site-proof.vercel.app`
- Backend: `https://site-proof-production.up.railway.app`
- GitHub `master` commit:
  `7bbcd534263c667e18b19cceda38459224dbcf2e`
- GitHub CI run: `28507906768`

## Browser Smoke

Ran a Playwright browser smoke directly against production.

Routes checked:

| Route | Expected result | Result |
| --- | --- | --- |
| `/` | marketing landing renders current hero copy | Passed, HTTP 200 |
| `/landing` | marketing landing renders current hero copy | Passed, HTTP 200 |
| `/login` | login UI renders | Passed, HTTP 200 |
| `/forgot-password` | reset-password request UI renders | Passed, HTTP 200 |
| `/privacy-policy` | privacy policy renders | Passed, HTTP 200 |
| `/terms-of-service` | terms page renders | Passed, HTTP 200 |
| `/projects` | unauthenticated user redirects to `/login` | Passed |
| `/dashboard` | unauthenticated user redirects to `/login` | Passed |
| `/hp-release/not-a-real-token` | invalid public token fails safely | Passed, HTTP 200 with unavailable-link copy |

Result:

```text
PRODUCTION_BROWSER_SMOKE_OK
```

Note:

- The first local smoke attempt used stale landing/reset copy assertions from an
  older page version. All routes returned 200. The smoke was rerun with current
  production copy and passed.

## HTTP/API Smoke

Ran direct HTTP checks against production frontend/backend.

| Check | Expected | Result |
| --- | --- | --- |
| Backend `/health` | 200 | Passed |
| Backend `/ready` | 200 | Passed |
| Backend `/api/projects` unauthenticated | 401 | Passed |
| Backend `/api/metrics` unauthenticated | 401 | Passed |
| Frontend `/` | 200 | Passed |
| Frontend `/login` | 200 | Passed |

Result:

```text
PRODUCTION_HTTP_SMOKE_OK
```

## Deploy And CI Signal

GitHub combined status for latest `master`:

- Railway deployment context `hearty-harmony - site-proof`: success.
- Vercel deployment context `Vercel`: success.

GitHub Actions CI run `28507906768` for commit `7bbcd534` completed with
conclusion `success`.

Jobs:

- Detect changes: success.
- Backend: success.
  - Prisma generation, formatting, migration validation, migration apply,
    lint, typecheck, build, Docker image build, coverage tests, unsafe-pattern
    check all passed.
- Frontend: success.
  - Formatting, lint, typecheck, unit coverage, production readiness guardrails,
    and build all passed.
- Frontend E2E: success.
  - Backend setup and full Playwright E2E run passed.
- Frontend PR E2E smoke: skipped as expected on `master`.

## Findings

No pilot blocker was found in this stage.

The live app answered expected public routes, protected routes redirected to
login, invalid public hold-point release tokens failed safely, production health
and readiness returned 200, and unauthenticated production API probes returned
401 instead of leaking data.

## Remaining Scope Boundary

This smoke improves the release-candidate evidence, but it still does not prove
the original literal standard of every endpoint and every branch tested through
a live browser. The Stage 140 closeout classification remains current:

- Controlled pilot: reasonable with accepted remaining non-pilot-blocking risks.
- Broad launch: still needs accepted operational, scale, support, pilot-feedback,
  and legal/commercial sign-offs.
