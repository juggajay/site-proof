# External Codebase Review — SiteProof / CIVOS

You are performing an independent, adversarial review of a production codebase. Your job is to find real gaps, bugs, and missed opportunities — not to summarise the architecture back to me. Assume a competent team built it; the easy wins are gone. Earn every finding.

## What the product is

CIVOS (repo name: site-proofv3) is a construction **quality management** platform for Australian civil contractors (head contractors on road/subdivision/infrastructure jobs). Core domain objects: Projects → Lots (the spine), ITPs (Inspection & Test Plans) with checklist items, Hold Points (a trust boundary — external verifiers release them via emailed single-use token links), NCRs, Daily Diaries, Dockets (subcontractor day-labour records), Progress Claims, Variations, Test Results / material conformance records, Documents/Drawings.

Three workflow loops: **compliance** (lot → ITP → conformance → evidence package), **daily habit** (diary/dockets — the adhesion feature), **revenue** (progress claims → Xero draft invoice export). Head contractors pay; subcontractors get free portal access via invite.

The founder is the target user (a carpentry contractor). The app is pre-launch, feature-complete for a first customer, and the current bottleneck is launch/validation — not more features.

## Stack

- **Frontend**: React 18 + Vite + TypeScript, TailwindCSS + shadcn/ui, TanStack Query **v4** (not v5), React Hook Form + Zod. Mobile shell for foreman/subbie flows under `frontend/src/shell/`.
- **Backend**: Express REST + Prisma ORM + PostgreSQL (hosted on Railway). JWT auth with MFA support. Roles per project via `ProjectUser`; canonical role list in `backend/src/lib/roles.ts`.
- **Storage**: Supabase Storage, single private `documents` bucket, all browser access mediated by backend routes (no public URLs). Supabase Auth/RLS are NOT in use.
- **Email**: Resend. **Errors**: Sentry. **PDF**: jsPDF client-side generators under `frontend/src/lib/pdf/` sharing a branding module; plus a server-side ASCII text-PDF writer for scheduled reports.

Key entry points: `backend/src/index.ts` (route registration), `backend/prisma/schema.prisma` (data model), `frontend/src/App.tsx` (routes), `frontend/src/lib/api.ts` (apiFetch), `backend/src/middleware/` (auth, rate limiting, error handler).

## Your review dimensions (in priority order)

1. **Tenancy & authorization gaps.** Every route must verify the user belongs to the company/project that owns the data. Look for: routes that take an ID and fetch without a company/project scope check; IDOR via nested resources (e.g. fetch a lot's test result by ID without checking the lot's project); role checks done client-side only; places where `user.role` is trusted instead of the per-project role. The Hold Point public token-release routes are deliberately unauthenticated (token-gated) — check the token handling itself (single-use enforcement, expiry, hashing) rather than flagging their existence.
2. **Data integrity & money-adjacent correctness.** Progress claims, variations, dockets, Xero CSV export. Race conditions on claim submission/certification, double-claiming a lot or variation, quantity/percentage arithmetic, floating-point money handling, status transitions that can skip states or be replayed. Missing DB constraints/uniques that app code assumes.
3. **Workflow gaps vs. real-world AU civil practice.** What would a quality manager or project engineer on a real job hit a wall on? Examples of the class: NCR workflows missing a disposition path, hold point release with no record of who/when/what evidence, claim workflows that can't represent a certified-less-than-claimed outcome, missing audit trail on records that get disputed (diaries and NCRs end up in adjudication under Security of Payment legislation). Judge against ISO 9001 clause 8.7 (nonconformity), MRTS50-style spec requirements, and SOPA evidence needs — but flag only concrete gaps you can point at in code, not "consider adding".
4. **Failure modes & resilience.** Unhandled promise rejections, missing transaction boundaries around multi-write operations, file upload flows that can leave orphaned DB rows or orphaned storage objects, email send failures swallowed silently where the user believes a notification went out (hold point release requests especially), pagination missing on unbounded lists.
5. **Test coverage gaps that matter.** Not coverage percentage — find the money/security/trust-boundary paths with no test at all. Backend tests are Vitest colocated (`*.test.ts`); frontend unit + Playwright e2e under `frontend/e2e/`.
6. **Performance only where it bites.** N+1 Prisma queries on list endpoints, missing indexes for common where-clauses (check schema against actual query patterns), oversized payloads on mobile-shell routes (foremen are on site with bad reception).

## Rules of engagement

- **Evidence or it didn't happen.** Every finding must cite `file:line` and describe a concrete failure scenario (inputs/state → wrong outcome). If you can't construct the scenario, it's not a finding.
- **Verify before reporting.** Read the actual code path end to end, including middleware. Many routes look unguarded at the handler but are covered by router-level middleware or mount-point guards in `backend/src/index.ts`. A finding that ignores middleware is noise.
- **Rank by severity**: (a) security/tenancy breach, (b) data loss or money-wrong, (c) user-facing breakage, (d) missed product opportunity, (e) maintainability. Cap category (e) at your 3 best items — I do not want a style review.
- **No speculative architecture advice.** Do not recommend microservices, GraphQL, event sourcing, a rewrite of the PDF layer, or new infrastructure. The stack is settled.
- **Docs can be stale — code wins.** If a doc contradicts the code, trust the code and optionally flag the drift.

## Settled product decisions — do NOT relitigate these

- Evidence documents (hold point packages, conformance reports, claim evidence) show **% physical position only** — CIVOS never computes dollar amounts on evidence docs. Claim totals appear only as labelled pass-through values. This was validated by market research; it's a positioning choice (Payapps owns the money schedule; CIVOS is conformance evidence).
- Claims are a **data compiler**, not a financial tool: no GST engine, no retention calculation, no SOPA validity checking. Xero owns money; the integration is one claim → one draft invoice.
- Usage quotas are deliberately off. Offline docket entry was deliberately rejected. Foremen deliberately cannot create/edit lots (field execution only). Test documents are titled "Material Conformance Record", never "Test Certificate" (NATA rule).
- Subcontractor pricing model (free via invite) is settled.

Findings that amount to "add the thing they deliberately excluded" will be discarded, so spend your effort elsewhere.

## Recently shipped (don't report as gaps)

As of 2026-07-10: full report/PDF branding overhaul (company logo/ABN/address on all 8 PDF generators, CIVOS footer attribution, standardised filenames), Xero CSV TaxType/DueDate fixes, hold point package section toggles, variation register with claim wiring, test-result workflow overhaul (requirement-first entry, ITP checklist item linkage), honest claim submission ("Mark as submitted"), foreman diary steps unlocked from linear order.

## Output format

1. **Executive summary** — 5 lines max: overall risk posture and the 3 findings I should read first.
2. **Findings table** — severity, one-line title, `file:line`.
3. **Detailed findings** — for each: the defect, the concrete failure scenario, the evidence (quoted code), and the smallest fix that resolves it. Smallest fix — not a refactor proposal.
4. **Gaps I couldn't verify** — anything you suspect but couldn't confirm from code alone (e.g. needs runtime/env/DB state), listed separately and labelled as unverified. Do not mix these into the findings table.

Aim for depth over breadth: 10 verified findings beat 40 pattern-matched ones. If after honest effort a dimension has nothing real, say "nothing found" for that dimension — that is a valid and useful result.
