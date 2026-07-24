# CIVOS — Customer Operations & Procurement Readiness Pack

Last updated: 2026-07-24
Owner: Jayson Ryan (jayson@civos.com.au)
Support contact: support@civos.com.au

## Purpose

This is the single document a Tier-2 civil contractor's procurement or admin
person can be answered from during vendor onboarding / security review. It
covers backup & recovery, incident response, monitoring, support, data
handling, subprocessors, production access, security posture, insurance, and
customer implementation.

## Honesty legend — every line item carries exactly one state

- **[VERIFIED]** — confirmed from this repository (code, config, CI workflow,
  package script, or committed doc). A file path is cited.
- **[NOT-YET-VERIFIED]** — plausibly true but not confirmable from the repo
  alone. Anything that lives only in a vendor dashboard (Railway, Supabase,
  Vercel, Anthropic, Sentry, Resend plans/settings) is at best this state — we
  have no dashboard access from the codebase.
- **[JAY-ACTION]** — requires the founder to do or decide something (buy
  insurance, run a drill, upgrade a plan, adopt a policy).

Where a policy does not exist in the repo, the line says so and any proposed
policy is marked **DRAFT-UNADOPTED**. Draft numbers (RPO/RTO/SLA targets) are
proposals, not commitments, until Jay adopts them.

> Scope honesty: several items below are marked NOT-YET-VERIFIED specifically
> because they depend on live vendor settings this pack cannot read. That is the
> correct state — do not upgrade them to VERIFIED without dashboard evidence.

---

## 1. Backup & Recovery

### Current state

| Item | State | Evidence / Owner |
|------|-------|------------------|
| Automated Railway Postgres backup (daily, encrypted, verified, off-Railway) | **[VERIFIED]** | `.github/workflows/database-backup.yml`; helper `backend/scripts/backup.ts`; runbook `docs/database-backup-restore-runbook.md` |
| Backup schedule = daily 14:37 UTC (00:37 Australia/Sydney std time) | **[VERIFIED]** | `docs/database-backup-restore-runbook.md` §Automated Backup |
| Backup encryption (GPG AES-256) + checksum + `pg_restore --list` verification | **[VERIFIED]** | runbook §Automated Backup steps 3–5 |
| Retention = 30 days of encrypted dump artifacts in GitHub Actions | **[VERIFIED]** | runbook §Objective |
| Restore drill tooling (restore into disposable Postgres) exists as a workflow | **[VERIFIED]** | `.github/workflows/database-restore-drill.yml` (manual `workflow_dispatch`, restores a chosen backup run into a throwaway `postgres:17` service) |
| Documented production restore procedure | **[VERIFIED]** | runbook §Production Restore |
| Backup GitHub secrets actually configured (`DATABASE_BACKUP_URL`/`DATABASE_URL`, `DATABASE_BACKUP_ENCRYPTION_KEY`) | **[NOT-YET-VERIFIED]** | Lives in GitHub repo settings, not the codebase — confirm in GitHub → Settings → Secrets |
| At least one scheduled backup run has passed | **[NOT-YET-VERIFIED]** | Confirm in GitHub → Actions → Database Backup |
| A restore drill has actually been executed and recorded | **[JAY-ACTION]** | Runbook §Restore Drill exists but records no completed drill. Launch gate requires ≥1 passing drill before paying users |
| Railway point-in-time recovery (PITR) enabled | **[NOT-YET-VERIFIED]** | Depends on Railway plan; runbook treats PITR as an additional control only |
| **Supabase Storage (documents/photos) backup** | **[JAY-ACTION]** | No repo mechanism backs up the Supabase `documents` bucket. The DB backup covers Postgres only; uploaded files are **not** in scope of any committed backup job. This is a real gap for a buyer who asks "are our photos/certs backed up?" |

### RPO / RTO targets — DRAFT-UNADOPTED baseline (from runbook)

The runbook proposes these as a baseline; they are not a contractual SLA until adopted.

- **RPO: 24 hours** while the daily GitHub Actions backup is the primary control.
- **RTO: 4 hours** for a practiced restore into a replacement Postgres database.
- **Retention: 30 days** of encrypted, verified dump artifacts.

These improve if Railway PITR is enabled and proven by a drill.

### Restore drill — status and procedure

Status: **[JAY-ACTION]** — never confirmed as executed. The runbook prescribes
running it before paying customers and at least monthly.

Two ways to run it:
1. **Automated:** dispatch `.github/workflows/database-restore-drill.yml` with a
   successful Database Backup run id — restores into a disposable Postgres on a
   GitHub runner. **[VERIFIED]** the workflow exists.
2. **Manual:** follow `docs/database-backup-restore-runbook.md` §Restore Drill
   (download artifact → verify checksum → GPG decrypt → `backup.ts verify` →
   `backup.ts restore` into disposable DB → `migrate:status` → row-count sanity
   checks → record date/result in launch notes).

### DRAFT-UNADOPTED — Supabase Storage backup proposal

Until adopted there is no file-storage backup. Proposed options for Jay to pick one:
- Enable Supabase project's own backup tier (plan-dependent) — **[JAY-ACTION]** in Supabase dashboard.
- Add a scheduled job that syncs the `documents` bucket to a second object store (e.g. periodic `supabase storage` export). Not built.
- Accept the risk explicitly and disclose it to buyers (weakest option).

---

## 2. Incident Response

### Current state

| Item | State | Evidence / Owner |
|------|-------|------------------|
| Standing support/security contact = support@civos.com.au | **[VERIFIED]** | `backend/src/routes/support.ts` (`DEFAULT_SUPPORT_EMAIL`), `frontend/src/lib/contactLinks.ts` (`DEFAULT_SUPPORT_EMAIL`) |
| Backend error capture to Sentry in production | **[VERIFIED]** | `SENTRY_DSN` required in prod (CLAUDE.md; `docs/production-readiness-audit.md` — startup fails without it) |
| Frontend error capture to Sentry in production | **[VERIFIED]** | `VITE_SENTRY_DSN` required for prod build (`docs/production-readiness-audit.md`) |
| A failed scheduled backup is treated as a launch-blocking incident | **[VERIFIED]** | `docs/database-backup-restore-runbook.md` §Daily Check |
| Documented incident-response procedure (severity levels, escalation, comms) | **[JAY-ACTION]** | No IR runbook exists in the repo. Draft proposed below |
| Named security contact / disclosure address distinct from support | **[JAY-ACTION]** | Only the shared support inbox exists today |

### DRAFT-UNADOPTED — Incident Response procedure

Single-operator business (Jayson) today; procedure is written to survive that.

**Severity levels**
- **SEV-1 Critical:** data loss/corruption, confirmed breach, or full outage.
  Prod DB unreachable, backups failing, or unauthorised access suspected.
- **SEV-2 Major:** core workflow broken for all users (auth down, uploads
  failing), no data loss.
- **SEV-3 Minor:** degraded/partial feature, workaround exists.
- **SEV-4 Low:** cosmetic or single-user issue.

**Reporting channel:** support@civos.com.au (monitored) — **[VERIFIED]** as the standing contact.

**Escalation path (draft):** Reporter → support@civos.com.au → Jayson (owner,
sole responder) → external vendor support (Railway / Supabase / Vercel) as
needed. No secondary on-call exists — **[JAY-ACTION]** to name a backup contact
before contractual uptime commitments.

**Response targets (draft, not a committed SLA):** SEV-1 acknowledge ≤1h /
mitigate ≤4h; SEV-2 ack ≤4 business h; SEV-3 ≤2 business days; SEV-4 best effort.

**Data-breach handling (draft):** contain → assess scope from `auditLog` and
Sentry → notify affected customers → notify the OAIC if the Notifiable Data
Breaches scheme applies (Australian Privacy Act). **[JAY-ACTION]** to confirm
NDB obligations with a legal advisor.

---

## 3. Uptime Monitoring & Status Communication

### Current state

| Item | State | Evidence / Owner |
|------|-------|------------------|
| Backend liveness endpoint `GET /health` | **[VERIFIED]** | `backend/src/server.ts` (~line 120) |
| Backend readiness endpoint `GET /ready` | **[VERIFIED]** | `backend/src/server.ts` (~line 124, `createReadinessHandler`) |
| Docker healthcheck wired to readiness | **[VERIFIED]** | `docs/production-readiness-audit.md` (non-root runtime + readiness healthcheck) |
| Production smoke checks hit `/health`, `/ready`, HTTPS redirect | **[VERIFIED]** | `docs/production-readiness-audit.md` §Evidence Checklist (Production smoke) |
| External uptime monitor / pinger (UptimeRobot, Better Stack, etc.) | **[JAY-ACTION]** | No monitoring config in the repo. Nothing polls `/ready` from outside today |
| Public status page | **[JAY-ACTION]** | None exists |
| Customer outage notification mechanism | **[JAY-ACTION]** | None beyond ad-hoc email from support@ |

### Gaps / DRAFT-UNADOPTED

- Add an external monitor polling `https://<backend>/ready` at ≤1-min interval
  with alert to support@civos.com.au / SMS. Cheapest closing of the biggest gap.
  **[JAY-ACTION]**
- Optional lightweight status page (hosted status service or a static page).
  **[JAY-ACTION]**

---

## 4. Support

### Current state

| Item | State | Evidence / Owner |
|------|-------|------------------|
| In-app support request endpoint | **[VERIFIED]** | `backend/src/routes/support.ts` — emails support@civos.com.au via Resend |
| Support categories: general, technical, billing, feature, bug | **[VERIFIED]** | `backend/src/routes/support.ts` (`SUPPORT_CATEGORIES`) |
| Support requests are rate-limited | **[VERIFIED]** | `backend/src/middleware/rateLimiter.ts` (`support` scope) |
| Email support address support@civos.com.au | **[VERIFIED]** | `backend/src/routes/support.ts`, `frontend/src/lib/contactLinks.ts` |
| Published support hours | **[JAY-ACTION]** | Not defined anywhere in the repo |
| Response-time / severity SLA | **[JAY-ACTION]** | Not defined. Draft below |
| Phone support | **[JAY-ACTION]** | `telHref` helper exists but no number is published |

### DRAFT-UNADOPTED — Support policy

- **Channels:** in-app support form + email support@civos.com.au. **[VERIFIED]** both route to the same inbox.
- **Hours (draft):** business hours, Mon–Fri, AEST/AEDT (single operator).
- **Response targets (draft):** mirror the SEV targets in §2 — SEV-1 ≤1h, SEV-2 ≤4 business h, SEV-3 ≤2 business days, SEV-4 best effort.
- These become real only when Jay adopts them and can staff them.

---

## 5. Data Retention, Deletion, Export & Offboarding

### Current state

| Item | State | Evidence / Owner |
|------|-------|------------------|
| Per-user data export (GDPR-style, portable JSON) | **[VERIFIED]** | `GET /api/auth/export-data` in `backend/src/routes/auth/accountPrivacyRoutes.ts` — returns the calling user's profile, company summary, project memberships, NCRs, diaries, ITP completions, test results, lots created, comments, documents (as download URLs), notifications, consent records, API keys, etc. Sensitive fields redacted |
| Export available from the UI (Settings) | **[VERIFIED]** | Referenced in `frontend/src/pages/legal/PrivacyPolicyPage.tsx` ("Export … available in Settings"); backend endpoint confirmed above |
| Per-user account deletion (GDPR) | **[VERIFIED]** | `DELETE /api/auth/delete-account` in `backend/src/routes/auth/accountDeletionRoutes.ts` — requires email confirmation + password (or fresh session for passwordless); anonymises QA evidence (ITP completions set to null author) rather than destroying records |
| Company owner cannot self-delete without transferring ownership | **[VERIFIED]** | `accountDeletionRoutes.ts` (owner-transfer guard) |
| Deletion writes a non-PII audit record | **[VERIFIED]** | `accountDeletionRoutes.ts` (`ACCOUNT_DELETION_REQUESTED` audit log before deletion) |
| Stated retention: project data ~7 years after project completion | **[VERIFIED]** (as a stated policy) | `frontend/src/pages/legal/PrivacyPolicyPage.tsx` §Data Retention. Note: this is a stated policy, not an automated enforcement mechanism |
| **Whole-company / full-tenant export** (all project data for a customer, not just one user's own records) | **[JAY-ACTION]** | No endpoint produces a complete company-wide export. `export-data` is scoped to the authenticated user's own contributions. A buyer asking "give us everything at contract end" cannot be fully served today |
| **Tenant offboarding procedure** (delete/return all company data on exit) | **[JAY-ACTION]** | No company-level offboarding flow exists; only per-user deletion. Draft below |
| Automated retention/purge job (enforce the 7-year policy) | **[JAY-ACTION]** | Not implemented; retention is manual/stated only |

### Gaps and DRAFT-UNADOPTED — Offboarding

- The export capability is real but **per-user**. Do not tell a buyer "you can
  export all your company data" — tell them each user can export their own
  records, and a full-tenant export is a manual operator task today.
- **DRAFT offboarding procedure (manual, operator-run):** on customer exit,
  Jayson runs a scoped Postgres extract for the company's projects (dockets,
  lots, ITPs, NCRs, diaries, claims, documents index) plus a Supabase bucket
  export of that company's files, delivers it, then deletes the company and
  cascades. No tooling exists for this yet — **[JAY-ACTION]** to build or
  formalise.

---

## 6. AI Data Handling

### Current state

| Item | State | Evidence / Owner |
|------|-------|------------------|
| AI vendor = Anthropic (Claude API) | **[VERIFIED]** | Calls to `https://api.anthropic.com/v1/messages` in `backend/src/routes/copilot/*`, `backend/src/routes/controlLines/setoutExtraction.ts`, `backend/src/routes/documents/classificationRoutes.ts` |
| Default model = `claude-3-5-haiku-20241022` (overridable via `ANTHROPIC_MODEL`) | **[VERIFIED]** | e.g. `backend/src/routes/copilot/index.ts`, `chatRoute.ts`, `planSheetExtraction.ts`, `lotBreakdownExtraction.ts`, `projectFactsExtraction.ts` |
| What is sent to Anthropic | **[VERIFIED]** | Uploaded drawings/certificates, extracted project facts, and copilot chat context — the content of the specific document/request being processed |
| Human-review queue before AI output changes data | **[VERIFIED]** | `backend/src/routes/copilot/proposalService.ts` — every AI extraction becomes an `AiProposal` in `proposed` status; a human must `accept`/`reject`/`edit`; original payload is immutable; accepted changes are applied in-transaction and are reversible via `rollbackProposal`; all transitions are audit-logged |
| AI actions are audit-logged | **[VERIFIED]** | `proposalService.ts` (`ai_proposal_created` / `ai_proposal_accepted` / `_rejected` / `_edited` / `_rolled_back`) |
| Customer data is NOT used to train models | **[NOT-YET-VERIFIED]** | This is an Anthropic commercial-terms property, not something the codebase can prove. Anthropic's API terms are the source of truth; no repo doc records the specific terms in force. Verify against the Anthropic commercial agreement before asserting to a buyer |
| Data residency of AI processing | **[NOT-YET-VERIFIED]** | Depends on Anthropic infrastructure; not controlled or recorded in the repo |

### Notes for buyers

- The AI never silently mutates customer records: it proposes, a human decides,
  and the decision plus a rollback path are recorded. **[VERIFIED]** — this is
  the strongest AI-governance claim we can make and it is code-backed.
- The "no training on your data" claim rests on Anthropic's API terms, which is
  why it is **[NOT-YET-VERIFIED]** here rather than VERIFIED. Cite Anthropic's
  terms, not this repo, when answering it.

---

## 7. Subprocessor Register

Cross-checked against `frontend/src/pages/legal/PrivacyPolicyPage.tsx`
(§Third-Party Service Providers, updated 2026-07-24). All nine appear there.

| Subprocessor | Function | State | Evidence |
|--------------|----------|-------|----------|
| Railway | App hosting + PostgreSQL database | **[VERIFIED]** (listed) | PrivacyPolicyPage.tsx; CLAUDE.md (Railway Postgres) |
| Vercel | Frontend web app delivery/hosting | **[VERIFIED]** (listed) | PrivacyPolicyPage.tsx |
| Supabase | File & photo storage (`documents` bucket) | **[VERIFIED]** (listed) | PrivacyPolicyPage.tsx; `docs/supabase-storage-setup.md` |
| Resend | Transactional email delivery | **[VERIFIED]** (listed) | PrivacyPolicyPage.tsx; `backend/src/lib/email.ts` |
| Anthropic | AI document processing (drawings, certificates) | **[VERIFIED]** (listed) | PrivacyPolicyPage.tsx; §6 above |
| Google | Optional Google account sign-in | **[VERIFIED]** (listed) | PrivacyPolicyPage.tsx; OAuth config in production-readiness-audit.md |
| MapTiler | Map imagery / satellite tiles | **[VERIFIED]** (listed) | PrivacyPolicyPage.tsx |
| Formspree | Public-website early-access form intake | **[VERIFIED]** (listed) | PrivacyPolicyPage.tsx |
| Sentry | Error monitoring (backend + frontend) | **[VERIFIED]** (listed) | PrivacyPolicyPage.tsx; SENTRY_DSN / VITE_SENTRY_DSN |

Register accuracy note: the code's disclosed list and this pack match exactly —
no undisclosed subprocessor was found in the code, and no listed subprocessor is
unused. Signed DPAs with each subprocessor are **[JAY-ACTION]** (contractual,
not in-repo).

---

## 8. Production Access & Change Management

### Current state

| Item | State | Evidence / Owner |
|------|-------|------------------|
| Who can touch production | **[NOT-YET-VERIFIED]** | Single operator (Jayson) in practice; actual access lists live in Railway/Vercel/Supabase/GitHub dashboards, not the repo |
| Railway must NOT run migrations on deploy (blank start/pre-deploy command) | **[VERIFIED]** | `CLAUDE.md` §Operational Warnings — "Custom Start Command and Pre-deploy Command must be blank so the Dockerfile CMD runs unchanged" |
| No `prisma db push` / `--accept-data-loss` against production | **[VERIFIED]** | `CLAUDE.md` §Operational Warnings |
| Migrations applied via a reviewed, manual, master-only workflow with typed confirmation | **[VERIFIED]** | `.github/workflows/production-migrations.yml` — `workflow_dispatch`, refuses non-`master`, requires the exact phrase `deploy-production-migrations` |
| Production migration drift reconciled + committed migrations marked applied | **[VERIFIED]** | `CLAUDE.md` (reconciled 2026-05-13; live DB matches `schema.prisma`) |
| Secrets kept in `.env` / GitHub Environment secrets, never committed | **[VERIFIED]** | `CLAUDE.md` §Environment; `docs/production-readiness-audit.md` §GitHub Environment Secrets |
| Fail-closed production config validation (missing secrets stop startup) | **[VERIFIED]** | `docs/production-readiness-audit.md` (fail-closed runtime config validation; missing `DATABASE_URL`/`SENTRY_DSN` block startup) |
| CI release gates (lint, type-check, tests, coverage, readiness, E2E, Docker, preflight) | **[VERIFIED]** | `.github/workflows/ci.yml`; `docs/production-readiness-audit.md` §Evidence Checklist |
| Formal change-approval / segregation-of-duties (multi-person) | **[JAY-ACTION]** | Single operator; no second approver. Note for buyers requiring segregation of duties |

---

## 9. Security Posture Summary

### Current state

| Control | State | Evidence |
|---------|-------|----------|
| Authentication = JWT bearer tokens | **[VERIFIED]** | `backend/src/middleware/authMiddleware.ts` (`requireAuth` → `verifyToken`, Bearer scheme) |
| Multi-factor authentication (TOTP) supported | **[VERIFIED]** | `backend/src/routes/mfa.ts` (enable/verify/disable endpoints) |
| MFA secrets encrypted at rest (app-layer AES-256-GCM) | **[VERIFIED]** | `backend/src/lib/encryption.ts` (AES-256-GCM, per-value IV + auth tag); used by `backend/src/routes/mfa.ts` and `backend/src/routes/auth.ts` |
| Webhook secrets encrypted at rest (same mechanism) | **[VERIFIED]** | `encryption.ts` used by `backend/src/routes/webhooks.ts`, `backend/src/routes/webhooks/delivery.ts` |
| Role-based access control (canonical roles + hierarchy) | **[VERIFIED]** | `backend/src/lib/roles.ts`; route guards + `frontend` `RoleProtectedRoute` (CLAUDE.md §User Roles) |
| Rate limiting + auth lockout (scoped: api/auth/support/chat/verification) | **[VERIFIED]** | `backend/src/middleware/rateLimiter.ts` (per-scope limits + principal/source lockout) |
| Tenant isolation via company/project scoping | **[VERIFIED]** | e.g. `backend/src/routes/projects.ts` (company-admin access checked as `project.companyId === user.companyId`); cross-project AI proposals return 404 (`proposalService.ts` `loadProposalForProject`); security checklist in CLAUDE.md mandates company/project ownership checks |
| TLS in transit + HTTPS redirect enforced | **[VERIFIED]** | `docs/production-readiness-audit.md` (HTTPS redirect smoke check; unsafe-URL readiness guardrails) |
| Password hashing | **[VERIFIED]** | `verifyPassword` in `backend/src/lib/auth.js` (used by deletion/login flows) |
| Route-auth coverage guardrail (tests that protected routes require auth) | **[VERIFIED]** | `backend/src/lib/routeAuthCoverage.test.ts` (production-readiness-audit.md) |
| Field-level encryption of general project/business data at rest | **[NOT-YET-VERIFIED]** | App-layer encryption covers **secrets only** (2FA, webhook). Broader data-at-rest encryption is whatever Railway Postgres / Supabase provide at the infrastructure level — a vendor property, not in the repo |
| Database-level / disk encryption at rest | **[NOT-YET-VERIFIED]** | Railway / Supabase managed setting; not controllable or provable from the repo |
| Penetration test | **[JAY-ACTION]** | None exists. Do not claim one |
| ISO 27001 / SOC 2 certification | **[JAY-ACTION]** | CIVOS holds none. Do not claim one |

### Plain statements (do not overstate)

- CIVOS has **no** independent penetration test, **no** SOC 2, and **no** ISO
  27001 certification of its own. Say this plainly to buyers.
- **Discrepancy flag:** `frontend/src/pages/legal/PrivacyPolicyPage.tsx`
  §Data Security currently asserts "Regular security audits and vulnerability
  assessments" and "Secure hosting with ISO 27001 certified providers." The
  latter refers to *hosting providers'* certifications (plausible for Railway/
  Supabase/Vercel but **[NOT-YET-VERIFIED]** here), and "regular security audits"
  is **[NOT-YET-VERIFIED]** — there is no repo evidence of a recurring audit
  program. **[JAY-ACTION]:** either substantiate these claims or soften the copy
  so the public policy does not outrun what can be proven.

---

## 10. Insurance

### Current state

| Item | State | Owner |
|------|-------|-------|
| Cyber liability insurance | **[JAY-ACTION]** | Not held / not recorded. A buyer's procurement will commonly ask for it |
| Professional indemnity (PI) insurance | **[JAY-ACTION]** | Not held / not recorded |
| Public liability | **[JAY-ACTION]** | Ryox Carpentry may hold trade PL, but no software-entity cover is recorded |

### What a Tier-2 buyer typically asks

- **Cyber liability:** cover for data breach, business interruption, and
  notification costs. Common minimum for a SaaS handling project data:
  AUD $1M–$5M aggregate (varies by contract).
- **Professional indemnity:** cover for loss caused by the software's failure /
  errors. Often AUD $1M–$5M.
- **Certificates of currency** for both, naming the customer where required.

**[JAY-ACTION]:** obtain cyber + PI quotes before signing any contract that
carries an indemnity or insurance clause. This is a business/legal decision, not
a code change.

---

## 11. Customer Implementation Runbook

Two paths. Both use product features whose routes/pages were confirmed in the
repo. Feature existence is **[VERIFIED]**; the exact click-path copy is
operator guidance.

### Feature evidence (all VERIFIED)

| Step | Feature | Evidence |
|------|---------|----------|
| Company creation on sign-up | Registration flow | `backend/src/routes/auth/registrationRoutes.ts`; `frontend/src/pages/onboarding/CompanyOnboardingPage.tsx` |
| Project setup | Projects API | `backend/src/routes/projects.ts` |
| ITP template seeding | Seeder | `npm run seed:itp` → `backend/scripts/seeds/itp-templates/index.mjs` (filterable by state/activity; additive + idempotent — CLAUDE.md §Seed global ITP templates) |
| Lot creation | Lots API | `backend/src/routes/lots.ts` (LOT_CREATORS/EDITORS exclude foreman — see roles) |
| User invites + roles | Project team routes | `backend/src/routes/projects/teamRoutes.ts` |
| Subcontractor portal | Subbie portal | `frontend/src/pages/subcontractor-portal/`; `backend/src/routes/subcontractors/*` |

### Path A — New Project Launch (greenfield customer)

1. **Create the company / account.** Owner registers → company record created
   (`registrationRoutes.ts`); complete `CompanyOnboardingPage`.
2. **Invite office users, set roles.** Add admin / project_manager /
   quality_manager via project team invites (`teamRoutes.ts`). Roles per
   `backend/src/lib/roles.ts`.
3. **Create the project.** Name, project number, status (`projects.ts`).
4. **Seed ITP templates** relevant to the work: preview with
   `npm run seed:itp -- --state=<state> --activity=<activity>`, then execute with
   `--execute` against the approved DB (CLAUDE.md). Operator-run.
5. **Create lots** (chainage/offset/layer/activity) — `lots.ts`. Spatial lot
   map available where geometry is imported.
6. **Invite field users** (site_manager, foreman, site_engineer) and
   **subcontractors** to the subbie portal.
7. **Run one end-to-end check:** raise an ITP completion / test result / diary
   entry / docket to confirm the loop works before handing to the crew.

### Path B — Controlled Live-Project Pilot (existing live job)

1. **Company + minimal users first** (owner + one PM + one QM). Keep the blast
   radius small.
2. **Create a single real project** already in progress.
3. **Seed only the ITP templates that job needs** (filtered seed run) — avoid
   loading the full library into a pilot.
4. **Import/create the current lots** and back-fill only open items (open hold
   points, live NCRs), not full history.
5. **Add one subcontractor** to the portal and issue one real docket as the
   adhesion point.
6. **Run the AI copilot on one real drawing/certificate** and exercise the
   human-review queue (accept/edit/reject) so the customer sees the
   propose→approve governance (`proposalService.ts`).
7. **Daily check-in for the first week**; expand users/lots once the loop holds.

Pilot success criteria (draft): field users log dockets/diaries without support
tickets; QM verifies at least one hold point; one AI proposal reviewed and
applied; no data-integrity surprises.

---

## Appendix — Item counts by state

See `docs/ops/README.md` for the roll-up. Counts are maintained there to avoid
drift between two files.
