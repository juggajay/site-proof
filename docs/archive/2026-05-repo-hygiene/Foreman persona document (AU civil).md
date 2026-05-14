1) Foreman persona document (AU civil)
Persona: “On-site Foreman (Civil Works)”

Role reality

Runs day-to-day execution: directs crews/plant, coordinates subcontractors, resolves blockers, and keeps the job moving.

Accountable for evidence: what was done, where, by whom, and whether it meets spec—without becoming a clerk.

Demographics & environment

Typically 30–55; mix of trade background and supervisory experience.

Works across roads/bridges/earthworks with state authority specs (TfNSW/TMR/VicRoads).

High interruption rate; frequent sun glare, dust, wet hands, gloves; mixed connectivity.

Tech comfort

Comfortable with photos, messaging, and simple forms.

Low tolerance for “software ceremony” (logins, deep menus, multi-page forms).

Learns tools that mirror field workflows (lists, checklists, photo-first capture, offline-first).

Devices (what gets used where)

Phone (primary): capture/approve/verify while walking (one-handed, short bursts).

Tablet (secondary): drawings/markups and longer inspections when stationary (crib room / ute / site office).

Desktop (rare for foreman): end-of-week admin, exports, deeper review—often done by PM/engineer instead.

Daily schedule (typical pattern)

Prestart: confirm program, crew, plant, permits, hazards, hold points due.

Morning production: coordinate, inspect first runs, handle issues/variations.

Midday: vendor/subbie coordination, deliveries/dockets, quick progress capture.

Afternoon: close out inspections/hold points, defects/NCRs, end-of-day diary summary.

Top pain points

Too many screens/fields; duplicated entry across diary/ITPs/photos/NCRs.

Hard to find “what needs attention now.”

Offline/sync anxiety (did it upload? did approvals stick?).

Photo admin overhead (categorise/tagging) while trying to supervise work.

Goals

Keep crews productive.

Prove compliance with minimal effort.

Avoid rework by catching defects early.

Approve what must be approved today (time/dockets/hold points) fast and safely.

2) Task priority matrix (frequency × urgency × mobile necessity)

Legend

Frequency: Daily / Weekly / Occasional

Urgency: Immediate (blocks work) / Same-day / Can wait

Mobile necessity: Must be mobile / Better on tablet / Can be desktop

Task	Frequency	Urgency	Mobile necessity	Why it matters to foreman UX
Capture photos (progress, evidence, defects)	Daily	Immediate / Same-day	Must be mobile	Fastest proof; reduces disputes and rework
Complete/acknowledge ITP checklist items due today	Daily (triggered)	Immediate	Must be mobile	Hold points/quality gates can stop work
Hold point sign-off (or request)	Occasional (stage-based)	Immediate	Must be mobile	Work cannot proceed without sign-off
Raise defect / NCR / observation	Weekly (varies)	Same-day (sometimes immediate)	Must be mobile	Needs capture at point-of-discovery
Approve/review timesheets/dockets	Daily	Same-day	Must be mobile	Payroll + subbie friction; first-tier approval often foreman-led
Lot/area progress update (“what’s done where”)	Daily	Same-day	Must be mobile	Enables handover and visibility
Daily diary summary (weather, manpower, plant, activities, delays)	Daily	Same-day / EOD	Must be mobile (capture), desktop optional (review)	Site diary is a core project record
Attach test results (compaction/concrete)	Occasional	Can wait (unless gating)	Tablet/desktop	Often entered by QA/engineer unless foreman-run
Export reports / PDF packs	Weekly	Can wait	Desktop	Not a field task
Configure templates, spec libraries, admin	Occasional	Can wait	Desktop	Remove from foreman mobile view
Deep analytics / dashboards	Weekly	Can wait	Desktop	Not “in the dirt” work
3) Recommended primary actions (max 5) — one tap from home

Use a bottom navigation with 3–5 destinations per established mobile guidance and push everything else into “More”.

The 5 primary actions

Capture (Photo / Issue / NCR)

Today (My Required Items: ITPs, Hold Points, Inspections, Tasks)

Approvals (Dockets + Timesheets needing review/approval)

Diary (Quick add + End-of-day “Finish Diary”)

Lots / Progress (Update area status, attach evidence)

Design intent: the foreman should live in these five. Anything outside them is a candidate for hiding or removal.

4) Recommended hidden / secondary actions (“More” menu or desktop)
Put in “More” (mobile, but secondary)

Search (global) across photos/issues/lots (only if fast and offline-tolerant)

Reports view-only (no heavy exporting)

Templates view-only (no editing)

Contacts / directory

Settings, notifications, profile, help

Desktop/tablet-only

Template builders (ITP/NCR forms), custom fields, workflow config

Bulk edits, batch re-tagging, document control

Exports (PDF packs, compliance registers)

Cross-project analytics

5) Recommended removals from foreman mobile view (ruthless cut list)

These may still exist for other roles (QA/engineer/PM) but remove from foreman mobile unless your interviews prove otherwise:

Complex module switching (10+ icons/pages). Replace with Today + Capture + Approvals.

Full test-result management (unless foreman is the test owner). Keep as “view required result” only.

Deep filtering/report builders on phone.

Spec library browsing (TfNSW/TMR clauses). Instead: link the one relevant excerpt from the current checklist item.

Multi-step NCR wizard. Replace with “capture now, enrich later.”

6) User journey maps (written) for top workflows
A) Capture → Photo evidence (fastest path)

Goal: take photo, optionally link to Lot/ITP/NCR, done in <10 seconds.

Tap Capture

Camera opens immediately (no category required)

Take photo(s)

Post-capture sheet: Suggested links (Lot, ITP item, Issue/NCR) + Save

App auto-tags: time, user, project, and (optionally) GPS (if enabled)

Key rule: categorisation is optional at capture; allow later triage.

B) Today → ITP checklist / hold point flow (work-gating)

Tap Today

See “Must do now” stack (Hold points due, ITP items due)

Tap item → checklist opens

One-thumb completion: Pass/Fail/NA + photo (optional, but prompted on fail)

If Hold Point: Request sign-off / Sign-off (role-based)

Offline-safe save; sync later (show status banner)

Offline-first is non-negotiable for field tools; competitors explicitly support offline workflows (e.g., Fieldwire offline editing & sync ; Procore offline mobile use ; HammerTech offline inspections ).

C) Approvals → dockets/timesheets (same-day hygiene)

Tap Approvals

List shows “Needs review today” with 3–5 key fields visible

Tap a line → detail

Approve / Query / Reject

Auto-next to next item

Procore describes foreman/superintendent as the typical first-tier reviewer, changing status (Reviewed/Approved) .

Pattern recommendation: avoid pure “swipe-to-approve” as the primary mechanism; use it only as a shortcut with:

an always-visible Undo

and a “Press-and-hold to Approve” option for safety (fat-finger/gloves).

D) Diary (capture throughout; finish EOD in 60 seconds)

Tap Diary

Default view: Today with “Quick add” chips:

Activity

Delay

Delivery

Plant

Crew change

End-of-day: Tap Finish Diary

Review auto-filled sections → submit

Site diaries are a core project record (weather, activities, events) .

E) NCR (capture now; enrich later)

Tap Capture → select NCR/Defect

Required minimum: Location (Lot), brief description, photo

Optional: responsible trade, severity, due date

Save (offline-safe)

Later (tablet/desktop): add spec references, full workflow, attachments

7) Competitor analysis summary (what works / what fails)
What construction field apps consistently get right

Offline-first + sync transparency

Fieldwire supports working offline and syncing changes when reconnected

Procore supports offline mobile usage and later sync

HammerTech explicitly designs mobile inspections for offline work and seamless sync

PlanGrid supports offline viewing/markups that sync later

Autodesk Build supports syncing/downloading projects for offline/limited connectivity use

List-first UX

Tasks/issues presented as a simple list with quick filters, then detail screens.

Fast capture, then enrichment.

Photo as the primitive

Photo-first capture with attachments to issues/checklists.

Common failures (opportunities for SiteProof)

Feature sprawl: too many modules exposed to field roles.

Too many taps per outcome (capture → classify → fill → assign → attach → submit).

Poor interruption recovery (lose form state; unclear sync queue).

Over-reliance on connectivity despite field realities.

AU-relevant operational apps (dockets/time) patterns

Assignar mobile is designed around field submission of timesheets, forms, dockets, and progress

Docketbook emphasizes offline capture + signatures for dockets

These tools reinforce that foremen want: quick capture, proof, and approvals—not deep project admin.

UX patterns for physical constraints (gloves, glare, one-handed, interruptions)
Interaction & layout

Touch targets: aim for at least 48×48dp (~9mm) and spacing to reduce mis-taps

3–5 primary destinations in persistent bottom nav; everything else behind More

Put primary actions in the thumb zone (bottom half), enable left/right-handed comfort.

Interruption-proofing

Auto-save drafts aggressively; resume exactly where left off.

Clear offline banner + sync state (HammerTech explicitly signals offline and auto-sync)

Connectivity strategy

Offline-first by default; cache “Today” worklist and relevant lots/checklists on project open.

Explicitly document what works offline (Fieldwire and Procore do this in support content)

Specific module answers (your questions)
Daily Diary

Throughout day vs batch at EOD

In practice, foremen often capture key events during the day (delays, deliveries, incidents) but finalise diary at end-of-day. This aligns with the need for a daily project record and with competitors making daily logs easy to complete daily (calendar views, configurable fields) .

Minimum viable diary entry (foreman)

Weather (auto)

Crew count (auto-suggest, editable)

Plant used (suggest last-used)

Top activities (3 bullets)

Delays/issues (if any) + photos (optional)

Auto-fill opportunities

Weather: device location + nearest station (and allow override)

Personnel/plant: pre-fill from yesterday + roster/allocations (Assignar supports structured assignment/time contexts)

Docket approval

How quickly?

Practically: same day (payroll and subbie payment cycles). Procore explicitly frames foreman/superintendent as first-tier reviewer and status changer .

What foremen actually look at

Who / crew

Date + shift hours

Cost code / activity (or job reference)

Exceptions (overtime, standby, rework)

Attachments/proof (if present)

Swipe-to-approve?

Use swipe as a shortcut, not the only path. Gloves + glare + mis-taps make irreversible swipes risky; prefer tap-to-review with big approve button + undo.

Photos/documentation

How many per day?

Highly variable by project phase; design for dozens/day without organisational overhead.

Categorise at capture or later?

Default: later. Offer suggested links (Lot/ITP/NCR) post-capture, but don’t force.

GPS tagging

Useful for context; don’t make it mandatory. Assignar markets geo-location timestamps for field submissions —good as an optional assist, not a blocker.

ITPs & hold points

Typically triggered by work stage, not a “daily form.” Your best UX is a Today-driven checklist notification (“Hold point pending in Lot 12 — cannot proceed”) rather than a library of ITPs to browse.

NCRs

Often weekly/occasional, spiking during complex works or commissioning.

Do not make NCR creation a permanent primary tab if your Capture action already covers it. Put NCR as a capture type within Capture.

Practical “minimum viable foreman app” (3–5 things)

If you stripped everything back to the essentials:

Capture evidence (photo-first → link to lot/issue later)

Today worklist (ITPs + hold points + inspections due)

Approvals (dockets/timesheets)

Progress by Lot (done/not done + attach evidence)

Finish Diary (EOD submit in under 60 seconds)
