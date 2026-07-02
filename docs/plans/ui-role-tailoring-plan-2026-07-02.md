# UI Role-Tailoring Plan — 2026-07-02

Companion to `docs/research/role-tailored-uiux-review-2026-07-02.md` (the
evidence). This is the build plan, sequenced and decision-locked with Jayson.

## Locked decisions (Jayson, 2026-07-02)

1. **Build order:** subbie /p restructure first.
2. **Classic desktop subbie dashboard: retired.** `/p` layout everywhere.
3. **Diary split is review-only v1 and adds NO new menu item.** The existing
   "Daily Diary" nav entry stays; its destination is role-branched.
4. **Owner dashboard is mockup-first** (same process as foreman/subbie shells).
5. **Standing rule — no menu overload.** Every slice must be nav-subtractive or
   nav-neutral. A user finds what they need without scanning a menu wall. New
   capability goes *behind* an existing surface (dashboard widget, lot hub,
   role-branched route), never into a new top-level item.
6. **Operating model:** orchestrator + subagents (build → verify → critique →
   fix per screen, one slice = one PR, opus for delegable work). Orchestrator
   works from summaries, screenshots, CI status — not source files.

## Slice 1 — Subbie /p restructure (FIRST)

Design settled in the review doc §2 + recommendation 3.

- **1a. Subbie lot hub** (new screen, mirrors foreman `LotHubScreen`):
  `/p/lots/:lotId` with tiles Inspection (canCompleteITP pill), Holds & Tests
  on this lot, NCRs on this lot (module), Docs on this lot (module); bottom
  primary "Continue inspection" when actionable. Reuses existing portal
  queries filtered by lotId — no new endpoints. `WorkScreen` lot tap →
  hub (not straight into the ITP run).
- **1b. Home slim-down:** remove the "Add today's hours" cambar (duplicates
  hero); remove Inspections / Holds & Tests / NCRs top-level tiles; My Work
  chip becomes the actionable "N checks to do". Edge cases: lots OFF +
  itps ON keeps an Inspections tile as fallback; `/p/quality` stays reachable
  from the Work screen ("view all holds & tests") for un-lotted items.
- **1c. Desktop retirement:** desktop subbies get `/p` (shellFlag + redirect);
  delete `SubcontractorDashboard` + `PortalQuickLinks` grid once nothing
  routes to them. Classic deep routes 301 into `/p` equivalents.
- **Verification dependency:** subbie is NOT role-override-drivable; real
  subbie screenshots need Jayson signed into a subbie account on the `:9344`
  harness (`shot-subbie.mjs`). Schedule that check-in before merge.

## Slice 2 — QM verification (un-break the dead end)

The QM dashboard's "Pending Verifications" queue links to `/itp`, which has no
verify/reject action (backend supports it; UI never built — product-audit H4).
Build the verify/reject affordance on the ITP surface for pending items,
visible to verification roles. Queue keeps pointing where it points today —
nav-neutral. Backend contract audit first (endpoints exist per audit; confirm
shapes before UI work).

## Slice 3 — Diary role split (review-only, nav-neutral)

Same "Daily Diary" menu item, role-branched destination:
- **Field roles** (foreman, site_engineer): today's capture UI, unchanged.
- **Office roles** (owner, admin, PM, QM): a review view — per-project
  submitted / missing for today + yesterday, open + read any entry, weekly
  compliance strip. No "New Entry" affordance for office roles.
No sign-off workflow in v1 (deferred; would need schema + notifications).

## Slice 4 — Owner/admin dashboard (mockup first)

HTML mockup in `docs/design-mockups/` on Quiet Authority tokens → Jayson
approves direction → build as an owner branch in `DashboardPage`.
Content brief: money status across projects (claims: draft/submitted/
certified/paid), compliance exposure (open NCRs + stale hold points — reuse
`ItemsRequiringAttentionWidget` data), diary-submission compliance strip
(feeds off slice 3's query), "waiting on the company" queue. Zero capture
affordances. Cross-project claims visibility lives HERE (dashboard widget with
drill-in), NOT as a new top-level Claims nav item — per the no-new-menus rule.

## Slice 5 — Nav hygiene (subtractive only)

- Docket Approvals off site_engineer + quality_manager nav.
- Portfolio: align nav and route (owner/admin only, or show PM the link —
  pick one; recommend owner/admin only, remove PM from route gate).
- `member` role: don't show Projects link that dead-ends; show the setup
  notice instead.
- Drawings: no nav entry AND an orphan route — surface it from lot context
  (like the foreman lot hub) and drop the idea of a top-level entry.
- Group the office 13-item project sub-nav into labelled sections (Quality /
  Field records / Commercial / Admin) — grouping only, no new items.

## Slice 6 — Data-honesty fixes (parallel, subagent fodder)

- PM dashboard cost: approved dockets, not submitted (§403).
- PM lot-status buckets reconcile to total; drop phantom `on_hold` (§400).
- Diary report KPIs computed across all pages, not page 1 (H20).
- Foreman desktop "Inspections Due Today" actually filters to today (H26).

## Sequence

1 → 2 → 3 → 4 (mockup can start alongside 2–3; build waits on approval)
→ 5 → 6 opportunistic/parallel whenever a subagent is free.

Each slice: branch off origin/master → orchestrated build→verify→critique→fix
workflow → both-theme screenshots reviewed → CI green polled → squash-merge.
