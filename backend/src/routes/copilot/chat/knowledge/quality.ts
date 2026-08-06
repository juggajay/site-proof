import type { PageKnowledge } from './types.js';

const SAVED_VIEWS = `**Views** saves and recalls register filter combinations. Shipped presets are the same for everyone; **Save current view** stores this user's current URL filters under a name in this browser. It is disabled until a filter is applied. Saved views can be applied or deleted and do not follow the user to another device.`;

export const QUALITY_PAGE_KNOWLEDGE = [
  {
    route: 'projects/<projectId>/lots',
    title: 'Lot Register',
    keywords: [
      'views button',
      'bulk create lots',
      'linear strip',
      'satellite map',
      'columns',
      'saved filters',
      'draw lot',
    ],
    roles:
      'All internal project roles and viewers can read; write and bulk controls depend on the actual project role.',
    surface: 'office',
    body: `The Lot Register is the project's master list of inspectable, testable and claimable work units.

**Create Lot** opens a single-lot form. The **More register actions** menu contains **Export CSV** for readers and, for permitted non-subbie users, **Import Register** and **Bulk Create Lots**. Bulk creation builds activity-by-chainage lots and can assign ITPs and geometry. Search, Status, Activity, chainage range, subcontractor and area filters narrow the register; **Clear** removes active filters. ${SAVED_VIEWS}

The list/card/linear/map controls change presentation without changing data. List is the sortable table; Cards is the mobile-friendly register; Linear shows status along chainage; Map opens the spatial workspace. **Columns** shows or hides optional table columns. Row click/View opens the lot. Row **More** offers Edit, Clone and Delete only when the role and lot state allow them. Checkboxes select deletable lots; the bulk bar offers **Update status**, **Assign subcontractor**, test-rule attributes when the ruleset is available, **Print labels**, **Delete**, and **Clear selection**. Actions that cannot safely apply to every selected lot are disabled.

On Map: **Find by area** draws a search box; **My location** flies to the device position; **Photos** toggles photo pins on mobile; **Layers** controls basemap, plan overlays, coverage/testing panels and pin layers; **Draw lot** lets managers trace a polygon and assign it to a lot; **Save map** stores a PNG in Documents; **Past view** replays lot state on a selected date. Layer errors are shown on-map, and pin layers cap at the first 500 until the user zooms in.`,
  },
  {
    route: 'projects/<projectId>/lots/<lotId>',
    title: 'Lot Detail',
    keywords: [
      'evidence readiness',
      'qr code',
      'conform lot',
      'override workflow status',
      'lot tabs',
      'subcontractor assignment',
    ],
    roles:
      'All internal project roles and viewers can read; editing, verification and conformance depend on the actual project role.',
    surface: 'office',
    body: `Lot Detail is the evidence workspace for one lot. The QR code opens or shares this lot; the status chip shows its current workflow state.

The primary header button is the highest-priority Evidence Readiness action, such as opening an incomplete check or test. When nothing outranks it, permitted users see **Edit Lot**. **More actions** contains **Ask Clancy**, **Copy Link**, Edit when displaced by a readiness action, and **Override Workflow Status** for authorised quality roles; overriding requires a reason and is audited. Subcontractor Assignments can add, edit or remove the companies allowed to work on this lot.

The five tabs are **ITP Checklist**, **Test Results**, **NCRs**, **Evidence** and **Activity**. Evidence switches between Photos and Documents; Activity switches between Comments and Changes. Count badges show tests and NCRs. The ITP tab records pass/fail/N/A, comments, evidence, witness points and hold-point release. Tests opens linked results; NCRs opens linked non-conformances. Photos supports selection, batch captions and adding chosen photos to evidence. Documents opens lot files. Comments includes mentions; Changes is the audit-style history.

**Evidence Readiness** lists exact blockers and its action links jump to the tab/control that resolves each one. **Conform Lot** appears only when the role permits it and blockers are cleared; authorised overrides remain explicit and audited. **Generate Conformance Report** lets the user choose report sections before creating the PDF.`,
  },
  {
    route: 'projects/<projectId>/lots/<lotId>/edit',
    title: 'Edit Lot',
    keywords: [
      'edit lot',
      'unsaved changes',
      'chainage',
      'budget',
      'activity type',
      'itp template',
    ],
    roles: 'Owner, admin, project manager, quality manager and site engineer.',
    surface: 'office',
    body: `Edit Lot changes the lot's identity, location, commercial attributes and assigned workflow inputs.

The form edits lot number, description, activity, area, chainage/offsets, layer, budget and related assignment fields. ITP selection may be suggested from the activity but remains a human choice. **Save Changes** validates and writes the edit; **Cancel/Back** returns to Lot Detail. Leaving with unsaved changes opens a confirmation so the user can stay or discard. Claimed, conformed or otherwise locked data may be disabled rather than editable.`,
  },
  {
    route: 'projects/<projectId>/itp',
    title: 'ITP Templates',
    keywords: [
      'acceptance criteria',
      'template editor',
      'create itp',
      'import from project',
      'hold point item',
      'verification queue',
      'template change proposal',
      'new revision',
    ],
    roles:
      'All internal project roles can view; template management and verification are role-gated.',
    surface: 'office',
    body: `ITP Templates manages reusable inspection checklists and the queue of completed items awaiting office verification.

**Import from Project** selects another accessible project and copies one of its templates. **Create ITP Template** opens the template editor. **Include state spec library templates** shows the project's matching global library; **Activity Type** and **Responsible** filter cards. Library **Copy** makes an editable project version. Project-template **Edit** opens its checklist, **Active/Inactive** controls whether it can be newly assigned, and **Compare** reviews a newer library edition without migrating live instances automatically.

In the template editor, **Add checklist item** creates a row; arrows reorder it; Remove deletes it. Each row defines description, point type, responsible party, evidence requirement and other rule fields. **Acceptance criteria** is the plain-language or specification requirement the completed check must satisfy—set it in that row's Acceptance criteria input. Saving an edited template can offer propagation to assigned lots; the user may apply or skip it rather than silently rewriting snapshots.

The verification queue links back to the lot evidence. **Verify** accepts a completed item. **Reject** opens the required reason and returns it for correction. Users without reviewer permission do not see those verbs.

**Template change proposals raised from NCR trends are reviewed on this page**, not on the AI Setup Copilot page. The Template change proposals section lists proposals raised from NCR Analytics with the failure evidence frozen at the time they were raised. **Review** opens the decision: accepting requires a revision label and a reason, and **opens a new revision that is an exact copy** of the template plus supersedes the current one—it does not itself make the change, so the template editor opens on the new revision next for the user to make it. Rejecting requires a reason. A proposal whose template already has a newer revision is marked superseded and cannot be accepted. Decided proposals sit under a collapsed Decisions list. The section is visible only to owner, admin, project manager, site manager and quality manager, and it is absent entirely when the NCR learning loop is not enabled in the environment.`,
  },
  {
    route: 'projects/<projectId>/hold-points',
    title: 'Hold Point Register',
    keywords: [
      'request selected greyed out',
      'request release',
      'record release',
      'chase',
      'awaiting release',
      'saved views',
    ],
    roles:
      'All internal project roles can view; request, chase and release controls depend on role and record state.',
    surface: 'office',
    body: `The Hold Point Register tracks every hold point generated from lot ITP checklists and the third-party release trail.

Search matches lot number or description. The Lot filter scopes one lot; Status offers All, Pending, Awaiting Release, Notice Expired and Released. Count links toggle pending or awaiting-release filters. **Export CSV** downloads the current register on desktop. ${SAVED_VIEWS}

**Request Release** opens recipients, scheduled release date, message and evidence. Preview shows the evidence package before sending. **Copy link** copies a deep link to the row. Once notified, **Record release** records a manual decision and evidence; **Chase** sends a permitted follow-up; **Generate Evidence Package PDF** downloads the audit package. These appear only when the hold point state and role allow them.

**Request selected** is not a general all-project bulk button. Batch release requires one lot because one review room is built for hold points from that lot. First filter to a single lot, tick eligible pending rows, then the contextual bar shows **Select all pending**, **Clear** and **Request selected (N)**. If no single lot is selected or no eligible row is ticked, the request action is absent rather than available.`,
  },
  {
    route: 'projects/<projectId>/tests',
    title: 'Test Results',
    keywords: [
      'views button test results',
      'verified meaning',
      'upload certificate',
      'batch upload',
      'read with ai',
      'send to lab',
    ],
    roles:
      'All internal project roles; create, progress, reject and verify actions are role/state-gated.',
    surface: 'office',
    body: `Test Results manages test requests, lab results and certificates for the project.

**Upload Certificate** is the main action: attach a lab certificate, let CIVOS extract proposed values, review them, then confirm. **Batch Upload** processes several certificates and still requires review. **Add Test Result** creates a manual record. **Export CSV** appears when results exist. On mobile, secondary actions sit under **More actions**.

Search covers report/request number, lot and lab. **Filters** expands Test Type, Status, Pass/Fail, Linked Lot and date range; Clear removes them. ${SAVED_VIEWS}

A row's visible button is its next required step: progress a request, enter received results, or verify it. **Verified** means an authorised user has completed the review step; it does not merely mean the laboratory file exists. Row **More** may offer **Send to Lab**, Attach/Replace certificate, **Read with AI**, **Link to ITP item**, **Reject** for an entered result, and **Print conformance record** when enough final data exists. Sample location is optional: choose on map or use acceptable GPS; clearing it removes the pin, and a coarse GPS fix is refused rather than invented. A failed result may prompt the user to raise an NCR, but that remains a separate confirmed action.`,
  },
  {
    route: 'projects/<projectId>/ncr',
    title: 'NCR Register',
    keywords: [
      'four dots ncr',
      'responded reviewed rectified closed',
      'raise ncr',
      'days open',
      'days waiting',
      'concession',
    ],
    roles:
      'All internal project roles; lifecycle actions depend on responsibility, severity and quality-management role.',
    surface: 'office',
    body: `The NCR Register manages non-conformances from issue to verified closeout.

**Raise NCR** opens description, category/severity, responsible party, lot/delivery links, due date and before evidence. **Export CSV** downloads the displayed rows. **NCR Trends** opens analytics for authorised management/quality roles. Search and Filters narrow by status, severity, category, responsible party, lot and dates; Clear removes them. ${SAVED_VIEWS}

**Days Open** is elapsed time since the NCR was raised until close or today. **Days Waiting** is time sitting with the party that currently owes the next step. The four-dot strip is **Responded · Reviewed · Rectified · Closed**. A filled dot means that gate is recorded complete, a hollow dot means someone still owes it, and a dash means it was not required/recorded on a terminal path. Hovering a dot shows its detail.

The visible row button is the current next step: Respond, Review Response, Submit Rectification, QM Approve, Close, Concession, Reject rectification or Notify Client. Remaining actions are under More, along with Assign/Reassign, Copy link and Print NCR. Major-NCR close can be disabled until QM approval, and the same QM may be prevented from also performing the independent close. Rectification requires after evidence; Concession records why full rectification is not possible.`,
  },
  {
    route: 'projects/<projectId>/ncr/analytics',
    title: 'NCR Analytics',
    keywords: [
      'ncr trends',
      'repeat failure',
      'root cause',
      'repeat offender',
      'propose template change',
    ],
    roles: 'Owner, admin, project manager, site manager and quality manager.',
    surface: 'office',
    body: `NCR Analytics highlights repeated quality failures rather than editing NCRs.

**Back to NCRs** returns to the register. Charts break down root cause, category and activity. Repeat-failure and responsible-party sections identify patterns from closed and open records. **Propose template change** opens a reviewed proposal for an ITP improvement; it does not silently alter a template. Cancel closes the proposal, and Create/Submit is disabled until its required explanation and target are supplied.

Proposals are RAISED here but DECIDED on the project **ITP Templates** page, in its Template change proposals section; a link showing the number of open proposals appears here when any are waiting. A proposal cannot be raised against a state spec library template—copy the library template into the project first and propose against the copy.`,
  },
  {
    route: 'projects/<projectId>/documents',
    title: 'Project Documents',
    keywords: [
      'upload document',
      'favourites',
      'version history',
      'document filters',
      'download file',
      'lot document',
    ],
    roles:
      'All internal project roles and viewers can read; management controls depend on document permissions.',
    surface: 'office',
    body: `Project Documents stores project files, photos and lot-linked evidence outside the controlled drawing register.

**Upload Document** opens file, type, caption, lot/date and related metadata. Search matches filename or caption. Favourites toggles a quick favourites-only view. **More filters** expands type, lot, uploader, tags and date filters; Search applies them and Clear removes them. **Views** follows the saved-filter pattern where rendered.

**View** opens supported images/PDFs securely. **Download** retrieves the file. Row **More** offers Add/Remove favourite, **Version history**, and **Delete** for authorised users. Upload is available from the empty state. Pagination or Load more retrieves further records. A lot link means the document is visible from that lot; access remains backend-mediated rather than exposing its stored object URL.`,
  },
  {
    route: 'projects/<projectId>/drawings',
    title: 'Drawing Register',
    keywords: [
      'download current set',
      'add drawing',
      'revision history',
      'upload revision',
      'drawing status',
      'as built',
    ],
    roles:
      'Internal project roles and viewers can read; drawing managers get upload, revision and delete controls.',
    surface: 'office',
    body: `The Drawing Register controls drawing numbers, statuses and revision history.

**Download Current Set** packages the current non-superseded drawings. **Add Drawing** opens the upload form for drawing number, title, discipline, revision and status. Status and Search filters narrow the register; **Search** applies the text filter. Previous/Next page through results.

Click the file/download control to open the current drawing. **Revision history** shows all revisions. **Upload new revision** adds a successor and supersedes the prior revision according to the form. Authorised users can change the drawing status or Delete after confirmation. Status cards—Total, Preliminary, For Construction and As-Built—are summaries, not buttons.`,
  },
] satisfies readonly PageKnowledge[];
