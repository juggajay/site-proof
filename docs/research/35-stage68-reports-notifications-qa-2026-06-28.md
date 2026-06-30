# Stage 68 Reports, Notifications, And Email QA

Date: 2026-06-28
Branch: `qa/stage68-reports-notifications-qa`
Base: `8b245bdf Fix document evidence access and email links (#1203)`

## Scope

This pass reviewed scheduled reports, report delivery, notification alerts,
daily digests, outbound notification email templates, and related docket and
hold-point notification paths.

Three read-only subagent sweeps were used:

- Scheduled reports, exports, report access, and report email links.
- Notifications, alerts, automation, digests, and UI behavior.
- Outbound email templates, auth/hold-point/report links, and token handling.

## Fixed In This Stage

- Alert escalation email preferences no longer route every alert through the
  NCR-assigned preference. NCR alerts use NCR preferences, hold-point alerts use
  hold-point reminder preferences, diary alerts use diary reminder preferences,
  and generic operational alerts no longer depend on NCR assignment settings.
- Escalated alerts explicitly assigned through `escalatedTo` are no longer
  hidden behind the 500-row alert list cap when unrelated escalated alerts from
  other projects are newer.
- The Notifications page now keeps `Load more` available when the selected
  client-side filter has no matches in the currently loaded page but more server
  pages exist.
- Scheduled report delivery no longer retries an already-sent recipient when a
  later recipient fails in the same run. Mixed partial delivery is marked sent
  with a logged warning; full delivery failure still retries.
- Daily digest processing now selects only users with enabled daily digest
  preferences before applying the user batch limit, so disabled digest queues
  cannot starve active users.
- Digest/report links no longer double-prefix already absolute frontend URLs.
- Hold-point public release token consumption now atomically re-checks expiry
  when marking the token used.
- Company member invitation email subjects now sanitize CRLF/header-line input.
- Docket review notifications no longer notify users linked only through a
  suspended or removed subcontractor company.

## Follow-Up Findings

- Scheduled report schedule times still use server-local `Date` math. They
  should use project/company timezone and store the resulting UTC instant.
- Scheduled report digest recipients still receive a live reports-page link, not
  a persisted PDF snapshot for that run. This is not a broken-link issue after
  this stage, but the data can differ by the time a digest is opened.
- Scheduled report recipients can include unknown external email addresses. This
  may be intentional, but should get explicit product confirmation and audit
  treatment before paying customer rollout.
- Scheduled report PDF detail sections are capped at 50 rows. The documents say
  "sample", but paying users may expect complete scheduled reports.
- Digest sends do not currently re-check current project/entity access for each
  queued item. Consider purging digest rows on access removal or filtering at
  send time.
- The legacy system-alert route still diverges from the automation worker.
  Prefer calling the shared automation path or retiring the route.
- Web push dispatch remains partial because many flows write `notification`
  records directly instead of using the dispatch helper.

## Verification

Passed:

- `backend`: `npm test -- --run src/lib/notificationAlertConfig.test.ts src/lib/notificationAutomation/alertEscalations.test.ts src/lib/notificationAutomation/systemAutomation.test.ts src/lib/notificationJobs.test.ts`
- `backend`: `npm test -- --run src/lib/scheduledReports.test.ts src/lib/email.test.ts src/lib/runtimeConfig.test.ts src/routes/dockets/reviewNotificationDelivery.test.ts`
- `backend`: `npm test -- --run src/routes/notifications.test.ts`
- `backend`: `npx vitest run src/routes/holdpoints.test.ts -t "expires between lookup" --reporter verbose`
- `frontend`: `npm run test:unit -- --run src/pages/NotificationsPage.test.tsx`
- `backend`: `npm run type-check`
- `frontend`: `npm run type-check`
- `backend`: `npm run lint` (existing warning in `src/lib/dataRetention.test.ts`)
- `frontend`: `npm run lint` (existing warning in `src/lib/theme.tsx`)

Not completed locally:

- Full `backend/src/routes/holdpoints.test.ts` timed out locally after five
  minutes. The new targeted hold-point expiry regression passed.
