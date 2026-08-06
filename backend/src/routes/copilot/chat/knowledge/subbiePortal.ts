import type { PageKnowledge } from './types.js';

const SUBBIE_ROLES =
  'Subcontractor admin or subcontractor user with access to the selected project; module and assignment gates still apply.';
const CHROME = `Shared mobile-shell controls: **Back** returns to the named parent; the project selector changes the active project; the sun/moon control changes theme; the sync chip shows queued or failed offline work and offers Retry; **Sign out** warns when unsynced work exists.`;

export const SUBBIE_PORTAL_KNOWLEDGE = [
  {
    route: 'subcontractor-portal',
    title: 'Classic Subcontractor Portal Home',
    keywords: [
      'classic subbie home',
      'portal dashboard',
      'assigned projects',
      'subcontractor modules',
      'portal navigation',
    ],
    roles: SUBBIE_ROLES,
    surface: 'subbie-portal',
    body: `The classic desktop portal home summarises the subcontractor's available projects and work. Its cards link to dockets, assigned work, inspections, hold points, tests, NCRs and documents when those modules and permissions are enabled. The newer phone-first equivalent is **/p**. Controls never grant access beyond the user's subcontractor company and project assignments.`,
  },
  {
    route: 'my-company',
    title: 'Classic My Company',
    keywords: [
      'company crew roster',
      'plant roster',
      'employees rates',
      'subcontractor admin',
      'classic company',
    ],
    roles: SUBBIE_ROLES,
    surface: 'subbie-portal',
    body: `My Company maintains the subcontractor company's employee and plant roster used by dockets. Subcontractor admins can add, edit or remove roster entries; ordinary subcontractor users can view them. Employee records include name and role. Plant records include description/identifier and wet or dry hire details. Rate approval is controlled by CIVOS office users, so a subbie cannot approve their own commercial rates.`,
  },
  {
    route: 'subcontractor-portal/docket/new',
    title: 'Classic New Subcontractor Docket',
    keywords: ['new docket', 'labour hours', 'plant hours', 'submit docket', 'lot allocation'],
    roles: SUBBIE_ROLES,
    surface: 'subbie-portal',
    body: `New Docket records the selected day's labour and plant against a project. Add rostered employees or plant, enter hours and work details, allocate work to lots where offered, then save the draft or **Submit** it for contractor review. Submission locks the claimed values unless the docket is queried or otherwise returned for response.`,
  },
  {
    route: 'subcontractor-portal/docket/<docketId>',
    title: 'Classic Subcontractor Docket Detail',
    keywords: [
      'edit docket',
      'queried docket',
      'docket status',
      'respond query',
      'approved docket',
    ],
    roles: SUBBIE_ROLES,
    surface: 'subbie-portal',
    body: `Docket Detail shows labour, plant, allocations, totals, attachments and the review trail for one docket. Draft or queried records expose the permitted edit/response controls; submitted records await contractor review; approved and rejected records show the decision and are not freely editable. Use the visible status and query message to decide the next action.`,
  },
  {
    route: 'subcontractor-portal/dockets',
    title: 'Classic My Dockets',
    keywords: [
      'docket history',
      'docket statuses',
      'queried dockets',
      'payment trail',
      'filter dockets',
    ],
    roles: SUBBIE_ROLES,
    surface: 'subbie-portal',
    body: `My Dockets is the subcontractor's docket history. Filters narrow by status/date and each row opens its detail. Draft means not submitted, Submitted is awaiting contractor action, Queried requires a response, Approved records accepted values and Rejected records the refusal. This is an operational approval trail, not a bank-payment ledger.`,
  },
  {
    route: 'subcontractor-portal/work',
    title: 'Classic Assigned Work',
    keywords: ['assigned lots', 'my work', 'lot status', 'subcontractor lots', 'work allocation'],
    roles: SUBBIE_ROLES,
    surface: 'subbie-portal',
    body: `Assigned Work lists only lots assigned to the subcontractor company in the selected project. Search/status controls narrow the list and a lot opens its permitted inspection workflow. Missing lots normally mean the company has not been assigned, the wrong project is selected, or the Lots portal module is disabled.`,
  },
  {
    route: 'subcontractor-portal/itps',
    title: 'Classic Subcontractor ITPs',
    keywords: [
      'subbie inspections',
      'itp checklist',
      'checks to do',
      'assigned itp',
      'inspection status',
    ],
    roles: SUBBIE_ROLES,
    surface: 'subbie-portal',
    body: `ITPs lists assigned lots with inspection checklists available to the subcontractor. Status and completion counts show what remains. Opening an eligible lot starts the checklist; view-only access is shown when the assignment does not include permission to complete it.`,
  },
  {
    route: 'subcontractor-portal/lots/<lotId>/itp',
    title: 'Classic Subcontractor Lot ITP',
    keywords: [
      'complete itp',
      'pass fail na',
      'inspection evidence',
      'itp comments',
      'hold point permission',
    ],
    roles: SUBBIE_ROLES,
    surface: 'subbie-portal',
    body: `Lot ITP presents the assigned checklist for one lot. Where canCompleteITP permission is present, the subbie can record **Pass**, **Fail** or **N/A**, add comments and required evidence, and complete eligible checks. Hold-point release remains a contractor/authorised quality action: completing a subbie check does not release a hold point.`,
  },
  {
    route: 'subcontractor-portal/holdpoints',
    title: 'Classic Subcontractor Hold Points',
    keywords: [
      'view hold points',
      'hold status',
      'release hold point',
      'subbie quality',
      'classic holds',
    ],
    roles: SUBBIE_ROLES,
    surface: 'subbie-portal',
    body: `The classic Hold Points page shows hold-point status relevant to the subcontractor's assigned work. It is visibility, not contractor authority: subcontractors do not release hold points here. This page has no /p replacement because Holds & Tests was deliberately removed from the mobile subbie shell.`,
  },
  {
    route: 'subcontractor-portal/tests',
    title: 'Classic Subcontractor Test Results',
    keywords: ['view test results', 'subbie tests', 'lot tests', 'test status', 'classic tests'],
    roles: SUBBIE_ROLES,
    surface: 'subbie-portal',
    body: `The classic Test Results page provides the subcontractor's permitted test-result visibility for assigned work. It does not expose the contractor's full project register or office administration controls. There is no /p tests screen; the mobile shell deliberately omits Holds & Tests.`,
  },
  {
    route: 'subcontractor-portal/ncrs',
    title: 'Classic Subcontractor NCRs',
    keywords: ['subbie ncrs', 'respond ncr', 'rectify ncr', 'non conformance', 'ncr status'],
    roles: SUBBIE_ROLES,
    surface: 'subbie-portal',
    body: `Subcontractor NCRs lists non-conformances visible to the company. Open an NCR to read the issue, evidence and history. **Respond** and **Rectify** appear only when the NCR state and role allow that action; review and closure remain contractor-side decisions.`,
  },
  {
    route: 'subcontractor-portal/documents',
    title: 'Classic Subcontractor Documents',
    keywords: [
      'subbie documents',
      'portal files',
      'open document',
      'assigned documents',
      'view only',
    ],
    roles: SUBBIE_ROLES,
    surface: 'subbie-portal',
    body: `Subcontractor Documents is a view-only register of files made available through the portal. Search/filter controls locate a file and **Open** uses an authorised file URL. It does not grant access to the contractor's full project document library or document-management actions.`,
  },
  {
    route: 'p',
    title: 'Subbie Mobile Home',
    keywords: [
      'mobile subbie home',
      'setup needed',
      'my dockets',
      'my work',
      'my company',
      'project selector',
    ],
    roles: SUBBIE_ROLES,
    surface: 'subbie-portal',
    body: `The phone-first Subbie Home is the daily work hub. ${CHROME}

The hero opens today's docket. **Setup needed** means crew/plant or approved rates are missing and sends the user to My Company; a prior unfinished-docket notice opens that draft. **My Dockets** always opens history. **My Work** appears when Lots is enabled. Inspections, NCRs and Documents appear as home tiles only when Lots is off; otherwise they sit behind each lot. **My Company** always appears. Counts and queried notices identify work needing action.`,
  },
  {
    route: 'p/docket',
    title: "Subbie Today's Docket",
    keywords: [
      'today docket',
      'add labour',
      'add plant',
      'save draft',
      'submit docket',
      'roster approval',
    ],
    roles: SUBBIE_ROLES,
    surface: 'subbie-portal',
    body: `Today's Docket opens or creates the current day's project docket. ${CHROME}

The Labour and Plant sections add approved roster items through bottom sheets, record hours, wet/dry plant details and lot/work allocation, and allow removal while editable. **Add**, **Save and add another** and **Submit docket** drive entry and submission. The summary separates entered totals from contractor-adjusted approved values. Docket creation stays locked until required roster rates are approved.`,
  },
  {
    route: 'p/docket/<docketId>',
    title: 'Subbie Mobile Docket Detail',
    keywords: [
      'queried mobile docket',
      'docket decision',
      'respond docket',
      'adjusted totals',
      'locked docket',
    ],
    roles: SUBBIE_ROLES,
    surface: 'subbie-portal',
    body: `Mobile Docket Detail uses the same Labour, Plant and Summary layout for a saved docket. ${CHROME}

Draft and Queried states expose the actions the subbie can take, including correcting entries and resubmitting a query response. Submitted waits for review. Approved or Rejected displays the contractor decision and locks ordinary editing. Adjusted markers distinguish submitted values from contractor-approved hours/costs.`,
  },
  {
    route: 'p/dockets',
    title: 'Subbie Mobile Docket History',
    keywords: [
      'mobile docket history',
      'filter docket status',
      'queried chip',
      'approved docket',
      'payment trail',
    ],
    roles: SUBBIE_ROLES,
    surface: 'subbie-portal',
    body: `My Dockets is a mobile history of the company's dockets for the active project. ${CHROME}

Status chips filter the cards; tapping a card opens its status-driven detail. Queried is actionable, Submitted is waiting, Approved records accepted commercial values and Rejected records the decision. The screen tracks review state, not whether an invoice has been paid by a bank/accounting system.`,
  },
  {
    route: 'p/work',
    title: 'Subbie Mobile My Work',
    keywords: ['mobile assigned lots', 'my work lots', 'checks to do', 'lot hub', 'assigned work'],
    roles: SUBBIE_ROLES,
    surface: 'subbie-portal',
    body: `My Work lists the active company's assigned lots for the selected project and groups their current state. ${CHROME}

Search/filter controls narrow the assigned list and each lot opens its lot hub. A checks-to-do indicator reflects eligible incomplete inspections when ITPs are enabled. The screen cannot reveal unassigned project lots.`,
  },
  {
    route: 'p/itps',
    title: 'Subbie Mobile Inspections',
    keywords: [
      'mobile inspections',
      'itp list',
      'checks remaining',
      'view only itp',
      'complete inspection',
    ],
    roles: SUBBIE_ROLES,
    surface: 'subbie-portal',
    body: `Inspections lists assigned lots containing an ITP. ${CHROME}

Progress and remaining-check state identify the next inspection. Tapping a card opens the lot ITP. Permission comes from the assignment: users without canCompleteITP can inspect the information but see a view-only state. This route is the fallback entry when the Lots module is off.`,
  },
  {
    route: 'p/lots/<lotId>',
    title: 'Subbie Mobile Lot Hub',
    keywords: ['subbie lot hub', 'continue inspection', 'lot ncrs', 'lot documents', 'view only'],
    roles: SUBBIE_ROLES,
    surface: 'subbie-portal',
    body: `The Lot Hub groups portal actions for one assigned lot. ${CHROME}

**Inspection** shows progress and either actionable or VIEW ONLY permission; **Continue inspection** appears only when the user may complete an unfinished ITP. **NCRs** opens a server-side list scoped to this lot. **Documents** currently opens the project-level portal document list and is explicitly not lot-scoped. Tiles appear only for enabled modules.`,
  },
  {
    route: 'p/lots/<lotId>/itp',
    title: 'Subbie Mobile ITP Run',
    keywords: [
      'mobile itp run',
      'pass fail na',
      'inspection photo',
      'complete checklist',
      'cannot release hold',
    ],
    roles: SUBBIE_ROLES,
    surface: 'subbie-portal',
    body: `ITP Run is the mobile checklist for the selected assigned lot. ${CHROME}

Eligible users record **Pass**, **Fail** or **N/A**, comments and required evidence, then save/complete checks. A view-only state explains missing completion permission. Subcontractors cannot release hold points: inspection completion records their check but does not perform the contractor's hold release.`,
  },
  {
    route: 'p/ncrs',
    title: 'Subbie Mobile NCRs',
    keywords: [
      'mobile ncr list',
      'respond ncr',
      'rectify ncr',
      'lot scoped ncr',
      'non conformance',
    ],
    roles: SUBBIE_ROLES,
    surface: 'subbie-portal',
    body: `NCRs shows non-conformances visible to the subcontractor company. ${CHROME}

When opened from a lot, the lotId query scopes results on the server; otherwise it shows the permitted project list. Cards open issue detail. **Respond** or **Rectify** is offered only in the applicable workflow state; contractor review and closure actions are not available to the subbie.`,
  },
  {
    route: 'p/docs',
    title: 'Subbie Mobile Documents',
    keywords: [
      'mobile subbie docs',
      'open portal document',
      'view only files',
      'project documents',
      'secure file',
    ],
    roles: SUBBIE_ROLES,
    surface: 'subbie-portal',
    body: `Documents is a view-only mobile register for files exposed to the portal. ${CHROME}

Search locates a document and tapping **Open** requests an authorised URL for the device viewer. The current implementation is project-level, including when reached from a lot hub; it is not filtered to that lot. Upload, edit, supersede and delete controls are not available.`,
  },
  {
    route: 'p/company',
    title: 'Subbie Mobile My Company',
    keywords: [
      'mobile crew roster',
      'add employee',
      'add plant',
      'rate approval',
      'subcontractor admin',
      'wet dry plant',
    ],
    roles: SUBBIE_ROLES,
    surface: 'subbie-portal',
    body: `My Company manages the crew and plant used on mobile dockets. ${CHROME}

Crew cards show employee name/role; plant cards show identifying details and hire setup. **Add employee**, **Add plant**, edit and remove controls are restricted to subcontractor admins. Rates must be approved by the contractor before affected docket entry is unlocked. Ordinary subcontractor users have roster visibility without company-admin mutation rights.`,
  },
] satisfies readonly PageKnowledge[];
