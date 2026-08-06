# CivilPro competitive analysis — NCR / Punchlist / Field (Risk Management)

Sources: `bundles/ncr-punchlist-field.md` (18 KB articles, Web + Desktop variants) and three
transcripts — `kegl7SOSIl0` (Create an NCR), `4ru5uHdT3n8` (Punchlists Web), `FQuWRZD0kPk`
(Punchlists Desktop). Article titles cited inline. "(D)" = CivilPro Desktop article; unmarked = Web.

CivilPro ships as **two clients over one API**: a Windows Desktop app (the mature one) and a Web app
(mobile = responsive browser, not a native app). Which client you must use is workflow-dependent and
is the single biggest structural weakness in this whole area.

---

## 1. Feature inventory (mechanics)

### 1.1 NCR — creation

Two entry points ("Create a Non-Conformance Report (NCR)", `kegl7SOSIl0`):

1. **From the Lot register** — select lot → New NCR. The lot is auto-linked to the NCR.
2. **From Quality Assurance > Non-Conformance (NCR)** → New NCR. No auto-link; lots picked manually.

The creation UI is a **linear wizard** (Next/Back, ~8 pages Desktop, ~7 Web, with a final review
page in Web that Desktop lacks). Field-by-field, in wizard order:

| Page | Fields |
|---|---|
| 1 | Location (free text), Description |
| 2 | Estimated Cost (optional), **Severity** (picklist), **Third Party Approval Required** (Yes/No), Related Parties, Notes (Web) |
| 3 | **Action Type** (picklist), **Corrective Action** (free text; "if none, enter N/A" — i.e. not enforced) |
| 4 | **Root Cause Category** (picklist), Root Cause (**optional**), **Action to Prevent Recurrence (mandatory)** |
| 5 | Related Lot(s) — multi-select. Del key removes a mis-picked lot |
| 6 | Notes (Desktop) |
| 7 (D) | Manual approval page — "skip this for now" |
| 8 (D) | Close-out page — "skip this for now" |
| Final (Web) | Review-all screen with Back, then Save |

Two things stand out. **"Action to Prevent Recurrence" is the only mandatory narrative field** — a
deliberate ISO-9001 posture: they'll let you write "N/A" for corrective action and leave root cause
blank, but they force you to state prevention. And **Root Cause Category is a picklist while Root
Cause is optional free text** — so their reportable root-cause analytics come from the category, not
the prose.

Third Party Approval Required is set at creation and is what enables sending the proposed remediation
methodology to an external party (the Principal's Representative) before internal approval
(`kegl7SOSIl0`).

Multi-lot linking is a first-class use case, not an afterthought: the video's worked example is
"poor material type for pipes landed on site affecting multiple drainage lots" — one NCR, many lots,
and the NCR then appears in the related-items panel of every one of those lots.

### 1.2 NCR — visibility model (private/published)

This is unusual and load-bearing ("Edit an NCR", "Request Approval for NCR (D)"):

- An NCR is **private by default**. Private = not visible to users whose role has the
  `Limit Ncr View To Published` authority flag set.
- Publishing makes it visible to everyone with NCR view access on the project.
- **A published NCR cannot be edited.** To edit you must right-click → Access → Make Private (or
  Action on Selection → Make Private), edit, then Make Public again.
- Editing requires TWO permissions: `NCR - Edit` (Access tab in Roles) **and** `Publish NCR`
  (Authority tab). So the ability to correct an NCR is gated behind the ability to publish it.
- **You cannot issue an approval on an unpublished NCR** — the request-approval dialog detects this
  and offers "the NCR currently isn't published, would you like to publish it and then issue the
  approval?" with a safe No/exit path (`kegl7SOSIl0`).

Publish is effectively their immutability lock: draft → published = record frozen for the approver.

### 1.3 NCR — approval workflow

Two mutually exclusive paths.

**Path A — workflow approval** ("Request Approval for NCR", "(D)" variant, `kegl7SOSIl0`):

1. Right-click NCR (or Notepad icon on right panel) → Approval → Request Approval.
2. Dialog: **Workflow** (select the NCR/Basic workflow — must be pre-built, see "Create Basic
   Workflows for Approvals"), **Addressees** (dropdown pre-filtered to users who *can* approve),
   **CC**.
3. Build Approval / Preview / **Start & Send**. Preview renders the actual outbound email.
4. Enter **number of days until 1st step is due**.
5. Attach Filestore Docs / Photos **to the approval** — critical gotcha, see §5.
6. Send. Action Date + **Action Logs** update; register Status shows approval requested.

The approval is a **separate entity** linked to the NCR via Related Items — it has its own register,
its own action log, and a graphical workflow with a `View Progress` diagram.

**Approver side** ("Action NCR Approval Requests (by the Approvers)", "(D)" variant): approver gets an
email **with a PDF copy of the NCR attached**, plus a deep link. Cloud users click through; Desktop
users log in, connect to the named project, find the NCR, View Approval → **Action Step** → pick an
Action from a five-option dropdown (observed: Approve, Approve with Comments, Conditionally Approved,
Rejected, +1), attach files (from Filestore or local), add Comments → Action. An email preview is
shown with the requester auto-populated as Mail To; approver also gets a confirmation copy. All of it
lands timestamped in the Action Log.

**Path B — manual approval** ("Set Manual Approval and Close Out NCR", "(D)"): bypasses the workflow
entirely for approvals negotiated outside the system. Fields: NCR Approval By, NCR Approval Date
(defaults today), NCR Approval Details (free text — "enter as many details as possible e.g.
correspondence reference with date and time"). Status → **Manually Approved**. Reversible via Remove
Manual Approval. Manually Approved is a **terminal status** — the register also flags `Is Complete`.

**Rejection / resubmission** ("Re-submit an NCR") — the ugliest flow in the product:

1. Client actions the approval as Rejected with comments.
2. Contractor right-clicks → Make Private (the `Is Published` tick disappears), edits, saves.
3. Make Public again.
4. Now the approval is stuck at Rejected. To move it, either
   (a) **edit the approval workflow graph** — open the approval, View Progress, Edit Workflow, and
   **add a feedback loop arrow** from Rejected back to "NCR Requested", then action it as
   "Resubmit NCR"; or
   (b) use **short circuit** to step the approval back to the NCR Requested status without touching
   the workflow.

The KB openly admits their own shipped workflows lack the feedback loop and recommends the "Basic
Workflow Templates" which include them. A rejected NCR requires a user to edit a state machine.

### 1.4 NCR — close-out

Separate from approval ("Set Manual Approval and Close Out NCR"). Operations → Set/View Close Out →
fill **NCR Close Out Details** (rest auto-populated) → Save. Status → **Closed Out**. Reversible
(Remove Close Out). No gate is described that forces close-out to wait on approval, and no evidence
requirement — close-out is a text field, not a verification.

### 1.5 NCR — links and evidence

- **NCR ↔ ITP checklist inspection point** ("Attach NCR to a Checklist Inspection Point", "(D)"):
  open the Checklist (= ITP attached to a Lot), click the inspection item, pick the NCR in the
  **Non-conformance dropdown**, Save. **The inspection item then highlights red** in the checklist.
  Prerequisite: NCR must already exist. It's a link operation, not a create-from-here.
- **Photos / Filestore Docs** via the Related Items panel ("Link Photos or Filestore Documents to
  NCR", "(D)"): `+` to upload new, chain icon to link existing from the register, **camera icon to
  take a photo** (Web), broken-chain to unlink. Drag-and-drop supported for documents in Web.
- **Punchlist items can link NCRs** (see §1.6) — so a defect can escalate into a formal NCR and keep
  the trace.

### 1.6 Punchlist mechanics

Purpose per "Create Punchlists": minor defects/rework tracked to closeout and handover, raised
**before** final inspection.

**Header:** Punchlist No, Description, Raised By / Punchlist By (defaults current user), Date Raised /
Punchlist Date (defaults today). Video advice: bake location + separable portion into the Description
because there are no structured fields for them, and settle a **naming convention** up front for
filtering/grouping on big projects (`FQuWRZD0kPk`).

**Items:** Item No / Ref, Description, **Person Responsible**, Date Added, **Notes** (holds the
remediation proposal — hidden column by default; you right-click → column chooser → drag it in).

- Desktop autofills Ref ascending; **Web has no autofill** — the article says outright "there is no
  autofill at the moment" ("Create Punchlists").
- **Person Responsible need not be a CivilPro user** — typing a new name pops a contact-creation
  dialog. This is how subcontractors get assigned without licences.
- Desktop grid gotcha: you must **tab all the way through the row** to commit it; clicking away
  loses the line (`FQuWRZD0kPk`).

**The three-gate model** — every item carries three independent boolean gates: **Check → Verify →
Approve**. All three are ON by default at item creation. Per-item you can toggle any gate to **"Not
Required"** via Action on Selection (Web) / Item Operations (Desktop); shift-select works for bulk.
Typical mapping (`4ru5uHdT3n8`):

| Gate | Typically |
|---|---|
| Check | Site Engineer (internal, did the fix + attached post photo) |
| Verify | Project Engineer / supervisor / quality manager (internal review of evidence) |
| Approve | Principal's Representative / Client (external, final) |

Two-party projects drop Verify. Desktop guidance: **always keep Approve** — "each of these line items
has to have an approved tick in order for the punchlist to be able to be closed out"; if there's no
external party, use Check + Approve internally.

**Roles / permission scoping** ("Create Punchlists" steps 7a–7d): users are linked *to the punchlist*
via Related Items → Roles → Link, then a **User Scope Selector** assigns exactly one of Check /
Verify / Approve to that user. Multiple users per gate allowed. Person Responsible and gate-holders
are deliberately different concepts. Admin must have granted the user punchlist access first, or they
can't be linked at all. Un-permitted actions render **greyed out**, not hidden.

**Undo hierarchy** ("View and Edit Punchlists (D)"): Uncheck / Unverify / Remove Approval exist, but
**must be unwound in reverse order** — you cannot Unverify until Approval is removed, cannot Uncheck
until Unverified. Clean state-machine discipline.

**Attribution:** CheckedBy / VerifiedBy / ApprovedBy + dates are stored, surfaced only by adding
columns via the Column Chooser, and can be saved as a custom register view.

**Close-out:** once every item is Approved **or** marked Not Required, Global Action (⋯) → Close Out
Punchlist → Save & Close. Row turns green / Closed. Desktop **auto-prompts** "close out?" the moment
the last item resolves. Editing must be finished before close-out.

**Reporting:** Printer icon on the *register* (not the items page). Desktop: Reports → **Detail
Report with links** = the punchlist summary showing **pre and post photos side by side**, notes, and
who checked/verified/approved. This report is what the client actually reviews.

**Notification:** right-click punchlist in the register → **Notify Selection** → pick recipients →
sends an email containing a **link back into the punchlist**. This is the manual handoff between
gates — there is no automatic "all items checked, notify the verifier" trigger.

### 1.7 The pre/post photo workflow (the core punchlist ritual)

Both videos spend most of their runtime here, and it is entirely **manual file management**:

1. Defect walkover with **printed A3 construction drawings**; mark defect locations + numbers +
   defect detail + proposed remediation by hand.
2. Recommend a phone app such as **Solocator** that stamps GPS location, time and reference numbers
   **into the photo image** for traceability (`FQuWRZD0kPk`).
3. Dump phone photos into a Windows Explorer folder literally named `pre`.
4. **Scan the marked-up A3 drawings to PDF.**
5. In CivilPro, make the **first punchlist item "Markups from Walkover"**, attach the scanned PDF to
   it, and set Check/Verify/Approve = **Not Required** so it doesn't block close-out. (Recommended
   practice in "How to Use Punchlists in CivilPro Web (Video Tutorial)" and both videos.)
6. Per defect item: Related Items → Photos → `+` → browse the `pre` folder → choose import size
   (Original/Large if fine detail matters) → **manually rename the photo record to suffix " - Pre"**.
7. Rectify. Re-shoot. Dump into a `post` folder. Repeat the import, suffix " - Post".
8. Check → Notify → Verify → Notify → client runs the Detail Report, sees pre/post, ticks Approve.

There is **no pre/post field**. The distinction is a naming convention in a free-text photo title,
enforced by a human. The spatial record is a scanned PDF of paper drawings attached as a fake line
item.

### 1.8 Field module (Risk Management) — Site Diary, Instructions, Incidents

**Site Diary** ("Site Diary", "Add a Site Diary", "Add Site Diary (D)") — six sections: Activity
Summary (Date-of-activity, Reviewer, Site Activity narrative), Instructions, Costs, Cost Codes, HSE,
Photos. Diary ID auto-assigned but editable.

The defining mechanic is a **two-client, two-stage split**:

| Stage | Who | Where |
|---|---|---|
| Create | Supervisor on-site | Web / mobile browser |
| Review | PM or Contract Administrator | **CivilPro Desktop only** |

Status flow: **Created → Entered → Reviewed**. Costs do **not** reach the Daycost Register (and
therefore cost reports, invoice reconciliation, forecasting) until Reviewed. The KB flags this as
their #1 support question: "if your cost data looks stale, check whether recent diaries are still
sitting at unreviewed status."

Review ("Review Site Diary (D)"): reviewer pages the tabs; on the Costs tab selects costs and hits a
**green triple-arrow** to promote them into the lower (accepted) register — i.e. **line-item-level
cost approval, not all-or-nothing**. Final page selects the **Report Period** the daycosts land in.
Row turns green. A mis-periodised cost is fixed with **Move Daycost** (Action on Selection → Move
Daycost → pick period) rather than delete/re-enter.

Costs grid: Supplier (free-text entries auto-add to Supplier list), Resource (rate auto-populates
from the Resources library), Quantity, **Docket Number**. **Copy Costs From Previous** — filter by
Date and User, then select some or Copy All from an earlier diary; the headline time-saver for
repetitive days.

Cost Codes: `Manage Cost Codes` adds cost-code columns; you distribute each row's quantity across
codes. **Row is red until fully distributed, green when complete** — a nice, cheap sufficiency signal.

**Auto-registration:** Instructions and HSE incidents entered inside a diary appear automatically in
the Instructions Register and Incidents Register, flagged `Is from Diary`. HSE auto-flow currently
lands **in Desktop only** — the article says "if you require in Web, please get in touch with support
to prioritise!"

Resources can't be deleted once used in a diary — **mark Inactive** (drops from dropdowns, preserves
history). Cross-project daycost rollup is **Desktop or API only**.

**Diary locking** ("Lock / Unlock a Site Diary", "(D)", Desktop v538+) — they migrated from
**optimistic to pessimistic locking** and documented why: optimistic merge surfaced conflicts "after
someone had spent twenty minutes typing." Now: lock acquires automatically on open-for-edit or
start-review; releases on save or navigate-away/close. `Date Locked` / `Locked By` columns in the
register. Enforced **at the API level**, so Desktop and Web honour the same lock. Hanging locks
(closed tab, crash, force-closed mobile) cleared via Actions → **Unlock Diary** by anyone with
Admin/Delete on Site Diary, the lock holder, or **the diary owner regardless of Admin/Delete**.
Force-unlock loses the previous editor's unsaved work.

**Instructions Register** ("Instructions (D)", "Add Instructions (D)"): ID, Date, To, By, Instruction,
`Is from Diary`. Links to Lots, Variations, Contract Notices, Filestore Docs, Photos. Has its own
**Close Out** (View Close Out screen). PDF Instruction Report generated for selected rows with an
**Email PDF** button. Asymmetry worth noting: you can create an instruction inside a diary and it
appears in the register, but **you cannot retro-link a register-created instruction back to a diary**.

**Incidents Register** ("Incidents (D)"): Incident ID, **Incident Type** (safety / environmental /
quality / personnel / public / vehicle / other), Incident Date, Identified By, Description, **Status
(open / approved / closed out)**, `From Diary?`. Incident detail is six structured areas: **Details**
(type, date & time, **weather conditions**, **hours lost**, estimated cost), **Description**,
**Persons Affected** (incl. witnesses), **Cause**, **Rectification**, **Reoccurrence**. Has its own
Approval (Add/View Approval) and Close Out. Filters by ID/date/text, by incident/approval/close-out
date, and by status — with a mandatory **Apply Filter** click.

### 1.9 What is NOT in the field story

Across all six sources there is **no mention of**: offline capture, an installed mobile app, sync
queues, background upload, voice capture, GPS auto-location of a defect or NCR, or map/plan pinning.
"Mobile" means "the Web app in your phone browser" ("Add a Site Diary": *"Can I create a Site Diary on
my phone? Yes — the Site Diary is a core mobile workflow"* — i.e. responsive web). Their own answer to
photo geotagging is **to recommend a third-party app (Solocator)**.

---

## 2. UX flows, step-by-step

### 2.1 NCR happy path (from `kegl7SOSIl0`, worked example: excavator strikes a marked tree with no arborist present)

1. Lot register → select the lot ("box out of road 3") → **New NCR** (auto-links the lot).
2. Wizard: Location, Description → Estimated Cost, Severity, **Third Party Approval Required = Yes**,
   Related Parties → Action Type + Corrective Action → Root Cause Category + Root Cause + **Action to
   Prevent Recurrence** → confirm/extend the linked Lot list → Notes → Save.
3. NCR sits in the register in **Draft** (private). Optionally "notify someone internally… or you can
   tap them on the shoulder if they're sitting beside you."
4. Related Items → `+` → attach photos / PDFs / markups.
5. Right-click → **Request Approval**. Prompt: not published — publish and issue? → Yes.
6. Select the **non-conformance workflow**, addressee = Principal's Representative, optional
   **Preview** of the email → **Start & Send**.
7. Approver clicks the emailed link → approval window showing NCR description, the lot, the creator,
   linked filestore docs, and a hyperlink into the NCR itself.
8. Approver → **Action Step** → Approve / Approve with comments / Conditionally approved → comments →
   attachments → submit. (The video narrator sees fewer options because he created the approval — the
   action set is role-scoped.)
9. Requester gets a notification email. Register shows the approval status; **Manually Approved** also
   flips `Is Complete`.

### 2.2 Punchlist happy path (from `4ru5uHdT3n8`, seven documented steps)

1. **Prep offline**: walkover with A3 prints, mark up defects with numbers, photograph, sort into
   `pre` folder, scan markups to PDF.
2. **Create**: Punchlists register → `+ Add Punchlist` → Description (location + separable portion +
   what the walkover represents), Date Raised → Create.
3. **Assign roles**: select punchlist → Related Items → Roles → link Site Engineer = Checker, Project
   Engineer = Verifier, Principal's Rep = Approver.
4. **Item 0**: `+ New Item` → "Markups from Walkover" → attach scanned PDF → Action on Selection →
   remove Check, Verify **and** Approve.
5. **Defect items**: number, describe, Person Responsible, remediation in Notes.
6. **Pre evidence**: select item → Related Items → Photos → `+` → pick from `pre` → rename with
   " - Pre" suffix. Repeat.
7. **Rectify**, then attach `post` photos the same way with " - Post".
8. **Check**: Site Engineer ticks Checked on each completed item.
9. **Notify**: right-click punchlist in register → Notify Selection → Project Engineer.
10. **Verify**: PE reviews pre/post, ticks Verified.
11. **Notify** the client → client opens the punchlist, runs **Punchlist Report / Detail Report with
    links** to view pre/post side by side, ticks **Approved** (stamps their name + date).
12. **Close out**: set the Markups item's three gates to Not Required → Global Action (⋯) → **Close
    Out Punchlist** → Save & Close. Row turns green.

### 2.3 Site Diary end-to-end

Supervisor (Web/phone, end of day): Field → Site Diary → New Diary → Date (day of activity, not day
of typing) + Reviewer + Site Activity narrative → Add Instruction(s) → Costs rows (Supplier, Resource,
Qty, **Docket Number**) or **Copy Costs From Previous** → Manage Cost Codes and distribute until rows
go green → Add Incident(s) → Upload Photos (incl. photos of paper dockets) → Save. Status
Created → **Entered**.
PM/CA (Desktop, office): Site Diary register → select the non-green row → **Review Diary** → page
tabs → on Costs, select rows → **green triple-arrow** to accept → final page: pick **Report Period**,
add comments → Save. Row green, daycosts land in the Daycost Register in that period.

---

## 3. Terminology & data model

**Navigation groups:** `Quality Assurance` (NCR, Checklists), `Spec and Conformance` (Punchlists),
`Field` (Site Diary, Instructions, Incidents — the Desktop KB section is literally titled
"Field (Risk Management)"). Everything is a **Register** (grid) with a **Related Items** panel
(chain icon), an **Action on Selection** / **Item Operations** menu, a **Global Action** (⋯) menu, a
**Column Chooser**, and saveable **Custom Views**.

**Entities and key attributes:**

- **NCR** — Location, Description, Estimated Cost, Severity, ThirdPartyApprovalRequired, Related
  Parties, Action Type, Corrective Action, Root Cause Category, Root Cause, Action to Prevent
  Recurrence, Notes; flags `Is Published`, `Is Complete`; statuses Draft → (Approval Requested) →
  Approved / Approved with Comments / Conditionally Approved / Rejected / **Manually Approved** →
  **Closed Out**. Relations: Lots (many-to-many), Checklist Inspection Item (via `Non-conformance`
  field), Approval, Photos, Filestore Docs, Punchlist items.
- **Approval** — separate entity with Workflow (a graph with states, transitions, optional **feedback
  loops**, and **short circuit**), Addressees, CC, days-until-step-due, its own attachments, and an
  **Action Log** of timestamped actions. Reusable across NCRs, Incidents, and Punchlists.
- **Punchlist** — Punchlist No, Description, Raised By, Date Raised, Closed Out flag. Has **Roles**
  (user × scope ∈ {Check, Verify, Approve}).
- **Punchlist Item** — Item No/Ref, Description, Person Responsible (contact, not necessarily a
  user), Date Added, Notes; three gate booleans + three "*Required*" booleans; CheckedById /
  VerifiedById / ApprovedById + dates. Relations: Photos, Documents, Lots, Approvals, **NCRs**.
- **Site Diary** — Diary ID (editable), Date, Reviewer, Site Activity, Date Reviewed, Report Period,
  `Date Locked` / `Locked By`; statuses Created → Entered → **Reviewed**. Children: Instructions,
  Cost lines, Cost Code allocations, Incidents, Photos.
- **Daycost** — promoted cost line; belongs to a Report Period; movable via **Move Daycost**.
- **Resource / Supplier / Cost Code** — libraries; Resources carry Category + Supplier + rate and are
  **Inactive-able, not deletable, once used**.
- **Instruction** — ID, Date, To, By, Instruction, `Is from Diary`; own Close Out.
- **Incident** — Incident ID, Type, Date, Identified By, Description, Status, `From Diary?`; six
  detail areas (Details / Description / Persons Affected / Cause / Rectification / Reoccurrence);
  own Approval and Close Out.
- **Checklist** — an ITP attached to a Lot; its Inspection Items carry a `Non-conformance` FK and
  render **red** when populated.

**Vocabulary map to SiteProof:** Checklist ≈ our ITP completion on a lot. Inspection Item ≈ our ITP
checklist item. Filestore ≈ our documents. Daycost ≈ docket/cost line. Punchlist has **no SiteProof
equivalent**. Instructions and Incidents registers have no direct SiteProof equivalent (our diary
holds some of this inline).

**Permission model:** two axes — **Access** tab (per-register CRUD, e.g. `NCR - Edit`, `Site Diary
Edit`, `Admin/Delete`) and **Authority** tab (capability flags, e.g. `Publish NCR`, `Limit Ncr View
To Published`). Plus **per-record role scoping** for punchlists. Users self-check via profile →
My Permissions → Authority (Web); Desktop users must ask an admin.

---

## 4. Strengths worth stealing

1. **The three-gate Check → Verify → Approve model with per-item "Not Required".** Cheap, legible,
   and it maps exactly to how AU civil actually signs off: tradie/engineer says done, internal QA
   confirms evidence, superintendent accepts. The killer detail is **Not Required as an explicit
   terminal state** — it lets an administrative row exist in the register without blocking close-out,
   instead of forcing the fake "approve the paperwork item" our kind of state machine usually does.
2. **The undo hierarchy** — you must Remove Approval before Unverify before Uncheck. One rule,
   prevents the whole class of "verified but no longer checked" corrupt states. Worth copying
   verbatim into our hold-point / ITP sign-off unwind.
3. **Close-out gated on every item being Approved-or-Not-Required, with an auto-prompt when the last
   item lands** (Desktop). We should gate lot closure the same way and prompt at the moment the gate
   opens rather than waiting for the user to notice.
4. **Person Responsible ≠ gate holder, and Person Responsible can be a non-user contact.** Lets you
   assign defects to a subbie's leading hand who will never log in, without polluting the user table
   or buying a seat. Directly relevant to our subbie-free model.
5. **Two mandatory-by-design NCR fields chosen with intent**: Root Cause **Category** (structured,
   reportable) + **Action to Prevent Recurrence** (mandatory). Most tools mandate corrective action
   and leave prevention optional; CivilPro does the reverse, which is what an auditor actually asks
   for. Steal the field set wholesale — Severity, Estimated Cost, Third Party Approval Required,
   Action Type, Root Cause Category — it is a credible ISO 9001 / AS-NZS quality-system shape.
6. **NCR ↔ ITP inspection item link that turns the checklist row red.** One-glance visual truth that
   this lot has an open non-conformance against a specific hold/witness point. We have the data to do
   this today; the red row is the cheap part.
7. **Create-NCR-from-the-lot auto-links the lot**, and NCRs are many-to-many with lots. The "bad batch
   of pipe affected six drainage lots" case is a real and frequent one we should handle in one record.
8. **Publish = freeze.** Using a publish flag as both a visibility control and an edit lock is elegant
   and self-explaining to non-technical users: "if the client can see it, you can't quietly change it."
   The `Limit Ncr View To Published` role flag is a neat way to keep drafts off the client's screen
   without a separate draft workspace.
9. **Manual Approval as a documented escape hatch**, with a mandatory free-text "approval details"
   field for citing the out-of-band correspondence. Every real project approves things by phone call
   and site meeting; giving that a first-class, auditable slot beats forcing a fake workflow run.
10. **Approval email carries a PDF of the record plus a deep link.** The client can act from the email
    on their phone without logging in to read it. Our approval notifications should attach the
    generated PDF, not just link.
11. **Line-item-level cost acceptance in the diary review** (green triple-arrow promotes selected cost
    rows) + explicit **Report Period** selection at review time + **Move Daycost** to re-period a
    mistake without delete/re-enter. Far better than all-or-nothing diary approval.
12. **Copy Costs From Previous**, filtered by date and user, with Copy All. Day-after-day repetitive
    crews are the norm; this is the single biggest data-entry saving in their diary and it's trivial
    to build.
13. **Red-until-fully-distributed cost code rows.** A per-row sufficiency signal that needs no
    explanation. Same primitive as our sufficiency gate, applied at row level.
14. **Pessimistic locking with visible `Locked By` / `Date Locked` columns, an owner-can-always-unlock
    rule, and an explicit Unlock Diary action** — and they documented *why* they moved off optimistic
    merging. If we ever hit concurrent diary editing, this is the answer and the rationale is
    pre-written.
15. **Diary-entered Instructions and Incidents auto-register** ("don't double-up"). Capture once at
    the point of work, surface in the register that needs it.
16. **Incident detail structured as Cause / Rectification / Reoccurrence**, plus weather conditions and
    hours lost. Direct-lift field set if we ever formalise incidents.
17. **The Detail Report with pre/post photos side by side** is the actual deliverable clients want.
    Our report surfaces work should have a defect/NCR report in exactly this shape.

---

## 5. Weaknesses / gaps we can exploit

1. **The desktop dependency is the whole ballgame.** Diary review is Desktop-only, so *no cost data
   reaches any report until someone opens a Windows app*. HSE incident auto-flow to the register is
   Desktop-only ("if you require in Web, please get in touch with support to prioritise!"). Punchlists
   were Desktop-first with Web "restricted to viewing existing punchlists and closing out or approving
   line items" (`FQuWRZD0kPk`) — Web creation has since landed but the two clients still diverge.
   Cross-project rollup: Desktop or API only. **We are browser-only and mobile-first; that isn't a
   parity gap, it's the pitch.**
2. **No offline anything.** Not one mention across six sources. A civil site with no signal is the
   normal case, not the edge case. Our offline lot map + capture is a direct kill shot.
3. **The pre/post photo model is a naming convention, not a data model.** Manual folder wrangling in
   Windows Explorer, manual import one photo at a time, manual rename to append " - Pre" / " - Post".
   Nothing enforces that a post photo exists before Check is ticked; nothing pairs them; the pairing
   only becomes real in a rendered report. **A structured pre/post photo pair per defect, captured in
   the browser on the phone at the point of work, with a hard gate that Check cannot be ticked without
   a post photo, beats this outright** — and we already ship the fail-photo gate primitive.
4. **The markup PDF hack is an admission that they have no spatial defect model.** Their own
   recommended best practice is: print A3 drawings, mark defects with a pen, scan to PDF, create a
   fake first line item called "Markups from Walkover", attach the scan, and switch off all three
   gates so it doesn't block close-out. **This is exactly the hole our spatial lot map fills.** A
   defect pinned at a chainage/coordinate on the plan, with its photos attached to the pin, removes
   the paper round-trip entirely. Cite this in positioning — it's their documented workflow, not our
   characterisation.
5. **They outsource geotagging to a third-party phone app (Solocator).** Their own tutorial tells
   customers to install someone else's software to get location and time into photos. We stamp GPS +
   time server-side.
6. **Punchlists have no structured location.** Location, separable portion, and area live inside a
   free-text Description, which is why the tutorial has to teach a naming convention for filtering.
   No lot/chainage/coordinate field on the punchlist or the item.
7. **Web punchlist item numbering has no autofill** — documented, not inferred ("Create Punchlists":
   *"there is no autofill at the moment"*). Manual numbering on a 60-defect handover list.
8. **Notification between gates is fully manual.** "Notify Selection" is a right-click a human must
   remember; the alternative the video offers is "tap them on the shoulder." No trigger on
   all-items-checked, no reminders, no overdue nudges, no assignee notification when Person
   Responsible is set. Automatic stage notification is a small build and an obvious win.
9. **NCR editing requires an unpublish/republish dance**, and it needs *two* permissions, one of which
   is the publish authority. So a site engineer who can raise NCRs but can't publish **cannot fix a
   typo in their own NCR**. Guaranteed support tickets.
10. **Rejected NCR resubmission requires editing a workflow state machine.** The KB's own remedy is
    "open the approval, View Progress, Edit Workflow, add a feedback loop arrow," or use "short
    circuit." Rejection-then-resubmit is the *normal* NCR lifecycle in AU civil, and their default
    shipped workflows don't support it. **Our answer should be a one-click Resubmit that's built in,
    with the client comments carried through.**
11. **Two separate attachment surfaces with a documented trap:** photos linked to the NCR via Related
    Items are **not visible to approvers** and are **not attached to the approval email** — you must
    attach them *again* to the Approval ("Link Photos or Filestore Documents to NCR (D)": *"the photos
    and documents linked here are NOT visible to NCR Approvers"*). This is a real-world "the client
    approved without seeing the evidence" bug waiting to happen. Single evidence set, one attachment
    surface, always visible to the approver.
12. **NCR close-out is an unverified free-text field.** No requirement that corrective action was
    evidenced, that the linked ITP item was re-inspected, or that a photo exists. Close-out is a
    typing exercise. Our sufficiency-gate approach applies directly.
13. **No NCR field-creation story.** Every NCR article is register-driven, desk-shaped; there's no
    "raise an NCR from your phone at the defect." The failure is found on site and recorded in the
    office, from memory.
14. **Approval workflows must be pre-built before a single NCR can be sent** ("Ensure Workflows for
    Approvals have been set up before proceeding"). That's a configuration project standing between a
    new customer and their first approved NCR. Ship sensible defaults; make workflow config optional.
15. **Pessimistic diary locking has a well-documented failure mode they can't fix**: closed tab, lost
    connection, force-closed mobile app → hanging lock → someone with Admin must go clear it, and
    "the previous editor's unsaved work is lost." On mobile — the primary diary client — backgrounding
    the browser is routine. Autosave-drafts sidesteps the whole problem.
16. **Instructions can't be retro-linked to a diary** — "you cannot link an instruction to a site diary
    entry after adding it from the Instructions register." Arbitrary one-way constraint.
17. **Discoverability is poor throughout.** Notes (the remediation proposal field) is hidden by
    default; who-checked/verified/approved requires manually dragging columns from a Column Chooser;
    the Printer icon only appears on the register, not the items page ("you'll need to exit to the
    main register page before you can see the Printer icon"); Incident filters need a separate Apply
    click. This is a 2005 WinForms grid transplanted into a browser, and the tutorials are largely
    teaching people how to operate the grid rather than how to do the work.
18. **Delete-by-keyboard.** Removing a mis-linked lot from an NCR, or a linked user from a punchlist,
    is "hit the Del key." Undiscoverable and unforgiving.

---

## 6. Surprises

1. **They tell customers to print A3 drawings and mark up defects with a pen** as the recommended
   workflow, in an official 2025-dated tutorial. The market leader's documented best practice for
   defect capture is paper. That's the size of the opening for our spatial map.
2. **They recommend a competitor's app (Solocator) inside their own tutorial** to solve photo
   geotagging.
3. **Root Cause is optional but Action to Prevent Recurrence is mandatory.** Counterintuitive and, on
   reflection, probably correct — the auditor's question is "what stops it happening again."
   Nevertheless it means their NCR data has prevention text with no cause behind it.
4. **The recommended punchlist best practice is to create a dummy line item and switch off all its
   approval gates.** A workaround so entrenched it's step 3 of the official tutorial.
5. **They publicly documented a locking-architecture regression and reversal** — optimistic → they
   admitted it lost twenty minutes of typing → now pessimistic, with the reasoning printed in the help
   centre. Unusually candid, and a free lesson: we should not build optimistic merge for diaries.
6. **The approval "Action" dropdown is role-scoped in a confusing way** — the video narrator notes "I
   get a limited number of options here" because he created the approval. Same screen, different
   options, no explanation to the user.
7. **Punchlist gate roles are assigned per-punchlist**, so every new punchlist requires re-linking the
   same three people with the same three scopes. No project-level default, no template.
8. **Costs, cost codes and daycosts live inside the Site Diary**, and the whole cost-tracking,
   invoice-reconciliation and forecasting chain hangs off a supervisor filling in a diary and a PM
   opening a Windows app to review it. Their diary is a *financial* instrument first and a site record
   second. Ours is deliberately not (per our claims-are-a-data-compiler stance) — but the **docket
   number captured at entry time to make invoice reconciliation possible later** is a good pattern,
   and their tip ("skip the docket number and reconciliation turns into detective work") is worth
   lifting as UI copy.
9. **A Punchlist item can link an NCR** — so a defect that turns out to be a genuine non-conformance
   escalates without losing the trace. We have no equivalent escalation path, and it's a natural
   product motion for us.
10. **`Is Complete` on an NCR is set by Manually Approved**, which sits alongside — not before —
    Closed Out. Two independent completion concepts on the same record is a data-model smell; expect
    their reporting on "how many open NCRs" to be ambiguous.
