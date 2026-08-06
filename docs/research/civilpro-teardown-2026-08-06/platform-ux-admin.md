# CivilPro — Platform / UX / Admin competitive analysis

Source: `bundles/platform-ux-admin.md` (155 KB cleaned article text, ~130 Zendesk help-centre
articles, newest updated 2026-07-28) plus transcripts `QOs-tXRBxzI` (filters/views webinar),
`kT7mhB4nmu4` (contract notices), `gfMMB4JSGDs` (approving as admin), `rFFNqMt4cYY` (setup as
project administrator), `JcNWK4vgi1U` (create a new project).

Convention used throughout: articles suffixed **(D)** are the Desktop variant of the same
article; the unsuffixed one is Web App / Cloud. That doubling is itself the single most
informative structural fact about the product — see §5.

---

## 1. Feature inventory

### 1.1 Product structure — two clients, one database

Article: *"What is the impact of the CivilPro Data Storage on my system?"*, *"What are the
differences between CivilPro Web App (Cloud) and Desktop?"*, *"Do I need the Internet for
CivilPro?"*

- **CivilPro Web (Cloud)**: pure HTML/JS Angular SPA + .NET 7 REST API, both hosted from the
  *same* Azure App Service. Every customer gets their own App Service and Cloud UI app; only
  the App Service *Plan* is shared. Grid controls are DevExtreme (DevExpress) — confirmed by
  the API article pointing integrators at DevExtreme `DataSourceLoadOptions` docs.
- **CivilPro Desktop**: .NET 7 Windows app deployed via Microsoft ClickOnce, installs into the
  user profile. Connects **directly to the Azure SQL database** (not through the API) once
  connection info is supplied, via connection string, an encrypted `.cpcf` connection file, or
  API validation. It reaches Blob Storage using **an API key stored in the database**.
  Current version 13.126.1.661 (*"Check and Update to the Latest CivilPro Desktop Version"*,
  2026-07-28).
- **Database**: SQL Server, **single tenant per customer**, Azure Australia East, salted+hashed
  passwords for CivilPro Identity, Azure IP firewall with whitelist. Backups: PITR every 15 min
  / 28 days, differential daily, weekly LTR 4 weeks, monthly LTR 6 months, locally redundant,
  data sovereign in Australia.
- **Offline**: Cloud requires internet, full stop. Desktop works offline **only** for
  stand-alone local database projects, and *"There is no way to sync an offline project to the
  Cloud"*. They recommend offline only if >70% of the project is remote with no connectivity.

**Documented Web ⟷ Desktop feature split** (*"What are the differences…"*, last updated
2024-07-29 — stale, see §5):

| Feature | Web | Desktop |
|---|---|---|
| Add users with email invites | ✔ | ✖ (users can be added, no invite email is sent) |
| Add Image Layer | ✖ | ✔ |
| Teambinder Interface | ✖ | ✔ |
| Instructions / Risk Templates / Activity Library registers | ✖ | ✔ |
| Day Costs / Invoices / Forecasts registers | ✖ | ✔ |
| Controlled Docs + Controlled Doc Transmittals | ✖ | ✔ |
| Subcontractors / Project Suppliers / Resources / Cost Codes / Units | ✖ | ✔ |

The storage article states the split more bluntly: the browser *"supports all of CivilPro's QA
functions. It does not support the cost management or document transmittal functions."*

### 1.2 Admin / project setup

**Onboarding path** — *"Getting Started with CivilPro"* (2026-07-27), the newest and most
polished admin article. Explicit three-stage order, and an explicit warning: *"use the CivilPro
Web App for setup – especially for inviting users, as CivilPro Desktop does not trigger the
invite emails."*

- Stage 1 (Administration, Web App, in order): Set Up User Roles → Create a Project → Add /
  Invite Users → Manage Project Settings.
- Stage 2 (QA registers): basic approval workflows, Work Types, Area Codes, ITPs (import from
  Repository / CSV / create), Contract Notice templates.
- Stage 3 (optional): Control Lines, importing construction drawings ("Preparing your Plans"),
  Contacts, Addressee Groups, Custom Registers.
- After setup: create first Lot and Checklist.

**Create a Project** (*"Create a Project"*, 2026-01-22; video `JcNWK4vgi1U`): 7-step wizard —
(1) select an existing project first or roles can't be added (a real, documented UX trap);
(2) Contract Number* + Description* + start/end dates + Client Company, Client Contract Number,
Superintendent, Principal; (3) lat/long entry or click-the-map pin; (4) Add Users (existing user
from dropdown or type an email for a new one) + Role, sends invite; (5) Contractor Project
Number + Company; (6) **import data from an existing project** with per-register selection;
(7) review + Save. Only Subscription Administrators or a Global Role with "Add" on Project
Administration can create projects.

**Repository concept** (*"What is a Repository?"*, *"Mark a Project as Repository"*): any project
can be flagged `Is Repository`, making its registers importable into other projects. Every new
customer ships with a project literally named **REPO** pre-populated with Work Types, ITPs /
Specifications, Test Methods (and Area Codes). Web-importable from repo: Work Types, Test
Methods, Test Properties, Specifications (ITP), Area Codes, Approval Workflows, Custom Registers.
Desktop adds Subcontractors, Groups, Cost Codes, Risk Templates, Contract Notice Templates, Units.
Caveat: *"Users must be added to the project that they are going to import from"*.

**Project lifecycle**: *"Mark a Project as Completed"* moves it into a Completed folder off the
active register; reversible via right-click → Activate this Project. Deleting a project is
Desktop-only, irreversible, and removes all records.

**Settings hierarchy** — Subscription Settings vs Project Settings, **Project overrides
Subscription** (stated in both *"Manage Subscription Settings"* and *"Manage Project Settings"*).

- Subscription Settings (5 tabs): Project (culture, timezone, company logo, hide disabled menus),
  Handover (digital signature rules), Claims (GST rate), **Security** (MFA, Google SSO, Microsoft
  SSO, SAML, permitted domains), Notifications (approval number padding).
- Project Settings (4 tabs): Project (culture, timezone, project logo, **DMS Auto CC email** —
  comma-separated list that blind-copies a key person on every project email, hide disabled
  menus), Quality Assurance Control, Claims (GST), Notifications.
- Desktop's *"Manage Project Settings (D)"* documents a much longer QA Control tab than the web
  article does: Enable Primary Tags (deprecated since v11.173, replaced by Custom Registers),
  "Use Date Work Started to Identify Pre-opened Lots", **"Allow Lot Conformance with Unapproved
  NCR / Unfinished TR / Unapproved ATP"**, "Require Completed or Closed Out Checklist for
  Conformance", Guarantee Lot Checks + Auto Unguarantee Days, Custom Lot Number String, **Custom
  Lot Rejected Status** (e.g. `Withdrawn|Withdraw` — noun|verb pair), Text for Lot Conformance
  Sign Off, NCR root cause list override (defaults: Not Specified, Personnel or Training,
  Materials, Methods or Process, Machinery or Plant, Environmental or Conditions), Require Admin
  Permission for Editing ITPs, Disable Prompt When ITP Changed, **Require Approved ITPs for
  Checklists**, Do not show dates on checklists, Do not include chainage in checklist
  description, and per-project relabelling of "Checked / Verified / Approved" text.
  Note: *"These settings apply across the whole project, there is no option to set this on a per
  Lot basis."*
- Desktop-only Cross-Project (Subscription) Settings adds a **Purchasing** tab: custom PO number
  string `#CPN(x)-#POI(x)`, GST rate, default payment terms, Billing Entity/Address, PO T&Cs rich
  text appended to every printed PO.

**Custom Lot Numbers** (*"Custom Lot Numbers"*): default is a 9-char `WWAAAAIII` =
`#W(2)#A(4)#I(3)`. Schema tokens: `#W(n)` work type, `#A(n)` area code, `#I(n)` auto-increment
(must be last), `#P(n)` primary tag (deprecated), `#CR[shortcode](n)` custom register short code.
Web has a "use string builder" UI with drag-reorderable elements; Desktop makes you type the
string. Must be configured **before** lots are created — it does not retro-apply.

**Custom Registers** (*"Custom Registers"*, *"Create Custom Fields Using Custom Registers"*):
CivilPro's user-defined-field system. Per-register activation with three flags — `IsActive`,
`IsRequired`, `IsReported` (include in that register's report). Type = **Lookup** (dropdown of
CR Items) or **Text** (freeform). Supports **Parent Custom Register** for cascading/dependent
dropdowns (Activity Type → Activity Sub-Type). Attachable to: Lot, Test Request, NCR, Checklist,
Checklist Item, ITP, Quantity (D), Variation (D), Filestore, Photo, Daycost (D), Production (D),
Punchlist, Contract Notices, Invoice (D), Cost Code (D).
Inheritance rule: a CR active on both a "top-level" register and an "inherent" register
(Lot→Quantity/Test Request/Checklist; Cost Code→Daycost) **defaults down** and can be overridden
per record; where inherited the field cannot be left blank, so the documented workaround is to
add a "None"/"Unknown" CR item. Pro-tip in the article: duplicate the CR if you want the two
registers independent. CRs are drag-reorderable.

**Import** (*"Import Data into Registers"*) — three paths and a full matrix:
1. **CSV**: Schedule Items, Work Types, Area Codes, Control Lines, ITP Details, **Lots**, **NCRs**
   (called out as *"especially useful when a project is migrating from a spreadsheet-based QA
   system"*), Controlled Documents (D), Subcontractors (D), Groups (D), Cost Codes (D), Daycosts
   (D), Invoices (D), Units (D).
2. **Repository** (see above).
3. **CPX** (CivilPro's own export format): Schedule Items, ITPs, Test Methods, Test Properties,
   Custom Registers, Approval Workflows (D), Risk Templates (D), Purchase Orders (D), Contract
   Notice Templates (D).
CSV formatting rules (*"Format File for Import"*): no merged cells, no empty rows/columns, no
hierarchical data, tight character limits (Work Type/Area Code codes 2–8 chars, Unit 10 chars,
quantities/rates 15 chars). Desktop's Controlled Docs import has a proper column-mapping wizard
(right-click header → pick target field); the web import path is thinner.

**Approval workflows** (*"Create Basic Workflows for Approvals"*, *"Create Advanced Workflows
for Approvals"*, *"NCR Advanced Approval Workflow"*, *"New Approval Workflow Templates - 19 Sept
24"*): This is CivilPro's deepest configuration surface and its biggest differentiator.
- One click ("Create Basic Workflows") generates six defaults, one per **approval category**:
  Hold Point, Witness Point, NCR (Non-conformance), Check Item, Purchase Order, Independent.
  Those six categories are hard-coded; you cannot invent a seventh.
- Workflows are edited as an actual **flowchart**: Steps = boxes (statuses), Actions = arrows
  (transitions). Colour convention: First Step blue, Complete green, "Approved to Proceed" white,
  Alert step renders the row red in the register.
- **Step properties**: First Step, Complete (terminal), Alert Step (red-flag the row), Approved
  to Proceed (ticks an "Approval to Proceed" column in the register — i.e. work may continue
  while the condition is open), Days to Complete, **Private** (until a non-private step is
  reached the approval is invisible to collaborators and to anyone without the `Approval View
  Private` authority — this is how internal pre-approval review is implemented).
- **Action properties**: Requires Comment (enforces **minimum 25 characters**), Priority
  (controls dropdown ordering for the approver), Requestor Can Action, Addressee Can Action,
  Users Can Action (named users, and **they get notified** when such an approval is raised),
  Roles Can Action (role-wide, and explicitly **does not auto-notify**).
- Workflows can be cloned, exported/imported as `.cpx`, and CivilPro ships a downloadable NCR
  Advanced Approval Workflow template with a three-part structure: Internal Review (private
  pre-approval) → Standard Approval Review → Conditional Completion / feedback loop.
- The Sept-24 template refresh added per-category action verbs and resubmit loops:
  Witness Point → Witnessed / Witnessed with Comments / Not Witnessed / Reject / NCR;
  Hold Point + NCR → Approve / Conditionally Approve / Manually Approve / Other Approval /
  Reject / Request NCR, with `Complete Condition` → `Condition Met` | `Revise Completion`;
  Check Item → Approve / Approve with Comments / Not Checked / Reject / NCR.
  Rejection is a **loop, not a terminus**: rejected → Requestor assigns "Resubmit X" → status
  returns to "X Requested". Explicit note: *"The Hold Point will remain as 'Rejected' if the
  requestor does not perform this action."*
- Explicit anti-pattern in the docs: do **not** use "Users can action"/"Roles can action" to
  cover staff who have left — use Reassign Requestor in bulk on the Approval register instead.

### 1.3 Users, roles, permissions

**Three account classes** (*"What is a User vs an Associate?"*, *"Add (Invite) Users"*,
*"User Roles"*):

| Class | Seat | Determined by |
|---|---|---|
| **Administrator** | Paid | Role has at least one `Admin/Delete` |
| **Full User** | Paid | Role has at least one `Add` or `Edit` |
| **Associate User** | **Free** | Role is View / View Limited only |
| **Contact** | n/a | No login at all; can receive correspondence (Contract Notices, Test Requests) |

Seat class is **derived from the role's permission matrix**, not assigned — and the invite dialog
tells you the seat impact before you send. *"Right now, Associates are unlimited. However, this
may change in the future."* Target use for Associates: field agents annotating checklists, and
approval agents signing off.

**Role model — two orthogonal tabs.**

*Access tab* — five columns (`View Limited`, `View`, `Add`, `Edit`, `Admin/Delete`) × ~50 modules.
The full module list, recovered from the default 'Client' role table in *"User Roles"*:
Dashboard, Notification, Lot, Lot Review, Ncr, Test, Checklist, Approval, Quantity, Itp, Photo,
Filestore, Email, Contact, Unit, Tag, Atp, Survey, PunchList, Variation, Progress Claim, Document,
Contract Notice, Site Diary, Instruction, Incident, Risk, Daycost, Invoice, Purchase Order,
Receipt, Forecast, Work Type, Area Code, Control Line, Test Method, Test Property, **LotMap
Definition**, Lot Review Status, Schedule Item, Supplier Link, Resource, Cost Code, Custom
Register, Custom Reports, Project Administration, Notification Template, Contract Notice Template,
Workflow, Master Supplier, Subcontractor Management, Group, Teambinder, **Plan**, **PlanSnapshot**,
**Coordinates**, **PlanFeature**.

`View Limited` is the key primitive: the user sees only records **allocated/linked to them**,
**raised by them**, **addressed to or CC'd to them**, or where they are **Notice To / On Behalf
Of**. Permissions *stack* — granting both View Limited and View collapses to View, so the docs
advise picking one.

*Authority tab* — 20 discrete action grants, orthogonal to Access:
Conform Lot, Guarantee Lot, Publish NCR, Publish Approval, ITP Collaborate, ITP Approve Internal,
Checklist Check, Checklist Verify, Checklist Approve Internal, Approval Collaborate HPWP,
Approval Collaborate NCR, Approval Collaborate Independent, **Approval View Private**, Test
Request Collaborate, Survey Collaborate, Contract Notice Collaborate, **Limit NCR View To
Published**, **Limit Test Request View To Completed**, **Limit Survey View To Completed**, Lot
Review Collaborate.

Two structural mechanics worth stealing:
- **"Collaborate" authorities** let an external party act on the approvals/tests/notices
  *addressed to them* while keeping the role View-only — i.e. **the approver keeps a free seat**.
  This is the commercial hinge of the whole model.
- **"Limit …" authorities are inverted permissions**: they *override* every other role the user
  holds, hiding drafts. The 2026-07-27 *"Add / Edit Roles"* article adds a sharp operational
  warning: on an internal role these make records *"seem to disappear the moment they're
  created – reserve the 'Limit' authorities for external or Client-facing Roles."*

**Role stacking**: multiple roles on one project → highest Access and Authority wins, *except*
the Limit authorities which always win downward. Docs repeatedly say don't do it.

**Global Roles** vs project roles: a Global Role applies to every project current and future.
A Global Role with `Add` on Project Administration **can create projects**; a project-scoped role
with the same permission **cannot** — it can only edit that project's settings/details. That's a
subtle, deliberate escalation boundary.

**Shipped roles**: Project Administrator, Project User, Client, Cross Project Admin, Supervisor,
Tester. Clone-then-tweak is the recommended authoring flow (right-click → Clone Role).

**Purchase Order Approval Limit** is a per-role dollar field — a monetary authority ceiling
attached to the role object itself.

**User lifecycle** (all in *Administrator - Getting Started*, refreshed 2026-07-24/27):
Team panel (roster) · Invites register (invites **expire after two weeks**; right-click Resend /
Delete Invitation; "Delete Expired" bulk action) · Add Existing Users to an Existing Project (no
invite needed, just link) · **Bulk Assign Role** in the Team screen · Change a User's Role
(= delink + relink, no history lost) · Assign a Global Role · Check Username (admin looks it up;
username column addable via column chooser) · Promote Contact to Full User (Subscription Admins
only) · Remove from project vs **Mark Inactive** (frees the paid seat) · Re-activate (must be
linked to ≥1 project first) · Demote User → Contact (Desktop only) · **Admin password reset is
Desktop-only — explicitly "NOT supported in Cloud"**.

**The Contact/User collision trap** (documented twice, in *"Add (Invite) Users"* and
*"Troubleshooting - User unable to sign in"*): if a person exists as a Contact and is then
invited, acceptance converts the *latest matching* Contact into a User; older duplicate Contact
entries survive, and **"A notice addressed to a Contact entry cannot be opened by the person's
User account."** Recommended mitigation is renaming stale entries "(Contact Only)". This is a
data-model wart shipped as documentation.

**Subcontractor collaboration** (*"Collaborate with Subcontractors"*): a Subcontractor register
under QA Setup. Teams are **not** a permission construct — *"roles can only be assigned at
individual user level… The purpose of having subcontractor teams is to facilitate assigning a
collection of users to lots."* Flow: create restricted roles (View Limited + targeted Add/Edit)
→ invite users → create Subcontractor entry → link users → link Lots. Two operating models are
offered: head contractor raises the lots and the subbie fills in checklists/tests/files, or the
subbie raises their own lots. Best-practice note: link Lots to the *subcontractor entry* rather
than to individual users, so replacing a person doesn't mean re-linking 50 lots.

**Addressee Groups** (*"Create Groups"* / *"Use Groups"*): named user groups usable in the
approval "Addressees" field and Contract Notice "Notice To". Behaviour when an approval goes to
a group: everyone is notified, **first responder releases the item**. There's a "Show only users
that can approve" filter in the picker. Known bug documented in the Desktop article: *"the 'Link
Selected' tab is not working"* — workaround is to add multiple users via Cloud.

### 1.4 Registers, views and filtering

*"Navigate the Main User Menus (C)"*, *"Navigate the Register Page (C)"*, *"Filter Search and
Group Data in Registers (C)"*, *"Set Up and Save Custom Views in Registers"*, webinar `QOs-tXRBxzI`.

Cloud screen anatomy — five colour-coded zones: **Main Menu** (top-left hamburger + headings),
**Project & Account Menu** (top-right: project switcher, avatar → My Account / log out),
**Grid Menu** (context-specific action buttons left, filter options right, drag-to-group bar),
**Register View** (the grid), **Action Menu** (right rail: Global Action, Search box, Action on
Selection, Reports, **Related Items**, Views).

Grid capabilities: column chooser (drag field into header), drag-header-to-group-bar grouping
(multi-level), filter row (Excel-style per-column), header filter dropdowns, item search +
**Advanced Search** (multi-condition builder), sort by header click (shift-click for secondary),
checkbox multi-select with shift-range and Ctrl+A, infinite scroll / load-on-demand, item count,
and a per-row "detail row viewer" (Detail / See Related Data / More) added specifically for
tablet users. Unique identifiers render as blue underlined links to the detail page.

**Deliberate design decision worth noting**: *"information cannot be edited in the grid to
prevent accidental editing so all of the editing is performed in the respective detail views."*
Desktop is the opposite — grid editing behind an "Enable Editing" toggle (Ctrl+E), plus **Fill
Up / Fill Down** (Ctrl+Alt+D / Ctrl+Alt+U) for bulk-populating dropdown columns, which the web
app has no equivalent for.

**Views system — three tiers:**

| | User Custom Views | Project Custom Views |
|---|---|---|
| Restricted to one user | Yes | No |
| Shareable to selected users | Yes (needs `Admin` on Project Administration) | n/a — visible to all project users |
| Scope | replicated across **all** projects the user can access, unless "Save to this Project Only" | single project only |
| Create permission | any user | needs `Add` on Project Administration |

Registers supporting saved views (Web): Project, Lot, Test Requests, NCR, Approvals, Quantity,
Progress Claims, Schedule Items. Desktop's list drops Approvals and adds ATP.

**Magic view names** — the sharpest small idea in the product: a view named **`Default`** becomes
the register's landing view; a view named **`Mobile`** is auto-loaded on mobile devices. Fallback
chain is Mobile → Default → built-in Standard. Confirmed in the webinar: *"it will scan down the
views panel and it will look for a view called default; if it can't find a view called default it
will default to the standard view."*

Export: right-click → **Print Grid** downloads the grid as shown (webinar presents this as *the*
answer to "how do we get data into Excel"). Desktop additionally offers Export to Excel
(WYSIWYG) and Export to Excel (Data Aware, retains formulas/grouping). Registers exportable per
*"Export Registers as Excel Files"*: Lot, ITP, Test Requests, Approval via Print Grid; Work
Types / Area Codes / Control Lines via Global Action → Export All (CSV); Test Method and Test
Property registers **cannot be exported at all**.

There is a documented keyboard-shortcut sheet for Cloud (arrow navigation, F2 edit, Alt+↓ open
dropdown, Ctrl+arrows to move between header/filter/data/pager, Ctrl+Space select, Ctrl+F search
panel) — inherited straight from DevExtreme.

### 1.5 Notifications

*"Create, Send and Edit Notifications"*, *"Customize Notification Templates"*, *"Monitor Emails
Sent via Email Log"*.

- **Notify Selection**: select rows in any major register → Action on Selection → Notify
  Selection (or right-click). The selected items' details are auto-attached — the pitch is
  explicitly "no copy-pasting record details into an email". Fields: Notice To, CC, Date
  Required. Available on Lot, NCR, Checklist, Survey, Approval, ITP registers and more.
- Every notification lands in a **Notifications register** (bell icon) with an **Items** tab
  (per-item edit) and a **Close Out** tab (Action Date, Action By, Action Summary), so a
  notification doubles as a lightweight action tracker. Publishing locks the message.
- **Only one notification template ships: "Lot Conformance Query."** Everything else is
  "No Template" free text. This is a striking gap for a product this configurable.
- **In-app notifications** are auto-generated **only for approvals** (raised or actioned), and
  the docs are emphatic that they do *not* replace the approval request: *"you will still need
  to notify the approver when you create the approval request."*
- Notification method is a **per-user setting** (User Settings → Notifications Method, with a
  "Project Setting" option meaning inherit). The Superintendent guide advises setting it to
  in-app only if email volume is a problem.
- Templates exist at two levels: **subscription** (Projects register → Notification Templates)
  and **project** (Other Setup → Approval & Notification Templates), edited with a Field Chooser
  drag-in; both articles carry a loud warning that breaking a default template breaks
  notification delivery. Nice touch in the Desktop article: *"consider inviting yourself as an
  Associate Role (free) using a secondary email address"* to test the invite email.
- **Email Log** register (Document Management → Email Log) records every approval / test request
  / survey request email sent, with Related Items linking back to the source record and visible
  approver responses. This is a real audit surface we don't have an equivalent of.
- **Approval No Padding** setting (e.g. `0000` → approval 19 renders as 0019) exists at both
  subscription and project level, purely for notification cosmetics.
- **DMS Auto CC email** on Project Settings blind-copies nominated addresses on all project email.

### 1.6 Reporting

*"Reports"*, *"Emailing Reports (D)"*, *"Digital Signatures for Conformance Report PDFs"*,
*"CivilPro Dashboard"*, *"Why have my Lot Conformance / Lot Summary / Conformance Folio reports
stopped downloading?"*

- Every register has a printer icon → its own report set. Lot register alone: Conformance
  report, Quantity Sheet, Measure Up Sheet, Conformance Declaration, Lot Summary, Conformance
  Folio. **Report Options** is a dropdown of on/off toggles per report section.
- **Custom Reports** exist but are heavily discouraged: you cannot change titles or headings;
  setting a customised template as default *"will apply to all the users accessing the same
  project"*; and — critically — **a custom report silently breaks digital signing** (*"Check you
  don't have a custom report… CivilPro cannot sign the document. You will need to delete your
  custom report and recreate any changes from the new default report."*).
- **Lot Summary** = one indexed PDF per lot bundling checklist, tests, NCRs, approvals, survey,
  attachments, with duplicate attachments included only once. **Conformance Folio** = the same
  content as a folder structure for a DMS.
- **Digital signatures** (2026-04-29, one of the newest features): real PKI signing applied at
  PDF-render time using CivilPro's certificate, producing a **Declarations** section. Configured
  in Project Settings → **Handover** tab as a list of handover actions: `Source` = Conformed |
  Lot Review, `Status` (which Lot Review Status triggers it), `Signoff Text`, `Is Active`. The
  signature is that of whichever user satisfied the condition. Users may optionally upload a
  **Wet Signature** image in My Account → Settings; otherwise their name renders in cursive.
  The docs make a genuinely good argument that the image is theatre and the certificate is the
  substance. Preview shows names/dates only — signing happens on PDF export.
- **Dashboard**: five registers (Lot, NCR, Test Request, Survey Request, Approval) × four chart
  types (Status by cutoff date, Activity month-to-month, Status at EOM, By User). Filters:
  Cutoff Date (**defaults to end of last month** because it's built for EOM reporting — a
  documented gotcha), User, per-register status, Approval Types, "days open for trendline"
  (default 60), recent-months window, "separate pre-opened lots" (lots with no Date Work Started
  render grey). **Stated limitation**: no breakdown by approval sub-type or action; for that you
  go to the register and filter.
- Documented failure mode: Lot Conformance / Lot Summary / Conformance Folio **stop downloading**
  when too many large photos/filestore docs are linked. The official fix is to *turn photos off
  in the report*.
- Desktop can email reports either via the local mail client or via a direct SMTP send
  configured by a system administrator. Cloud has no equivalent article.

### 1.7 Document management and photos

- **Filestore** = the flat central file repository. **100 MB per file on Web; no limit on
  Desktop.** Files are linked to records via the chain icon → `+` from either side. Linked files
  can be renamed in-place from any register via the ellipsis menu (with a documented cosmetic
  bug: the file number appears to change until refresh). Storage carries a soft warning:
  performance degradation *"and incur a small additional monthly cost should significant amounts
  of data accumulate (CivilPro Team will reach out…)"*.
- **Photos** register: 50 MB per photo, drag-drop or "Choose File", plus an in-browser **camera
  capture** on the web register for site use. Linkable to Lots, Variations and NCRs — **but
  linking a photo to a checklist item must be done from the Checklist register**, not from
  Photos. Desktop has a bulk import with per-file dimension selection and image rotation tools.
- **Controlled Documents**: register of document → revisions → filestore files assigned to a
  revision, plus a **Distribution List** of Contacts/Users. `Last Rev.` / `Last Rev. Date` are
  computed, not editable. CSV import supported (Desktop has a column-mapping wizard; mandatory
  columns Doc No, Description, Document Date, Date Received).
- **Controlled Document Transmittals — Desktop only.** Flow: "List Untransmitted Users" →
  "Transmit to selected" creates a transmittal row per recipient → "Notify Individual" or
  "Notify Summary" actually sends, auto-attaching the linked filestore docs **plus a Transmittal
  Acknowledgement form for signature and return**. Two documented sharp edges: creating a
  transmittal record does *not* send anything; and transmitting **grants visibility** to
  View-Limited users, revocable only by deleting the transmittal record.
  The Cloud article (2026-02-26) still says transmittals are *"under development in the Web
  app… this will be updated very shortly"* and offers two workarounds: submit via **Independent
  Approval**, or attach to a **Contract Notice**.

### 1.8 Contract Notices (RFI / correspondence)

*"Contract Notices"*, *"Set Up Contract Notice Templates"*, *"Create and Send a Contract
Notice"*, *"Contract Notice Template Field Chooser"*, transcript `kT7mhB4nmu4`.

Umbrella module for outbound project correspondence: RFI, Notice of Variation, Corrective Action
Request, Extension of Time, Letter to Administrator, and anything else you template.

- **Templates**: Template Name, Abbreviation (e.g. NOV — drives the Ref No series), Subject and
  Body rich-text with a **Field Chooser** of auto-complete merge fields, `Response Expected?`
  flag, `Inactive Template` flag.
- **Merge-field model** (the Field Chooser article is essentially a schema dump): two classes of
  field. *Unique* fields (Project No/Name, CN Ref/Date/Subject/To/From/On Behalf Of + their
  company/address/phone/email/mobile variants, Notice Ref With Link, Notice Link AsURL) may
  **not** go inside a table. *Series* fields — Related Notices, Approvals, Variations, Lots,
  Photos, ITPs, Filestore, Controlled Docs, Incidents (D), Instructions (D) — may, and the table
  repeats per linked record: row 1 = heading, row 2 = the merge fields.
- **Lifecycle**: New Contract Notice → pick template + Notice To (must be a full user, associate,
  Contact, or Group) + optional On Behalf Of + Date Required → draft body → **link related
  records** (this is what populates the series merge fields) → **Render** (resolve placeholders)
  → **Publish** (locks it, makes it visible in the register to others) → **Email**. Clicking
  Email does all three. Drafts are invisible to clients until published.
- **Responses tab**: recipient clicks the emailed hyperlink, lands on the notice in CivilPro,
  sees Published Notice / Related Items / Responses, clicks **Add Response**, sets Person to
  Action + Date Action Required By + message + attachments; the originator is notified. Responses
  are individually **Mark Complete**-able; the notice as a whole is then **Closed Out** (Closed
  by + Date + note), and the register row turns green. Register shows an "0 of 1 responses"
  outstanding counter.
- Permission note from the Superintendent guide: *"external roles can view and respond to
  Contract Notices by default. Creating and issuing notices to the Contractor… is a separate
  permission tied to a different user type"* — i.e. two-way correspondence requires the head
  contractor's admin to upgrade the client.
- Transcript gotchas worth knowing: you **must save before linking related items or you lose
  unsaved body edits**; the presenter suggests drafting in Notepad and pasting; and table edges
  in the template need trial-and-error because the editor's viewport doesn't match the rendered
  PDF.

### 1.9 Teambinder / InEight integration

Five articles (*"Teambinder Integration"*, *"Ineight (Teambinder) - Setup Requirements"*,
*"Configure Teambinder - Connection and Authentication"*, *"Configure Teambinder - Field
Mapping"*, *"Match and Link Lots and Contacts/Users…"*, *"Use the Teambinder Functions in
CivilPro"*, *"Add CivilPro Lot to Teambinder"*).

Positioning is explicit and worth internalising: *"CivilPro is a construction management system
for compiling the QA records that are submitted to a Document Management System like Teambinder
on completion of works."* CivilPro concedes the DMS layer and integrates into it.

- **Licensed add-on with a processing fee**; connection + field mapping are performed by CivilPro
  staff under Project Operations and are *"not visible to end users"*.
- Three auth modes: **Master username/password** (single service account), individual credentials
  (4–24 h sessions, not stored), or **Teambinder-hosted auth** (30-day sessions, best, requires
  app registration).
- Functions on the Lot register: Show Teambinder Columns, Open in Teambinder, Update Doc Cache
  for Selection, Create in Teambinder, Update in Teambinder, **Lot Summary to Teambinder**,
  Lots from Teambinder, List Teambinder Docs for Lot, Upload Filestore Docs to Teambinder.
- Gating: role needs Teambinder Add/Edit **and** the lot's most recent **Lot Review Status must
  permit synchronisation** — a nice composite gate.
- Matching: Lots by lot number (partial-prefix search + Find Matches + manual override + Create
  New); Contacts **by email only** — *"If the contact has a different full name but the same
  email in TB, they will still be matched"*. There is **no way to create Teambinder users from
  CivilPro**.
- Four lot-numbering strategies (A identical, B custom-identical, C independent, D CivilPro
  number + prefix), with A/B/D recommended and C discouraged.
- Validation preview with `Is Validated` and `Identified Synch Issues` columns; the two usual
  failures are a required Custom Register value missing, or a contributing user unmapped.
  Invalid lots get no number and are silently skipped on upload.
- Four hard limitations documented: (1) master-account mode means **every record in Teambinder is
  attributed to the integration account**, destroying per-user attribution downstream; (2) the
  link cache is **only ever updated manually**; (3) sync is lot-by-lot; (4) **deleting a lot in
  Teambinder permanently burns that lot number** — the only remedy is renumbering the lot in
  CivilPro. Filestore sync only works in the context of a lot.

### 1.10 API, Power BI, integrations

*"CivilPro API - Concepts"*, *"How do I create Custom API Integrations…"*, *"How do I use the API
with Postman Scripts?"*, *"CivilPro Power BI API Connector"*, *"Login Parameters for Custom
Integrations"*.

- Dogfooded API: *"The CivilPro API is used by the CivilPro web UI, so anything you can do in
  CivilPro web can be done via the API."* Advice to integrators: perform the action in the UI and
  watch the network tab to find the endpoint. Swagger at `/swagger/index.html`, NSwag-compatible.
- Auth: `POST /api/Account/Authenticate` with **the password base64-encoded** → Bearer token that
  embeds UserId **and ProjectId**. Nearly every endpoint is project-scoped; to change project you
  re-authenticate, or append **`?qryProjectId=<id>`** to any GET to cross-scope (their concession
  to multi-project aggregation).
- Query language is DevExtreme `DataSourceLoadOptions` passed as JSON: `Filter`, `Sort`, `Skip`,
  `Take`, `Select`, grouping and aggregation — server-side. Repeated, almost anxious warnings to
  shape queries so as not to *"place undue pressure on your resources resulting in either poor
  user experience or additional costs for higher resourcing."*
- **No API versioning**: *"we do not maintain or make public old versions of our API"* — breaking
  changes are handled by telling you to re-run code generation.
- **Power BI connector**: uncertified `.mez` requiring every user to enable "Allow any extension
  to load without validation or warning" and, on networks, an on-prem gateway. Pre-built stubs
  for Lots, NCRs, Approvals, Survey Requests, Test Requests, plus ~24 statistics POST endpoints
  (`lotStats`, `lotEOMStatusStats`, `lotActivityStats`, `lotStatsByUser`, and the same four
  shapes for testRequest / Ncr / Survey / Approval). **Does not support SAML/SSO** — the official
  workaround is to *"create an Associate user with an email address that is not within specified
  email domains requiring SAML/SSO"*, i.e. deliberately provision a password-auth back door to
  bypass your own SSO enforcement.
- **Deep-link parameters** for embedding: `?returnUrl=lots/23`, `?returnUrl=lots&projectid=1`,
  and the SAML equivalents `?redirect=…`. Cheap and useful.

### 1.11 SSO, MFA, security posture

- Identity providers: **CivilPro Identity**, **Microsoft Identity** (Entra), **Google Identity**,
  **SAML**. Enabled per-subscription under Subscription Settings → Security, with a **permitted
  domains** list for Microsoft SSO / SAML. Once enforced it applies to both Cloud and Desktop.
  Warning in the sign-in article: *"You can only choose one SSO option so be sure you select the
  correct one the first time."*
- **SAML is a paid line item**: $500 + GST setup, $500/yr + GST subscription, justified in the
  article as real cost of certificates and per-customer deployment config.
- Desktop cross-project settings expose two extra hardening switches the Cloud article doesn't:
  **"Disable CivilPro Identity for users with SSO configured"** and **"Prevent users modifying CP
  Identity Status"** — explicitly designed for *"enforce SSO for your internal resources but allow
  CivilPro Identity for external collaborators"*.
- **MFA is email-code only and all-or-nothing**: *"Once it is switched on, it is applied to the
  entire account, and cannot be applied to just a selected number of users."* No TOTP, no SMS.
- **External-user SSO** (*"External Users Signing in to CivilPro with SSO"*, 2026-04-12 — one of
  the newest articles) is essentially a support-deflection document: CivilPro can't approve the
  app in another company's tenant, so either the subbie's own Entra admin consents, or you invite
  them as an Entra B2B guest. Fine engineering answer, brutal for onboarding a small subbie.
- IP whitelisting: Azure Australia East ranges + SendGrid `smtp.sendgrid.net` must be allowed;
  Desktop users hitting the SQL firewall see *"Your IP address … is not permitted"* and must
  re-authenticate via API (which clears their subnet on the firewall — dynamic-IP support is a
  connection-file API key).
- Deletion posture: *"Why you should be careful about deleting data in CivilPro?"* recommends
  status-based soft closure over deletion and role-limiting Delete. **Data recovery is a paid,
  hourly service**, and — the sting — *"Files in Filestore and Photos can be recovered for up to
  the last 30 days only."*

### 1.12 Onboarding, support, account and billing

- **Onboarding assets**: a downloadable **Project Success Checklist** (chronological setup →
  handover with links to web + desktop guides and video timestamps), a timestamped **Welcome to
  CivilPro overview video** (00:00 intro → 29:25 lot review status), a persona-specific
  **"Introduction for Administrators, Superintendents, and Client Representatives"**, a
  worked-video-tutorials library, and an in-app "?" that searches the help centre without leaving
  the app. Support: Zendesk, **Australia-based, Mon–Fri 8:30–5 AEST, most inquiries answered
  within 24 h**. Named humans appear in articles (e.g. the overview video ends with a direct
  invitation to book a Teams call with a named account manager).
- **Paid services as a normalised pattern**: *"book in some configuration time with our CivilPro
  support team"* for roles/permissions; hourly rates for Power BI support and connector
  certification scripts; 2–4 h of dev time to produce a data export on cancellation; hourly data
  recovery.
- **Billing** (*"We need to add/remove users. How will that be billed?"*, *"Cancellation & data
  management"*): annual plan, **payment by invoice**, renewal invoice one month out. Adding
  seats mid-term = prorated, **but you must contact their team** — no self-serve. Removing seats
  only takes effect at renewal. No refunds; on cancellation you keep access to end of term.
- **Cancellation offers three data outcomes**: keep paying **~$50/month** to have them host your
  dormant data; pay for a one-off backup export (2–4 h of dev time) and delete; or delete
  everything free and irrecoverably. They actively upsell option 1.
- **Infrastructure is billed through to the customer**: Azure DB tier pricing (as at Aug 2025)
  **S0 $1,980 / S1 $2,420 / S2 $5,940 + GST per year**, with indicative user bands 1–15 / up to
  100 / 100–200+. Every database starts on S0 and gets upgraded reactively when it feels slow.
- **Migration from Desktop v10** (*"Upgrade from CivilPro Desktop v10…"*): customer supplies a
  full DB backup + all filestore documents; migration runs hours-to-a-day, scheduled on weekends;
  **custom reports are the one thing that cannot be migrated**; running v10 alongside v12 is
  discouraged. Sales framing of the upgrade explicitly names *"Full account management: all users
  are now named users… No more support ticket requests and searching through your computer IP's
  to find out who has been assigned a seat"* as the **top-rated improvement by migrated
  customers** — a revealing signal about how bad the previous licensing model was.
- **Credit account** is offered across the **Herga group**: BuildingPoint Australia, Sitech, UPG,
  Information Alignment, and CivilPro. CivilPro is part of a Trimble-reseller hardware/software
  group, not an independent SaaS.

---

## 2. Key UX flows, step by step

### 2.1 Cold start → first Lot (the admin path)

1. Sign in at `https://{company}.civilpro.com` (per-customer subdomain). Land on the **Project
   Register**.
2. **Roles first.** Main Menu → Roles → New Role (or right-click an existing → Clone Role).
   Name it, optionally set a Purchase Order Approval Limit, tick the Access matrix (5 columns ×
   ~50 modules; "All" checkboxes select a whole column), then the Authority tab. Save.
3. **Create Project.** Click into any existing project first (else roles won't be offered) →
   back to Projects → New Project → 7-step wizard (details → map pin → users+roles → contractor
   → **import from existing project / REPO** → review → Save).
4. **Invite users.** Team → NEW USER → pick existing user or type an email, pick Role, confirm
   project. The dialog **shows whether that Role consumes a paid seat**. SEND LINK. Invite sits
   in the **Invites** register for two weeks. Tip in the docs: to invite one person to several
   projects, send the invites back-to-back — on accepting the first they're prompted with all
   pending invitations at once.
5. **Project Settings**: timezone, logo, DMS auto-CC, QA Control parameters, GST, notification
   options.
6. **QA registers**: Other Setup → Approval Workflows → Global Action → Create Basic Workflows
   (six defaults in one click) → Work Types → Area Codes → import ITPs from REPO/CSV → Contract
   Notice Templates.
7. **Optional**: Control Lines (chainage datums), construction drawings, Contacts, Groups,
   Custom Registers.
8. Create first Lot → attach ITP → Checklist exists.

The whole path is ~8 screens deep and assumes a competent administrator. There is no wizard, no
progress indicator, and no in-product checklist — the "Project Success Checklist" is a **PDF
download**.

### 2.2 Register → filtered view → shared view (webinar `QOs-tXRBxzI`, verbatim flow)

1. Right-click the header bar (or the ▽ top-right) → **Column Chooser** → drag the desired field
   (e.g. Work Type) into the header.
2. Right-click → **Show Filter Row** → type a term (e.g. "Surfacing") → Enter. The filter row
   stays active across registers for the session.
3. Right rail → **Views** → *User Custom Views* → SAVE VIEW → name it → (optionally tick "Save to
   this Project Only", else it replicates to every project you can access).
4. To make it the landing view, name it **`Default`**. To make a stripped-down mobile layout,
   name it **`Mobile`**.
5. For a shared team view: build the view, then save under **Project Custom Views** (requires
   `Add` on Project Administration) — everyone on the project sees it.
6. To push a view to one specific person (the client-rep use case): save as a User Custom View →
   click the **three dots** next to the view name → **Share** → select the project → select the
   users → Save. It appears in *their* User Custom Views.
7. Export: right-click → **Print Grid**.

The webinar's worked examples are instructive because they show what CivilPro users actually
need: (a) an **end-of-month meeting view** grouping lots by a "Engineers" custom register with
columns for outstanding test requests, unapproved NCRs, incomplete checklists, review status and
a notes column; (b) an **open approvals view** on the Approvals register filtered `Completed =
false`, grouped by approval Type then by Requestor, so a PM can see who owes what.

### 2.3 Superintendent / client-rep onboarding (`rFFNqMt4cYY` + *"Introduction for
Administrators, Superintendents, and Client Representatives"*)

This is CivilPro's best-executed flow and is explicitly a **10-minute setup ritual** sold to the
approving party:

1. You're invited by the Contractor; you only see projects you were invited to.
2. Avatar (top-right) → **My Account → Settings → Start Register → Approvals**. Save. Now you
   land on your action list, not the Lot register.
3. On the Approvals register, set a column filter to your own role/name (e.g. Principal's
   Representative) and `Completed = false`.
4. Save that as a view named **`Default`**.
5. Optionally set Notification Method to in-app only to kill email volume.
6. Daily loop: open item (from the emailed hyperlink or the register) → review **Related Items**
   (attachments, photos, the live checklist with completion-to-date) → **Action Step** → pick
   from the workflow's Action dropdown → add comments/attachments → **Action**. `View Progress`
   shows the state machine.
7. Bulk: *"Select multiple items on the same workflow and apply one response to all of them at
   once – handy after a single site visit covering several inspection points."*

Two approval delivery paths are documented: **email hyperlink** (remote) and **QR code**
(on-site — the contractor generates it, the approver scans, signs in on their phone, releases).
Group addressing means first-to-respond releases. When a representative leaves, the contractor
multi-selects outstanding items and adds the new person as addressee — nothing is re-raised.

### 2.4 Contract notice (RFI) round trip (`kT7mhB4nmu4`)

Other Setup → Contract Notice Templates → New → name + abbreviation + Subject built from Field
Chooser tokens (`{project no} - {project name} - RFI {CN ref}`) + Body with tables → Save.
Then Document Management → Contract Notices → New → pick template → Notice To / On Behalf Of /
Date Required → confirm template screen (a pure "are you sure" step, no data entry) → draft body
→ **Save before linking anything** → link Lots / Photos / Filestore / Variations via Related
Items → Render → Publish → Email. Recipient gets an email with the notice body inline plus a PDF
attachment plus a deep link. They open it in CivilPro, read Published Notice, inspect Related
Items, go to **Responses → Add Response** → person to action, attachments, body → Save →
notification fires back. Originator sees "0 of 1 responses", marks the response Complete, then
**Enter Close Out** on the whole notice → row turns green.

---

## 3. Terminology and data model

**Core spine.** Company/subscription (one **single-tenant database**, one subdomain) → Projects →
Lots → everything else. A **Lot** is *"a specific, discrete section of the physical work or a
process"* — explicitly including non-physical processes (management plans, commissioning). Lot
statuses: **Open** (neither), **Guaranteed** (complete and compliant but awaiting e.g. 28-day
results), **Conformed** (all tests received and compliant, checklists complete, NCRs closed).
Plus a separate **Lot Review Status** layer — customer-defined statuses (e.g. "Pending Client
Review", "Administrator Reviewed and Approved") used for client-side acceptance, digital
signature triggers, and Teambinder sync gating.

**Classifiers**: **Work Type** (2-char code, e.g. SG = subgrade), **Area Code** (≤4 chars, e.g.
MCSB = main carriageway southbound), **Control Line** (linear datum for chainage/offset), plus
arbitrary **Custom Registers**. Work Type + Area Code + index compose the default Lot Number.

**Vocabulary that differs from ours**: *Register* (= our list/index page), *Related Items* (= our
linked-records panel, but a first-class, universal, bidirectional link primitive), *Filestore*
(= document/blob store), *Controlled Document* (versioned doc with a distribution list),
*Transmittal* (a recorded distribution event), *Contract Notice* (any outbound correspondence
incl. RFI), *Specifications* (= ITPs; the two words are used interchangeably),
*Checklist* (= our ITP completion instance, derived from an ITP), *ATP*, *Punchlist*,
*Independent Approval* (a standalone approval not attached to a lot or checklist),
*Approval to Proceed* (a register column meaning "conditionally released, work may continue"),
*Repository / REPO* (template project), *Associate* (free view-only seat),
*Addressee* vs *Requestor* (the two workflow parties), *Step* vs *Action* (state vs transition),
*Random Stratified Sampling*, *Guaranteed Lot*, *Declarations* (signature block on a report).

**Permission model, formally**: `Role = { name, POApprovalLimit, Access[module][level],
Authority[action] }`. `level ∈ {ViewLimited, View, Add, Edit, AdminDelete}`. `UserProjectRole` is
a many-to-many link (user × project × role) plus a separate `GlobalRole` link (user × role,
applies to all projects). Seat class is a **derived** attribute of the union of a user's roles.
Resolution: union of permissions, highest wins, except `Limit*` authorities which are subtractive
and win globally.

**Approval workflow model**: `Workflow { category ∈ {HoldPoint, WitnessPoint, NCR, CheckItem,
PurchaseOrder, Independent}, Steps[], Actions[] }`; `Step { name, isFirst, isComplete, isAlert,
isApprovedToProceed, isPrivate, daysToComplete }`; `Action { name, fromStep, toStep,
requiresComment, priority, requestorCanAction, addresseeCanAction, users[], roles[] }`.

**Approval categories are fixed at six.** That is a real modelling constraint we do not share.

---

## 4. Strengths worth stealing

1. **Magic view names `Default` and `Mobile`.** Zero-UI personalisation: name a saved view
   `Default` and it becomes the landing view; name it `Mobile` and it becomes the phone layout,
   with a Mobile → Default → Standard fallback chain. Cheap to build, high perceived
   sophistication, and it solves "the mobile layout is wrong for my role" without a mobile layout
   editor.
2. **Push-a-view-to-a-user.** The single best idea in the corpus. An admin builds a filtered,
   grouped, column-chosen view and *shares it into another user's account*, then phones them and
   says "click this one thing". It converts a reluctant client rep from a support burden into a
   functioning user. Directly applicable to our subbie and client personas.
3. **"Start Register" as a per-user setting.** One dropdown that makes the app open on the
   register that person actually works in. Paired with a saved Default view it produces a
   personalised action inbox with no inbox feature built.
4. **Seat class derived from permissions, with "Collaborate" authorities.** Approvers, testers
   and client reps get *free* accounts because their role is View-only + a Collaborate authority
   that lets them act on items addressed to them. This is the commercial mechanism that gets the
   whole project ecosystem into the product without a per-head fight, and the invite dialog
   surfaces the seat impact *before* you send. We should confirm our free-subbie model has an
   equivalently crisp, visible rule.
5. **`View Limited` as a first-class access level.** Not a boolean "own records only" flag bolted
   onto one register, but a fifth column in the whole permission matrix with a precise definition
   (linked to me / raised by me / addressed or CC'd to me / notice-to me). It's what makes
   multi-subcontractor tenancy inside one project work.
6. **Flowchart approval workflow editor with per-transition permissions.** Steps and arrows,
   clone-and-extend from six generated defaults, importable `.cpx` templates, and per-action
   controls (`Requires Comment` with a 25-character minimum; `Priority` ordering the approver's
   dropdown so the most likely answer is first; four independent "who can action this" grants).
   The `Private` step property implementing internal pre-approval review is genuinely elegant.
7. **Rejection as a loop, not a terminus.** The Sept-24 template refresh exists specifically so
   workflows *"continue until a resolution is reached, without the requirement to 'Short-Circuit'
   an approval workflow."* Reject → Resubmit → back to Requested, all on one record with the full
   exchange preserved. Same for Conditionally Approve → Complete Condition → Condition Met /
   Revise Completion.
8. **`Approval to Proceed` as a distinct register column.** A visible, filterable state meaning
   "conditionally released, work continues, condition still open". Better than overloading a
   status enum.
9. **Notification-as-tracker.** Every "Notify Selection" creates a register row with an Items tab
   and a Close Out tab (Action Date / Action By / Action Summary). A notification isn't fire and
   forget; it's a small trackable obligation. Cheap to add, and it makes the register the system
   of record for chase-ups.
10. **Email Log register.** Every approval/test/survey email sent, with related-item links and
    visible responses. When a client says "I never got it", there's a record. We should have this.
11. **Digital signatures done properly** — actual PDF certificate signing with a Declarations
    section, wired to configurable **Handover actions** (source = Conformed | specific Lot Review
    Status → signoff text), plus honest documentation that the cursive-name image is decorative
    and the certificate is what matters. The rollout tactic is also good: 50 free signatures per
    company per month for 12 months on a rolling 30-day basis, re-signing doesn't count.
12. **Import-setup-from-an-existing-project inside the create-project wizard**, with per-register
    selection, plus the shipped `REPO` project pre-populated with Work Types, ITPs and Test
    Methods. New project setup collapses from days to minutes, and it's presented at exactly the
    moment the user is creating the project. The transcript makes the pitch explicitly: *"we can
    have repositories for certain clients so we can have consistency when delivering projects for
    them."*
13. **Persona-specific onboarding doc for the approving party.** *"Introduction for
    Administrators, Superintendents, and Client Representatives"* tells the *client* what the
    *contractor* does, how approvals reach them, and gives them a 10-minute setup ritual. It's
    written to be forwarded by the contractor to their client. That's a distribution mechanism
    disguised as documentation.
14. **Subcontractor entity as an indirection layer for lot assignment.** Link lots to the
    *subcontractor*, not the person, so staff churn doesn't mean re-linking 50 records. Small,
    obvious in hindsight, saves real pain.
15. **Addressee Groups with first-responder-releases semantics** — plus the "show only users who
    can approve" filter in the picker.
16. **Composite gating on external sync**: to push a lot to Teambinder you need the role
    permission **and** an approving Lot Review Status. Permission ∧ record-state is the right
    shape for any "publish to client" action.
17. **`Requires Comment` with a real minimum length.** 25 characters is enough to stop "ok" and
    short enough not to be tyrannical.
18. **Deep-link login parameters** (`?returnUrl=lots/23`, `&projectid=1`) so emails and external
    systems can land a user on a specific record post-auth.
19. **Deletion discouraged by design**, with a documented soft-close alternative and a
    "deactivate the user, don't delete them, or you lose their name off every record they
    touched" warning.
20. **In-app "?" that searches the help centre and files a support ticket without leaving the
    app**, with Australian support hours stated publicly.

---

## 5. Weaknesses and gaps we can exploit

### 5.1 The desktop/web split is the central strategic wound

- **Cost management lives only on Desktop.** Day Costs, Invoices, Forecasts, Cost Codes,
  Resources, Suppliers, Purchase Orders, Units, Variations (custom-register support), Production
  — all Windows-only. Any customer who wants cost + QA in one place needs Windows machines for
  part of the team. Our whole product is one web app.
- **Controlled Document Transmittals — the actual document-issue-and-acknowledge workflow — is
  Desktop-only**, and the Cloud article has said *"under development in the Web app, and this
  will be updated very shortly"* since at least 2026-02-26, offering two workarounds (Independent
  Approval, or bolt it onto a Contract Notice). Controlled Documents themselves are
  **view-only** on the web.
- **Admin password reset is Desktop-only** — *"This feature is NOT supported in Cloud."* A
  cloud-only customer literally cannot have their admin reset a password; they're pushed to
  Forgot Password.
- **Site Diary, Instructions, Incidents, Risk registers are Desktop-only** — and correspondingly
  their Contract Notice merge fields are marked *"Not available for the Web App/Cloud at the
  moment."* Daily diary is one of our core surfaces and it is not on their web product at all.
- **Fill Up / Fill Down bulk editing exists only on Desktop**, and the Cloud grid is
  deliberately read-only. So the fastest way to bulk-populate CivilPro is to install a Windows
  app. Meanwhile the Desktop app has no email invites and no project custom views.
- Net effect: **neither client is complete**, and the docs are duplicated ~40 times as
  `Article` / `Article (D)` pairs with drifting content. The comparison article
  (*"What are the differences…"*) was last updated **2024-07-29** and is now demonstrably wrong
  (Subcontractors and Teambinder both have current web articles), so a prospect can't even get a
  reliable answer about what runs where. Positioning line for us: *one app, everything in it,
  on any device.*

### 5.2 Setup burden is enormous and front-loaded

- The documented happy path is: Roles → Project → Users → Project Settings → Approval Workflows →
  Work Types → Area Codes → ITPs → Contract Notice Templates → Control Lines → Contacts → Groups
  → Custom Registers → *then* your first lot. Three named stages, ~13 registers.
- Permissions alone are a **5 × ~50 matrix plus 20 authority toggles**, and CivilPro's own answer
  is to **sell you configuration time**: *"If setting up and managing Roles is something you'd
  prefer having some assistance with, book in some configuration time with our CivilPro support
  team."* Twice. That's a confession.
- The permission model has documented footguns that require expert knowledge to avoid: role
  stacking silently escalates; `Limit*` authorities silently override; ticking a `Limit` authority
  on an internal role makes records *"seem to disappear the moment they're created"*; granting
  both `View` and `View Limited` collapses to `View`.
- The create-project wizard has a hard prerequisite trap: *"If you do not select an existing
  project first, you won't be able to add roles when you create a new project."*
- **Custom Lot Numbers and Custom Registers must be configured before any lot is created** and do
  not retro-apply. A wrong early decision is permanent for that project.
- Onboarding artefacts are a **PDF checklist** and a 30-minute video — no in-product guidance, no
  setup progress state, no templates-by-project-type beyond "import from another project".

### 5.3 Migration and lock-in friction

- **Getting in**: v10 → v12 migration is a manual, staffed, weekend-scheduled operation on a
  customer-supplied full DB backup + filestore copy, taking "several hours to a day", and
  **custom reports do not migrate**. CSV import exists but with narrow field lists, no
  hierarchical data, tight character limits, and a Desktop-only column-mapping wizard for some
  registers.
- **Getting out**: no self-serve export of the whole account. The cancellation article's three
  options are pay ~$50/month forever to keep your data hosted, **pay 2–4 hours of dev time for a
  backup**, or delete it irrecoverably. Register-level export is "Print Grid"; Test Method and
  Test Property registers **cannot be exported at all**. Data recovery is billable and
  **Filestore/photos are only recoverable for 30 days**.
- A "let us import your CivilPro data for free, and here's your export button" position is a
  direct attack on both ends.

### 5.4 Commercial model is friction-rich

- **Nothing is self-serve.** Adding seats: *"please contact our team"*. Removing seats: only at
  renewal, by emailing before the renewal date. Payment by invoice, annual only. There is no
  billing UI documented anywhere in a 130-article corpus.
- **Everything is an à-la-carte upsell** and the list is long: SAML $500 setup + $500/yr; Power
  BI connector $550–$950/yr **plus hourly support because "support for the Power BI connector is
  outside our normal subscription support"**; digital signatures $495–$995/yr after the free
  tier; MSI installer an annual fee; Teambinder a licence plus processing fee; configuration
  consulting; data recovery hourly; data export 2–4 h of dev time.
- **Azure database tier is passed through as a line item**: S0 $1,980 / S1 $2,420 / S2 $5,940 +
  GST per year, and *"we start each CivilPro database at the lowest cost tier (S0)"* — meaning
  the default experience is the slowest one, and the remedy for "the app is slow" is an upsell
  quote. There's a whole article (*"How do I improve the speed performance of my database?"*)
  whose answer is "pay more". Multi-tenant architecture would make this a non-conversation.
- The Associate model has an explicit expiry warning attached: *"Right now, Associates are
  unlimited. However, this may change in the future."* Anyone building their client and subbie
  ecosystem on free seats is exposed.

### 5.5 Product gaps

- **One notification template ships** ("Lot Conformance Query"). For a product with this much
  workflow configurability, the notification layer is bare, and the template editor comes with
  warnings that editing it may break delivery.
- **In-app notifications only fire for approvals**, and the docs are explicit they don't replace
  the email request — so users must do both. There is no unified activity feed, no digest, no
  per-event subscription model.
- **MFA is email-code only and account-wide.** No TOTP, no authenticator app, no per-role
  enforcement. For a product selling to Tier-1 contractors that's a procurement problem.
- **Power BI connector can't do SSO**, and the documented workaround is to create a
  password-authenticated Associate on a domain deliberately excluded from your SSO enforcement.
  That is a documented instruction to punch a hole in your own security control.
- **API password is base64-encoded**, there is **no API versioning** (*"we do not maintain or make
  public old versions of our API"*), and the recommended discovery method is "watch the browser
  network tab".
- **The Desktop app connects directly to the SQL database** and reaches blob storage with **an
  API key stored in the database**. A per-customer SQL firewall and dynamic-IP holes are the
  controls.
- **Reports break under photo load.** There's a published article titled *"Why have my Lot
  Conformance / Lot Summary / Conformance Folio reports stopped downloading?"* whose answer is:
  exclude the photos. On a photo-heavy civil project, the conformance pack — the actual product —
  fails. Server-side thumbnails and streamed PDF assembly are a concrete beat.
- **Custom reports break digital signatures** and can't change titles or headings, and making one
  default changes it for everyone on the project.
- **Dashboard is shallow by admission**: five registers, four chart types, no approval-type
  breakdown, and a cutoff date that **defaults to end-of-last-month**, so a new user's first
  dashboard view is stale by up to 31 days.
- **File limits are asymmetric and low for field use**: 100 MB per file on web (unlimited on
  Desktop), 50 MB per photo, with a soft threat of extra monthly storage charges. Video is
  explicitly called out as a filetype that can't go into a lot summary.
- **Photos can't be linked to a checklist item from the Photos register** — you must go to the
  Checklist register. That's exactly backwards from how a field user works.
- **Contract Notice draft loss**: the presenter warns twice on video that linking related items
  without saving first loses your body edits, and suggests drafting in Notepad. An unsaved-changes
  guard would fix it; instead it's documented as user technique.
- **Contact-vs-User duplication trap**: a notice addressed to a leftover Contact entry cannot be
  opened by that person's User account, and the official remedy is to rename entries
  "(Contact Only)". A merge/dedupe would fix it; instead it's documentation.
- **Teambinder integration degrades attribution**: master-account mode means every synced record
  is attributed to the integration account; the link cache updates only manually; and a deleted
  Teambinder lot **permanently burns that lot number**, forcing a renumber in CivilPro.
- **Offline is effectively absent.** Cloud requires connectivity; Desktop offline only works for
  standalone local databases that **can never be synced to the cloud**. Their own advice is to go
  offline only if >70% of the project has no connectivity — i.e. they've conceded the case. Our
  offline lot map work attacks this directly.
- **Approval categories are fixed at six.** Anything that isn't Hold Point / Witness Point / NCR /
  Check Item / Purchase Order / Independent has to be shoehorned into one.
- **Chrome is "recommended"** and one deprecated concept (Primary Tags) is still shipping,
  superseded by Custom Registers since v11.173 with backwards compatibility maintained.
- **External-user SSO is somebody else's problem**: CivilPro can't approve its app in a subbie's
  tenant, so onboarding a small subcontractor whose company has Entra can require *their* IT
  admin to grant consent, or *your* IT admin to run a B2B guest process. For an industry of
  two-person subbies, this is a wall.

---

## 6. Surprises

1. **Free seats are structural, not promotional.** Approvers, testers and client reps cost
   nothing as long as their role stays View-only + Collaborate authorities, and the invite dialog
   shows seat impact before sending. But the docs also hedge: *"Right now, Associates are
   unlimited. However, this may change in the future."*
2. **Users, Associates and Contacts are three distinct classes**, and the boundary between the
   last two is a live source of bugs — promoting a Contact converts only the newest matching
   entry, and correspondence addressed to a stale Contact entry is unopenable by that person's
   User account.
3. **CivilPro is part of the Herga group** — BuildingPoint Australia, Sitech, UPG, Information
   Alignment — i.e. inside the Trimble reseller ecosystem, with a shared credit account across
   all five. That explains the enterprise-sales, invoice-and-quote commercial posture and
   suggests channel access to Trimble/Sitech survey customers we don't have.
4. **The database tier is a published, passed-through price** (S0 $1,980 → S2 $5,940 +GST/yr) and
   every customer starts on the cheapest one. "Your app is slow" has a price list attached.
5. **Single-tenant everything**: one SQL database, one App Service and one Angular app per
   customer, sharing only the App Service Plan. Explains the per-customer subdomain, the
   per-customer SAML certificate handling, and why every knob is a support ticket.
6. **The Power BI connector's official SSO workaround is to create a non-SSO account** on a
   domain deliberately outside the enforced list.
7. **Reference customer list is Tier-1 and public**: TMR, RMS, Fulton Hogan, Bielby, CMC, FKG,
   Georgiou, Ventia, Pensar, Vassallo, Rockhampton Council, Toowoomba Council. They are not an
   SME-only product despite positioning as *"especially for Small and Medium Enterprise (SME)
   businesses"*.
8. **The migration-benefits article's top-rated improvement is named-user account management** —
   *"No more support ticket requests and searching through your computer IP's to find out who has
   been assigned a seat"* — which means the pre-2024 licensing model was IP-based and customers
   hated it enough that basic user management was the headline win.
9. **Roadmap hints, dated**: Controlled Document Transmittals "under development in the Web app"
   (2026-02-26); Site Diary / Instructions links "Cloud availability TBA"; Photos → Site Diary
   linking marked "TBA"; Primary Tags *"will eventually be removed from the application"*.
   The 2026-07 article refresh wave (Getting Started, Add/Edit Roles, Add Users, Subscription
   Settings, the Superintendent guide) is all **admin onboarding**, which suggests their current
   internal push is reducing setup friction and support load — the same weakness we identified.
10. **Digital signature pricing is per company/database, not per user or per document**: 50 free
    per month for the first 12 months, then $495/yr for 200/month or $995/yr unlimited, with
    re-signing an already-signed document explicitly free.
11. **The approval QR code path** — contractor generates a QR on the checklist item, superintendent
    scans it on their phone, signs in, releases on the spot — is a genuinely good field mechanic
    and gets a single sentence in the docs.
12. **They tell you to reverse-engineer their own API** from the browser network tab, and ship
    Postman collections as the primer.
13. **Everything routes to a human.** Adding seats, removing seats, upgrading the DB, SAML setup,
    Teambinder configuration, role configuration, data export, data recovery, MSI registration —
    every one of these is "contact our team". For a buyer who wants to move fast, that is our
    single largest structural advantage; for a buyer who wants hand-holding, it is theirs.
