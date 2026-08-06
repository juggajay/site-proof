# CivilPro — Lot Register & QA Register Setup: competitive analysis

Sources: KB bundle `lots-qa-registers.md` (36 articles), transcripts `iQVHGdnsbr0` (Creating Your First Lot) and `TyS6Q1g87gU` (Using Lot Review Status).

Note on citations: CivilPro ships two products — **Cloud/Web** and **Desktop**, and the KB duplicates nearly every article with a `(D)` suffix for Desktop. Where behaviour differs I say so.

---

## 1. Feature inventory (mechanics)

### 1.1 Lot numbering — composed, not sequential

Source: *Work Types*, *Area Codes*, *Add Work Types*, *Add Area Codes*, *Lot Register*.

A Lot Number is **assembled from codes**, not a bare counter:

```
Lot Number = [Work Type: first 2 chars] + [Area Code: first 4 chars] + [sequence]
```

Real examples from the KB: `AAGNRL012`, `EXGNRL001` (*How to Manage Sub Lots*), `ELRWNB001` (*Create a Lot Map (D)*).

- **Work Type** — 2 to 8 characters, but *"by default only the first two characters will be included in your Lot Number"* (*Work Types*). A "2 to 8 character code used by CivilPro to classify the type of work done for a lot." Examples given: SG subgrade, EL electrical, EX excavation, CP concrete pour, AC asphalt pavement.
- **Area Code** — the KB contradicts itself. *Area Codes* (QA Setup, 2023-07-13) and *Add Area Codes (D)* say **"maximum 4 characters"**; *Add Area Codes* (Cloud, 2026-01-22) says **"2-8 characters"** with only *"the first four letters ... included in your Lot Number"*. Examples: MCSB Main Carriageway Southbound, DL13 Drainage Line 13, BRRL Bridge over River Lane, GCBR Gold Creek Bridge.
- Description field on both is up to 500 characters.
- **Escape hatch**: *Create Custom Lot Numbers Using Custom Registers* — referenced from four articles as the only way to deviate from the WT+AC composition.
- A **Tag Code** feature exists in the Lot creation flow but is disabled: *"The Tag Code feature is being reviewed and currently not ready for use"* (*Create Lots*).

**Hard prerequisite**: *"Before you can create Lots, you will need to set up your Work Type and Area Code registers as the minimum required details for your Lot"* (*Create Lots*, *Create Lots (D)*). You cannot create a lot on a virgin project.

### 1.2 QA setup dependency chain

From the *Creating Your First Lot* transcript, the setup order is explicit and sequential:

```
QA Setup:  Work Types → Area Codes → Control Lines → Test Methods
Spec & Conformance:  ITPs (import from REPO or build)
Quality Assurance:  Lots → Checklists (Lot × ITP)
```

Additional setup registers that gate downstream features:
- **Test Methods** must exist before you can add a Test to an ITP (*Add Test Methods*). Each method carries **Test Result Fields** (Result Name + Result Unit), e.g. `Q103A`.
- **Test Properties** must exist before generating a Test Request (*Test Properties*). These are **Property Groups** with named fields and default values — e.g. group "N25 Concrete" carrying concrete class, number of batches, target slump, cement type.
- **Contacts** — project-specific non-login people (*Contacts List*).
- **Groups** — named addressee lists for approvals/contract notices (*Create Groups (for Addressees)*).
- **Control Lines** — optional, can be added after lot creation.

### 1.3 The REPO (Repository) pattern — seeded content

Source: *Add Work Types*, *Add Test Methods*, *Inspection Test Plan (ITP) / Specifications Register*, *Manage Lot Status Using Lot Review*.

Every new subscription gets a project called **REPO** pre-loaded with content. Import targets: Work Types, Area Codes, Test Methods, Test Properties, ITPs, Lot Review Statuses. The ITP repository is *"based on TMR specifications"* (Queensland Dept of Transport and Main Roads) — a single-jurisdiction seed.

Three import modes recur across registers:
1. **Import from Repository / Other Project** — pick REPO or any prior project (a tickbox reveals non-REPO projects).
2. **Import from Clipboard** — copy a range in Excel, paste straight in (Cloud only).
3. **Import from File** — CSV only, with **manual column-header mapping** ("Value 1" → "Work Type", "Value 2" → "Description"), green tick when all headers resolved.
4. Desktop-only: **Import V10 / CPX files** for Test Methods and Test Properties.

Gotcha they document: importing an ITP also drags in its associated Test Methods, so you shouldn't import Test Methods separately — but *"The test results will not be imported"* (*Add Test Methods*), meaning result-field definitions are lost on REPO import and must be re-keyed.

### 1.4 Lot geometry — four modes

Source: *Create Lots*, *Create Lots (D)*, *Control Lines*.

| Geometry Type | Inputs | Notes |
|---|---|---|
| No Geometry | — | Explicitly allowed; "You can always complete this later" |
| Chainage | Control Line + Start Ch + End Ch + Offset | Validation: *"Start Chainage must be smaller than the End Chainage"* |
| Coordinate Position | lat/long point | Map picker with zoom; "+" to add coordinates |
| Coordinate Region | lat/long polygon | Same |

- **Control Lines** are the survey datum. Desktop stores only code + description; **Cloud adds a coordinate page with a map plot**. Requires ≥2 points (*"It cannot be just a single point"*).
- Coordinates must be **decimal lat/long**. The KB literally tells users to ask ChatGPT/Gemini for a DMS conversion formula, and to consult a surveyor for Northings/Eastings transforms. Negative lat = southern hemisphere.
- Cloud has a **coordinate conversion tool configured on the control line**, which lets chainage-defined lots render on Google Maps (*Lot Mapping*).
- **AVL** (Area / Volume / Length) is auto-calculated from geometry; an **"AVL Override"** checkbox lets you hand-enter for irregular shapes (*Create Lots (D)* step 6).
- With Chainage geometry you additionally get a **Level Reference**: Nominal Thickness, Base Level, Top Level — the transcript confirms *"if we're doing a pavement layer we can add a depth as well and that will help with calculating our volume"*.

### 1.5 Lot lifecycle / statuses

Source: *Manage Lot Status*, *Manage Lot Status (D)*.

| Status | Definition (verbatim intent) | Visual |
|---|---|---|
| **Pre-Open** | Created, no Work Started Date. **Optional** — must be enabled by Administrator in project settings | — |
| **Open** | *"an incomplete Lot which is not Conformed, Guaranteed or Rejected"* | — |
| **Guaranteed** | *"a completed Lot that complies with the Specification but is waiting on some results of testing (such as 28 day concrete tests) or other information"* | Blue |
| **Conformed** | *"all testing has been performed and results received demonstrating compliance, all Checklists are completed and any NCRs are closed out"* | Green |
| **Rejected** | *"rejected and depending on your project workflows may require further review"* | — |
| **Closed** | **NOT conformance.** *"it does NOT mean that it is conformed. It merely records a closed date on the Lot ... an additional field for marking dates for administrative purposes"* | — |

Mechanics:
- **Conform is gated**: *"If your Lot has any outstanding NCR or Test Request, you'll get a message stating that these need to be approved or completed before you can conform the Lot."* Guarantee is the documented pressure-release valve for long-lead tests.
- **The gate is defeatable by config**: *"your Project Administrator may allow Lots to be conformed under a few exceptional circumstances by adjusting the project settings."*
- **Permission-gated**: *"Your administrator must have assigned you the access and authority to conform lots before you can update lot status."*
- Conformed or Guaranteed ⇒ **automatically 100% complete**.
- **Activate** converts Pre-Open → Open by stamping a Work Started Date.
- **Every status has an Undo** ("Un…" variants under Operations / right-click → Status).
- **Unguarantee by Age** — a bulk operation that strips the Guarantee date from any lot guaranteed longer than N days ago, N set by the Administrator in Project Settings. This is their 28-day-concrete follow-up mechanism.
- **% Complete** is manual, per-lot or per-quantity, for WIP claiming: *"if you have an agreement with your client that allows you to claim Work in Progress."* The column is **hidden by default** — you must open Column Chooser and drag "Percentage Complete" onto the header bar.
- Explicit link to money: *"Statusing your lots is necessary to produce an accurate progress claim."*

### 1.6 Lot Review — a second, fully configurable status axis

Source: *Manage Lot Status Using Lot Review*, *Manage Lot Status Using Lot Reviews (D)*, *Using Lot Review Status* transcript.

This is CivilPro's most sophisticated lot feature and it is **orthogonal to lot status**. Lot Status is the contractual state; Lot Review is the *workflow* state through *"the construction, administration and audit phases."*

**Lot Review Statuses are project-authored templates** (QA Setup → Lot Review Statuses), importable from Repository or via "Import Defaults". Shipped examples:
- Ready for conformance
- Resubmitted for conformance
- More information required for conformance
- Ready for client review
- Client reviewed
- Client review not required
- Client review – more information required

Each status carries a **Comment Template** — rich text with **tables**, used as a default comment. Their stated use: *"when completing a pre-check for conformance, you may want a table with each of the things the engineer needs to check."*

Each status has **seven behaviour flags**:

| Flag | Effect |
|---|---|
| Requires Comment | Comment mandatory when assigning |
| Admin can assign | Assignable by Lot Review Admin permission |
| Add can assign | Assignable by Lot Review Add permission |
| Reviewer can assign | Assignable by Lot Review **Collaborate** authority (i.e. the client) |
| Allows synch | *"lots for which the latest review status has this property can be synchronized to 3rd party platforms (if they are licensed)"* |
| Is Reported | Included on the Lot Conformance Report (when that report option is on) |
| Is Public | Visible to Lot Review collaborators. **"Reviews marked as 'Is Reported', but not 'Is Public' will still be shown on the conformance report."** |

**Permission model — two distinct permission families:**
- *Lot Review Status* permission — who can create/edit/administer the available statuses.
- *Lot Review* permission — who can apply an existing status to a lot.
- Plus **Lot Review Collaborate** authority — the external/client seat. Sees only reviews where status is `Is Public`, can assign only statuses with `Reviewer can assign`.

**Immutability**: *"Completed reviews cannot be edited. They can only be deleted by a user with Lot Review Admin permissions."* Each review records who assigned it and when; the full history lives on the Lot's **Reviews** tab.

**The three documented workflows** (verbatim from the KB):
1. *Internal administration of lot compilation* — engineer marks 'Ready for conformance' → QA manager filters register on that status → completes review as 'Conformance review complete' or 'Conformance review issues' → filters on issues and sends a notification → filters on complete and **bulk conforms**.
2. *Client integrated review* — contractor marks 'Ready for Client Review' → client logs in as Collaborator, filters, **samples ~20%**, marks 'Client requires additional info' or 'Client Review Complete', bulk-marks the rest 'Client review not required'.
3. *Synchronisation to 3rd party app* — set `Allows Synch` on the terminal client statuses so those lots flow out to an external platform.

### 1.7 Sub Lots — not supported, three workarounds

Source: *How to Manage Sub Lots in CivilPro* (2026-05-01).

Opening line: *"Although CivilPro doesn't natively support Sub Lots (e.g. Lot hierarchy), there are a number of ways to achieve a similar outcome."*

1. **Related Lots** — chainlink icon in the Related Items panel creates a **two-way parent/child link** (AAGNRL012 is parent of EXGNRL001; EXGNRL001 shows AAGNRL012 as its parent). But: *"CivilPro cannot filter / group Child Lots that are associated with a Parent Lot."* Display only.
2. **Custom Registers** — create a custom register (e.g. values "Parent", "Sub Lot 1", "Sub Lot 2"), which then appears as a dropdown in the lot creation wizard. Custom Registers support **parent/child cascading dropdowns** (pick "Embankment" in dropdown 1, get a filtered dropdown 2). Caveat they flag: *"these Custom Registers selections will be visible for all Lots created, so may be worth keeping standardised."*
3. **Duplicate Lot** — right-click a parent lot → Duplicate Lot, walk the wizard changing only the differing field (e.g. embankment layer), to preserve naming consistency.
4. Grouping is achieved by right-clicking the header row → **Show Filter Row** and typing the parent lot name — i.e. a **string search**, not a relation.

### 1.8 Conformance, checklists, and evidence

- **ITP → Checklist is a snapshot copy**: *"Once a checklist is created, any updates on the checklist does not change the ITP from which it is created. The ITP and the checklist are two separate templates"* (*Inspection Test Plan (ITP) / Specifications Register*). One ITP → many checklists across lots and projects.
- Two attach paths: from the Lot Register (Related Items → Checklists → link ITP) or from the Checklist Register (New Checklist → pick Lot + ITP) — *Create Checklists - Attach ITP to Lots*.
- **Standing Approvals** can be linked to an ITP inspection item so that *"when the same ITP is linked to other lots, the standing approval can be applied to these generated checklists"* — a pre-authorisation for repetitive hold points.
- **Approvals** (*Approval Register*): categories include Hold/Witness Point, NCR, Purchase Order, and independent approvals. Basic + Advanced workflows. Notable operations: **Short Circuit an Approval** (revert to previous status, e.g. rejected in error), **Set Manual Approval** (bypass the workflow when evidence of approval exists outside CivilPro), **Change an Approver** mid-flight, **Reassign to a new Requester**. PO approvals enforce a per-user **purchasing limit** = max limit across all that user's roles on the project.
- **Test Requests** (*Test Request Register*) support location geometry of the testing site itself, distinct from the lot geometry. **Creating a test request does not send it** — "Notify Tester" is a separate explicit action; the tester later triggers "Notify Result".
- **NCRs** attach to a specific **checklist inspection point**, not just to the lot.
- **Photos** live in a separate Photo Register (50 MB/file, camera capture on Cloud), linkable to Checklist, Lot, Variation, NCR. Non-image documents go to **Filestore** instead. Linking a photo to a checklist item must be done from the Checklist register, not the Photo register.

### 1.9 Reporting — the handover machine

Source: *Generate Lot Register Reports*, *Generate Lot Register Reports (D)*.

Six report types off the Lot Register: **Conformance Report, Quantity Sheet, Measure Up Sheet, Conformance Declaration, Lot Register Report, Lot Summary**.

- **Conformance Report** — multi-select lots (Ctrl+click), tick options in a Conformance Options panel, "Save As Default" persists your option set. Full customisation opens the **DevExpress WinForms Report Designer** (they link to DevExpress's own docs).
- **Lot Summary** — every record associated with a lot (NCRs, Checklists, Test Requests, Approvals) plus attached documents. Single lot → preview PDF. Multiple lots → *"the list will display the types of records rather than actual records"* and output is **zip files**.
- **Build Conformance Folio** — the handover deliverable. Picks a filesystem path and writes a **folder tree of PDFs** per lot. Three scopes:
  - `None` — lot register report + conformance report + reports for items referenced by the selected lots, in per-item subfolders within the lot folder.
  - `Related` — the above plus all other register reports containing referenced items, with top-level per-item folders.
  - `All` — every report including registers with items unrelated to the selected lots.
- Repeated **caution about photos**: *"If you have many photos or some photos in large file sizes, these will hamper your report download. It is strongly recommended that you DO NOT switch on the Photos option."*
- Quantity note: *"The Effective Qty can be less than Measured Qty, based on what's being paid while the Measured Qty is based on the actual quantity of work completed."*

### 1.10 Lot Mapping / spatial

Source: *Lot Mapping*, *Create a Lot Map (D)*, *Create a Lot Map - Lot Mapping*, *Importing Geo-Referenced Imagery (Image Layers)*.

Three distinct mechanisms:

1. **Cross-section mapping (their flagship)** — QA Setup → Lot Mapping. A Lot Map Section = one control line between two chainages. Within it, an ordered list of **layers**, each bound to a Work Type and/or a Custom Register item; CivilPro auto-detects which lots match and compiles the list (overridable — "Manual Lots = Yes", Update Lot List, Exclude Selected Lots). Layer fields: Work Type, Description, Custom Register Filter, Filter Type (And/Or), Display Height Default, Actual Height Default, **Overlap Tolerance** (*"if no tolerance is entered, any overlapping in chainage will display the layers as stacks instead of next to each other"*), Depth from Top Layer, Label Font Height, Overlap Behaviour. Layout properties: Chainage Intervals, Image Height/Width, Font Size, Left Margin; defaults to fit-to-scale. Output is a **PDF where lot numbers are clickable** and lot colour encodes status (*"Conformed Lot is purple"* in the Cloud article vs green in the register — inconsistent).
   - **Three of those layer fields are dead**: *"Actual Height Default – currently non-functional (for future modelling use)"*, *"Depth from Top Layer - currently non-functional"*, *"Overlap Behaviour - currently non-functional"*.
   - Desktop article pins a minimum build: *"Please ensure your CivilPro Desktop is updated to the latest version (11.83.1.226)."*
2. **Lot Mapping (Plan)** — Cloud only, lots rendered on **Google Maps**, including chainage-defined lots via the control line coordinate conversion tool.
3. **Manual Markup** — a menu option in the Lot Register opens a **PDF editor**; you open a plan, draw the lot by hand, and save the result to Filestore. Not a data record.
4. **Image Layers (geo-referenced imagery)** — overlays aerial imagery so lots can be marked out on it, *"removing the need to manually position, scale and rotate them yourself"*. **Requires QGIS**, third-party and unsupported: *"CivilPro is not affiliated with QGIS and cannot provide support on the use of this software beyond what is detailed in this video."*

### 1.11 Cross-register linking

- **Work Type → Schedule Item** links are user-created and filter the schedule-item list when adding lot quantities (*"The default for the Schedule Item list will be to show only those items relevant to that Lot's Work Type"*).
- **Work Type → ITP** links are **derived, not editable**: *"The links to ITPs are not made directly and cannot be edited. These links are calculated by CivilPro and are shown when there is a link from a Work Type to a Schedule Item, and from that same Schedule Item to an ITP."* A transitive inference used to pre-filter checklist selection.
- **Lot-based quantities** — records of how much of each schedule item was completed within a lot; the feed into progress claims.

### 1.12 Contacts vs Users

Source: *Contacts List*, *Add Contacts*, *Add Contacts (D)*.

Contacts are project-scoped non-login people (testers, client reps receiving Contract Notices/Test Requests). Users are global with logins and auto-appear in the Contacts register of every project they're on. Their stated reason for the split: avoiding *"an unnecessary long list of people from both groups (of every other project) appearing in dropdown lists."*

---

## 2. UX flows, step by step

### 2.1 New project QA setup (from the *Creating Your First Lot* transcript)

1. QA Setup → **Work Types**. Type a code and description inline. *"these are the disciplines we expect to do on this project."*
2. QA Setup → **Area Codes**. Same inline pattern. *"this is how we break up our job."*
3. QA Setup → **Control Lines**. New Control Line → either zoom into the works area and click points on the map, or import coordinates. *"We'll use this for configuring the geometry of our Lots."*
4. QA Setup → **Test Methods** → import from the supplied repository, tick the ones your project needs, Save.
5. Spec & Conformance → **ITPs** → Import from Repository (or any project marked as a repository project) → navigate to the ITP, select, Save. Or New ITP → name + code → open it → "Import specification details" from Excel, or build inspection items in the grid via "New Inspection Item".
6. Quality Assurance → **New Lot** → find the chainage on the control line centreline; for a pavement layer add a depth so volume calculates.
7. **Activate** the lot.
8. Related Items icon → chainlink beside **Checklists** → the ITP register appears → navigate to the ITP → press "+". The checklist is now assigned.
9. Click into the checklist and close out items.

### 2.2 Create Lot wizard — Cloud (*Create Lots*)

Lot Register → New Lot →
1. Work Type (dropdown), Area Code (dropdown), Description → Next
2. Date Work Started; optional Level of Testing (Normal → Reduced) → Next
3. Type of Geometry: Chainage (control line + chainage + offset) / Coordinates Position / Coordinates Region (map or "+" for lat-long) / No Geometry → Next
4. Custom Register Value, if any → Next
5. Review screen (Back to amend) → Save

### 2.3 Create Lot wizard — Desktop (*Create Lots (D)*, 7 steps)

1. Work Type, Area Code, **Geometry Type**, Description. Selecting Coordinate Position or Region here reveals a Chainage option → Next
2. Level of Testing; if Chainage was chosen, **Level Reference**: Nominal Thickness, Base Level, Top Level; Work Started date (optional). *"The rest of the fields are related to Lot Statusing which are not applicable at this stage"* → Next
3. Chainage branch: Control Line, chainage, offset. Coordinate branch: lat/long → Next
4. **AVL** — auto-calculated, or tick "AVL Override" and hand-enter Area/Volume/Length → Next
5. Notes → Save & Finish

Note the wizards **diverge**: Cloud asks geometry at step 3 and never mentions AVL or Level Reference; Desktop asks geometry type at step 1 and adds two extra screens.

### 2.4 Conform a lot (*Manage Lot Status*)

1. Lot Register → select lot → Related Items panel. *"take note of the items highlighted in orange and red as these are the incomplete items"* — click through checklists / NCRs / test requests to verify.
2. Operations tab (Desktop) or Notepad icon (Cloud), or right-click → Status → **Guarantee** or **Conform**.
3. Blocked if NCRs or Test Requests are outstanding; Guarantee still available.
4. Register repaints green (Conformed) / blue (Guaranteed); 100% complete auto-set.
5. Reports tab → Conformance Report for one or many lots (Ctrl+select).

### 2.5 Lot review round-trip (from the *Using Lot Review Status* transcript — the best window into their real workflow)

Field engineer:
1. Open the conformed lot, Related Items → *"we've got a tick beside our checklist which indicates that this checklist has been closed out."*
2. **Column Chooser → find the review status columns** (hidden by default — *"here we can see that no review status has been added to our lot"*).
3. Right-click → **Add Review to Selected** → nominate a status. Statuses come from the Lot Review Status templates in QA Setup.
4. Choose 'internal review ready' or 'pending client review' depending on the org's process. *"This review status is now updated and it shows who has updated this."*

Administrator / client:
5. Enter the Lot Register, add the **Review Status** and **Review By** columns.
6. **Group by review status**, then open the "Pending Client Review" group to see exactly the queue.
7. *"They can print a lot summary which gives them a nice index PDF of the completed checklist and all of your QA."*
8. Right-click → Add Review → 'Client reviewed and approved'. The lot moves into that group. *"All of these review statuses and who they're assigned by can be seen within the lot."*

### 2.6 CSV import (*Add Work Types*, *Add Area Codes*)

1. Global Action icon → Import from File.
2. Either paste from clipboard (copy the range in Excel first) or drag/drop a **CSV only** (no xlsx).
3. **Click each column header and re-map it** — "Value 1" → "Work Type", "Value 2" → "Description".
4. Green tick appears once all headers are mapped → Import.

Desktop uses a different flow: a modal Import Wizard, **right-click** the header to assign a field, "First row is header" checkbox, Next/Finish.

### 2.7 Desktop grid editing paradigm

Desktop registers are **read-only until you toggle edit mode**: right-click → Enable Editing, or the bottom-toolbar icon, or **Ctrl+E**; the icon highlights blue when active. Then click a row (pencil appears), type, Tab across columns. Delete = select rows + Del key. Cloud replaced this with proper New/Save forms.

---

## 3. Terminology & data model

### Their nouns

| CivilPro term | Meaning | SiteProof analogue |
|---|---|---|
| **Work Lot / Lot** | *"a parcel of work primarily defined by its area of work and work type"* | Lot |
| **Work Type** | 2–8 char discipline code, first 2 chars enter the Lot Number | (no direct equivalent) |
| **Area Code** | 2–8 (or ≤4) char location code, first 4 chars enter the Lot Number | (no direct equivalent) |
| **Control Line** | survey reference datum (polyline of ≥2 lat/long points) defining chainage | alignment / centreline |
| **Chainage** | distance along a Control Line; lots span start→end + offset | chainage |
| **AVL** | Area / Volume / Length, derived from geometry, overridable | — |
| **Level of Testing** | Normal / Reduced — testing frequency regime for the lot | — |
| **Level Reference** | Nominal Thickness / Base Level / Top Level | — |
| **ITP** | reusable specification template of inspection items | ITP |
| **Checklist** | an ITP instantiated against one Lot; a **snapshot**, decoupled from the ITP | ITP completion |
| **Inspection Item / Inspection Point** | a row on an ITP/checklist | checklist item |
| **Hold Point / Witness Point** | approval categories raised from a checklist item | hold point |
| **Approval** | a request→approver transaction, with workflow | approval |
| **Standing Approval** | pre-authorisation attached to an ITP item, inherited by generated checklists | — |
| **NCR** | non-conformance, attachable to a checklist inspection point | NCR |
| **Test Method** | a test type (e.g. Q103A) with Result Fields (name + unit) | test type |
| **Test Property Group** | preset parameter bundle applied to a Test Request (e.g. "N25 Concrete") | — |
| **Test Request** | list of tests assigned against a Lot, sent to an external tester | test request |
| **Schedule Item** | a bill-of-quantities line; links Work Type ↔ ITP transitively | claim/BOQ item |
| **Lot Quantities** | amount of each schedule item completed within a Lot | lot quantities |
| **Lot Status** | Pre-Open / Open / Guaranteed / Conformed / Rejected (+ Closed date) | lot status |
| **Lot Review / Lot Review Status** | orthogonal, project-authored workflow state with 7 behaviour flags | — |
| **Lot Review Collaborate** | the external/client reviewer authority | — |
| **Custom Register** | user-defined attribute register with cascading parent/child dropdowns | — |
| **Related Items** | universal cross-entity link panel (chainlink icon) | — |
| **Related Lots** | two-way parent/child lot link, display only | — |
| **Filestore** | document repository (non-image) | documents |
| **Photo Register** | image repository, 50 MB/file | photos |
| **Contact** | project-scoped non-login person | — |
| **Group** | named addressee list | — |
| **REPO** | seeded template project shipped with each subscription | seed templates |
| **Conformance Folio** | exported folder tree of PDFs = the handover package | — |
| **ATP (Authority to Proceed)** | legacy pre-V11 approval mechanism, superseded | — |
| **CPX** | export file format from v10/v11 | — |

### Relations, as evidenced

```
Company
 └─ Project (Work Types, Area Codes, Control Lines, Contacts, Groups,
             Custom Registers, Lot Review Statuses, Test Methods,
             Test Properties, ITPs, Schedule Items)
      └─ Lot   [Work Type + Area Code + seq]
           ├─ geometry → Control Line (chainage+offset) | lat/long point | region
           ├─ AVL (derived, overridable)
           ├─ Status (Pre-Open/Open/Guaranteed/Conformed/Rejected) + Closed date + % Complete
           ├─ Reviews[]  → Lot Review Status (immutable once complete, audited by user+time)
           ├─ Checklists[] ← instantiated from ITP (snapshot copy)
           │     └─ Inspection Items → Approvals (Hold/Witness), NCRs, Photos
           ├─ Test Requests[] → Test Methods → Test Result Fields
           │                  → Test Property Groups
           ├─ Quantities[] → Schedule Items
           ├─ Related Lots[] (bidirectional, ungroupable)
           ├─ Custom Register values[]
           └─ Filestore docs[], Photos[]

Work Type ─(user link)→ Schedule Item ─(user link)→ ITP
Work Type ═(derived, read-only)═════════════════════→ ITP
```

---

## 4. Strengths worth stealing

1. **Lot Review as a separate, configurable axis from lot status.** This is the single best idea in the corpus. Contractual state (Conformed) and workflow state (Ready for conformance / Pending client review / Client requires more info) are different questions, and conflating them into one enum is exactly what most tools do wrong. Their model — project-authored statuses with per-status behaviour flags, an append-only immutable review history with attributed author and timestamp, and a client-visible subset — solves the "who's got the ball on this lot" problem that dominates real QA admin. **The `Is Reported` vs `Is Public` split is subtle and correct**: an internal review can appear on the conformance report without being visible to the client's portal seat.

2. **Comment Templates with tables as the default comment on a review status.** A reviewer selects "Pre-conformance check" and gets a pre-filled table of the things to verify. Structured checklist semantics with zero schema work. Cheap to build, high perceived sophistication.

3. **Guarantee as a first-class status distinct from Conformed.** Purpose-built for the 28-day concrete problem: the lot is complete and compliant, but a result is pending. It lets the register stay honest instead of forcing a binary. **Unguarantee by Age** (a bulk sweep for lots guaranteed longer than N days) turns it into a working tickler rather than a black hole. SiteProof has no equivalent and this is a real gap in civil workflows.

4. **The conform gate is a computed precondition, not a checkbox.** *"If your Lot has any outstanding NCR or Test Request, you'll get a message stating that these need to be approved or completed before you can conform."* The system knows what "ready" means and refuses. That's the sufficiency-gate idea, already shipped.

5. **Build Conformance Folio.** The end deliverable on an AU civil job is a handover folio, and they generate a structured folder tree of PDFs — lot folder, per-item subfolders, three scope levels. Everyone else makes the QA manager assemble this by hand over a fortnight. This is a strong closing feature for a claims/handover story.

6. **The REPO project pattern.** Every subscription ships with a populated template project (work types, area codes, test methods, ITPs based on TMR specs, review statuses) and every register supports "Import from Repository / Other Project". The second project a customer sets up costs almost nothing. Onboarding friction is where competitors bleed.

7. **Related Items panel as a universal pattern.** One chainlink icon, one panel, every entity, add/remove links inline. **Colour-coding incomplete related items orange/red** so the QA manager can eyeball readiness without opening anything.

8. **Bulk everything.** Ctrl/Shift multi-select on the register drives bulk review assignment, bulk conform, multi-lot conformance reports, multi-lot folio builds. Their documented client workflow (*sample 20%, bulk-mark the rest 'not required'*) only works because bulk is everywhere.

9. **Group-by on the register as the queue UI.** The transcript's core move is "group by Review Status, open the Pending Client Review group." No bespoke inbox screen — the grid *is* the queue.

10. **Derived Work Type → Schedule Item → ITP inference** to pre-filter which ITPs and schedule items are offered on a lot. Reduces the picker to a handful of plausible options without anyone maintaining a mapping table.

11. **Test Property Groups** — reusable parameter bundles with default values ("N25 Concrete" ⇒ class, batches, target slump, cement type). Ten seconds instead of ten fields, per pour.

12. **Test Request ≠ notification.** Creating the request and sending it to the lab are separate explicit acts, and the tester notifies the result back through the system. Correct modelling of an external party who isn't a seat holder.

13. **Standing Approvals on ITP items** — pre-authorise a repetitive hold point once, inherited by every checklist generated from that ITP.

14. **Short Circuit / Set Manual Approval / Reassign Requester.** Real workflows break; they shipped explicit, audited escape hatches (rejected in error → revert; approval evidence exists on paper → record it manually) instead of leaving people stuck.

15. **AVL Override.** Auto-calculate area/volume/length from geometry, but let the engineer overrule it for irregular shapes. Compute-with-override is the right default for anything a surveyor will disagree with.

## 5. Weaknesses / gaps we can exploit

1. **No lot hierarchy. At all.** They published an article whose first sentence admits it (*How to Manage Sub Lots*) and whose remedy is three workarounds: a display-only link that *"cannot filter / group Child Lots"*, a global custom register whose values pollute every lot in the project, and **filtering by typing the parent's name into a filter row**. Real civil work is hierarchical (embankment layers, pour sequences, bridge elements). **Native parent/child lots with roll-up status is a straight win.**

2. **Lot numbering is a rigid string concat.** WorkType[0:2] + AreaCode[0:4] + seq. You may define an 8-character work type but only two characters survive, which silently creates collisions between `SGRADE` and `SGBASE` (both → `SG`). Escaping the scheme requires learning an entirely separate feature (Custom Registers) documented in a different article. And the KB itself can't keep the area code limit straight — three articles say 4 max, one says 2–8.

3. **Two-register mandatory setup before the first lot exists.** You cannot create a single lot until Work Types and Area Codes are populated. A new user's first ten minutes are spent authoring taxonomy for a job they haven't started. SiteProof can let a foreman create a lot in 15 seconds and infer or defer the coding.

4. **CSV import with manual header mapping, CSV-only.** No xlsx, no header auto-detection (Desktop even makes you tick "First row is header" *and* still map manually). Every register has its own slightly different import UI. Auto-detecting columns from a pasted spreadsheet is a demo-winning 30 lines of code.

5. **Critical columns are hidden by default.** Both the review status columns and % Complete require opening a Column Chooser and *dragging a field onto the header bar*. The Lot Review tutorial spends its first 20 seconds on this. The product's best feature is invisible until you configure the grid.

6. **Desktop/Cloud fork.** Nearly every article is duplicated with a `(D)` variant and the flows genuinely differ: Desktop needs Ctrl+E "Enable Editing" before you can type; the create-lot wizards ask different questions in different orders; control line coordinates and map plotting are Cloud-only; cross-section Lot Mapping is documented as Desktop (with a pinned build number, 11.83.1.226); CPX/V10 import is Desktop-only. Customers must learn which half of the product does what. **Being one web app that works on a phone is a positioning advantage, not just an implementation detail.**

7. **Report customisation is the DevExpress WinForms Report Designer**, and their own KB punts to DevExpress's documentation. That's a desktop .NET report designer being handed to a QA manager.

8. **Photos are a documented liability.** Three separate warnings across the reporting articles telling users *not* to include photos because it *"will hamper your report download."* On a modern civil job photos are the primary evidence. SiteProof's server-side thumbnailing and backend-mediated storage means we can put photos in the conformance pack without an apology.

9. **Geo-referenced imagery requires QGIS**, an unaffiliated desktop GIS they explicitly won't support. Anyone who wants aerial overlays must install and learn separate GIS software.

10. **Three disconnected "map" concepts.** Cross-section PDFs (QA Setup), plan view on Google Maps (Cloud), and a manual PDF markup saved to Filestore. The manual markup produces no data at all — just a picture. **This is the crack in their spatial story**: their chainage cross-section map is a generated PDF artefact, not an interactive live surface. A single interactive map that *is* the lot register — click a lot on the map, see status colour, open its evidence — beats three partial artefacts.

11. **Non-functional fields shipped in production UI.** "Actual Height Default – currently non-functional (for future modelling use)", "Depth from Top Layer – currently non-functional", "Overlap Behaviour – currently non-functional", plus "The Tag Code feature is being reviewed and currently not ready for use" sitting in the lot creation flow. Four dead controls users must be told to ignore.

12. **Multi-lot Lot Summary degrades badly**: select more than one lot and *"the list will display the types of records rather than actual records for a specific lot"*, output arrives as zip files. The handover-scale case is the weakest path.

13. **Conformance Folio writes to a local filesystem path** ("Path to build Folio"). Not a shareable link, not a stored artefact — a folder on someone's laptop.

14. **The conform gate is disableable at project level** (*"your Project Administrator may allow Lots to be conformed under a few exceptional circumstances by adjusting the project settings"*), and approvals can be manually set outside the workflow. Both are pragmatic, but they mean a "Conformed" lot is not a guaranteed evidentiary state — there's no visible marker distinguishing a properly-gated conform from a bypassed one. **An immutable, always-computed sufficiency verdict recorded alongside the status is a credibility differentiator.**

15. **Contacts/Users footgun.** *"If you have added a person in the Contacts register before inviting them as a user, you'll need to delete the person or remove the email address from the Contacts register as the system will direct the user to login instead of the profile setup screen."* Cloud has since papered over this with "Promote Contact to Full User", but Desktop's fix is still "delete the record".

16. **Coordinate handling is manual and outsourced.** DMS→decimal conversion: *"get in touch with CivilPro Support ... (or ask as much from ChatGPT / Gemini)"*. Northings/Eastings: *"we recommend getting advice from Surveyors."* AU civil data arrives in MGA/GDA2020 grid coordinates constantly. **Handling MGA zone transforms natively is a concrete, unglamorous, high-value differentiator.**

17. **REPO ITP content is TMR-only** (Queensland). Every other state's contractor starts from an ITP library keyed to the wrong specification. This aligns with the ITP-library coverage work already in flight — multi-jurisdiction ITP seeding is a direct attack on their onboarding advantage.

18. **Test result fields don't survive REPO import** (*"The test results will not be imported"*) — you re-key result field definitions per project.

19. **No documented mobile story in this corpus.** "CivilPro Mobile" is mentioned once, in passing, in the *legacy* ATP article. Everything else is a desktop grid with right-click context menus, Ctrl+E edit modes, and Column Choosers — none of which exist on a phone. The entire lot workflow described here assumes someone at a desk.

20. **No overlap/gap detection between lots.** The only chainage validation documented is `start < end`. Overlap Tolerance exists solely as a *rendering* parameter on the cross-section map. Nothing tells you two lots claim CH100–CH300 on the same layer, or that CH250–CH400 has no lot at all. **Coverage/gap analysis over chainage is a natural spatial-map feature and they have no answer to it.**

## 6. Surprises

1. **"Close" a lot does not mean conformed.** *"It merely records a closed date on the Lot. This option is provided only as an additional field for marking dates for administrative purposes, and it's up to each organization on how they want to use this."* A first-class status verb that means nothing the system enforces — vestigial, and they document it defensively.

2. **`Is Reported` without `Is Public`.** A review status can be stamped onto the client-facing conformance report while being invisible to that same client inside the app. Deliberate, called out in a NOTE in both the Cloud and Desktop articles. Whether that's a feature or an information-asymmetry hazard depends on who's asking.

3. **`Allows Synch` is a property of a lot *review status*, not of the lot.** Third-party synchronisation is triggered by *"lots for which the latest review status has this property"* — reaching client sign-off is what pushes the lot to an external platform. Workflow state as an integration trigger is an unusual and rather elegant design.

4. **Their documented client workflow assumes sampling, not review.** *"Client filters for lots that are ready, and checks a selection of, for example, 20%. Marks them as either 'Client requires additional info' or 'Client Review Complete'. Reviews the rest as 'Client review not required'."* There is a shipped status named **"Client review not required"**. The product is explicitly built around the reality that clients spot-check.

5. **Purchase order approval limits live inside the QA approval engine.** *"A user's limit is the maximum PO limit assigned to them across all of the roles on the project. When a user actions or short circuits a step, approval or completion actions/steps will be removed if the user has insufficient PO limit."* Financial delegation authority computed as a max across roles, enforced by stripping workflow steps at runtime. CivilPro is further into procurement than a QA tool suggests.

6. **Work Type → ITP links are computed and explicitly unmodifiable.** *"The links to ITPs are not made directly and cannot be edited. These links are calculated by CivilPro."* A derived, read-only relation surfaced to users as if it were data.

7. **Completed lot reviews are immutable** and deletable only by a Lot Review Admin. They built proper audit semantics into this one feature — while lot *status* is freely undoable by anyone with the permission.

8. **The KB tells users to ask ChatGPT or Gemini** for coordinate conversion formulas, in official product documentation (*Control Lines*).

9. **Unguarantee by Age is a bulk time-based status sweep.** A configurable "any lot guaranteed more than N days ago loses its guarantee date" operation. Not a notification, not a reminder — a retroactive status strip. Blunt, but it does force the 28-day test back onto someone's desk.

10. **The ATP register is still shipped and documented** while being labelled legacy, superseded by the Approval register, with the note that *"If your project is proceeding in a cooperative manner then this functionality of Civil Pro may not be required."* An entire retained subsystem for adversarial contract administration.

11. **The cross-section Lot Map's output is a PDF with clickable lot numbers** that drill into lot detail. A generated document acting as a navigation surface — a genuinely odd but revealing choice about where they think work happens.

12. **Lot status colours contradict between articles**: the register uses green for Conformed and blue for Guaranteed (*Manage Lot Status*), while the Lot Map article says *"Conformed Lot is purple"*. Two colour systems for the same state.

13. **The seeded ITP library is the actual moat and it's regional.** *"A repository of ITPs (based on TMR specifications) is provided by CivilPro"* — their onboarding speed is bought entirely with Queensland roads content. That's both the thing to match and the thing to outflank by covering more jurisdictions.
