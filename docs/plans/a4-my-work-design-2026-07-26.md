# A4 — "My Work" (UX Stage 1) design spec

**Status:** design only. No product code, no routes, no components in this PR.
**Base:** `origin/master` @ `668a9592` (F0.3 contracts merged, #1560).
**Mockups:** [`docs/plans/a4-mockups/`](./a4-mockups/) — three self-contained HTML files,
desktop + 390px mobile frames in each, verified rendering in Chromium with zero console
output.

| Deliverable | File |
| --- | --- |
| (a) Needs Attention — richer cards | `docs/plans/a4-mockups/01-needs-attention.html` |
| (b) My Work overview — uniform cards | `docs/plans/a4-mockups/02-my-work-overview.html` |
| (c) Lot header primary action (before / after / empty case) | `docs/plans/a4-mockups/03-lot-header-primary-action.html` |

---

## 1. What A4 is, and what it is not

From the validated build-out program:

- **Phase 1** — office nav groups, a Needs-Attention destination, an action hierarchy,
  and a lot-header primary action. Must be shippable on its own.
- **Phase 2** — the full ball-in-court model: needs-action / due-soon / waiting-on-me /
  waiting-on-others / overdue, with age, owner, one primary action per item, and
  notifications that deep-link to the decision rather than to a register.

A4 is a **rendering** of the F0.3 contract. It invents no new readiness vocabulary. Every
row it draws is an `ActionAssignment`; every verb on a button comes from that row's
`primaryAction`; every explanation traces to that row's `reasonCode`.

**Out of scope, permanently:** the foreman and subcontractor shells (`frontend/src/shell/**`).
A4 designs office roles only — `owner`, `admin`, `project_manager`, `quality_manager`, and
`site_engineer` where a role gate admits it (`backend/src/lib/roles.ts:6-18`).

---

## 2. Current truth at HEAD (everything below is cited)

### 2.1 The office sidebar already has the phase-1 nav groups

`frontend/src/components/layouts/navItems.ts:34`:

```ts
export const OFFICE_SECTION_ORDER = ['Quality', 'Commercial', 'Records', 'Admin'] as const;
```

Grouped rendering is gated on office roles only — `Sidebar.tsx:161` computes
`isOfficeRole = hasRoleInGroup(projectScopedRole, ROLE_GROUPS.QUALITY)`, and
`Sidebar.tsx:354-371` renders sectioned groups for them and the flat list for everyone else.

**Consequence: the "office nav groups" half of phase 1 is already shipped.** A4 phase 1
inherits it and must not re-litigate it.

Global nav above the project block is exactly three items — Dashboard, Portfolio, Projects
(`Sidebar.tsx:46-68`). Project nav renders only when a `projectId` is in the route
(`Sidebar.tsx:345`). **No sidebar item carries a badge or count today**; the only count in
the office chrome is the notification bell (`Header.tsx:243-256`, capped at `9+`).

### 2.2 An attention surface already exists, and it is the wrong shape

`frontend/src/components/dashboard/ItemsRequiringAttentionWidget.tsx` is mounted on the
office dashboard at `DashboardPage.tsx:495-500`, fed by `stats.attentionItems`
(`DashboardPage.tsx:214-237`), and returns `null` when the total is zero
(`ItemsRequiringAttentionWidget.tsx:42-44`).

What it gets right: cross-project rows, age ("N days overdue"), a chevron, a per-row link,
same-origin link validation (`:31-36`).

What it gets wrong, and what A4 fixes:

| Problem | Evidence |
| --- | --- |
| Grouped by **subject type**, not by ball-in-court | `:57` "Overdue NCRs", `:97` "Stale Hold Points" |
| **No owner** on any row — you cannot tell who is holding it up | `AttentionItem` has no assignee field (`:3-18`) |
| **No action** — every row is a navigate, so the decision is always one screen away | rows are plain `<button onClick={navigate}>` (`:65-90`) |
| Only two reason codes are representable | `type: 'ncr' \| 'holdpoint'` (`:5`) |
| Free-text `description` under each label | `:8`, rendered `:84` |

### 2.3 The lot header has five equal buttons and no primary

`LotHeader.tsx:254-307` renders, all as raw `<button>` with the same outline treatment:
Ask Clancy (`:255`), Copy Link (`:259`), Print (`:276`), Edit Lot (`:284`), Override
Workflow Status (`:296`), then the status chip (`:306`). Nothing is promoted, so the screen
never says what to do next.

The **mobile** branch of the same file already solved this: one primary plus a
`MoreVertical` overflow into a `BottomSheet` (`LotHeader.tsx:162-181`, actions list
`:98-138`). A4 does not invent a pattern — it promotes the shipped mobile pattern to desktop
and changes only *which* action earns the primary slot.

### 2.4 Notification deep-linking already has a safety contract

`Notification.linkUrl` (`backend/prisma/schema.prisma:1624`) is rendered through
`getSafeInternalPath` (`frontend/src/pages/NotificationsPage.tsx:45-57`), which rejects
anything not starting with a single `/`, and anything containing `\` or control characters,
before `navigate()` (`:177-186`). A4 extends this contract; it does not replace it.

### 2.5 Visual language

Tokens are HSL triplets in `frontend/src/index.css:8-104`, consumed as `hsl(var(--x))`.
Warm canvas `--background: 40 14% 96%` (`:9`), near-black `--primary: 24 14% 9%` — explicitly
"NOT violet" (`:18`), neutral `--accent` — explicitly "not amber" (`:27`), and the single
signature `--brand: 26 90% 37%` deep amber (`:42`), used in exactly two office places: the
active nav item's left rail and its icon (`Sidebar.tsx:100, 111`).

The colour discipline A4 must honour is already written down in
`frontend/src/lib/lotStatusOverview.ts:63`:

> "muted lifecycle states, colour only where a human must act, foreground tint for the earned end states"

That sentence *is* the ball-in-court model expressed as colour. A4 adopts it verbatim:
`bg-destructive/10 text-destructive` for blockers, `bg-warning/10 text-warning` for warnings,
`bg-muted text-muted-foreground` for everything else, `bg-foreground/10 text-foreground` for
earned end states.

Type: IBM Plex Sans / Mono, loaded once in `frontend/index.html:26-29`; families mapped at
`tailwind.config.js:95-98`. Page `h1` is `text-2xl font-semibold tracking-tight`
(`DashboardPage.tsx:368`); the uniform card label is `text-sm font-medium`
(`DashboardQuickLinks.tsx:26`). `Badge` has only four variants — no success/warning/info
(`frontend/src/components/ui/badge.tsx:10-17`) — so A4's chips are utility classes on a
`<span>`, matching how `LotHeader.tsx:86` already does it.

The `.shell-*` classes in `index.css:278-1046` are **field/mobile shell only** and must not
leak into these office screens.

---

## 3. The data contract A4 renders

`backend/src/lib/readiness/contracts/actionAssignment.ts` (read in full; invariants at `:8-19`).

```ts
interface ActionAssignment {
  subjectType: string;      // 'lot' | 'hold_point' | 'ncr' | 'claim' | 'test'
  subjectId: string;
  title: string;
  status: 'waiting_on_me' | 'waiting_on_others' | 'done';   // exhaustive, mutually exclusive
  needsAction: boolean;     // DERIVED — never authored
  isOverdue: boolean;       // ORTHOGONAL to status
  dueAt?: string;           // ISO 8601
  assignee: { kind: 'user'|'role'|'company'|'external'|'system'; id?: string; role?: string };
  severity: 'blocker' | 'warning' | 'support';
  reasonCode: ReadinessReasonCode;   // closed vocabulary, reasonCodes.ts:29-72
  primaryAction: { label: string; href?: string; executableByRoles: Role[] };
}
```

The derivation, `actionAssignment.ts:85-93`:

```ts
needsAction === (status === 'waiting_on_me' && primaryAction.executableByRoles.includes(viewerRole))
```

### Four invariants, and how the UI is forced to honour each

| Invariant | How the design makes it visible |
| --- | --- |
| `status` is exhaustive + mutually exclusive | It is the **only** grouping axis. Three groups, every open item in exactly one, counts sum to the total. Nothing is grouped by subject type (unlike the widget today). |
| `needsAction` is DERIVED from status **and** viewer role | The primary-action **button renders iff `needsAction === true`**. It is the single visible difference between rows. A `waiting_on_me` row whose viewer cannot execute the action gets *no* button and a `Needs {role}` chip instead — the UI never offers a verb the viewer cannot perform. |
| `isOverdue` is ORTHOGONAL to `status` | Overdue is never a group. It is (i) a chip on the row and (ii) a filter lens across all groups. Filtering to Overdue keeps the ball-in-court grouping, so an overdue item still reads "Waiting on Hunter Geotech Pty Ltd". See mockup (a), Waiting-on-others row 1: **7 days overdue AND waiting on a lab**, both true, neither collapsed. |
| One `primaryAction`, one stable `reasonCode` | One button per row, never a menu. The reason line on the lot header prints the `reasonCode` beside the sentence, so the button is always traceable to the predicate that produced it. |

**Severity comes from the readiness engine** — `EvidenceReadinessSeverity = 'blocker' | 'warning' | 'support'`
(`backend/src/lib/evidenceReadiness/core.ts:1`).

---

## 4. THE grouping mapping table

UI groupings are **derived views** over `status` + `needsAction` + `isOverdue` + `dueAt`. No
grouping is stored, and no grouping is a status.

### 4.1 Primary axis — ball in court (a partition; items appear exactly once)

| UI group | Predicate | Renders a primary action button? | Chip shown | Sums to total? |
| --- | --- | --- | --- | --- |
| **Needs you** | `needsAction === true`<br>(≡ `status==='waiting_on_me' && viewerRole ∈ primaryAction.executableByRoles`) | **Yes** — solid `btn-primary`, label = `primaryAction.label` | severity | ✅ |
| **Your court — needs another role** | `status==='waiting_on_me' && needsAction === false` | No | severity + `Needs {role}` where role = first of `executableByRoles` outranking the viewer | ✅ |
| **Waiting on others** | `status==='waiting_on_others'` | No | severity | ✅ |
| *(not rendered)* | `status==='done'` | — | — | excluded; surfaced only as a "Closed this week" count |

These four rows are exhaustive over `ActionAssignmentStatus`, so the three rendered groups
partition every open assignment. **This is the only axis that groups.**

### 4.2 Secondary axis — timing (lenses; deliberately overlapping)

| UI lens | Predicate | Relationship to the partition |
| --- | --- | --- |
| **All open** | `status !== 'done'` | default |
| **Overdue** | `isOverdue === true && status !== 'done'` | **cross-cuts all three groups** — an overdue item is still in exactly one ball-in-court group, and keeps its owner and its (absent) button |
| **Due in 7 days** | `!isOverdue && dueAt != null && dueAt <= now + 7d && status !== 'done'` | cross-cuts all three groups |
| **No due date** | `dueAt == null` | cross-cuts all three groups |

Rules that follow from orthogonality and must be enforced in code review:

1. Selecting a timing lens **filters** the list; it never re-groups it. The three group
   headings stay on screen.
2. Timing counts and ball-in-court counts **do not sum to each other**. The overview screen
   separates them under two eyebrows (`Ball in court` / `By timing`) precisely so nobody
   reads them as one total.
3. `isOverdue` must never be used to *promote* an item out of `waiting_on_others` into
   `Needs you`. Overdue changes urgency, never ownership.
4. `isOverdue === true && status === 'done'` (done-but-was-late) is permitted by the contract
   (`actionAssignment.ts:15`) and is **not** rendered in My Work. It belongs to reporting.

### 4.3 Assignee rendering

| `assignee.kind` | Rendered as | Example (mockup a) |
| --- | --- | --- |
| `user` | Person's name; "(you)" appended when `id === viewerId` | `Dana Whitmore (you)`, `Marcus Tolley (Site Engineer)` |
| `role` | Canonical role label; "(you)" when the viewer holds it | `Quality Manager (you)` |
| `company` | Company name, with a qualifier where it clarifies | `Hunter Geotech Pty Ltd (NATA lab)` |
| `external` | Party name + what is awaited | `Ausgrid — witness attendance` |
| `system` | `CIVOS automation` | nightly evidence sweep |

Each row prints the kind as a small mono tag before the name (`ROLE`, `USER`, `COMPANY`,
`EXTERNAL`, `SYSTEM`) so "waiting on a person" and "waiting on a firm" are never confused —
they imply different chase behaviour in AU civil.

`system` rows never render a chase affordance: you do not ring a robot.

---

## 5. Action hierarchy rules

### 5.1 What makes something *the* primary action

Nothing in A4 chooses a verb. **`primaryAction` is authored by the contract producer**, one per
assignment (`actionAssignment.ts:46-51, 76`). A4's job is only to decide (i) whether to render
it, and (ii) which assignment's action wins a shared slot.

**Render rule (absolute):** the solid button renders **iff `needsAction === true`**. There is
no second-tier button, no "Chase" button, no split button. `executableByRoles` is described in
the contract as "the canonical-role gate the `needsAction` derivation consults — it is the
contract's way of saying 'who can actually action this', not a UI hint" (`:41-45`). Rendering a
button outside that gate would make the UI lie about permissions.

**Ranking rule** (used to order the list, and to pick the lot-header primary). Sort key,
lexicographic, all comparisons stable:

```
1. needsAction              true before false
2. severity                 blocker(0) < warning(1) < support(2)
3. isOverdue                true before false
4. dueAt                    ascending, nulls last
5. ageDays                  descending (oldest first)
6. subjectId                ascending  ← stable tiebreak, so the order never flickers
```

Note the ordering of 2 and 3: **severity outranks overdue.** An overdue advisory must not
outrank a blocking hold point. Age is last because in AU civil an old low-severity item is
noise; a new blocker is not.

### 5.2 `reasonCode` → `primaryAction` mapping

The vocabulary is closed (`reasonCodes.ts:29-85`). Codes fall into three classes.

**Class A — actionable (produce an assignment with a real verb):**

| `reasonCode` | `primaryAction.label` | `executableByRoles` (proposed) | Typical `subjectType` |
| --- | --- | --- | --- |
| `no_itp_assigned`, `no_itp` | Assign ITP | owner, admin, project_manager, quality_manager | lot |
| `itp_incomplete` | Open ITP checklist | + site_engineer, site_manager, foreman | lot |
| `unreleased_hold_points`, `unreleased_itp_hold_points`, `na_hold_point_not_released`, `release_gated_hold_points` | Release hold point | owner, admin, project_manager, quality_manager | hold_point |
| `missing_hold_point_recipients` | Add recipients | owner, admin, project_manager | hold_point |
| `hold_point_overdue` | Review hold point | owner, admin, project_manager, quality_manager | hold_point |
| `pending_tests` | Verify test result | owner, admin, quality_manager | test |
| `no_passing_verified_test`, `no_tests` | Record test result | quality_manager, site_engineer | test |
| `failed_tests` | Raise NCR | owner, admin, quality_manager | test |
| `open_ncrs`, `open_minor_ncrs` | Open NCR | owner, admin, quality_manager | ncr |
| `open_major_ncrs` | Verify rectification | owner, admin, quality_manager | ncr |
| `ncr_overdue` | Review NCR | owner, admin, quality_manager | ncr |
| `not_conformed` | Conform lot | owner, admin, project_manager, quality_manager | lot |
| `conformance_no_longer_current` | Re-conform lot | owner, admin, project_manager, quality_manager | lot |
| `conformance_overridden` | Review override | owner, admin, quality_manager | lot |
| `missing_budget` | Set lot budget | owner, admin, project_manager | lot |
| `partially_claimed` | Add to claim | owner, admin, project_manager | claim |
| `missing_request_evidence` | Attach evidence | owner, admin, project_manager, quality_manager | lot |
| `no_photos`, `low_photo_evidence` | Add photos | site_engineer, site_manager, foreman | lot |
| `insufficient_test_count` | Review test coverage | owner, admin, quality_manager, site_engineer | lot |
| `tests_unlinked_to_itp_item` | Link tests to ITP | owner, admin, quality_manager, site_engineer | lot |

The two overdue codes are **the same subject as an existing row, later in its life** —
`ncr_overdue` only ever co-occurs with `open_ncrs`/`open_major_ncrs`, and `hold_point_overdue`
with an unreleased-hold-point code. They therefore set `isOverdue` on that one assignment;
they never add a second row for the same NCR or hold point (§4.2, timing is a lens over the
row, not a row of its own). Both sufficiency
rows are lot-scoped, not test-scoped — the shortfall is "this lot × this rule", so the button
lands on the lot's tests tab, not on any one test.

**Class B — positive / terminal (produce `status: 'done'`, never rendered):**
`conformance_prerequisites_met`, `lot_already_claimed`, `lot_already_conformed`,
`already_claimed`, `released_hold_points`, `passing_tests`, `itp_complete`, `ncrs_closed`,
`photo_evidence`, `test_sufficiency_met`.

**Class C — aggregate / count-only / advisory (produce NO assignment):**
`management_only_items`, `field_actionable_items`, `documents`, `photos` (roll-ups, not
decisions), plus `approved_dockets` and `diary_entries`, which the engine hardcodes to 0 today
(`reasonCodes.ts:143-150`) pending F0 execution-spec §13.4 ("wire in D1 or drop"). A4 must not
render a decision from a hardcoded zero.

Also class C, for a different reason — **no single verb exists**, so a row would violate §5.3:

- `test_sufficiency_unknown` — a MISSING INPUT, not a shortfall. Its six causes
  (`sufficiency/types.ts:238-245`) point at different owners: `no_ruleset_for_project` and
  `no_rule_for_activity` are CIVOS content gaps, `activity_not_canonical` /
  `scale_not_selected` / `scale_not_recognised` are lot setup, `quantity_missing` is lot data.
  One button cannot address that set, and guessing the wrong one sends the user to a dead end.
  If usage shows this dominating, split it per cause into class-A codes — do not give the
  aggregate a verb.
- `lot_exceeds_max_lot_size` — advisory arithmetic (`evaluate.ts:267-279`): the lot is larger
  than the ruleset's cap. The remedy is splitting the lot, which is not an operation the app
  offers, so it is information for the lot surface, not a routable decision.

**Rule for future codes:** a new engine code must be classified A/B/C in the same change that
adds it to `READINESS_REASON_CODES`, or My Work silently drops it.

### 5.3 What "one primary action" forbids

- No row shows two buttons.
- No row shows a dropdown of actions.
- Bulk selection is **not** in A4. If several items share a verb, that is a hold-point *release
  batch* concern (`futureConsumers.ts:41-64`), a different consumer.
- The primary button never performs a destructive or irreversible operation directly from the
  list. It navigates to the decision surface, which owns confirmation. My Work is a router to
  decisions, not a decision surface.

---

## 6. Screen specs

### 6.1 Screen (a) — Needs Attention · `01-needs-attention.html`

The one screen where richer item cards are permitted (Jay's exception, 2026-07-24).

**Card anatomy — fixed, identical on every row:**

```
[subject icon 32px] [ref (mono) · title · severity chip]        [time chip] [primary action | chevron]
                    [assignee-kind tag · owner · age · reasonCode]
```

The second line is **two fixed fields plus a code**, never prose. That is what keeps the row
heights uniform even with the exception granted — the exception buys *structured* extra fields,
not free text. The widget's current free-text `description` (`ItemsRequiringAttentionWidget.tsx:8, 84`)
is deleted, not carried forward.

**Layout:** page title, timing lenses, then the three ball-in-court groups in fixed order
(Needs you → Your court, needs another role → Waiting on others), then a single dashed line
recording closed volume. Group order is itself the hierarchy — demotion by **position**, never
by card size.

**Mobile (390px):** identical anatomy; the primary button becomes a full-width ≥44px target on
its own line (matching the shipped mobile touch target at `LotHeader.tsx:167`), and rows with no
button keep the chevron inline.

**Empty state:** when every group is empty, the screen renders one line — "Nothing is waiting on
you." — and nothing else. It never invents work to fill the page.

### 6.2 Screen (b) — My Work overview · `02-my-work-overview.html`

**Pure uniform anatomy, no exception applies here:** `icon + label + optional status chip +
chevron`. No subtitles, no second line, no size variation, one card height. Production classes to
reproduce: container `flex items-center gap-3 rounded-lg border bg-card p-4 transition-colors
hover:border-foreground/20 hover:bg-muted` (`DashboardQuickLinks.tsx:21`), label `text-sm
font-medium` (`:26`), chevron `h-4 w-4 flex-shrink-0 text-muted-foreground`
(`ItemsRequiringAttentionWidget.tsx:89`).

Every card is a filtered entry into screen (a). Three eyebrow-separated sections:

1. **Ball in court** — Needs you / Your court, needs another role / Waiting on others / Closed this week
2. **By timing** — Overdue / Due in 7 days
3. **By project** — one card per active project + "All projects"

The eyebrows (`text-[11px] font-semibold uppercase tracking-wide text-muted-foreground`,
`DashboardQuickLinks.tsx:52`) are section labels, not card subtitles; projects are demoted purely
by sitting lower on the page.

Chip colour: `act` (destructive tint) only on Needs you / Overdue / a project with needs-action
items; `soon` (warning tint) on Due in 7 days; neutral everywhere else; `ok` (foreground tint) on
Closed this week. Again: colour only where a human must act.

### 6.3 Screen (c) — lot header · `03-lot-header-primary-action.html`

Three frames: today's five-outline-button state, the promoted state, and the honest empty case.
See §7 for the logic.

---

## 7. Lot-header primary action logic

```
assignments = ActionAssignments where subjectType='lot' and subjectId=lotId,
              plus assignments whose subject (hold point / NCR / test) belongs to this lot
candidates  = assignments.filter(a => a.needsAction)          // §5.1 render rule
top         = candidates.sort(rankingRule §5.1)[0]            // undefined if none
```

**If `top` exists:**

1. Render one solid `Button` (`bg-primary text-primary-foreground`, `button.tsx:11`) with
   `top.primaryAction.label`, **first** in the action cluster.
2. Keep the status chip immediately after it (`LotHeader.tsx:85-89` unchanged).
3. Collapse **every** other action — Edit Lot, Override Workflow Status, Copy Link, Print, Ask
   Clancy — into a `MoreVertical` overflow. This is the shipped mobile pattern
   (`LotHeader.tsx:172-180`) applied to desktop; permission gating for each entry is unchanged
   (`canEditLot && isEditable` at `:284`, `canConformLots && lot.status !== 'claimed'` at `:296`).
4. Below the header divider, print one sentence naming the subject, plus the `reasonCode` and,
   separately, the overdue chip. The two are printed as distinct tokens — never merged into one
   phrase — so the ball-in-court truth and the timing truth stay separable.

**If `top` does not exist:** render **no** solid button. The slot falls back to the existing
outline `Edit Lot` when permitted, or nothing. The reason line states who the lot is waiting on,
if anyone. We never manufacture a primary action to fill the slot — a fabricated urgency signal
on a quality record is worse than no signal.

**Why this is safe to ship in phase 1:** it needs no new storage. `top` can be computed from the
lot's existing readiness verdict, which is already live and characterization-pinned (F0.2a, #1556).

---

## 8. Notification deep-link contract

Today: `Notification.linkUrl` (`schema.prisma:1624`) → `getSafeInternalPath`
(`NotificationsPage.tsx:45-57`) → `navigate()` (`:177-186`).

A4 adds three rules and changes no existing validation:

**R1 — one href builder.** My Work rows, dashboard-widget rows, and notification `linkUrl`s are
all produced by a single shared builder keyed on `(subjectType, subjectId, reasonCode)`. Today
the widget builds links server-side (`ItemsRequiringAttentionWidget.tsx:17`) and notifications
build them at emit time; they can drift. One builder means a notification and its My Work row
cannot point at different screens.

**R2 — link to the decision, not the register.** The target is the subject's own screen with an
optional focus hint:

```
/projects/:projectId/lots/:lotId?focus=<subjectType>:<subjectId>
```

`focus` is advisory: the target scrolls to and expands the named entity. It is a **GET-safe hint
only** — it never encodes a verb, never triggers a mutation, and an unknown or stale `focus` is
ignored silently rather than erroring.

**R3 — the safety envelope is unchanged and non-negotiable.** Every generated href stays a
same-origin absolute path so `getSafeInternalPath` accepts it: starts with a single `/`, no
`//`, no `\`, no control characters. `focus` values are `[a-z_]+:[0-9a-f-]{36}` and are validated
on read, not trusted. If a producer cannot build a safe path, it emits **no** `linkUrl` — the
notification remains readable and simply is not clickable.

**Staleness:** an assignment can be resolved between notification and click. The target must
render its normal current state; it must not show an error, and it must not re-open a completed
decision. My Work rows follow the same rule.

---

## 9. Phase 1 / phase 2 cut line

### Phase 1 — shippable alone

| # | Item | Notes |
| --- | --- | --- |
| P1.0 | Office nav groups | **Already shipped** (`navItems.ts:34`, `Sidebar.tsx:354-371`). No work. |
| P1.1 | A thin `ActionAssignment` adapter over the two signals that already exist | Overdue NCRs (`ncrOverdue`, `predicates.ts:234-241`) and stale hold points (`holdPointStagnant`, `:112-119`) — the exact data `stats.attentionItems` already carries. Output conforms to the contract and sets `needsAction` via `deriveNeedsAction`, never by hand. |
| P1.2 | The Needs-Attention destination | Screen (a), rendering only what P1.1 emits. In phase 1 that is **Needs you** and **Waiting on others**; the third group is simply empty until more codes are wired. |
| P1.3 | Dashboard widget rows adopt the richer card | Owner + age + primary action; the free-text `description` is dropped; the widget header gains "View all →" pointing at P1.2. |
| P1.4 | Lot-header primary action (§7) | Independent of P1.1–P1.3; can land first. |
| P1.5 | The one runnable check | A unit test asserting the grouping table of §4.1 — including a fixture that is `isOverdue && status==='waiting_on_others'` and asserting it lands in *Waiting on others*, not in a synthetic "Overdue" group. This is the invariant most likely to be broken by a future well-meaning refactor. |

Phase 1 deliberately does **not** render "Your court — needs another role", because with only
two reason codes there is nothing honest to put in it.

### Phase 2

| # | Item |
| --- | --- |
| P2.1 | Full `ActionAssignment` producer across every Class-A reason code, sourced from the F0.1 predicate library |
| P2.2 | Real ball-in-court: `assignee.kind` populated for all five kinds; the "needs another role" group activates |
| P2.3 | Timing lenses (`Overdue`, `Due in 7 days`, `No due date`) and per-row time chips |
| P2.4 | Screen (b), the My Work overview |
| P2.5 | Notification deep-link unification (§8 R1–R3) |
| P2.6 | Whether My Work needs its own storage — the F0 spec says "Contract only (A4 builds storage if measured necessary)" (`f0-execution-spec-2026-07-24.md:33`). **Measure first.** Default: no new table. |

---

## 10. Open decisions for Jay

### D1 — How is the Needs-Attention destination reached? *(the mandated flag)*

No new menu item may be added, and a cross-project destination cannot hang off the project nav,
which only renders inside a project (`Sidebar.tsx:345`). Options, all of which avoid a new nav item:

| | Option | Cost | Risk |
| --- | --- | --- | --- |
| **A** *(recommended)* | "View all →" in the existing dashboard attention-widget header; destination is a child route of `/dashboard` | Smallest. Zero nav change; the widget is already the thing people look at. | Discoverable only when the widget is non-empty (it returns `null` at zero — `ItemsRequiringAttentionWidget.tsx:42-44`). Acceptable: at zero there is nothing to find. |
| **B** | `/dashboard` itself becomes My Work for office roles; today's dashboard content moves below the fold | Zero nav change, maximum prominence | Changes what every office user sees on login. A real behaviour change, not a UI tweak. |
| **C** | Option A **plus** a count badge on the existing "Dashboard" nav item | Small; drawn in mockup (b) so it can be judged | Introduces the first-ever nav badge (`Sidebar.tsx` has none today) and a second red count competing with the bell (`Header.tsx:243-256`) |
| **D** | A new "My Work" sidebar item | — | **Violates the no-new-menu-items rule.** Listed only so it is visibly rejected. |

**Recommendation: A now, C later if usage says people cannot find it.** A ships with phase 1 and
costs nothing to reverse.

### D2 — Which overdue definition drives `isOverdue` for hold points?

Two definitions ship today and **disagree on all three axes** (`predicates.ts:89-91`):

| | `holdPointOverdue` (`:92-99`) | `holdPointStagnant` (`:112-119`) |
| --- | --- | --- |
| statuses | `requested`, `scheduled` | `pending`, `scheduled`, `requested` |
| date column | `scheduledDate` | `createdAt` |
| threshold | > 1 day | > 7 days |
| used by | the alert engine | the dashboards, incl. today's attention widget |

If My Work picks one and the dashboard keeps the other, the same hold point shows two different
ages on two screens — exactly the drift F0 exists to kill. This is F0 execution-spec §13 open
item 2 ("Dashboard staleness semantics: overdue vs stagnant").

**Recommendation:** `holdPointOverdue` (scheduled-date based) for `isOverdue`, because "overdue"
should mean *a date you committed to has passed*, not *this has been sitting a while* — and
surface stagnation separately as age, which the card already prints. **Jay's call**, because it
changes what the dashboard has said for months.

### D3 — Cross-project or project-scoped?

Today's widget is cross-project (each item carries `project`,
`ItemsRequiringAttentionWidget.tsx:12-16`) while the sidebar's Quality/Commercial groups are
per-project. Should Needs Attention always be company-wide, or auto-filter to the current project
when the user is inside one?

**Recommendation:** always company-wide, with a project filter (drawn as the "All projects" lens
in mockup (a) and the by-project cards in mockup (b)). A QM covering three jobs wants one list.
**Jay's call** because it depends on how his pilot customers actually staff projects.

### D4 — Does "Closed this week" belong on the overview?

`status: 'done'` items are excluded from every list. The overview still shows a "Closed this week:
31" card. It is the only motivational element in the design and the only card that shows work
*not* needing attention.

**Recommendation:** keep it — it is one uniform card and it makes an empty Needs-you list feel
earned rather than broken. Cheap to delete if it reads as fluff.

### Decided here (reversible; flag if wrong)

- **`severity: 'support'` items may appear in *Waiting on others* but never in *Needs you*.** A
  support item is informational by construction and can never be a blocker for the viewer.
- **Class-C aggregate codes render no rows at all** (§5.2), including `approved_dockets` and
  `diary_entries`, which the engine hardcodes to 0 (`reasonCodes.ts:143-150`) pending F0 §13.4.
- **Due-soon horizon is 7 days.** Arbitrary but conventional for AU civil lookahead; make it a
  constant, not a scattered literal.
- **No bulk actions in A4** (§5.3). Batch release belongs to the hold-point package consumer.

---

## 11. Design-rule compliance

| Rule | How this design complies |
| --- | --- |
| One uniform card style per screen; icon + label + optional chip + chevron; no subtitles | Screen (b) is strictly uniform — one card, one height, no second line anywhere. Screen (c) uses the existing lot-summary card unchanged (`LotSummaryCards.tsx:10-30`). |
| Richer cards **only** inside the Needs-Attention list | Only screen (a). Its second line is two structured fields plus a code — never prose — so heights stay uniform. Today's free-text `description` is deleted. |
| Demote by position or by folding behind a hub, never by size | Group order on (a); eyebrow sections on (b) with identical cards throughout; the lot header folds four actions behind one overflow. No element is shrunk to demote it. |
| No new menu items | None added. D1 lists reach-options and flags the choice; option D is named only to be rejected. |
| Office roles only | Viewer is `quality_manager` throughout. `frontend/src/shell/**` is untouched and unreferenced. |
| Quiet Authority visual language | Tokens copied verbatim from `index.css:8-104`. Near-black primary, warm zinc neutrals, amber used only where the app already uses it. No violet, no gradients, no AI-slop chrome. Colour appears only where a human must act — the rule already written at `lotStatusOverview.ts:63`. |

---

## 12. Verification performed on this PR

- All three mockups served over `http://127.0.0.1` and loaded in Chromium; full-page screenshots
  reviewed at 1200px and at the 390px mobile frame. **0 console errors, 0 warnings.**
- Two layout defects found and fixed during review: the mobile grid dropped chevron-only rows to
  their own line (screen a), and the overflow popover displaced page content instead of overlaying
  it (screen c). Both re-verified after the fix.
- Every claim in §2 carries a `file:line` citation against `668a9592`.
