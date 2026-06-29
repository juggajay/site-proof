# Stage 80 Integrations, Webhooks, Reports, And Notifications QA

Date: 2026-06-29
Branch/worktree: `qa/stage80-integrations` at `458e5702`
Scope: company webhooks, scheduled-report delivery, notification preferences, digest dispatch, actionable notification links.

## Stage Numbering Note

This is global audit Stage 80. Older local worktree names such as `qa-ncr-stage-14` and `qa-reporting-evidence-stage-15` are stale narrow-workstream labels from earlier passes. They do not mean the global audit loop went backwards.

## How This Stage Was Audited

- Read Stage 68 and Stage 69 reports to avoid reopening fixed scheduled-report and notification issues.
- Spawned three read-only subagents with separate scopes:
  - webhooks and integration event coverage
  - scheduled reports and report delivery
  - notifications, digests, web push, and deep links
- Cross-checked subagent findings locally in source before editing.
- Ran focused frontend and backend tests plus frontend/backend type-checks after the patch.

## Fixed In This Stage

1. Frontend/backend email preference default drift
   - Backend default for `ncrStatusChangeTiming` was `immediate`.
   - Frontend default was `digest`, so the Settings page could show the wrong fallback if the server omitted the value.
   - Fixed frontend default and tests to match backend.

2. Webhook wording overclaimed event coverage
   - UI said wildcard webhooks subscribed to "All events".
   - Actual webhook catalog currently covers lot, hold point, and NCR lifecycle events.
   - Updated UI/test copy to "All supported events" and "supported lot, hold point, and NCR events".

3. Reports page tier gate used raw subscription tier strings
   - Backend normalizes values like ` Professional ` before allowing scheduled reports.
   - Frontend compared the raw string and could incorrectly lock out paid accounts.
   - Fixed frontend gating to trim/lowercase the tier before checking `ADVANCED_ANALYTICS_TIERS`.

4. Subcontractor NCR notification links were under-scoped
   - Links used `/subcontractor-portal/ncrs?ncr=...` only.
   - The portal also scopes by `projectId` and `subcontractorCompanyId`.
   - Fixed NCR portal notification links to use the shared subcontractor portal link builder with all scope parameters.

## Findings That Need Separate Follow-Up

### High: Webhook Delivery Is Not Durable

`triggerWebhooks()` fire-and-forgets delivery. The delivery row is only written after network attempts complete. A deploy or process restart between the business mutation and the delivery completion can lose the webhook with no failed delivery row.

Recommended follow-up:
- create a pending delivery row before dispatch
- include a stable event/idempotency key
- process delivery through a durable worker
- persist attempts/backoff
- add manual replay from the webhook UI

### High: Scheduled Report Partial Failures Are Marked Sent

If one recipient succeeds and another recipient fails, the schedule is marked sent and advanced. The failed recipient is not retried and admins do not get a visible partial-failure state.

Recommended follow-up:
- add scheduled report run/recipient delivery records
- mark runs as `sent`, `partial`, or `failed`
- retry only failed recipients
- surface partial failures and repair actions in the schedule UI

### High: Scheduled Report Links Are Live Views, Not Immutable Snapshots

Immediate scheduled-report emails attach a PDF snapshot. Digest recipients only get a live Reports page link, and the generated PDF also embeds a live Reports page URL. This is not wrong if labelled as live, but it is not an immutable report artifact.

Recommended follow-up:
- create a scheduled-report run artifact
- link emails and digest items to that immutable run
- label any remaining live links as live project views

### High: NCR Notification Email/Push Coverage Is Incomplete

NCR assignment/status workflows write inbox rows directly in several places. That bypasses the newer notification dispatch helper, email preference handling, and automatic web push dispatch.

Recommended follow-up:
- create a shared NCR notification helper
- route inbox creation through dispatch
- call preference-aware email delivery for `ncrAssigned` and `ncrStatusChange`
- preserve portal-safe links per recipient

### Medium: Webhook Ownership Is Unclear After Offboarding

Webhook configs remain enabled when their creator is removed or deleted. The creator FK becomes null, while the company-owned webhook continues sending.

Recommended follow-up:
- show creator/owner in the webhook UI
- on member removal or account deletion, disable or transfer creator-owned webhooks
- audit the action and surface the affected webhook count

### Medium: Failed Scheduled Reports Are Hard To Repair In UI

The backend supports updating scheduled report recipients and timing, but the UI currently exposes Pause/Activate/Delete for existing schedules, not Edit. Reactivating a failed schedule can retry the same bad recipient set.

Recommended follow-up:
- add Edit existing schedule
- prefill report type, cadence, recipients, and time
- route failure recovery toward Edit before retry

### Medium: Digest Worker Can Starve Later Users After Repeated Send Failures

The digest worker selects due enabled users with a fixed `take` limit. Failed sends leave items queued, so a repeatedly failing early user can keep consuming the batch and delay later users.

Recommended follow-up:
- add retry/backoff metadata to digest delivery
- or paginate fairly beyond failed users
- add a test where user `limit + 1` still gets processed when earlier enabled users fail

### Medium: Webhook Event Coverage Needs Product Decision

Supported events are currently lot create/update/delete, hold point release requested/released, and NCR create/close. Other customer workflows such as dockets, diary, test results, claims, documents, project/team changes, and reports do not emit webhooks.

Recommended follow-up:
- publish a visible supported event catalog
- add an event picker
- decide the next domains to emit, likely dockets, claims, documents, and test results

## Verification

Passed:
- `frontend`: `npm run test:unit -- src/pages/settings/emailPreferencesData.test.ts src/pages/company/companyWebhooksData.test.ts src/pages/company/components/CompanyWebhooksSection.test.tsx src/pages/reports/ReportsPage.test.tsx`
- `backend`: `npm test -- src/routes/notifications/links.test.ts src/routes/notifications/emailPreferences.test.ts`
- `frontend`: `npm run type-check`
- `backend`: `npm run type-check`
- `git diff --check`

Not run locally:
- full DB-backed `backend/src/routes/ncrs.test.ts`, because the local backend env on this machine can point at production and project rules forbid running tests against production DBs. CI should run it against a safe test database.

