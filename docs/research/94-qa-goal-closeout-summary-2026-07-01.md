# QA Goal Closeout Summary

Date: 2026-07-01

Branch: `docs/qa-goal-closeout-summary`

Base: `origin/master` at `7e3360235ce6644f0368254a629cad74e48d7e1c`
after PR #1306.

## Purpose

This note closes the long-running browser-led QA loop as a managed workstream.
It does not claim the app is perfect or that every backend endpoint and every
branch has been tested through a live browser.

The practical finish line is controlled-pilot readiness: enough current evidence
exists that no confirmed pilot-blocking workflow defect remains open, and future
work should be handled as finite targeted QA, bug fixes, and pilot feedback.

## Current Evidence

Merged closeout and production evidence:

- Stage 140 closeout index:
  `docs/research/91-stage140-closeout-coverage-index-2026-07-01.md`
- Stage 141 production smoke:
  `docs/research/92-stage141-release-candidate-production-smoke-2026-07-01.md`
- Stage 142 backup/restore closeout:
  `docs/research/93-stage142-ops-restore-closeout-2026-07-01.md`

The latest merged production preflight fix is PR #1306:

- Commit: `7e3360235ce6644f0368254a629cad74e48d7e1c`
- Change: passes the bounded Railway proxy setting into the protected
  production preflight workflow.

Fresh production preflight after the Supabase restore concern:

- Workflow: `Production Preflight`
- Run: `28511860462`
- Head SHA: `7e3360235ce6644f0368254a629cad74e48d7e1c`
- Result: success
- Safe checks confirmed:
  - runtime configuration validates,
  - Resend is configured and accepted a test send,
  - Supabase Storage bucket `documents` is reachable, private, and accepts
    upload/delete probes,
  - Google OAuth and VAPID push remain skipped because they are not configured.

## What Is Reasonably Covered

The staged evidence meaningfully covers the controlled-pilot workflows for:

- owner/admin onboarding, project/company management, reports, claims, dockets,
  documents, drawings, lots, ITPs, hold points, NCRs, test results, dashboard,
  audit log, and notifications;
- foreman mobile shell, assigned lots, diary, dockets, ITP run, hold-point
  request/release, NCR/issues, photos, and drawings;
- subcontractor classic portal and mobile shell, assigned work, dockets,
  labour/plant lot allocation, ITP, hold-point, NCR, document, and test-result
  access;
- external superintendent hold-point token release, evidence-package access
  paths, release state propagation into ITP/lot conformance, and release
  attribution clarity;
- production health, CI, Sentry work, database backup, database restore drill,
  and Supabase storage preflight.

## What Is Not Proven To The Literal Original Standard

The original goal asked for every endpoint and a perfect app. Current evidence
does not prove that literal standard.

Not fully proven:

- every backend endpoint through a real browser flow;
- every branch of MFA, OAuth, magic link, reset, and email verification against
  real third-party providers;
- every delivered email template in every real email client;
- every offline conflict scenario across diary, ITP, docket, NCR, photos, and
  evidence;
- every large-data export/import/performance case;
- every legal/commercial statement in every jurisdiction.

These are not current controlled-pilot blockers. They are the reason the loop
should close as controlled-pilot readiness, not broad launch perfection.

## Supabase Storage Note

Supabase is storage-only in this app. The production database is Railway
Postgres.

If Supabase was disabled, it could affect uploaded files and evidence links:
documents, photos, drawings, NCR evidence, hold-point evidence, report
artifacts, and signed file links.

The fresh production preflight run above proves provider-level storage health
after the restore concern. It does not prove a new app-level browser upload and
read-back flow. That browser mutation was intentionally not continued after Jay
stopped the loop to discuss closeout.

## Closeout Decision

Close the broad staged QA/fix loop as a standing workstream.

Do not continue treating this as an infinite open task. Future QA should be
finite and scoped:

1. targeted bug reports from Jay or pilot users;
2. pre-release smoke after meaningful changes;
3. focused real-provider email/OAuth checks when those providers are configured;
4. offline and large-data hardening when the product needs those guarantees;
5. support, legal/commercial, and pilot-feedback sign-offs before broad launch.

## Product Status

Recommended status:

- Controlled pilot: reasonable, with the known residual risks accepted.
- Broad paid launch: not yet a no-caveat claim; needs operational, support,
  legal/commercial, scale, and pilot-feedback sign-offs.

