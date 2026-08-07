# CivilPro UI/UX benchmark → SiteProof ticket backlog — 2026-08-06

**Method.** Companion to `civilpro-teardown-2026-08-06.md` (mechanics). This pass mined the *visual*
corpus: all **1,618 screenshots** embedded in CivilPro's 252 illustrated KB articles were downloaded
(their Zendesk attachment URLs are unauthenticated) and mapped to six flows; six analysts then read
CivilPro's screens side-by-side with our 105 authed-prod screenshots (`.gstack/dev-browser/
ui-sweep2-2026-08/`) **and our frontend source on `origin/master`**, producing click-path
comparisons and implementable tickets. Density-audit findings (2026-08-06 sweep) were excluded so
everything here is new value.

**Detailed per-flow reports** — screen-by-screen walkthroughs, click-path tables, full ticket specs
with file paths and screenshot evidence — in
[`civilpro-ui-benchmark-2026-08-06/`](civilpro-ui-benchmark-2026-08-06/):
[lots](civilpro-ui-benchmark-2026-08-06/lots.md) ·
[itp-checklist-hp](civilpro-ui-benchmark-2026-08-06/itp-checklist-hp.md) ·
[ncr-punchlist](civilpro-ui-benchmark-2026-08-06/ncr-punchlist.md) ·
[tests](civilpro-ui-benchmark-2026-08-06/tests.md) ·
[claims](civilpro-ui-benchmark-2026-08-06/claims.md) ·
[platform](civilpro-ui-benchmark-2026-08-06/platform.md).
The raw screenshot atlas (195 MB) is not committed; the per-article manifest and re-download recipe
are in the teardown doc's method notes — it's a 5-minute re-fetch if needed.

---

## The one-line verdict, six ways

Every flow analyst independently converged on the same shape: **CivilPro is a better *register*;
SiteProof is a better *record*.** Their DevExpress grid is ugly, desktop-era, and configuration-
hungry — but ten years of QA managers have beaten it into a working queue: group-by with counts,
ageing columns, bulk verbs, status colour readable from across the room, and every action available
without leaving the list. Our records are richer (readiness verdicts in plain English, sufficiency
engine with clause provenance, signed evidence, role-tailored shells) but our lists are flat,
monochrome scrolls and several of our best computations never reach the screen.

Where we're ahead — keep and defend: field/mobile shells (one check per screen, autosave, offline)
vs their shrunken desktop grid on an iPad; cold-start (role defaults, no setup ritual); plain-
language blockers vs "some items are orange"; single app vs two divergent clients.

---

## Cross-cutting patterns (each appears in 3+ flows)

1. **State legible from the list.** Their registers encode status in colour + swatch; ours renders
   most statuses in identical grey (`pages/lots/constants.ts` maps 3 of 4 lot statuses to
   `bg-muted`; NCR maps 5 states the same). We also found **four competing lot-status colour
   systems** in our own code (table / QuickView / map legend / LinearMapView which discards its
   colour prop). One token map, consumed everywhere, colour paired with text.
2. **The grid is the queue.** Group-by with counts + ageing columns (Days Open, signed Due) +
   shipped preset views ("Open", "My lots", "Awaiting verification") is how their users answer
   "who's got the ball" with no inbox feature. We have zero group-by anywhere (grep-verified), no
   time column on any register, and saved filters that are localStorage-only, lots-only.
3. **Who-owes-what strips on rows.** Their checklist rows carry Check/Verify/Approve as three
   tri-state marks (done / required-pending / not-required-greyed); punchlist rows the same; NCR
   register shows Is Complete/Published ticks. Our rows carry one chip. The four-dot gate strip
   (NCR) and three-pip row (checklist) tickets transfer this without their column-chooser burden.
4. **Bulk verbs, greyed not hidden.** Every CivilPro verb works on a multi-row selection, and
   inapplicable verbs render greyed — the menu teaches the state machine. Our bulk actions exist on
   lots only and are under-surfaced.
5. **Shortcut buttons that carry the number.** `COPY REMAINING QTY (35,658 M2)`, `Set Certified =
   Claimed`, `Copy Costs From Previous` — they found every tedious hour and put a labelled button on
   it. Cheapest pattern in the corpus to copy.
6. **Show the working.** Their test calculator prints `2,600 / 500 => 6 - 0 => 6` in a green cell;
   their Effective Qty sits beside the status that caused it. We compute *better* numbers (sufficiency
   engine with authority/edition/clause) and show them only as blockers. Presentation, not capability.
7. **Compute-with-override, marked.** Derived values everywhere, manual overrides rendered orange
   with a revert action. Adopt as amber + `Edited` chip + tooltip + revert — never colour alone.

**Anti-pattern guardrails** (their documented failures — do not import): colour as the *only*
encoding; critical columns hidden behind a Column Chooser; right-click as primary surface; wizard
steppers for 3-field tasks; save-vs-send as separate forgettable acts; rich-text as data model;
config rituals before first value; "scroll right for more columns" drawn on their own docs
screenshots; a workflow-graph editor as the fix for a rejected NCR.

---

## Consolidated backlog, in waves

Priorities merge the six per-flow rankings; effort is the analysts' estimate against current code.
File paths and evidence screenshots are in the per-flow reports (ticket IDs referenced).

### Wave 1 — "Registers speak" (~1 week total, no schema changes, pure presentation)

| # | Ticket | Flow ref | Effort |
|---|---|---|---|
| 1 | One status-colour token map; kill the four competing systems; apply to lot + NCR registers, mobile cards, map | lots T1, ncr T2 | ~1d |
| 2 | Group-by (curated fields, collapsible bands with counts) on Lots, then NCR/Hold Points | lots T2, platform P1 | ~2d |
| 3 | Ageing columns: Days Open / signed Due, sortable, on Lots, NCR, Hold Points, Tests | lots T3, platform P2 | ~1d |
| 4 | Shipped preset views per register, default chosen by role (QM lands on "Awaiting verification") | lots T8, ncr T3, platform P3 | ~1-2d |
| 5 | NCR four-dot gate strip (Responded·Rectified·Verified·Closed) with attribution tooltips — drives off fields we already store | ncr T1 | ~1d |
| 6 | Readiness columns on lot register (ITP n/m, open NCRs, tests outstanding, Has evidence) — data already computed for LotReadinessPanel | lots T3 | ~2d |
| 7 | Surface bulk actions: selection bar on lots; extend pattern to NCR/HP; greyed-not-hidden verbs | lots T4, platform P8 | ~2d |

### Wave 2 — "Field flow" (~1 week; the only gap where CivilPro genuinely serves a site engineer better)

| # | Ticket | Flow ref | Effort |
|---|---|---|---|
| 8 | Hold-point row shows *requested* state (pending pip + recipient + due) and offers **Request release from the row** — today a foreman must leave the checklist and find 1 row among 1,728 in the HP register | itp T1 | ~2d |
| 9 | **QR release**: render the existing `HoldPointReleaseToken` URL as an on-screen QR ("scan this, or send the link") — beat their version by keeping the register record + signature they deliberately drop | itp T2 | ~1d |
| 10 | Approver verbs on the public release page: Release / Release with conditions / Reject / Raise NCR, min-25-char comment with live counter, status-after preview | itp T3 | ~2d |
| 11 | Before/after evidence pairing on NCR rectify (two labelled dropzones, paired columns, close gated on ≥1 *after* photo, same split in the PDF) — their version is a Windows-folder naming convention | ncr T6 | ~2d |
| 12 | Acceptance criteria: add the missing editor input (field exists, displayed, never enterable) + print method/frequency/criteria under the checklist row | itp T4 | ~0.5d |
| 13 | Printed checklist: initials-over-date cells + abbreviation key + a Field Complete (wet-ink) variant with signature blocks | itp T5 | ~1d |

### Wave 3 — "Numbers show working" (~2 weeks)

| # | Ticket | Flow ref | Effort |
|---|---|---|---|
| 14 | Test denominator everywhere: "3 of 6 verified" on Tests page header, lot Tests tab, CreateTestModal — sufficiency engine already computes it, zero new arithmetic | tests T1 | ~1d |
| 15 | Show the working + cite the clause on hover ("6 required — VicRoads 204 v8.0 cl. 204.13(a)"); missing inputs phrased as help, not blockers | tests T2 | ~1d |
| 16 | Batch raise: "Raise 6 tests" one modal → N rows; scope filter (lot / checklist / item) | tests T3 | ~2d |
| 17 | Wire the orphaned lab request form (`GET /api/test-results/:id/request-form` — zero frontend callers); make "Send to lab" actually produce the artefact | tests T4 | ~0.5d |
| 18 | **Claim detail page** `/claims/:claimId` with pinned lot columns + band columns (Previously claimed / This claim / Certified / To date); mobile = one band at a time via segmented control | claims T1 | ~1wk |
| 19 | Set Certified = Claimed, then edit exceptions; line-level certification (what makes a SOPA dispute arguable) | claims T2 | ~1d |
| 20 | Shortcut buttons with live values ("Claim remaining (42%)"); manual-override amber + Edited chip + revert; quantity transparency line ("$42,000 × 65% (ITP 13/20) = $27,300") incl. no-dollar variant on evidence docs | claims T3-T5 | ~2d |
| 21 | Notification triage state (Needs action / FYI / Actioned) + collapse repeated alerts — our bell shows five identical ESCALATED rows today. **Shipped page-only in #1778** ("Read" not "Actioned" — read ≠ done); the bell dropdown was descoped pending design | platform P5 | ~2d |
| 21b | **Bell dropdown — design APPROVED by Jay 2026-08-07** (`docs/design-bell-dropdown-mock-2026-08-07.html`): desktop-only popover over the same `/api/notifications/grouped` data as the page (one classifier module, no drift); Needs-action first, ×N collapse chips, "Read" collapsed, ~8 rows then "View all notifications" + "Mark all read" footer; below `md` the bell stays a straight link to /notifications. Build-ready — no further design pass needed | platform P5 | ~1d |

### Wave 4 — structural (schema/product decisions for Jay, not quick tickets)

- **Per-sample structured test results** (tests T6): named result fields per method, one row per
  specimen → characteristic value / CV per lot — the language AU specs are written in. CivilPro has
  the model; pairing it with our numeric spec bounds gets **auto pass/fail**, which they can't do.
- **One-ITP-per-lot constraint** (itp T10): `ITPInstance.lotId` is unique in our schema; CivilPro
  lots routinely carry Subgrade + Unbound + Asphalt ITPs simultaneously.
- **Punchlist module** (ncr T8): we have no lightweight defect-list instrument; NCR is the wrong
  granularity for a 60-item handover walk. Their punchlist UI is the best-designed surface they own
  — copy the three-gate grid, add lot/chainage + project-level default roles.
- **Variation Submitted vs Approved + waypoint timeline** (claims T7/T8): we store only
  `approvedAmount`; the negotiation (and EOT) has nowhere to live.
- **Review/handoff axis on lots** (lots T5): fixed 4-status append-only review log — their best
  idea, shipped without their configurability.
- **Email log** (platform P6): persist every outbound email + delivery status; the dispute answer
  to "we never got the hold-point request".
- **Client-role result gating** (tests T8): record intent now, build when a client role ships.
- **Hold-point rejection / conditional-release lifecycle** — **APPROVED by Jay 2026-08-06; needs
  design before build.** Added after the Wave-2 SOL review cut Reject / Release-with-conditions /
  Raise-NCR from the public release page: `HoldPointReleaseToken` and the release path only model an
  unconditional "yes" (the execution path always writes `released`), so a knock-back or a "yes,
  but…" currently has no record at all. Scope: schema for a rejection decision (who/when/why, HP
  returns to a re-requestable state, foreman notified) and for conditional release (condition text
  as first-class items with a close-out step, not a notes field that vanishes), register + checklist
  display of both states, and the re-request cycle. The two most dispute-valuable moments on a job —
  a failed inspection and a conditional pass — become records instead of phone calls. ~2–3 days incl.
  one reviewed migration. Raise-NCR from the release page stays cut unless it requires
  authentication — anonymous NCR creation is an abuse surface, not a feature.

### Deliberately not adopting
Schedule-of-rates register (second spine vs our lot spine) · floating quantities · claim snapshots
(compute live, freeze at submission) · per-user view *sharing* and magic view names (config-burden
versions of preset views) · drag-to-group bar and column-chooser-first design · Start Register
setting (role defaults already land people correctly) · DJC/cost codes/forecasting (Xero owns money).

---

## Sequencing note

Wave 1 pairs naturally with the density-audit fix waves already in flight (#1756 landed the first
chunk) — same pages, same components, compatible diffs. Wave 2 items 8–10 are the highest
competitive value: they close the only flow where CivilPro beats us in the field, and they build on
infrastructure (release tokens, public pages) that already exists.
