# Stage 99 Auth And Account QA

Date: 2026-06-30  
Branch: `qa/stage99-auth-account`

## Scope

Auth and account readiness pass covering:

- Login, registration, session redirects, remembered and session-only storage
- Forgot password, reset-password token validation, and reset submission
- Verify-email token status, token scrubbing, and verification submission
- Magic-link verification, token scrubbing, post-login redirect, and storage safety
- Invite acceptance for matching and mismatched signed-in accounts
- Settings account security: MFA setup, MFA disable, export, delete-account gating

Two read-only explorer agents also inspected frontend and backend auth/account coverage. They found strong unit/API coverage overall, with browser-level gaps around token callback pages, invite account switching, and passwordless/OAuth MFA disable UX.

## Fixes Made

1. Forgot-password duplicate submission guard
   - Same-tick double clicks on "Send Reset Link" could send two reset email requests before React disabled the button.
   - Added a synchronous `useRef` guard in `ForgotPasswordPage`.
   - Added Playwright regression coverage.

2. MFA disable now supports passwordless/OAuth users
   - Backend already accepts either `password` or `code` for `/api/mfa/disable`, but the UI only exposed a password field.
   - The Settings MFA disable dialog now accepts password, 6-digit authenticator code, or 10-character backup code.
   - Payload selection sends `{ code }` for authenticator/backup-code shaped input, otherwise `{ password }`.
   - Added hook and Playwright coverage.

3. Invite account switching actually signs out
   - "Log in with a different account" previously linked to `/login` while the user stayed authenticated, so the login page could immediately redirect them away.
   - The invite page now signs out first, then navigates to login with the invite redirect preserved.
   - Added unit coverage.

4. Browser coverage added for token callback routes
   - Reset password happy path verifies token scrubbing and POST payload.
   - Verify email happy path verifies token scrubbing and status/verify API sequence.
   - Magic link happy path verifies token scrubbing, redirect preservation, and that the raw magic token is not stored in browser auth state.

## Verification

Passed locally:

- `npm run test:unit -- src/pages/auth/LoginPage.test.tsx src/pages/auth/MagicLinkPage.test.tsx src/pages/auth/ResetPasswordPage.test.tsx src/pages/auth/VerifyEmailPage.test.tsx src/pages/auth/RegisterPage.test.tsx src/pages/auth/OAuthCallbackPage.test.tsx src/pages/auth/postLoginRedirect.test.ts src/pages/settings/useMfaSettings.test.ts src/pages/settings/useEmailPreferences.test.tsx src/pages/settings/components/SettingsSections.test.tsx src/pages/settings/components/AccountDangerModals.test.tsx src/pages/subcontractor-portal/AcceptInvitePage.test.tsx src/pages/subcontractor-portal/AcceptInvitePageSections.test.tsx`
  - 13 files, 68 tests passed.
- `npm run test:e2e -- e2e/auth.spec.ts e2e/settings.spec.ts --project=chromium`
  - 40 tests passed.
- `npm run type-check`
- `npm run lint`
  - Existing warning remains: `frontend/src/lib/theme.tsx:98` fast-refresh export warning.
- `npm run format:check`
- `npm run fallow:audit -- -- --format json --quiet`
  - Verdict: `warn`.
  - No dead code and no new complexity introduced.
  - Warnings are E2E mock duplication and inherited complexity in existing auth/settings components.

Not run locally:

- Backend DB-backed auth/MFA/subcontractor tests.
  - `npx prisma generate` needed a one-command TLS workaround in this Windows environment.
  - The backend test safety guard then correctly refused to run against the Railway `DATABASE_URL`.
  - Docker/local Postgres was not available locally, so backend DB tests are left to CI.

## Remaining Notes

- Backend explorers noted reset and magic-link sends are protected by the general auth/IP limiter, while verification resend also has a target-email limiter. This is worth a future abuse/rate-limit pass but was not changed in this frontend-focused stage.
- Magic links for MFA-enabled accounts are intentionally rejected by backend, but the token is consumed before the MFA check. Security posture is acceptable; UX could be improved later by checking MFA before consuming the token.
- Account deletion may leave `ScheduledReport.createdBy` and `WebhookConfig.createdBy` as `SetNull` by schema design. This needs product confirmation, not a quick auth UI patch.
