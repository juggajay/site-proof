# Stage 116 Live Production Confidence QA

Date: 2026-07-01 Australia/Sydney
Stage owner: Codex
Scope: production deployment, live public domains, backend health, CORS, and post-merge CI.

## Summary

Stage 115 had already proved the local full-app rehearsal: backend tests, frontend coverage, and full Chromium E2E were green.

Stage 116 moved to live production confidence. The important live issue found was that `https://www.civos.com.au` could load the frontend, but browser API calls to the Railway backend were blocked by CORS. That would make the app look available while failing real user API requests from the custom domain.

The issue is now fixed and verified in production.

## Production URLs Confirmed

- Current public frontend: `https://www.civos.com.au`
- Canonical Vercel alias: `https://site-proof.vercel.app`
- Backend: `https://site-proof-production.up.railway.app`

`https://site-proof-juggajays-projects.vercel.app` exists as a Vercel alias but is protected by Vercel login, so it is not a useful public browser-canary target.

## Fixes Shipped

### PR #1276

`fix: allow production frontend origin aliases`

- Added `CORS_ALLOWED_ORIGINS` support.
- Validated production CORS aliases as HTTPS origins.
- Passed the setting through production preflight.

### PR #1277

`fix: allow first-party production frontend aliases`

- Added the current first-party frontend origins as built-in production aliases when `FRONTEND_URL` is one of those origins.
- Kept `CORS_ALLOWED_ORIGINS` for future extra domains.
- Added regression coverage in `backend/src/lib/runtimeConfig.test.ts`.
- Updated README production config wording.

This second PR was needed because Railway CLI access was unavailable in this session, so relying only on a new Railway runtime variable would have left production broken until manual dashboard work.

## Verification

### Local Verification Before PR #1277

From `C:\Users\jayso\siteproof-wt\fix-production-cors-default-aliases`:

- `backend`: `npm test -- src/lib/runtimeConfig.test.ts` passed, 32 tests.
- `backend`: `npm run format:check` passed.
- `backend`: `npm run lint` passed.
- `backend`: `npm run type-check` passed.
- repo: `npm run fallow:audit -- -- --format json --quiet` passed for introduced issues.
- `git diff --cached --check` passed.

Fallow still reports the inherited `pdfjs-dist` unused dependency warning. This was not introduced by this stage.

### CI And Deploy

PR #1277:

- Backend PR check passed.
- Frontend PR E2E smoke passed.
- Vercel status passed.

After merge commit `5991f8884ad5c87969b7d34ab82b6eb2f8cc4880`:

- Railway deploy status: success.
- Vercel deploy status: success.
- Master CI: success.
- Backend job: success.
- Frontend job: success.
- Full Frontend E2E job: success.

### Live Backend Health

Checked after deploy:

- `GET https://site-proof-production.up.railway.app/health` returned 200.
- `GET https://site-proof-production.up.railway.app/ready` returned 200.

### Live CORS Preflight

Checked `OPTIONS https://site-proof-production.up.railway.app/api/auth/me`:

| Origin | Result |
| --- | --- |
| `https://site-proof.vercel.app` | 204, allowed |
| `https://www.civos.com.au` | 204, allowed |
| `https://civos.com.au` | 204, allowed |
| `https://site-proof-juggajays-projects.vercel.app` | 204, allowed |
| `https://attacker.example` | not granted `Access-Control-Allow-Origin` |

### Browser Canary

Playwright loaded:

- `https://www.civos.com.au`
- `https://civos.com.au`
- `https://site-proof.vercel.app`

From the browser context, `fetch('https://site-proof-production.up.railway.app/api/auth/me', { credentials: 'include' })` returned a normal 401 CORS response on the public app origins. That proves the browser can reach the backend and the remaining 401 is normal unauthenticated behavior, not a CORS failure.

Observed behavior:

- `/login` returns 200.
- `/projects` redirects unauthenticated users to `/login`.
- `https://civos.com.au` canonicalizes to `https://www.civos.com.au`.
- No page exceptions were observed on the public app domains.

## Notes

- The logged-out root path currently lands on `/login` in production. That appears related to the existing open landing PR #1190 rather than the CORS fix.
- `site-proof-juggajays-projects.vercel.app` redirects to Vercel login/protection, so public browser checks against it produce Vercel-origin noise. It remains allowed at the backend level because it is a first-party alias, but it should not be used as the primary public canary.
- Antivirus/security software continued to mark some old research docs in local worktrees as deleted. Those changes were not staged or committed.

## Stage 116 Result

Status: passed.

The live production custom-domain CORS blocker is fixed, deployed, and verified. Production health, deploy status, master CI, and browser-level API reachability are all green for the public app domains.

## Next Recommended Stage

Stage 117 should move back into authenticated role-based browser QA:

- owner/admin browser loop
- foreman browser loop
- subcontractor browser loop
- lot/ITP/hold-point/NCR/docket flows that were previously high-risk
- report generation and document links

Use seeded local/staging accounts or newly created test accounts. Keep production mutation testing limited unless disposable data is clearly separated.
