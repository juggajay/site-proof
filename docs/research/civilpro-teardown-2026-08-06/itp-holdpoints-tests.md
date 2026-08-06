# CivilPro — ITP / Checklist / Hold Point / Test & Survey Request: competitive analysis

Sources: `bundles/itp-holdpoints-tests.md` (56 KB, 39 KB articles) + 9 video transcripts.
Article titles cited inline. `(D)` in a title = the CivilPro **Desktop** variant of that article.

Two products share one database: **CivilPro Desktop** (V10/V11/V12, thick client) and **CivilPro Web/Cloud**
(browser, also the mobile/tablet surface). Feature parity is incomplete and the KB says so.

---

## 1. Feature inventory (mechanics)

### 1.1 ITP register and the ITP object

Location: web `Spec and Conformance > Inspection Test Plan (ITP)`; desktop `Specifications (ITP)` register.

**ITP header fields** ("Create ITP", "Create ITP (D)"):

| Field | Notes |
|---|---|
| Description | mandatory |
| ITP Doc No | mandatory in Web, optional in Desktop |
| QVC Doc No | QVC = Quality Verification Checklist |
| Spec Reference | free text |
| Revision Date / Reference | only populated when revising |

**Inspection item (line item) fields** — the ITP row:

- `Item Type` — Quality / Safety / Environmental / Community / **Heading**. Heading rows are structural
  section titles, not inspection points.
- `Hold Point and Witness Point Check` (a.k.a. **Check Type** on import) — **Check Item / Witness Point /
  Hold Point / Milestone**. Milestone is a real fourth type.
- `Reference Text` — free rich-text column, deliberately unconstrained. The video ("Importing ITPs into
  CivilPro Web App") says it is used for "activity steps… it might denote whether it's a hold point
  explicitly". The AI-import prompt instructs bolding it and appending an underlined " - Hold Point".
- `Description` — rich text/HTML (lists, bold, colour, tables, pasted images).
- `Clause`, `Responsibility`, `Records`, `Method of Inspection` — plain text.
- `Included on Inspection Test Plan Report` — ticked by default; unticking removes the row from the ITP PDF.
- `Has Tests?` — read-only, computed, ticks when the row has a linked test.

**Checklist Template tab** (per line item) — controls what the derived checklist looks like:

- `Inspect Required` → renders a **Check** box on the checklist
- `Verify Required` → renders a **Verify** box
- `Authority Required` → renders an **Approval** box and enables external approval requests
- `Included on Checklist` (independent of Included on ITP Report — a row can print on one and not the other)
- `Override description for checklist` → **AltQvcText** ("Using the AltQvcText field in Inspection item"):
  a separate, shorter description shown on the checklist. Blank = inherit ITP description. The grid shows
  the AltQvcText cell with a grey background when identical, a `Diff QVC text` tick column when they differ,
  and an `Action on Selection > Revert Text` to snap it back. Purpose is explicitly stated: short wording
  for the inspector on a phone, exhaustive wording on the ITP document.

**Test tab** (per line item, 1..n tests) — "Add Tests to ITP", "Add Tests to ITP (D)":

| Field | Meaning |
|---|---|
| Test Method | FK to the Test Methods register (QA Setup) |
| Freq (norm) | quantity of material per 1 test at normal testing, e.g. 500 = 1 per 500 m² |
| Freq (red) | same at reduced testing; **must be >= Freq (norm)** |
| Lot Freq (N) / Lot Freq (R) | minimum number of tests per lot, normal / reduced |
| Unit | unit the Lot Freq is based on (m, m², m³) |
| Quantity Basis | **Schedule Qty / Lot Length / Lot Area / Lot Volume** |
| Compliance | free rich text — the acceptance criteria the tester and reviewer read (e.g. ">= 95% MDD") |

An approved ITP is locked: "If the ITP is Approved (indicated by a green status), you must Unapprove it
before adding, editing, or deleting tests" ("Add Tests to ITP").

**Grid / UX affordances**: named saved Views (`ITP`, `QVC`, `ALL`, `Approval`, plus user-created — the video
author keeps a `default` and a `tablet` view); column chooser drag-drop; saved filters travel with the view;
`Format Selected` bulk-applies font family/size/colour across chosen fields (Reference Text, ITP Description,
QVC text, Test Compliance) — recommended value is literally "Segoe UI, 9"; Desktop requires an
`Enable Editing` toggle before any cell edit, plus `Enable fill up/down` for arrow-key row traversal;
**Custom Registers** add tenant-defined columns to the ITP (and hence checklist).

### 1.2 ITP import formats

Six ingestion paths:

1. **Import from Clipboard** — paste a selection straight out of Excel ("Import ITP from CSV files", step 6a).
2. **Import from CSV file** — drag-drop or file picker. Recommended save format is **CSV UTF-8 (delimited)**;
   the desktop video shows clipboard import mangling characters that CSV-UTF8 fixes.
3. **Import from XLSX Template** — CivilPro's own downloadable workbook. Explicitly warns it "will NOT work
   for a non-template Excel file and may cause unexpected results".
4. **CPX import** (Desktop only) — CivilPro's hierarchical export format, v10 and v11 variants on separate
   toolbar buttons ("Import ITPs from CPX files (D)"). Used for cross-version/cross-database transfer.
5. **Import from Repository** — any project can be flagged a repository; new Cloud tenants are given a seeded
   **REPO** project of ready ITPs. "When you import an ITP from the repository, the associated Test Method
   will also be imported" ("Import ITP from existing projects in CivilPro (Repository)").
6. Manual line-by-line entry (`+ New Inspection Item`), which the KB recommends when formatting matters.

**Import wizard mechanics**: after load, every source column heading is mapped by dropdown to a CivilPro
field — ITP Description, Reference Text, Clause, Inspection Method, Records, Responsibility, and a
`Unique ID` column that exists purely for **export → edit → re-import round-trips**. "First row as header"
option in Desktop.

**Documented import limitations** ("Import ITP from CSV files", both import videos):

- Word and PDF cannot be imported at all.
- Merged cells break the import; the user must un-merge in Excel first.
- Multi-line cells explode into one ITP row per bullet unless manually consolidated (Ctrl+X / Alt+Enter /
  paste, per row) before import.
- Rich formatting (lists, bolding, line breaks) is lost; lists must be re-applied per row in CivilPro.
- **`Item Type` defaults to Quality and `Hold Point & Witness Point check` defaults to Check Item on every
  imported row** — the two most important fields are never imported and must be set by hand per row.

### 1.3 AI-assisted ITP conversion (the notable one)

"Converting ITPs to CivilPro Format using AI" (updated **2026-08-04**) ships a ~2,000-word production prompt
for ChatGPT/Claude/Copilot/Gemini. Mechanics worth reading closely:

- **Two-phase protocol.** Phase 1 the model must list every ITP found, propose a column mapping table, state
  how it read the notation legend, give expected Hold/Witness/Check counts, and **stop for confirmation**.
  Phase 2 emits one CSV per ITP in its own code block, header row first, no prose inside the block.
- **Notation derivation**: `H/HP/Hold` → Hold Point; `W/WP/Witness` → Witness Point; `S/R/I/M/V`, review,
  surveillance, monitor, record, bare tick, or nothing → Check Item. **"the most restrictive wins: Hold beats
  Witness beats everything else"**. Suffixes/role labels (`HP1`, `H(C)`, `H PM`) → read the leading letter.
- **Flag derivation**: Hold Point → Inspect/Verify/Approve = TRUE/TRUE/TRUE; Witness Point → TRUE/TRUE/TRUE;
  Check Item → TRUE/FALSE/FALSE. Literal `TRUE`/`FALSE` in caps.
- **Check Type is a magic-string trap**: "accepts EXACTLY these values… Any other value – including the word
  'Check' on its own – imports as blank. Never abbreviate."
- **HTML is the wire format**: Reference Text and Description render HTML; Clause/Records/Inspection Method do
  not. Rules mandate `<b>`, `<u>`, `<br>` emitted by the LLM, `<br>` for every source line break, a
  standardised `Max Lot Size:` / `Frequency:` block appended to Description.
- **Item Type keyword classifier**, checked in order: Environmental → Safety → Community → Quality (default).
- **Heading rows**: Description wrapped in bold, Item Type = Heading, Check Type blank, all flags FALSE.
- **ASCII-only rule** with named Word-extraction corruptions ("250C in extracted text is usually 25 deg C").
- **Skip list**: legend tables, document-control footers, title blocks, revision tables, blank sign-off rows;
  the model must report what it skipped.
- Operational instructions: save via Notepad ("All Files"), **"Do not re-save the file in Excel before
  importing"** because Excel strips the quoting.

An earlier, cruder version of the same prompt is embedded in both import video articles (2026-02-23).

### 1.4 ITP approval and revision control

**ITP-level approval flag** ("Set ITP for Client Approval (D)", "Submit ITP for Client Approval"):
`Set/View Selected ITP Approval` records `ITP Approved by` + `ITP Approved Date` (default: current user,
today). Approved ITP renders **green** in the register; unapproved renders white. `Unapprove selected ITPs`
reverses it. **Project Settings can block unapproved ITPs from being attached to Lots** — "CivilPro has
mechanisms to prevent unapproved ITPs from being used on Lots".

**Two client-approval routes** ("Submit ITP for Client Approval" + transcript "Obtaining Approval of ITPs"):

- *Digital (Notify Selection)* — select ITP → Notify Selection wizard (Notice To / CC / Attachments / Date
  Required → template-driven Subject+Message → Publish & Send). Client clicks the emailed link, lands in a
  client view of the ITP, can switch the view to see it as a checklist, then right-click → `Set Selected ITP
  Approval`. Requires the client role to hold **`ITP Approve Internal`**.
- *Manual PDF + Independent Approval* — print three PDFs (ITP, Checklist, **Hold Point / Witness Point
  register**), attach them to an Independent Approval, client replies with **Logs** carrying marked-up PDFs,
  contractor revises and re-logs, client finally `Action Step > Approve`; contractor then records the ITP
  approval citing the approval number. The transcript is candid: this "does mean… a disconnect between those
  PDF versions of the ITPs and the actual ITPs within CivilPro".

**Revision Manager** ("Manage Inspection Test Plan (ITP) Revisions"):
`New Revision` (auto-increments the version), `Approve Revision`, `Activate Revision` (**only one revision
active at a time**, shown by a `Date Activated` column), `Move Selection to Revision` (fold a duplicated ITP
into another ITP's revision history — a de-duplication tool), `Move to Own ITP` (promote a revision out to a
standalone ITP; doing so activates it), `View Selected ITP Approval`.
"You cannot update or change an approved ITP, as any changes are reflected in the new revision and the
previous version will be preserved as a revision copy."

### 1.5 Checklist lifecycle

**Creation**: attaching an ITP to a Lot creates a Checklist — explicitly "a **carbon-copy** of the ITP… for
that Lot" ("Check and Verify Inspection Points"). It is a point-in-time snapshot.
**Master-ITP edits do not propagate**: "it won't automatically update the checklists that have already been
applied to lots… if you deploy it to a lot, you find that there's an error on it, just unlink it from that
lot, make the changes to the ITP, and then redeploy" (desktop import transcript).

**Per-row completion**: Check box, Verify box, Approve box — each rendered only if the corresponding
Inspect/Verify/Authority Required flag was set on the ITP. A row is complete only when *all* its rendered
boxes are ticked; complete rows go green. Desktop supports Ctrl+multi-select then `Check selected` /
`Verify selected`.
**`Mark N/A`** via right-click — requires the `Checklist Edit` permission.
**Row `Comment` field** — the KB is emphatic that it is internal: "Nothing is notified when you add one…
If you need your Client or Superintendent to see and respond, it should go through the Approval instead".

**Evidence attachment per row** (Related Items / chain icon):
- Photos: `+` upload, chain-link from the Photo Register, or **Camera icon** (opens the device camera on
  mobile). Bidirectional — the photo also lands in the project Photo Register.
- Filestore Documents: `+` upload / drag-drop, or link an existing file. Broken-chain icon to unlink.
- Bulk photo path: Photos register → **Quick Upload QR** → scan with phone → upload batch → bulk-assign to
  Lots or Site Diaries ("Using CivilPro in the Field (Tablet / Mobile)").

**Two checklist report formats** ("Check and Verify Inspection Points"):
- *Electronic Checklist* — current digital state, for distribution/record-keeping.
- *Field Complete Checklist* — printable, and it is the **only** one carrying signature blocks for the
  **Responsible Officer** and **Verifying Authority**. Workflow: print, complete with a pen on site, scan,
  link to the Lot filestore, and it flows into the Lot Summary report.

**ITP Progress Matrix** ("Monitor Checklist Progress Using the ITP Progress Matrix (D)") — **Desktop V12
only**. Pick an ITP + revision, filter by `Unconformed Only` / `HP` / `WP` / `Check`, hit `Get Status Matrix`,
and get a lots × inspection-points grid with a numbered column key beneath and clickable links into the
approvals. This is CivilPro's only cross-lot QA rollup surfaced in these articles.

### 1.6 Hold / Witness points and the approvals model

**Workflows** are project-level objects configured in QA Setup ("Create Basic Workflows for Approvals",
referenced throughout). `Import basic workflows` loads "industry standard workflows suitable for the
construction industry" with separate workflows for Hold Point, Witness Point and Check items. The workflow
defines the steps, the actions available to the approver, and the default `Days until due`.
**The workflow dropdown filters on the row's Check Type** — a row typed as Check Item shows an empty dropdown
when you try to raise a Hold Point. This is the #1 FAQ in *both* the web and desktop articles, and the fix
requires editing the checklist row **and** the master ITP.

**Raising** ("Request Approval for an Inspection"): right-click a checklist row (or select + `Action on
Selection`) → Request Approval. Fields: `Workflow`, `Days until due`, `Addressees` (defaults to filtering
only users who can approve; unticking `Show only users that can approve` adds subscription admins not linked
to the project and inactive users), **Groups** as addressees, `CC`, `Attachments` (from computer or Filestore).
**Approvals are created one per inspection item** — no multi-row raise.

Two send paths:
- `Create Approval` → status **Not started**, nothing emailed; lets the requester edit `Subject Text` and
  `Approval Text` and add attachments, then `Start Workflow` → `Start Workflow (Preview)` or
  `Start Workflow (Send)`.
- `Start & Notify` → immediate.

Status becomes **Requested**; the checklist Approve box shows a **`?`**; a tick appears once approved.

**Approver actions** ("Action Inspection Approval Requests (by the Approvers)") — approver clicks the email
link, lands on the Approval, reviews linked Filestore docs/photos, clicks `Action Step`:

| Action | Effect |
|---|---|
| Approve | releases the point outright; name, date, attachments recorded |
| Conditionally Approve | work continues pending closeout (e.g. 28-day test); reveals `Days to Complete Next Step`; **comments mandatory, minimum 25 characters** |
| Rejected | back to contractor; same `Days to Complete Next Step` + **25-char minimum comment** |
| Request NCR | raises a non-conformance against the work **without leaving the approval** |
| Other Approval | any extra configured workflow step |

A `Status after Action` field previews where it lands. `Action (Send)` emails the requester, updates status,
and writes a timestamped entry to **Action Logs**. Both parties get confirmation email.
**Batch actioning**: in the Approvals register, select several approvals on the same workflow at the same
actionable status and apply one action — pitched for "a run of Hold Points along one trench, or several proof
rolls covered by the one visit".
**Group addressee semantics**: everyone in the group is notified and **the first to action it releases the item**.

**QR Quick Approval** ("Generate Quick Approval using QR Code", "Release Hold Points using a QR Code Onsite"):
requester on a phone/tablet long-presses the Approval box (or Action on Selection) → `Quick Approval` → a QR
code renders on their screen → the approver scans it with their **camera app** (explicitly "not a QR reader
app"), signs in, and sees a stripped screen: checklist text, comments box, single **Approve** button.
Design constraints the KB spells out:
- **The only option is Approve.** No conditional, no reject, no thread. If the approver might want to
  conditionally approve, you must raise a normal approval instead.
- **Quick Approvals do not appear in the Approvals Register.** Traceability is instead: approver name+date
  stored against the checklist line item, a notification under Related Items, and approver name+date printed
  on the checklist inside the Lot Summary report.
- Requires the `Approval Collaborate HPWP` role permission.
- An already-raised approval can also be released by QR: open the Approval → `Show QR Code`.

**Independent Approvals** ("Create an Independent Approval"): standalone approval raised from the Approval
Register, not tied to any register item — "**It replaces the pre-V11 Authority to Proceed**". Optional
**Independent Approval Templates** live under `Other Setup > Approval & Notification Templates` with
`Template Type = Approval Independent`, a Subject and a rich-text Body, a `Default Type` flag and an
`Inactive Template` flag. No merge fields. Created at Not started; nothing sends until `Start Workflow`.
Typical actions: Approve / Conditionally Approve / Reject, plus `Resubmit for Approval` after amendment.

**Standing Approvals** ("Create and Link Standing Approvals to ITP", "Update Checklist based on Standing
Approval", transcript "One Approval, Multiple Checklists"): link an existing approval (usually an Independent
Approval carrying, say, a concrete mix design) to an **ITP inspection item's** `Standing Approvals` slot.
Thereafter every checklist generated from that ITP auto-links that approval to that row, visible in the row's
Related Items. Named use cases: construction procedures, concrete mix designs, supplier approvals, quarry
registration certificates, material source approvals.
**Critical limitation, stated plainly**: "It won't automatically release the hold point when this is deployed
as a checklist… at least it'll be there to quickly reference." Each checklist row still needs
`Set Manual Approval` (fields: related `Approved Lot`, `Approval Reason` free text) by an authorised user,
who **types the approval number into the reason text by hand** ("albeit through writing the approval number
124"). The linkage is a bookmark, not automation.

**Approval administration**:
- `Change an Approver` — must `Administration > Make Private`, edit the Approvers field, `Make Public`, then
  manually `Send Notification`.
- `Reassign an Approval to a new Requester` — Operations > Reassign Requester; new requester needs the
  request-approval permission or they don't appear in the picker.
- **`Short Circuit an Approval`** — revert to a previous workflow status. Options: *Revert to unstarted*,
  *Set to first step*, *Set to a specific step* (+ New status, Days to complete next step, Comment,
  Attachments). The KB actively steers away from deletion: "Although you can delete approvals (which will
  then re-set the checklist), this is not recommended as it means that you will lose the audit trail…
  Using the 'short circuit' function maintains the transparency of the approval rectification process."
  Short-circuiting re-fires the approver's email.

### 1.7 Test register

**Setup objects**: `Test Methods` register (QA Setup) — method code + description, and per-method
**Test Result Fields** (`Result Name` + `Result Unit`, e.g. FMC / %, DDR / %) which define the structured
result columns ("Update Test Result Fields"). `Test Properties` — reusable pre-set property groups attachable
to a Test Request "for reference for the testing laboratory, or for reference when reviewing test results".
Common test methods ship in the REPO project.

**Test Request fields** ("Create a Test Request", "Create a Test Request (D)"):
`Lot Tested`, `Test Req. To` (tester user), `Date Required` (+ `Time Required` in Desktop), `Description`,
Test Request Number (auto or manual), `Test Reason`, `Notes`.
**Geometry**: `Chainage` (Control Line + chainage + offset — auto-inherited from the Lot), `Coordinate
Position`, `Coordinate Region` (lat/long, map zoom), or `No Geometry`; plus `Depth` and `Level Reference`.
**Method of Location**: `Tester Locates` / **`Random Stratified Testing`** / `Location Specified`. Random
Stratified takes a `Resolution` integer and "the system will randomly select the locations based on the
Control Line with the chainage and offset provided", computing **Longitudinal / Lateral / Depth** positions —
i.e. X along the control line (chainage) and Y as offset from centreline (per the tester transcript).
**Tests block**: `Test Method` (dropdown from Test Methods register; Desktop also offers **`Retrieve from
ITP`** to pull the method straight off the ITP), `Schedule Item` (draws a quantity off the project Schedule),
`Number of Tests`, `Compliance`. Multiple test methods per request; a filter to show only selected methods.
`Material Source` details. Test Properties attached last.

**Test Request generated from a Checklist line** ("Create a Test Request from a Checklist") — the standout
mechanic:
1. Right-click the checklist row (`Has Tests` ticked) → `New Test Request`. Lot number and geometry
   (chainage/offset, **Lot Area e.g. 2,600 m²**) auto-pull.
2. `Add Tests from ITP` → "Retrieve from ITP" window listing the test methods linked to that row.
3. Scope filter: **Checklist Line / Checklist / Lot** — pull tests for the one row, the whole checklist, or
   everything on the lot.
4. `Select Quantity` dropdown (e.g. *Lot area: 2600*) → `Assign to Selected`, or set each row individually.
5. System computes **`Tests this req` = quantity ÷ frequency**, and **honours the ITP minimum-per-lot floor**:
   "if a calculation results in 2 tests but the ITP requires a minimum of 4, the system will set the count to 4."
6. Disclaimer: "Always verify the calculated number of tests… CivilPro cannot provide any guarantees or
   warranties resulting from use of the information contained."

**Notification is a separate, manual, easily-missed step** ("Notify/Email Tester", "Notify Tester (D)"):
"IMPORTANT: The Test Request has NOT been sent to the Tester." Dialog: Mail To (tester), CC, Attachments,
Subject, Message. **A PDF cover sheet of the Test Request is auto-attached**, carrying the itemised tests and
the compliance targets. Tester clicks the Test Request number hyperlink in the email to sign in. Email Logs
are visible under Related Items.

**Tester side** (transcript "Responding to Test or Survey Requests"): the tester's Test Requests register
shows only requests involving them. They run the test externally, produce a PDF, return via the email link or
the register, `Action on Selection > Notify Result`, `+` attachments, drag the PDF in, Next, `Publish & Send`.
Result-notification fields ("Notify Result (for Test Request)"): Notice Date, Notice From, Notice To, CC,
Attachments, Date Required, plus non-editable `Publish Date` and `Progress`. Message editor supports inserted
tables and hyperlinks.

**Structured results**: on the Test Request, the canister icon opens a grid whose **row count equals the
number of tests requested**, with columns from the method's Test Result Fields ("Update Test Result Fields").
Conformance is a manual `conforms` flag, then right-click **`Mark Complete`** → row goes green with a tick in
the Complete column.

**Result visibility gate** (transcript "Review Test Results Before Making Public"; noted in "Create a Test
Request" and "Notify Result (for Test Request)"): the role Authority tab has
**`Limit Test Request View to Completed`**. Applied to an external role (client rep / project administrator),
that role cannot see a Test Request *or its results* until the request is marked Complete. The documented
purpose is to let the contractor receive a non-conforming result, remediate, obtain a compliant retest, and
only then expose the request to the client.

### 1.8 Survey requests

Parallel register ("Create a Survey Request", "(D)" variant, "Notify Surveyor", "Notify Result (for Survey
Request)"). Fields: `Survey Type` (dropdown), `Request To` (surveyor user — must be pre-invited by an admin),
`Date Required`, `Description`, `Raised By` + `Date Requested` (auto), **one or more linked Lots**, geometry
via `Update Geometry from Lots` or manual entry, **tolerance levels** + commentary, notes.
Gotcha stated twice: "the documents attached here **will not be sent to the surveyor** and can be viewed only
when they log in to CivilPro". Notify Surveyor is again a separate manual step.
Surveyor response: `Result Sets` tab → `New Result Set` (Description) → `New Survey Result` rows with
**Coordinates, Non Compliance, Comment** → `Notify Result` back to the requester.

### 1.9 Conformance report + digital signatures

Transcript "Using Digital Signatures for Conformance Reports":

- The **Lot Conformance Report** is the first document inside the **Lot Summary** (which also carries the
  checklists, test results, scanned field checklists and other linked records).
- **Handover gates**: `Project Settings > Handover > New Handover`. Each gate = a **source/trigger** + a
  **status** + **sign-off text**. Demonstrated triggers: Lot status reaches `Conformed` (a fixed status, so no
  status picker) and a **Lot Review Status** reaches a configured value (e.g. "administrator reviewed and
  approved" / "client reviewed and approved"). Lot review statuses are role-restricted — the client-only
  status is what pulls the client's signature onto the contractor's report.
- Signatures are **real cryptographic PDF signatures**, not images: "not just an image. They are a secure,
  verifiable digital signature that's embedded within the PDF." Without an uploaded signature image
  (`user Settings > Upload Signature`) you still get the user's name plus the digital verification.
- **Signatures are reactive and revocable**: "if the lot is now unconformed or the conformance is removed
  that signature will no longer apply for any lot summaries that are produced thereafter. Similarly if that
  lot review status is changed… This signature will be removed."
- To embed the *signed* conformance report in a Lot Summary you must tick **`Sign Conformance`** before
  PDF/download. Alternative outputs: **Folio** (a Windows folder structure of all lot documentation) or save
  the Lot Summary back into the Lot's filestore.

---

## 2. UX flows, step by step

**A. Word/Excel ITP → working checklist (the "official" path, per both import videos)**
1. New ITP in CivilPro (Description, ITP Doc No). 2. Open the Word ITP, select the table, copy. 3. Paste into
a blank Excel sheet. 4. `Merge & Center` off — un-merge everything. 5. For every activity, manually
Ctrl+X each continuation row and Alt+Enter-paste it into the cell above so one activity = one row.
6. Select all → set font to Arial (kills symbol artifacts). 7. Save As → **CSV UTF-8 (delimited)**.
8. In CivilPro: `Import Specification Details` → Import from CSV (or clipboard, or XLSX template).
9. Map every column heading to a CivilPro field. Import. 10. Build a working View exposing Item Type, Check
Type, Inspect/Verify/Authority. 11. Walk every row setting `Item Type` (find the Headings). 12. Walk every
row again setting `Hold Point & Witness Point check` — alt-tabbing to the source ITP. 13. Walk every row a
third time toggling Inspect/Verify/Authority Required. 14. Open each row's rich-text editor to delete the
mangled imported bullets and re-apply lists. 15. Add tests to the rows that need them (method, freqs, min per
lot, unit, quantity basis, compliance). 16. `Format Selected` across all rows to normalise font to Segoe UI 9.
17. Save. 18. From the Lot register, select a Lot → Related Items → Checklists → pick the ITP → `+`.

**B. AI-assisted variant** ("Converting ITPs to CivilPro Format using AI"): paste the shipped prompt into
ChatGPT/Claude, attach the .docx/.xlsx, review the Phase-1 mapping and HP/WP counts, confirm, copy each CSV
code block into Notepad, Save As with `.csv` and type "All Files", **do not open it in Excel**, then import.
Steps 11–13 above collapse into the model's Check Type derivation.

**C. Complete a checklist on site (mobile browser)** — "Using CivilPro in the Field", "Check and Verify
Inspection Points": navigate to the same URL as desktop → project → `Quality Assurance > Checklists` (search
by Lot Description, Raised By, Control Line) → open → tick Check / Verify per row → row comment for
instrument/observed value → select row → chain icon → Camera / `+` / link for photos and documents →
right-click `Mark N/A` for irrelevant rows → Save. Print `Field Complete Checklist` for wet-ink where required.

**D. Raise and release a Hold Point** — right-click row → `Request Approval` → Workflow (`Hold Point Workflow
- Default`), Days until due, Addressee(s)/Group, CC, Attachments → `Start & Notify` (or `Create Approval`,
edit the Approval Text, then `Start Workflow (Preview|Send)`). Checklist shows `?`. Approver receives email →
link → Approval screen → chain icon to review evidence → `Action Step` → Approve / Conditionally Approve /
Rejected / Request NCR (+ comments, 25-char minimum on the latter two) → `Action (Send)`. Requester emailed,
Action Log written, checklist Approve box ticks green.

**E. QR release on site** — requester (iPad) opens checklist → selects the HP row → `Action on Selection` →
`Quick Approval` → QR renders → approver scans with camera → signs in → single-screen Approve. Done in
seconds; no Approvals register record created.

**F. One approval covering many lots (independent + standing)** — Approvals → `New Independent Approval` →
workflow + principal's rep → Preview → write subject/approval text explaining that this approval will be
re-used across checklists → Related Items → Filestore → drag in the mix design → tick "include as attachment"
so it rides the email → `Start Workflow (Send)`. Approver reviews, `Action Step > Approve`. Back on the
checklist row: Related Items → Approvals → pick the approved item → Save (this only *references* it) →
right-click → `Set Manual Approval` → Approved Lot + Approval Reason quoting the approval number → row
releases. Then on the **master ITP** row: Related Items → `Standing Approvals` → `+` → pick the approval →
Save. Every future checklist off that ITP shows the approval pre-linked on that row — but each still needs
its own `Set Manual Approval`.

**G. Test request from a checklist to results in the conformance report** — checklist row (`Has Tests`) →
right-click `New Test Request` → tester, description, geometry auto-filled → `Add Tests from ITP` → scope
filter `Checklist Line` → `Select Quantity` (Lot area 2600) → `Assign to Selected` → system computes counts
against ITP frequency + minimum → Save → **`Notify Tester`** (separate step) → tester gets email + auto-
attached TR PDF cover sheet → tester runs test, returns to TR, `Notify Result`, attaches result PDF,
`Publish & Send` → engineer enters structured result field values per sample row → flags `conforms` →
right-click `Mark Complete` → (only now visible to roles carrying `Limit Test Request View to Completed`) →
results flow into the Lot Conformance Report / Lot Summary.

**H. Sign-off** — engineer sets Lot status `Conformed` → handover gate fires, contractor's signature embeds
in the conformance PDF. Client opens the lot, right-click → `Add Review` → "client reviewed and approved" →
second gate fires, client's signature embeds. Contractor produces the Lot Summary with `Sign Conformance`
ticked → PDF/download, or Folio export, or save to the lot's filestore.

---

## 3. Terminology and data model

**Registers** (CivilPro's word for tables/list views): Lot, Specifications/ITP, Inspection Items, Checklist,
Approval, Test Request, Survey Request, Test Method, Test Property, Photo, Filestore Document, Notification /
Email Log, Schedule, Control Line, Custom Register.

**Vocabulary worth knowing** (some of it is AU-civil idiom, some is CivilPro-specific):

| Term | Meaning |
|---|---|
| ITP / Specification | the template. Desktop calls the register "Specifications (ITP)" |
| Inspection Item | a row of the ITP |
| Checklist | the per-Lot carbon copy of an ITP |
| QVC | Quality Verification Checklist; `QVC Doc No`, `AltQvcText`, `Diff QVC text` |
| Check Type / "Hold Point and Witness Point check" | Check Item, Witness Point, Hold Point, **Milestone** |
| Item Type | Quality, Safety, Environmental, Community, Heading |
| "Raising a Hold Point" | creating an Approval from a checklist row |
| "Release" | approving that Approval |
| Authority Required | flag that renders the Approve box |
| Verifying Authority / Responsible Officer | the two signature blocks on the Field Complete Checklist |
| Independent Approval | approval not bound to a register item; replaces pre-V11 "Authority to Proceed" |
| Standing Approval | an approval linked to an ITP row, inherited by future checklists |
| Short Circuit | revert an approval to a previous workflow status, audit trail intact |
| Quick Approval | QR-code single-button on-site release, no register record |
| Repository / REPO | a project flagged as a template source; new tenants get a seeded REPO project |
| Associate User | externally-invited user (tester, surveyor, client rep) |
| Random Stratified Testing | system-generated random test positions within the lot from the control line |
| Folio | export of a lot's documents as a Windows folder tree |
| Handover gate | lot-status trigger that embeds a digital signature in the conformance report |
| CPX | CivilPro's hierarchical export/import file format (v10 / v11) |

**Relationships as evidenced**:

```
Project
 ├─ ITP ──1:n─ InspectionItem ──1:n─ Test {method, freqN, freqR, lotFreqN, lotFreqR, unit,
 │    │                                    quantityBasis, compliance}
 │    ├─ Revisions (n, exactly one Active; Approve + Activate are separate acts)
 │    ├─ ITPApproval {approvedBy, approvedDate}  → green/white gate on lot attachment
 │    └─ InspectionItem ──n:1─ StandingApproval → Approval
 ├─ Lot {status, reviewStatus, geometry: controlLine+chainage+offset | coords, length/area/volume}
 │    ├─ Checklist  (= snapshot copy of one ITP, immutable w.r.t. template edits)
 │    │    └─ ChecklistItem {check, verify, approve, comment, N/A}
 │    │         ├─ Photos (n)  ↔ Photo Register
 │    │         ├─ FilestoreDocs (n) ↔ Filestore Register
 │    │         ├─ Approval (0..1 live) | ManualApproval {approvedLot, reason}
 │    │         └─ TestRequests (n)
 │    ├─ TestRequest {geometry, methodOfLocation, resolution, materialSource, reason}
 │    │    └─ Test {method, scheduleItem, count, compliance}
 │    │         └─ ResultRow[count] × TestResultField{name, unit}, conforms flag, Complete flag
 │    ├─ SurveyRequest ──1:n─ ResultSet ──1:n─ SurveyResult {coords, nonCompliance, comment}
 │    └─ LotSummary → ConformanceReport (+ handover-gate digital signatures)
 └─ Approval {workflow, requester, approvers[], CC, status, dueDays, subjectText, approvalText,
              attachments, ActionLogs[]}
```

**Permissions seen by name**: `Checklist Edit`, `ITP Approve Internal`, `Approval Collaborate HPWP`,
`Limit Test Request View to Completed` — all on a Role's **Authority** tab, administered by a Subscription
Administrator. Users can self-inspect via profile → `My Permissions`.

---

## 4. Strengths worth stealing

1. **ITP-embedded test frequencies with a minimum-per-lot floor, auto-calculated against lot geometry.**
   `quantity basis` (Lot Length/Area/Volume/Schedule Qty) ÷ `Freq (norm)`, floored at `Lot Freq (N)`. This is
   the single most valuable mechanic in the whole corpus and it *needs* the spatial data SiteProof already
   has. Normal vs reduced frequency pairs match how AU specs actually write testing regimes.
2. **Compliance text carried from ITP → checklist row → test request PDF → result review.** The inspector on
   site sees the acceptance criteria without opening the spec. Cheap to build, high perceived value.
3. **Standing approvals as a concept** (mix designs, quarry approvals, supplier approvals approved once,
   referenced by many lots). CivilPro's execution is half-manual — see §5.6 — which is exactly the gap.
4. **QR quick-release for hold points.** The superintendent is standing next to you; email round-trips are
   absurd. Their design note about the deliberate single-button scope is worth copying too.
5. **`Limit Test Request View to Completed`.** A contractor-side remediate-before-exposure toggle, documented
   openly. Commercially potent and clearly demanded ("We commonly get asked…").
6. **Electronic vs Field Complete checklist split** — signature blocks appear only on the paper version, and
   the scan-back-in loop is documented so the wet-ink sheet ends up in the Lot Summary.
7. **AltQvcText** — exhaustive wording on the ITP document, short wording on the phone, with a diff indicator
   and a revert action. Solves a real field-usability problem cheaply.
8. **Approver action set**: Approve / Conditionally Approve / Reject / **Request NCR from inside the
   approval**, with a mandatory 25-character comment on conditional and reject. The NCR shortcut closes the
   loop into SiteProof's existing NCR module.
9. **Short Circuit over delete**, with the rationale documented. Audit-preserving reversal is a trust feature.
10. **Group addressees with first-to-action-wins release**, plus approver-side batch action on
    same-workflow/same-status approvals.
11. **Handover gates**: lot status / lot review status transitions auto-embed cryptographic PDF signatures,
    and un-conforming the lot **revokes** them from future exports. Status-driven signing beats a signature
    button.
12. **The published AI conversion prompt as a migration weapon.** Whatever else, it drives switching cost
    toward zero. SiteProof should out-execute it (see §5.1), not ignore it.
13. **Repository / seeded REPO project** for new tenants, and cross-project ITP import that drags the
    associated Test Methods along.
14. **ITP Progress Matrix** — lots × inspection points, filterable to HP/WP/Check and "unconformed only".
    A portfolio-level QA view CivilPro only ships on Desktop; shipping it on web/mobile is an easy win.
15. **Checklist as an immutable snapshot** of the ITP — issued QA records don't mutate when someone edits a
    template. Correct default.
16. **`Unique ID` column enabling export → bulk edit → re-import** round trips.
17. **Random Stratified Testing** with a resolution parameter producing longitudinal/lateral/depth sample
    positions from the control line. Real sampling design, not a form field.

## 5. Weaknesses and gaps we can exploit

1. **The importer is the product's soft underbelly, and they've conceded it.** The official 2026 guidance is:
   un-merge cells by hand, manually Alt+Enter every multi-line cell, save as CSV UTF-8, map columns, then
   *manually set Item Type and Check Type on every single row* because both default to Quality/Check Item.
   Their own escape hatch is a 2,000-word prompt telling the customer to paste their ITP into ChatGPT and
   save the output **in Notepad**, with a warning never to open the file in Excel. **Opening for SiteProof:**
   server-side ingest of .docx/.xlsx/.pdf, LLM-derived Check Type / Item Type / flags / frequencies, and a
   reviewable diff screen before commit. No CSV, no Notepad, no per-row retyping. This alone is a migration
   pitch to every CivilPro customer with legacy ITPs.
2. **Magic-string fragility**: `Check` instead of `Check Item` imports as **blank, silently**. Any structured
   import we build should reject-and-report rather than silently blank a hold-point type.
3. **Two apps, uneven capability.** Desktop-only: ITP Progress Matrix (V12), CPX import, `Retrieve from ITP`
   on a test request ("At the moment, this feature is available only on CivilPro Desktop"), the inbuilt lot
   quantity calculator. The web ITP grid is admitted to be "a little bit more clunky than editing in the
   desktop application". A single modern web+mobile codebase is a straightforward differentiator.
4. **Rich text is the data model.** Hold Point status lives in a structured field *and* is duplicated as bold/
   underlined HTML inside Reference Text. Users are told to normalise fonts by hand (`Format Selected`,
   "Segoe UI, 9"). Formatting artifacts from import require opening a rich-text editor per row. Structured
   fields + a rendered document beats HTML-in-a-cell.
5. **No template→checklist update path.** Fixing a wrong row on a deployed checklist means unlink the
   checklist from the lot, edit the ITP, relink — losing in-flight work. There's no divergence indicator, no
   "apply this template change to open checklists", no per-row patch. A safe, opt-in propagation with a
   diff preview is genuinely valuable and CivilPro cannot easily retrofit it.
6. **Standing approvals don't release anything.** Every inherited row still needs a manual `Set Manual
   Approval` where the user *types the approval number into a free-text reason field*. So the "one approval,
   many checklists" promise still costs one manual action per lot, with the traceability link stored as prose.
   **Ship the real version**: linked standing approval auto-satisfies the row, reference stored structurally,
   auto-revoked if the underlying approval is withdrawn or expires (mix designs and quarry registrations
   have expiry dates — nothing in the corpus tracks that).
7. **Requester-side raising is strictly one approval per inspection item.** The approver can batch; the
   contractor cannot. Ten hold points along a trench = ten separate raises. Multi-select raise, and a
   "release everything on this lot the super witnessed today" flow, are open ground.
8. **"You must remember to notify" is a documented failure mode across three registers** — Test Requests
   ("IMPORTANT: The Test Request has NOT been sent"), Survey Requests (stated twice), and the Create-Approval
   path. Multiple KB articles exist solely to tell users to press send. Created-but-never-sent is the default
   state. SiteProof should make send the default and drafting the exception, and surface an "unsent requests"
   count.
9. **Survey request attachments never reach the surveyor** — visible only after they log in. Pointless
   friction for an external party.
10. **Every external party needs a CivilPro account first.** Testers, surveyors and clients must be invited
    as Users/Associate Users by an admin before they can even be selected as an addressee — repeated as a
    prerequisite in ~8 articles, and the transcript notes "if you don't see the person available to select in
    here it may mean that they haven't been invited". No signed-token response link for a one-off lab or
    surveyor. Given SiteProof's subbie-free / HC-pays model, frictionless external response is a natural moat.
11. **Row comments notify nobody**, and the KB has to warn users about it in bold — evidence of real-world
    confusion, and of the gap between "I wrote it down" and "someone will see it".
12. **The empty-workflow-dropdown FAQ appears in both the web and desktop articles**, and the fix requires
    editing *both* the checklist row and the master ITP. Bad defaulting turned into documentation.
13. **QR Quick Approval's traceability is thin and scattered** — no Approvals register record, approve-only,
    evidence split across the line item, a Related Items notification, and the printed Lot Summary. A
    hold-point release that isn't in the approvals register is a weak spot in an evidence pack; SiteProof can
    ship on-the-spot release *and* a first-class immutable record.
14. **Configuration burden pushed onto users.** Custom register columns don't appear in anyone else's default
    view; the KB repeatedly instructs each user to drag columns, save a personal view, save a tablet view, and
    "make sure your view is not filtered" (a troubleshooting step in four separate articles). Role-tailored
    default views — which SiteProof is already building — directly answer this.
15. **Approval admin is gymnastics**: changing an approver is Make Private → remove → add → Make Public →
    manually re-notify.
16. **Nothing anywhere is offline.** The entire mobile story is "CivilPro runs in a mobile browser". Photos,
    checklists, QR release and test requests all assume live connectivity — in an industry that works in
    cuttings and rural corridors. SiteProof's offline work is a defensible wedge and should be marketed as one.
17. **Compliance is free rich text, so nothing can be evaluated automatically.** Test results have structured
    fields (name + unit) but conformance is a human tick. No auto pass/fail against the ITP compliance
    criteria, no trending, no statistical lot assessment (characteristic value / CV of a lot), which is a
    named requirement in AU earthworks and pavement specs. Structured acceptance criteria + auto-evaluation is
    a large, credible product gap.
18. **The test-count calculator disclaims itself** — "CivilPro cannot provide any guarantees or warranties…
    Always verify". A calculator the vendor won't stand behind is a calculator you can beat.
19. **No spatial hold-point or test view.** Test requests carry chainage/offset/lat-long and random stratified
    positions, and survey results carry coordinates — but nothing in this corpus renders open hold points,
    pending tests or non-conformances on a map or chainage strip. All that geometry goes in and never comes
    back out visually. **This is the direct hook for SiteProof's spatial lot map**: same data, a modality
    CivilPro doesn't offer for QA state.
20. **Notification model is email + register**, with one passing mention of in-app notifications. No task
    inbox, no "what's waiting on me today" surface appears anywhere in the ITP/HP/test documentation.

## 6. Surprises

1. **The official ITP importer is now a ChatGPT prompt** ("Converting ITPs to CivilPro Format using AI",
   updated 2026-08-04 — days old). And it's *good*: two-phase confirm-before-output, notation-legend
   interpretation, most-restrictive-wins on conflicting party codes, HTML emission rules, ASCII normalisation
   including named Word-extraction corruptions ("250C in extracted text is usually 25 deg C"), skip lists,
   and a reconciliation report. A competitor publicly outsourcing its data ingestion to the customer's LLM is
   both a signal of importer weakness and a genuinely clever GTM move.
2. **`Limit Test Request View to Completed`** — a documented, supported feature whose stated purpose is
   keeping non-conforming test results away from the client until the contractor has remediated. Ships and
   documents what most vendors would leave unsaid.
3. **Random Stratified Testing** generates actual randomised longitudinal/lateral/depth sample positions
   inside a lot from the control line, with a user-set resolution. Far more sophisticated than expected.
4. **Digital signatures are cryptographic and revocable.** Gate-triggered on lot status, and un-conforming a
   lot strips the signature from all subsequently produced reports.
5. **"Milestone" is a fourth inspection point type** alongside Check/Hold/Witness, present in both the UI
   dropdown and the AI prompt's allowed values, but never explained anywhere in the corpus.
6. **A row with no Inspect/Verify/Authority boxes configured counts as complete.** The web import video shows
   rows going green that nobody touched: "We didn't configure these ones down here. And that's why Civil Pro
   thinks those are already closed out." Silent false conformance in an evidence system.
7. **Quick Approval is deliberately absent from the Approvals register**, and the KB writes out the reasoning
   ("by selecting this, we don't expect there to be further actions"). An intentional traceability trade.
8. **`Move Selection to Revision` / `Move to Own ITP`** — bidirectional reorganisation between standalone ITPs
   and revision histories, built to clean up the duplicate-ITP mess real projects accumulate.
9. **Conditional Approve and Reject enforce a 25-character minimum comment.** A small, sharp anti-lazy-
   rejection control.
10. **Group addressees release on first action** — sensible for a superintendent team, quietly powerful.
11. **`Folio` export** — the whole lot's documentation as a Windows folder tree, for handover to clients who
    want files, not a PDF.
12. **Approved ITPs hard-lock**, including blocking test edits, and Project Settings can bar unapproved ITPs
    from being used on lots at all. Strong template governance — stronger than most competitors bother with.
13. **`Included on ITP Report` and `Included on Checklist` are independent toggles**, so a row can exist on
    the issued ITP document but not on the field checklist, or vice versa.
14. **`Request NCR` sits inside the approver's action dropdown** — the client raises the non-conformance from
    within the hold-point response, without navigating anywhere.
