# UI benchmark — CivilPro platform surfaces vs SiteProof/CIVOS

Scope: register/grid ergonomics, saved views, navigation, dashboard, notifications.
Sibling docs cover lots, ITP, NCR, tests, claims, spatial.

**Evidence roots** (all paths absolute):
- CivilPro shots: `C:\Users\jayso\AppData\Local\Temp\claude\C--Users-jayso-site-proofv3\1f629074-8d2a-4548-84d3-660e9613b45f\scratchpad\civilpro-kb\shots\<articleId>\NN.png` — abbreviated below as `CP:<articleId>/NN.png`
- Ours: `C:\Users\jayso\site-proofv3\.gstack\dev-browser\ui-sweep2-2026-08\<file>.png` — abbreviated `SP:<file>.png`
- Mechanics source: `...\civilpro-kb\findings\platform-ux-admin.md` §§1.4–1.6, 2.2–2.3, §4

Every claim about our side below was checked against the working tree, not
inferred from screenshots. Code citations are absolute paths under
`C:\Users\jayso\site-proofv3\`.

---

## 1. Their platform UI, screen by screen

### 1.1 Register anatomy — five zones

`CP:360044869933/01.png` is the annotated canonical shot; `CP:360044683614/01.png`
colour-blocks the same five zones.

| Zone | Contents |
|---|---|
| **Main menu** (top-left hamburger) | Full-height dark drawer, search box at the top, 12 top-level headings, flyout submenus (`CP:360044683614/03.png`, `CP:4413710493071/01.png`) |
| **Project & account menu** (top-right) | Bell + a second starred-count icon, `?` help, the **project name as the switcher**, avatar → Change Project / My account / Logout (`CP:360044683614/06.png`) |
| **Grid menu** (strip above the grid) | Primary create button on the left (`+ NEW LOT`), the **group-by drop bar** in the middle, column-chooser and filter icons on the right |
| **Register view** | The grid itself: identifier column renders as a blue underlined deep link, status as a coloured square + word, `Count: n` in the footer |
| **Action menu** (right icon rail) | Kebab, Search, **Action on Selection**, Print/Reports, **Related Items**, **Views** — six persistent icons, each opening a right-hand drawer over the grid |

The right icon rail is the structural idea. Every heavy interaction (search,
bulk actions, reports, linked records, views) is a drawer off one rail rather
than a toolbar button, so the grid keeps full width and the rail is identical
on every register in the product.

Two columns are worth naming because they change how the register reads:
**Days Open** on lots (`CP:9087429113103/06.png`, values 499–1227 in
`CP:4406737424527/01.png`) and **Due Days** on approvals, which goes negative
when overdue (`CP:6898902262927/14.png`, showing `-196` and `-1`). Ageing is
register data, not a dashboard widget.

Deliberate constraint from the docs: the web grid is **not** inline-editable —
"information cannot be edited in the grid to prevent accidental editing". All
editing happens in the detail view. Desktop is the opposite (Ctrl+E toggle,
Fill Up/Fill Down).

### 1.2 Group-by bar

The grid menu carries a permanent hint strip: *"Drag a column header here to
group by that column"* (`CP:9087429113103/08.png`). Drop a header on it and the
grid becomes collapsible groups with the group value in the band header
(`CP:9087429113103/09.png` — `Lot Status: conformed` / `pre-open` / `Removed`,
each expandable, `Count: 6` still in the footer). Multi-level grouping is
supported by dropping a second header. The grouped column disappears from the
row body, so grouping also buys back horizontal space.

The webinar's two worked examples are the real use cases: an end-of-month
meeting view grouped by engineer, and an open-approvals view filtered
`Completed = false` and grouped by type then requestor.

### 1.3 Filter row and filter stack

Four independent filtering mechanisms, all on the same grid:

1. **Filter row** — a per-column input strip under the header
   (`CP:9087429113103/06.png`); typing `LIGHT` under Description narrows to one
   row and writes `[Description] Contains 'LIGHT'` into a **filter summary bar
   pinned at the bottom** with a `Clear` link.
2. **Header filter dropdown** — a checkbox list of the distinct values in that
   column with Select All (`CP:9087429113103/03.png`).
3. **Filter Builder** — a visual multi-condition builder with And/Or grouping,
   field/operator/value chips, per-condition delete (`CP:9087429113103/02.png`).
4. **Search drawer** — free-text plus a Tag select plus an Advanced Search
   button, with a **Recent Search** list (`CP:9087429113103/01.png`,
   `CP:4406737424527/01.png` — matches are highlighted in the grid cells).

The header context menu unifies the lot: Sort Asc/Desc, Clear Sorting, Fix
(freeze) / Unfix, Column Chooser, Filter Editor, Disable Column Auto Width,
Show Filter Row, Show Filter Panel, **Print Grid**
(`CP:9087429113103/04.png`, `/11.png`). Column Chooser is a searchable drawer
of removed fields that you drag into the header (`CP:9087429113103/05.png`).

`Print Grid` is their entire "export to Excel" story on web — what you see is
what you get, which is only defensible *because* views persist the "what you
see" part.

### 1.4 Views panel — three tiers plus shipped presets

`CP:4406737424527/02.png` is the important shot. The Views drawer has three
sections:

- **Built-in presets, unlabelled and always present**: Standard, Dates, Values,
  Open Lots, Pre opened Lots, Related Items Summary, Guaranteed Lots,
  Conformed Lots, **My Lots**. Nine curated views shipped with the product, no
  configuration required, a tick marking the active one.
- **User Custom Views** — per-user, with a `SAVE VIEW` button under the list.
- **Project Custom Views** — visible to everyone on the project, own
  `SAVE VIEW` button, gated on `Add` for Project Administration.

Saving is one dialog: a name field and a single checkbox, **"Save to this
Project Only"** (`CP:4406737424527/03.png`). Unchecked, the view replicates to
every project the user can access — that default is the right one for a person
who works across five jobs.

Each custom view has a kebab: **Update / Copy / Rename / Share / Delete**
(`CP:4406737424527/06.png`). Share opens a full-screen picker with a project
dropdown at the top and a checkbox list of users with their **company** shown
(`CP:4406737424527/07.png`) — so an admin can push a view into a named client
rep's account and phone them to say "click this one thing".

On top of this sits the magic-name convention (from the docs, not visible in a
shot): a view named `Default` becomes the register's landing view, a view named
`Mobile` is auto-loaded on phones, fallback chain Mobile → Default → Standard.

Saved views capture columns, column order, sort, grouping and filters as one
object, and the registers supporting them on web are Project, Lot, Test
Requests, NCR, Approvals, Quantity, Progress Claims, Schedule Items.

### 1.5 Dashboard

Web dashboard: card-per-chart grid, each card with its own kebab, and a single
global **"Show data for: 08 Apr 25 – 07 Jul 25"** date-range control in the
top-right (`CP:13178757192463/01.png`). Charts are named in caps
(`LOT STATUS - ACTIVITY`) with the legend under the plot.

The desktop client shows the full set (`CP:7599695892623/01.png`): six charts
across four bottom tabs — **Lot Stats / NCR Stats / Test Stats / Approval
Stats**. Within Lot Stats: Lot Status pie, Lots by user pie, Lot Activity
stacked bar month-by-month, **Lot Status at EOM** (stacked bar + two trendlines
on a secondary % axis: "Open Lot %" and "Open >60 days %"), Lot Status by User,
and a Raised By / Lot Count table.

The filter panel (`CP:7599695892623/02.png`) is a compact 9-field form: Cutoff
date, User, Lot Status, NCR Status, Test Status, Appr. Status, Appr. Types,
**Days open for trendline** (default 60), **Show (n) recent months** (default
12), and a "Separate pre-opened lots" checkbox, with an explicit `Update charts`
button rather than live refetch.

The documented gotcha: cutoff date **defaults to end of last month** because
the dashboard is built for EOM reporting, which surprises people looking for
today's number.

### 1.6 Notification register with close-out

Notifications are a register, not a feed (`CP:6898902262927/08.png`). Columns:
Notification Number, Date, Subject, Author, Date Required, **Status**,
Published. The same group-by bar and filter icon sit above it. Status is a
three-value triage enum rendered as a coloured square: **Not Actioned /
Action Required / Information**. Published renders as an envelope glyph.

Creation is a three-step wizard launched from any register's **Action on
Selection** drawer (`CP:6898902262927/03.png` — that drawer also carries bulk
Duplicate/Activate/Guarantee/Conform/Reject/Close, the Undo variants greyed
when inapplicable, New Test Request, New NCR, Lot Summary, Build Conformance
Folio, Notify Selection, Delete):

1. **Notification Definition** — Notification No, Publish Date, Notice Date,
   Notice From, **Notice To** and **Notice CC** as chip fields, Date Required,
   and a read-only **Progress** field showing `Not Actioned`
   (`CP:6898902262927/04.png`).
2. **Message** — template select ("Lot Conformance Query" or "No Template"),
   Subject, and a rich-text body **with the selected records already rendered
   as a table** (Lot No / Description / Date Open / Status / Days Open), each
   lot number a live deep link (`CP:6898902262927/05.png`).
3. **Publishing Options** — three radios: Publish sending notification &
   emails / Publish previewing notification & emails / **Save, Unpublished**,
   with a count of recipients (`CP:6898902262927/06.png`).

The saved notification has four tabs: **DEFINITION / MESSAGE / ITEMS / CLOSE
OUT** (`CP:6898902262927/13.png`). The ITEMS tab is a per-record grid with
**Action Date, Request Comment, Note** columns and a pencil to edit each row —
so one notification covering six lots tracks six independent responses. The
register supports bulk **Action Selected / Unaction Selected / Archive /
Unarchive / Mark Selected Unread / Reset In-App Notification**
(`CP:6898902262927/11.png`).

The same close-out pattern repeats on Contract Notices, whose detail view is
**DETAILS / TEMPLATE / RESPONSES / CLOSE OUT** with an `Enter Closeout` action
(`CP:4413710493071/15.png`), and the register shows an outstanding-response
counter ("0 of 1 responses").

Separately, **Document Management → E-mail Log** is a first-class register
(`CP:4413710493071/01.png`) recording every approval / test request / survey
email sent, with related-item links and the approver's visible response.

### 1.7 Related Items drawer

`CP:360044869933/03.png`: select a row in any register, open the Related Items
rail icon, and a drawer lists every linked record grouped by type — Quantities,
Checklists, Approvals, Non Conformances (NCRs), Test Requests, Variations —
each group collapsible, each with a `+` to link a new record and each row with
an unlink button. Bidirectional and universal: the same drawer, same grouping,
on every register.

---

## 2. Interaction-model comparison

### 2.1 "What is waiting on me?" — a QA manager

**CivilPro.** Avatar → My Account → Settings → **Start Register = Approvals**.
Now every login lands on the Approvals register. Filter it to their own
role/name plus `Completed = false`, save that as a view named `Default`. From
then on: log in, land on a list of exactly the items owed by them, sorted by
**Due Days** with the overdue ones negative. Multi-select several items after a
site visit and apply one workflow response to all of them.

Roughly ten minutes of setup, done once, and the payoff is a self-maintaining
action inbox with no inbox feature in the product. The cost is that it *is*
setup: it does not exist until someone performs the ritual, and the persona
doc that teaches it is a PDF the contractor forwards to their client.

**Ours.** Login always resolves through
`frontend\src\pages\auth\postLoginRedirect.ts:79` → the mobile shell path if
one applies, else `/dashboard`. Mobile foreman gets `/m`, mobile subbie gets
`/p` (`frontend\src\shell\shellFlag.ts`); every other role, and every desktop
session, gets the same `/dashboard`. A QA manager on a laptop lands on the
company dashboard (`SP:001-dashboard-desktop.png`) — welcome line, date-range
picker, an **Items Requiring Attention** card, four stat tiles, Recent
Activity, Lot Status Overview — and has to click "View all" to reach
`SP:003-needs-attention-desktop.png`, which on this data set is a single card
reading "Waiting on others (1)".

So we win on cold start (their action list needs configuring; ours is there on
first login, correctly grouped, with a plain-English "51 days overdue" chip)
and lose on durability. Our Needs Attention page is a fixed, non-navigable
summary: no columns to sort by age, no way to say "only NCRs", no way to make
it the landing page, and nothing that survives as a working surface once the
count goes from 1 to 40. Theirs is a register, so it scales.

The second gap is ageing. `Days Open` and `Due Days` are sortable columns on
their registers; we compute overdue days only inside dashboard widgets
(`frontend\src\components\dashboard\ItemsRequiringAttentionWidget.tsx`,
`QualityManagerDashboard.tsx`). Our Lot Register
(`SP:133-lots-list-desktop.png`) has Lot Number, Description, Chainage,
Activity Type, Status, Subcontractor, Budget, Actions — nothing time-based at
all, so "what has been sitting the longest" is unanswerable from the list.

### 2.2 Building a meeting view

**CivilPro.** Column Chooser → drag in the fields you want → drag a header onto
the group bar → filter row for the narrowing → Views drawer → SAVE VIEW under
either User or Project Custom Views → right-click → Print Grid for the paper
copy. Four mechanisms, one persisted object, and the Project tier means the
whole site team opens the same view on Monday.

**Ours.** The Lot Register has a filter bar (search, status, activity,
chainage min/max, subcontractor), a column settings menu
(`frontend\src\pages\lots\components\LotColumnSettingsMenu.tsx`, controlling
`visibleColumns` and `columnOrder`), three view modes (list / card / linear
map), and a bookmark control for saved filters
(`frontend\src\pages\lots\components\LotSavedFiltersMenu.tsx`, visible at the
right of the filter bar in `SP:133-lots-list-desktop.png`).

Three hard limits, all verified in code:

1. **There is no group-by anywhere.** `grep -rn "groupBy" frontend/src` returns
   nothing. A 109-lot register is a flat 109-row scroll.
2. **Saved filters are localStorage-only and Lot-Register-only.**
   `lotFilterConfig.ts:27` — `SAVED_FILTERS_STORAGE_KEY =
   'siteproof_lot_saved_filters'`; save/load/delete all go through
   `writeLocalStorageItem` in `LotFiltersBar.tsx:167–203`. They do not follow
   the user to another device, cannot be shared, and there is no notion of a
   default. The NCR, ITP, Test Results, Hold Points, Documents and Claims lists
   have no saved-filter control at all.
3. **Saved filters save filters, not views.** The snapshot is
   status/activity/search/subcontractor/areaZone — column choice and order are
   held in separate state and are not part of the saved object.

Bulk actions we do have, on the Lot Register only: status update, assign
subcontractor, delete
(`frontend\src\pages\lots\components\BulkActionModals.tsx`). There is no
"notify selection" equivalent on any register.

### 2.3 Personalising a client rep's experience

**Theirs is a push model.** The admin builds the view, opens the kebab →
Share, picks the project and ticks the users (`CP:4406737424527/07.png`), and
it appears in that person's own Views list. Combined with Start Register and
the `Default` magic name, an admin can hand a reluctant client rep a
one-click, correct, permanently-installed working surface. It is genuinely the
best idea in their corpus — and it is also pure configuration work that
somebody has to do, per person, per project.

**Ours is a pull model with role defaults.** We ship distinct dashboards
per role (`ProjectDashboard`, `ProjectManagerDashboard`,
`QualityManagerDashboard`, `ForemanDashboard` under
`frontend\src\components\dashboard\`), plus two whole role-specific mobile
shells (`SP:027-m-home-phone.png` — foreman home is three uniform cards and one
black "Start today's diary" hero; `SP:039-p-work-phone.png` — subbie My Work
grouped by state). Nobody configures anything; the right surface is chosen by
role and viewport. `DashboardWidgetCustomizer.tsx` backs the "Customize" button
on `SP:001-dashboard-desktop.png` for per-user tweaks on top.

That is the better philosophy and we should not trade it away. The gap is not
that we lack a share-a-view feature; it is that our role defaults stop at the
dashboard and never reach the registers. A QM's Lot Register looks identical
to an owner's.

---

## 3. Patterns worth adopting — ranked

### P1 — Group-by on register list pages (config-free version)
**Build:** a `Group by` select in the existing filter bar with 3–5 curated
fields per register (Lots: Status, Activity Type, Subcontractor, Area/Zone;
NCRs: Status, Severity, Subcontractor; Hold Points: Status, Lot). Rows render
under collapsible bands showing the group value and a count. Not a
drag-to-group bar, not arbitrary fields, not multi-level.
**Where:** `frontend\src\pages\lots\` first (`LotFiltersBar.tsx` +
`LotTable.tsx`), then NCRs and Hold Points.
**Evidence:** `CP:9087429113103/09.png` (grouped), `CP:9087429113103/08.png`
(the drop bar), vs `SP:133-lots-list-desktop.png` (109 flat rows).
**Fit:** strong. Zero persisted config, no admin involvement, and it is the
single largest ergonomic gap between the two products. Curating the field list
per register *is* the role-tailored move — it removes the column-chooser
dependence that makes their version work.

### P2 — Ageing as a register column
**Build:** a computed, sortable `Age` / `Days Open` column on registers whose
records have a lifecycle, and a signed `Due` column where a due date exists
(negative = overdue, matching their Approvals register). Default the register
sort to age descending where that is the useful order.
**Where:** Lot Register, NCRs, Hold Points, Test Results, Docket Approvals.
**Evidence:** `CP:9087429113103/06.png` (Days Open), `CP:6898902262927/14.png`
(Due Days at `-196`), vs `SP:133-lots-list-desktop.png` (no time column).
**Fit:** strong, and cheap — we already compute overdue days for the dashboard
widgets, so this is surfacing an existing calculation in a second place. Do
this with P1: "group by status, sort by age" is the whole meeting view.

### P3 — Ship named view presets per register, per role
**Build:** a small `Views` dropdown next to the filter bar listing hand-written
presets (Lots: All, Open, Awaiting test, On hold, Conformed, **My lots**;
NCRs: Open, Overdue, Mine, Closed this month). Each preset is a code-defined
bundle of filter + sort + group + visible columns. The default preset is
chosen by role: a QM opens on "Awaiting verification", a PM on "Blocked".
**Where:** shared component consumed by the Lots/NCRs/Hold Points/Tests lists.
**Evidence:** `CP:4406737424527/02.png` — nine built-in views above the custom
sections; note `My Lots` and `Open Lots` are shipped, not authored.
**Fit:** strongest philosophical match in this document. It gives us the
outcome of their Start-Register + `Default`-view ritual with no ritual, no
admin, and no per-user state. It also makes P1 and P2 discoverable — most users
will never build a view but will happily click one.

### P4 — Promote saved filters to per-user server state, and widen them to a saved *view*
**Build:** move the localStorage blob to a `SavedView` row keyed on
(user, register), extend the snapshot to include visible columns, column order,
sort and group-by, and expose the same control on every register that gets P1.
Add a project-level tier that any PM/admin can save so a whole site team shares
one view.
**Where:** `LotSavedFiltersMenu.tsx` + `lotFilterConfig.ts` generalised out of
`pages/lots/`; new backend route + Prisma model.
**Evidence:** `CP:4406737424527/03.png` (name + one checkbox), `/06.png`
(Update/Copy/Rename/Delete).
**Fit:** good, with one deliberate subtraction — **skip per-user Share**
(`CP:4406737424527/07.png`). Pushing a view into a named person's account is
the config-burden version of P3, and P3 already covers the client-rep case
without anyone doing setup. Two tiers (mine, project) instead of three.

### P5 — Notifications as a triageable register with close-out
**Build:** give notifications a triage state (`Needs action` / `FYI` /
`Actioned`) instead of only read/unread, group repeats of the same alert into
one row with a count, and add a lightweight close-out (who actioned it, when,
one-line note) on notifications that represent an obligation.
**Where:** `frontend\src\pages\NotificationsPage.tsx` and its backend routes.
**Evidence:** `CP:6898902262927/08.png` (Status column: Not Actioned / Action
Required / Information), `CP:6898902262927/13.png` (ITEMS + CLOSE OUT tabs),
`CP:6898902262927/11.png` (bulk Action Selected). Our failure case is visible
in `SP:009-notifications-desktop.png`: five near-identical
`ESCALATED: Missing Daily Diary` rows, all 12d ago, differing only by date,
with no state between "unread" and "deleted".
**Fit:** partial. Adopt the triage state and repeat-collapsing; both are cheap
and fix a real defect on screen today. Their full "notify a selection of lots
and track per-item responses" flow is a correspondence feature, not a
notification feature — if we want it, it belongs next to NCRs/hold points, not
in the bell.

### P6 — Email log
**Build:** persist every outbound email (recipient, subject, template, sent-at,
provider message id, delivery status from the Resend webhook) and surface it as
a read-only register under project Records, with a link back to the source
record.
**Where:** new Prisma model + a page beside Documents; today the schema has
only `EmailVerificationToken` (`backend\prisma\schema.prisma:1602`) and no
send log at all.
**Evidence:** `CP:4413710493071/01.png` — `Document Management → E-mail Log`
sitting alongside Filestore.
**Fit:** good, and it is a trust feature rather than a UI feature. For a QA
product, "the client says they never got the hold-point request" needs an
answer. Rank it below P1–P3 because it changes no daily ergonomics, but it is
the item most likely to matter in a dispute.

### P7 — Related Items drawer from the register row
**Build:** select a row, open a right drawer showing linked records grouped by
type (ITPs, tests, NCRs, hold points, photos, documents) with counts, each row
a deep link.
**Where:** Lot Register first.
**Evidence:** `CP:360044869933/03.png`.
**Fit:** moderate. We reach the same information through the lot detail page,
so this saves a round-trip rather than enabling something new. Worth doing only
once P1–P3 have landed, and worth reconsidering entirely if our lot detail page
is already fast enough that the drawer is redundant.

### P8 — Extend bulk actions beyond the Lot Register
**Build:** the selection + bulk-action pattern we already have on lots, applied
to NCRs and Hold Points (bulk assign, bulk status, bulk notify).
**Where:** generalise `BulkActionModals.tsx` out of `pages/lots/`.
**Evidence:** `CP:6898902262927/03.png` — one Action-on-Selection drawer with
the same shape on every register, invalid actions greyed rather than hidden.
**Fit:** moderate; mostly a consistency win. Their "greyed, not hidden" choice
for inapplicable actions is worth copying — it teaches the state machine.

### Deliberately not adopting
- **Per-user view sharing** (`CP:4406737424527/07.png`) — superseded by P3.
- **Drag-to-group bar and drag-in column chooser** — the free-form versions of
  P1/P3; they require the user to know the schema.
- **Magic view names `Default` / `Mobile`** — clever, but it is a naming
  convention masquerading as a setting, undiscoverable and unvalidated. Our
  role + viewport routing already picks the surface.
- **A per-user "Start Register" setting** — P3's role defaults deliver the
  same landing behaviour without a settings page.
- **Print Grid as the export story** — we already have Export CSV and Print
  Register on the Lot Register (`SP:133-lots-list-desktop.png`), which is
  strictly better than WYSIWYG-only.

---

## 4. Anti-patterns to avoid

**Column-chooser dependence.** Their register is only good after you have
dragged the right fields in. `Days Guaranteed`, `Conformed`, `Closed`,
`Work St.`, `Work End`, `Rejected`, `Raised By`, `Area Code` all sit hidden in
the chooser (`CP:9087429113103/05.png`). A user who does not know the field
names never finds them, and a field greys out once used, so the chooser doubles
as the only inventory of what the record even holds. Curated presets (P3) must
be the primary path; any column chooser we add is a power-user escape hatch,
not the way the feature is meant to be used.

**Critical fields hidden by default.** `Has Docs?` — whether a lot has evidence
attached — renders as an unlabelled checkbox column that has to be scrolled to
(`CP:360044869933/01.png`). Evidence-completeness is the whole product; it
should never be a column you opt into. Our Quality Closeout Readiness block
(`SP:101-project-overview-desktop.png`, "108 blocked of 109 lots" broken down
by reason) is the better treatment and should stay prominent.

**Temporary view state.** Filter-row state persists across registers for the
session but not beyond it, so a user who spent five minutes narrowing a grid
and did not think to save a view loses it. If we ship P1/P2 without P3/P4,
we ship exactly this bug. Either persist the working state or make presets so
good that nobody hand-builds one.

**Colour-only encoding.** Lot status is a small coloured square plus a word,
which is fine; but the workflow layer underneath is entirely colour-coded —
blue First Step, green Complete, white Approved-to-Proceed, and an **Alert Step
that turns the whole register row red** with no other marker. Our
`SP:039-p-work-phone.png` "NCR RAISED" pill and `SP:003-needs-attention-desktop.png`
"51 days overdue" chip carry the meaning in words; keep it that way, and if we
add row-level emphasis, pair it with a text label.

**Wizard-shaped creation for a two-field task.** Their notification is three
steps and a stepper (`CP:6898902262927/04.png` → `/05.png` → `/06.png`) to send
a message about some lots. If we build anything from P5, it is one screen.

**Two clients, one truth.** Their Desktop and Web registers behave oppositely
(inline-editable vs not; Export to Excel vs Print Grid only), which is why half
their help centre is doubled. Our `/m` and `/p` shells are role-scoped subsets
of one app, not a second implementation — a distinction worth defending
whenever someone proposes a desktop-only or mobile-only register behaviour.

---

## 5. Verdict

Their register is a genuine power tool — group-by, four filter mechanisms, a
persisted three-tier view system with nine shipped presets, ageing columns, and
a uniform bulk-action rail — and every one of those is missing or
Lot-Register-only on our side; our saved filters are localStorage, our lists
have no grouping and no time column, and a QA manager's register looks the same
as an owner's.

We are ahead on cold start and on plain language: role-tailored dashboards and
two role shells mean the right surface appears with no setup, where CivilPro
needs a ten-minute ritual and a PDF checklist to get a client rep to a useful
screen — but our advantage stops at the dashboard and never reaches the
registers.

Ship P1 (curated group-by), P2 (ageing column) and P3 (shipped view presets
with role defaults) together as one workstream on the Lot Register, then repeat
on NCRs; that closes the ergonomic gap while keeping the config-free philosophy
intact, and leaves P4/P6 as the follow-ups worth doing.
