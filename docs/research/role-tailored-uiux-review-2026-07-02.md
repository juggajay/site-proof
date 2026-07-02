# Role-Tailored UI/UX Review — 2026-07-02

Question asked: does each role's screen match what that user actually does all day?
Method: 4 parallel code-audit agents (nav/role map, foreman anatomy, subbie portal
inventory, management surfaces + prior research) + user-story synthesis.

## User stories (the yardstick)

| Role | Story | Should see |
|---|---|---|
| Owner / admin | "Is my business healthy and protected?" Logs in a few times a week. | Summaries + review queues. Never a capture form. |
| Project manager | "Keep the job moving and get paid." Daily. | Pipeline, claims, review of field records, chase-ups. Creates claims only. |
| Quality manager | "What's waiting on me?" | A work queue: verify ITPs, release HPs, review NCRs. |
| Foreman | "Capture today, fast, one-handed, on site." | Already the reference (mobile). |
| Site engineer | Hybrid: assigned lot work + tests. | Field-leaning, no commercial. |
| Subbie | "Submit my docket, get out." | One hero action, minimal menu. |
| Subbie admin | Same + manage own crew roster. | Ditto + roster write access. |

## Confirmed headline issues (Jay's two instincts)

### 1. Owner sees diary-creation UI he will never use — CONFIRMED
- Nav: "Daily Diary" has **no role gate** — every internal role incl. owner/admin
  (`frontend/src/components/layouts/Sidebar.tsx:110`).
- Page: `frontend/src/pages/diary/DailyDiaryPage.tsx` renders the "New Entry"
  affordance unconditionally (`:123`, `:252`, `:365`) — same single-day
  creation UI for a foreman and the owner.
- Deeper problem: **there is no management review surface for diaries at all.**
  The only review is the read-only Reports → Diary tab (which also has the
  page-only-KPI undercount bug, product-audit H20). No "who submitted today /
  who didn't" queue, no sign-off, no reopen/amend (`locked_at` is dead code,
  §292/§295).

### 2. Subbie portal too many card tabs — CONFIRMED (in BOTH homes)
Correction 2026-07-02 (Jay): the new `/p` mobile shell is NOT the fixed
version — it still organizes by data type instead of by the subbie's world,
and it duplicates its primary action. Verified in code:

- **Duplicate primary action**: the bottom "Add today's hours" cambar
  (`frontend/src/shell/subbie/screens/HomeScreen.tsx:449-461`) navigates to the
  exact same `docketPath` as the Today's Docket hero directly above it
  (`:423-429` vs `:464`). The foreman cambar is a *different* action
  (Take a photo → CaptureModal, `shell/screens/HomeScreen.tsx:349-361`).
- **Duplicate drill-in**: My Work lot tap → `/p/lots/:lotId/itp`
  (`WorkScreen.tsx:187-189`) and the Inspections tile → `/p/itps` → same
  `/p/lots/:lotId/itp`. Two top-level tiles land on the same run screen.
- **Data-type tiles vs the foreman's behind-the-lot pattern**: foreman home =
  hero + 3 tiles (Lots/Dockets/Issues); Inspections, Photos, Drawings, Details
  live BEHIND the lot in `LotHubScreen.tsx:140-181` (exactly 4 menus + a
  "Continue inspections — N due" bottom action). Subbie home lifts
  Inspections, Holds & Tests, NCRs to top-level tiles (default = hero +
  4 tiles + 2 links + duplicate cambar ≈ 8 targets).
- The classic desktop dashboard (`SubcontractorDashboard.tsx` +
  `PortalQuickLinks` 6–7 card grid) has the same disease worse, plus daily
  dead empty states. Non-admin subbies also get a "My Company — manage roster"
  surface that is read-only for them (`CompanyScreen.tsx:252`).

## Bigger finds (not in the original brief)

### 3. QM "Pending Verifications" queue is a dead end — BROKEN, not cosmetic
`QualityManagerDashboard.tsx:407-451` correctly frames "waiting on the QM",
but every item links to `/itp`, which has **no verify/reject UI** (product-audit
H4 — verification is backend-only). The headline separation-of-duties feature
is unreachable from the UI. Highest-impact single fix in this review.

### 4. Owner/admin have no dashboard of their own
`DashboardPage.tsx:89-120` routes PM, QM, foreman, subbie to bespoke
dashboards; owner/admin/site_manager/viewer/member all share `DefaultDashboard`.
Ironically it hosts the best "waiting on me" widget in the product
(`ItemsRequiringAttentionWidget`) — but answers "how many lots/projects", not
"which claims await certification, which crews didn't submit a diary, what's
blocked". Prior design exploration (mockups on disk) covered foreman + subbie
shells only; management dashboards were feature-assembled, never designed.

### 5. Nav mismatches (from the role/route map)
- Docket **Approvals** shown to site_engineer + quality_manager who can't see
  amounts (`Sidebar.tsx:111`; amount viewers = owner/admin/PM, `roles.ts:167`).
- Portfolio: nav shows owner/admin only (`Sidebar.tsx:93`) but the route allows
  PM (`App.tsx:294`) — reachable by URL with no link. Pick one.
- `member` role sees Dashboard + Projects links but every project route 403s.
- `/projects/:id/drawings` exists but has no nav entry anywhere.
- Management project sub-nav is a **flat 13-item list** — Claims sits as a peer
  of Documents; no grouping by job (Quality / Field records / Commercial / Admin).
- Claims requires drilling into a project first — no top-level commercial entry.
- PM dashboard cost widget uses *submitted* (not approved) dockets (§403);
  lot buckets don't reconcile (§400).
- Desktop foreman "Inspections Due Today" lists ALL ITP items, not today's (H26).

## The pattern to standardize (from the foreman anatomy)

What makes the foreman mobile experience work (`ForemanBottomNavV2.tsx`,
`TodayWorklist.tsx`, `CaptureModal.tsx`):
1. Hard cap ~5 fixed nav choices; one is the primary **action**, not a page.
2. **One urgency-ranked worklist** replaces N category tabs (server merges
   HPs/ITPs/inspections into Blocking → Due Today → Coming Up).
3. "Today"/"Waiting on me" framing, not "Dashboard" chrome.
4. The daily action is a permanent, visually dominant fixture (1 tap anywhere).
5. Value before form (camera first, categorize after).
6. Whole cards are tap targets; color encodes status only.
7. Honest empty states with 1–2 forward actions.

Role translation of principle 2:
- Foreman: today's field work (built ✅)
- QM: verifications + HP releases + NCR reviews (queue exists, actions missing)
- PM: submissions to review + claims to progress + blocked items
- Owner: exceptions only — money waiting, compliance exposure, missing diaries
- Subbie: today's docket (built in `/p` ✅, desktop still on old grid)

## Recommended work, in order

1. **Un-break QM verification** — verify/reject actions on the ITP surface (or a
   dedicated verification queue screen the dashboard links to). (H4)
2. **Split diary by role** — field roles keep capture UI; owner/admin/PM/QM get a
   review view: yesterday/today submission compliance per project, read + (later)
   sign-off. Hide "New Entry" from office roles.
3. **Restructure the subbie `/p` home on the foreman pattern** (then retire the
   classic desktop dashboard onto it):
   - Home = Today's Docket hero + **My Work** tile + **My Dockets** tile +
     small Documents / My Company links. Remove the "Add today's hours" cambar
     (duplicates the hero).
   - New **subbie lot hub** behind My Work (mirror of foreman
     `LotHubScreen`): Inspection run (with the canCompleteITP "YOU CAN
     COMPLETE"/"VIEW ONLY" pill from `ItpsScreen`), Holds & Tests on this lot,
     NCRs on this lot (module), Docs on this lot (module); bottom primary
     "Continue inspection" when actionable. Reuses the existing
     `/p/quality`-style queries filtered by lotId — no new endpoints.
   - Fold the top-level Inspections / Holds & Tests / NCRs tiles into the hub.
     Edge cases: (a) lots module OFF + itps ON still needs an Inspections
     entry (keep tile as fallback in that config only); (b) holds/tests not
     tied to a lot need a "view all" path (keep `/p/quality` reachable from
     the Work screen).
   - Move the My Work chip from "N lots" to the actionable count ("N checks
     to do"), mirroring the foreman Lots chip.
4. **Owner-first dashboard** — dedicated owner/admin view: claims/money status
   across projects, compliance exposure (open NCRs, stale HPs — widget exists),
   diary-submission compliance, "waiting on the company" queue. No capture
   affordances anywhere.
5. **Top-level Claims entry** for commercial roles (cross-project claims landing).
6. **Nav hygiene sweep** — Docket Approvals off SE/QM; Portfolio nav/route
   agreement; group the 13-item sub-nav by job; drawings nav entry or kill route;
   member-role dead-end.
7. Data-honesty fixes behind the dashboards: PM cost uses approved dockets,
   reconcile lot buckets, diary report KPIs across all pages, foreman desktop
   "due today" filter. (§403, §400, H20, H26)

## Source reports
Agent findings summarized above; key files cited inline. Prior-research note:
`docs/research/ux-audit-2026-06-08/` and `docs/live-dogfood-qa-plan.md` do not
exist on this branch — the richest prior source is `docs/product-audit-2026-06-21.md`
(117 findings; H-numbers above refer to it).
