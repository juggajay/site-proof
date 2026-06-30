# Stage 112 - Notification Preferences QA

Date: 2026-06-30
Branch: `qa/notification-preferences`

## Scope

Focused pass over notification-center, email-preference, push-notification, alert,
and digest behavior:

- `/api/notifications` list/read/delete and alert routes.
- `/api/notifications/email-preferences` and `/send-test-email`.
- `/api/push` status, subscription, test, and send paths.
- `NotificationsPage`, `EmailPreferencesSection`, and `PushNotificationSettings`.
- Browser-facing coverage in `header-notifications.spec.ts` and `settings.spec.ts`.

Two read-only subagents inspected backend and frontend surfaces in parallel.

## Findings Fixed

### Test-email side effect accepted API-key auth

`POST /api/notifications/send-test-email` can send a real provider email. Push
side-effect routes already require an authenticated browser session, but this
email route only inherited general auth. That allowed an API key to reach the
send-test path.

Fix:

- Added `requireBrowserSession(req, 'Sending test notification emails')` before
  the route loads preferences or attempts delivery.
- Added regression coverage proving API-key-authenticated test-email requests
  now return 403 with browser-session copy.

### Email master-off state was only mouse-disabled

When `Enable Email Notifications` was off, the child controls were wrapped in
`pointer-events-none`, but the actual switch/select controls were still enabled
for keyboard users.

Fix:

- Child notification toggles and timing selects now use `disabled={isSaving ||
  !preferences.enabled}`.
- Added component coverage for disabled child switch/select controls while the
  master email toggle is off.

### Unsupported push browsers still hit `/api/push/status`

`getPushStatus()` computed local support first but still called the backend
status endpoint. In browsers without Push/Notification support, an unrelated API
error could show as service unavailability instead of the correct unsupported
browser state.

Fix:

- `getPushStatus()` now returns a local unsupported state before making any API
  call.
- Added coverage proving unsupported browsers do not call `authFetch`.

### Notification center had small accessibility and safety gaps

The notification route load failure was visual-only, filter buttons did not
expose selected state to assistive tech, and notification links with control
characters could still be passed to navigation if they were otherwise internal.

Fix:

- Added `role="alert"` to the notification load-failure state.
- Added `aria-pressed` to filter buttons.
- Rejected notification link URLs containing ASCII control characters.
- Added regression coverage for all three behaviors.

### Client-side type-filter empty copy overclaimed

Mention/alert tabs filter over loaded pages only. When page 1 has no matching
records but more pages exist, the UI said no notifications matched the view even
though `Load more` could reveal matches.

Fix:

- Empty copy now says no matching notifications are in the loaded results and
  prompts users to load more when more pages exist.
- Existing load-more behavior remains unchanged.

## Deferred / Needs A Separate Design

- Digest delivery can still duplicate emails if the provider accepts the email
  and the process crashes or DB cleanup fails before deleting digest rows. The
  proper fix is a delivery claim/outbox or sent-state design, not a route-level
  patch.
- Escalated alert listing scans escalated alert JSON in memory to preserve
  visibility for non-project-member escalation recipients. A simple cap would
  regress current protected behavior. The proper fix is a normalized indexed
  escalation-recipient table or a portable indexed JSON containment query.
- System-alert creation still uses read-then-create duplicate checks. The
  durable fix needs an active-alert identity uniqueness strategy and
  transaction/upsert handling.
- New mobile shell notification/settings entry points should be coordinated with
  the foreman-shell workstream because `frontend/src/shell/**` is currently
  owned by that stream.

## Verification

Backend:

- `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/siteproof_test npx vitest run src/routes/notifications.test.ts --testNamePattern "send-test-email"` - 5 passed
- `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/siteproof_test npx vitest run src/routes/notifications.test.ts src/routes/pushNotifications.test.ts` - 169 passed
- `npm run type-check` - passed
- `npm run lint` - passed

Frontend:

- `npx vitest run src/pages/settings/components/EmailPreferencesSection.test.tsx src/lib/pushNotifications.test.ts src/pages/NotificationsPage.test.tsx` - 10 passed
- `npx vitest run src/pages/NotificationsPage.test.tsx src/pages/settings/useEmailPreferences.test.tsx src/pages/settings/components/EmailPreferencesSection.test.tsx src/lib/pushNotifications.test.ts` - 16 passed
- `npm run type-check` - passed
- `npm run lint` - passed with the existing `theme.tsx` fast-refresh warning
- `npm run test:e2e -- e2e/header-notifications.spec.ts e2e/settings.spec.ts --project=chromium --reporter=list` - 17 passed
