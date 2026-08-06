import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Briefcase,
  Building2,
  ClipboardCheck,
  ClipboardList,
  DollarSign,
  FileCheck,
  FileText,
  FolderKanban,
  GitPullRequest,
  Map as MapIcon,
  MapPin,
  Package,
  Plug,
  Rocket,
  Sparkles,
  TestTube,
  Truck,
  Upload,
} from 'lucide-react';

export interface DocumentationStep {
  title: string;
  description: string;
}

export interface DocumentationSection {
  id: string;
  title: string;
  summary: string;
  icon: LucideIcon;
  route?: string;
  routeLabel?: string;
  subcontractorRoute?: string;
  subcontractorRouteLabel?: string;
  steps: DocumentationStep[];
  tips: string[];
}

export interface QuickReferenceItem {
  label: string;
  headContractorLabel?: string;
  icon: LucideIcon;
  href: string;
  subcontractorHref?: string;
}

export const workflowSteps: DocumentationStep[] = [
  {
    title: 'Set up the company and project',
    description:
      'Create your company, add a project, then confirm users, areas, navigation shortcuts, and specification set before field work starts.',
  },
  {
    title: 'Break work into lots',
    description:
      'Create lots that match the way work is inspected, tested, conformed, and claimed. Lots are the backbone of CIVOS.',
  },
  {
    title: 'Collect evidence as work happens',
    description:
      'Attach ITPs, complete checklist items, request hold point releases, upload tests, record NCRs, and keep the diary current.',
  },
  {
    title: 'Resolve readiness blockers',
    description:
      'Use Evidence Readiness on the lot and claim screens to see exactly what prevents conformance, claiming, or handover.',
  },
  {
    title: 'Claim and report from the same evidence',
    description:
      'Conformed lots and approved variations flow into progress claims, evidence packages, reports, and exports without re-keying.',
  },
];

export const documentationSections: DocumentationSection[] = [
  {
    id: 'getting-started',
    title: 'Getting started: your first project',
    summary:
      'The whole path from a new account to a finished job — set up, inspect, claim, and hand over.',
    icon: Rocket,
    route: '/projects',
    routeLabel: 'Open projects',
    steps: [
      {
        title: 'Create the project',
        description:
          "Add the project workspace with its number, client and state, then put your team on it from the project's Users page — field crew as foremen, office staff as project or quality managers. Someone who has never used CIVOS is invited to the company first, under Company Settings, Team Members.",
      },
      {
        title: 'Bring in the survey',
        description:
          "Import the surveyor's alignment (LandXML or DXF) under Control Lines, and register the drawings under Plan Sheets — a GeoPDF registers itself; any other PDF is placed by matching control points to their grid coordinates.",
      },
      {
        title: 'Create lots',
        description:
          'Use Bulk Create Lots to generate lots along a control line from chainage and offsets, assigning an ITP template to every lot in the same pass. Switch the register to Map to see the job on satellite.',
      },
      {
        title: 'Run the quality loop',
        description:
          'Complete ITP checks with photo evidence, request hold point releases — the superintendent releases from a secure email link — and upload lab certificates, which CIVOS reads into test results for your review.',
      },
      {
        title: 'Keep the daily record',
        description:
          'The diary captures weather, crew, plant and work, with deliveries logged from the phone. The foreman shell is phone-first, and field capture keeps working offline.',
      },
      {
        title: 'Bring subbies on',
        description:
          'Invite subcontractor companies from the Subcontractors page. They work in their own portal, and their dockets flow to your Docket Approvals queue.',
      },
      {
        title: 'Claim and hand over',
        description:
          'Conform finished lots, build progress claims from them and generate an evidence package to send with each one, then finish with per-lot evidence folios and the project handover export.',
      },
    ],
    tips: [
      'Lot budgets must be set before a lot can be claimed — add them early.',
      'Subcontractor portal accounts are free — inviting a subbie never costs them or you anything.',
      'The Evidence Readiness panel on every lot lists what still blocks conformance or claiming. When in doubt, start there.',
      "Once work starts moving, the map's Past view replays the job as it was on any date.",
      'Ask Clancy at any step — it can explain any module and take you to the right page.',
    ],
  },
  {
    id: 'projects-lots',
    title: 'Projects and lots',
    summary: 'Create the project workspace and structure work into claimable, inspectable lots.',
    icon: FolderKanban,
    route: '/projects',
    steps: [
      {
        title: 'Create or open a project',
        description:
          'Use Projects to create the workspace, set the project number, client details, status, and navigation module shortcuts.',
      },
      {
        title: 'Create lots from the Lots register',
        description:
          'Add lot number, area, chainage, layer, activity, budget amount, and subcontractor assignment where relevant.',
      },
      {
        title: 'Use lot status as the workflow signal',
        description:
          'Not started, in progress, ready for inspection, conformed, and claimed statuses drive dashboards, reports, and claim eligibility.',
      },
    ],
    tips: [
      'Use lot numbers that match site records and progress claim schedules.',
      'Add budgets before conformance if the lot will be claimed.',
      'Assign subcontractors at lot level when they need portal work or docket access.',
      'Bulk Create Lots can assign an ITP template to every lot and draw its map footprint from a control line and chainage in one pass.',
    ],
  },
  {
    id: 'site-map',
    title: 'Site map and lot geometry',
    summary:
      'See lots on a satellite map, place them from control lines or plan sheets, and check coverage.',
    icon: MapIcon,
    route: '/projects',
    routeLabel: 'Open projects',
    steps: [
      {
        title: 'Open the map view',
        description:
          'Switch the Lot Register to Map to see each lot as a shape on satellite imagery, coloured by status, with control lines and a status legend.',
      },
      {
        title: 'Place lots on the map',
        description:
          'Generate lot footprints from a control line and chainage, import an alignment from LandXML or DXF, trace a lot off a plan sheet, or draw one by hand.',
      },
      {
        title: 'Read coverage, testing, photos, and history',
        description:
          'Use Testing to recolour drawn lots by test frequency, Test pins to show where samples were taken, Coverage to find chainage gaps, Find by area to list lots in a box, Photos to pin GPS-tagged site photos, and Past view to scrub lot status by date.',
      },
    ],
    tips: [
      'The Testing layer recolours drawn lots with the same three-valued test frequency verdict the lot page shows: green for Testing satisfied, amber for Fewer tests than required, and grey for No rule. Lots that are not drawn are counted, not coloured, and the panel says how many. Testing is an internal layer that subcontractors never see, and it is unavailable in Past view because a live verdict has no meaning against a past date.',
      'The Test pins layer shows a pin only where someone captured a sample point on a test. Nothing is derived, so a test recorded with a chainage description and no captured coordinate is counted toward the frequency but never drawn. The pin gives the coordinate and how it was captured, such as GPS plus or minus 6 m, or Picked on map.',
      'Overlay registered plan sheets on the imagery and blend the paper away so only the linework shows.',
      'Tiles, plan sheets, and map data you have already viewed stay available offline; there is no bulk pre-download.',
      'Snapshot the map to save it into project Documents, ready to attach to a conformance pack or claim.',
      'Subcontractors see only the lots assigned to their company on the map.',
      'The satellite lot map is also available in the foreman mobile shell.',
    ],
  },
  {
    id: 'readiness',
    title: 'Evidence Readiness',
    summary:
      'See the exact blockers, warnings, and supporting evidence for conformance and claims.',
    icon: ClipboardList,
    steps: [
      {
        title: 'Open a lot readiness panel',
        description:
          'The lot page shows action blockers, warnings, and support items. Blockers explain what must be fixed before the next action.',
      },
      {
        title: 'Follow the action links',
        description:
          'Readiness actions scroll to the relevant lot tab, such as ITP, tests, hold points, documents, or commercial fields.',
      },
      {
        title: 'Review claim readiness before selection',
        description:
          'The Create Claim modal disables only lots with true action blockers and explains why each lot can or cannot be selected.',
      },
      {
        title: 'Check the test frequency count',
        description:
          'Where the project state and specification set resolve a governing specification — VicRoads Section 204 for Victorian earthworks, TfNSW Q6 for NSW earthworks and pavements — readiness shows how many compaction tests the lot requires against how many verified passing tests it has.',
      },
    ],
    tips: [
      'Blockers stop the action. Warnings do not stop the action but should be reviewed.',
      'Hold points are claim evidence blockers, not conformance blockers.',
      'Force Conform is an admin override and requires an audit reason.',
      'The required test count comes from the lot activity and its testing scale, which NSW projects call Specified relative compaction. In NSW the count also varies with the lot area, taken from the lot quantity in square metres or from its drawn geometry. Victorian earthworks lots need 6 compaction tests on Compaction Scale A or B and 3 on Scale C, and Scale A applies where the specification does not state one.',
      'Test frequency checking is advisory on every project today. It can be set to block per project, which stops a lot short of its required count being conformed.',
      '"Test frequency cannot be checked" means an input is missing. Set the lot activity, testing scale, and quantity, or draw the lot geometry, on the lot edit page.',
      'After three consecutive conforming lots a VicRoads lot can become eligible to request a reduced frequency from the Superintendent. CIVOS reports the eligibility only and never reduces the count itself.',
    ],
  },
  {
    id: 'itp-holdpoints-tests',
    title: 'ITPs, hold points, and test results',
    summary:
      'Attach inspection plans, complete checks, release hold points, and verify test evidence.',
    icon: ClipboardCheck,
    steps: [
      {
        title: 'Assign an ITP template',
        description:
          'Use the lot ITP action to select a seeded template or project template matching the activity and specification set.',
      },
      {
        title: 'Complete and verify quality items',
        description:
          'Record checklist outcomes, upload supporting evidence, and verify test results before relying on them for claim evidence.',
      },
      {
        title: 'Request and release hold points',
        description:
          'Request release from the lot, then record release in-app or through the secure public hold point link.',
      },
    ],
    tips: [
      'A hold point waiting on the superintendent sits at Notified until it is released. That is the only status CIVOS treats as awaiting release.',
      'CIVOS can chase the superintendent for you, but only on projects that have been switched on for it by name. Everywhere else nothing is sent automatically and you chase manually as before.',
      'Where it is switched on, the first reminder goes out one working day before the scheduled release date and then every two working days while it stays overdue, up to three reminders per release request. Requesting release again starts a fresh request with a fresh three.',
      'A reminder is one email per recipient per project per day, listing every hold point of yours they owe a decision on, each with its own live release link. They never get a second message that day, however many hold points fall due.',
      'Each reminder mints a fresh link because the original one expires. Releasing the hold point, re-requesting it, closing the project, or removing that address from the notification list all stop the reminders.',
      'Every automated reminder is written to the audit log, including the ones deliberately not sent.',
      'A secure hold point link covers that one hold point only, and it shows the holder the lot, the hold point, the schedule, and the evidence package. It does not show them the other addresses the request went to, and it never shows the email address of the person who requested release — the release record and its PDF name that person or say Site Team.',
      'Replies to a hold point email reach the person who requested the release. If that account is gone or inactive it goes to company support, and the email says so rather than putting their name on it.',
      'On those same switched-on projects, a hold point still Notified more than a day past its scheduled date raises an internal Hold Point stale alert to the project team, at high severity and critical once it is two days past.',
      'Superintendents work entirely from the emailed links. There is no CIVOS inbox or queue for them to sign into and no list of everything they owe you across projects.',
      'Seeded jurisdictional templates are global and can be copied into a project.',
      'Assigned the wrong ITP? It can be unassigned from the lot until work is recorded against it.',
      'Test results count toward conformance once linked to their ITP checklist item and verified.',
      'Where a governing specification sets a test frequency, only verified passing tests whose type is recognised for that rule count toward it. Density Ratio, AS 1289.5.4.1, and RC 316.00 all count as compaction; laboratory reference tests such as MDD never count toward the field test number. A "Verified tests not counted" warning means the test type is not recognised, not that the test is unlinked.',
      'Recording where a sample was taken is optional and blocks nothing. On the test forms you can pick the point on a map or use your current GPS fix; a GPS fix coarser than 30 m is refused with its own accuracy shown rather than saved, and a map pick carries no accuracy figure. CIVOS never derives a sample location — no capture means no location, not a pin in the middle of the lot.',
      'Send to lab records that a sample went to a laboratory, and the register then shows how long it has been waiting. Setting an expected result date is optional and marks the row overdue once that date passes; CIVOS never assumes a turnaround, so a blank date shows elapsed days only and is never flagged late.',
      'Verified ITP and test records are protected from unsafe edits.',
      'Failing an ITP checklist item online requires a photo of the issue first, and still raises an NCR automatically.',
      'Hold point release and request events are written to the audit log.',
      'The lot ITP checklist and lot edit form keep working offline and sync when you are back in coverage.',
    ],
  },
  {
    id: 'subbie-dockets',
    title: 'Subcontractor portal and dockets',
    summary: 'Invite subcontractors, assign lots, collect dockets, query them, and approve them.',
    icon: Briefcase,
    route: '/projects',
    routeLabel: 'Open projects',
    subcontractorRoute: '/subcontractor-portal',
    subcontractorRouteLabel: 'Open portal',
    steps: [
      {
        title: 'Invite and approve the subcontractor',
        description:
          'Use the project Subcontractors page to invite the company, approve the row, and confirm portal access toggles.',
      },
      {
        title: 'Assign work at lot level',
        description:
          'Open the lot Assigned Subcontractors control and link the subcontractor company to the specific lot.',
      },
      {
        title: 'Submit, query, respond, and approve dockets',
        description:
          'The subcontractor submits labour and plant hours. The head contractor can query, approve, or reject from Docket Approvals.',
      },
    ],
    tips: [
      'Portal users should use separate accounts from head-contractor company users.',
      'Fresh subbie work visibility depends on lot-stage assignment, not just project invite acceptance.',
      'Approved dockets contribute to cost and reporting views.',
    ],
  },
  {
    id: 'documents-drawings',
    title: 'Documents, drawings, and photos',
    summary: 'Store project files, photos, drawings, and evidence where the work was performed.',
    icon: Upload,
    steps: [
      {
        title: 'Upload supported files',
        description:
          'Upload PDF, Word, Excel, Outlook email, image files, and other supported project document types through the Documents page.',
      },
      {
        title: 'Attach evidence to work records',
        description:
          'Use comments, test result certificates (printed as the Material Conformance Record), drawings, and document references to keep evidence close to the relevant lot or workflow.',
      },
      {
        title: 'Use clear document types',
        description:
          'Choose the document type that best matches the record so reports and handover packs are easy to filter later.',
      },
    ],
    tips: [
      'Unsupported file types return a specific rejection reason.',
      'Production storage uses Supabase Storage through backend-controlled uploads.',
      'Avoid uploading credentials, private keys, or unrelated personal data.',
      'Photo capture and the daily diary pre-select the lot you are standing in from GPS — you can still change it.',
      'GPS-tagged photos appear as pins on the site map when the Photos layer is on.',
      'Documents filed under a commercial category are never visible in the subcontractor portal, even on work a subcontractor can otherwise see.',
    ],
  },
  {
    id: 'ncr-diary',
    title: 'NCRs and daily diary',
    summary:
      'Track quality non-conformance and keep a daily record of work, weather, people, plant, and issues.',
    icon: AlertTriangle,
    steps: [
      {
        title: 'Raise NCRs with evidence',
        description:
          'Create NCRs from the project NCR page, add evidence, rectify the issue, send for review, and close only after verification.',
      },
      {
        title: 'Submit daily diaries',
        description:
          'Record work areas, labour, plant, weather, delays, and addendums from the Daily Diary module.',
      },
      {
        title: 'Use addendums for late information',
        description:
          'After submission, addendums preserve the historical diary while still recording later clarifications.',
      },
    ],
    tips: [
      'NCR state changes and evidence events are audited.',
      'Diary submission locks the main record and uses addendums for later notes.',
      'Docket approval can feed diary labour and plant where configured.',
      'Tap the mic on diary and docket note fields to dictate instead of type (Australian English).',
    ],
  },
  {
    id: 'deliveries',
    title: 'Deliveries and materials',
    summary:
      'Track every material delivery from the daily diary to the lot, with the supplier docket attached as evidence.',
    icon: Truck,
    steps: [
      {
        title: 'Log deliveries in the daily diary',
        description:
          'The foreman records a delivery with a photo of the supplier docket — or adds the photo later; the delivery saves either way. Dictation and offline capture work the same as the rest of the diary.',
      },
      {
        title: 'Review the delivery register',
        description:
          'Deliveries shows every delivery across the project with its lot link, batch or mix reference, and whether the supplier docket is on file. Supplier, lot-linked, docket-filed, and date filters all run on the server, so the counts are the truth.',
      },
      {
        title: 'Attach evidence after the diary locks',
        description:
          'The supplier docket, batch reference, and lot link can be attached to a delivery after the diary has locked — only those three evidence fields, and every change is written to the audit log.',
      },
    ],
    tips: [
      '"Docket filed" means the actual supplier docket document is attached. A typed docket number alone does not count.',
      'The unlinked-delivery and missing-docket counters are project-wide totals that filters never shrink — they are the numbers to drive to zero before handover.',
      'An unlinked delivery raises a support-level readiness prompt. It never blocks conformance or a claim.',
      'An NCR can name the delivery that supplied the bad material — pick the delivery on the NCR create form and the link shows on the NCR and its PDF. The link is set at creation only.',
      'The register sorts by the diary date the delivery was recorded against, so a late back-entry files where it happened, not at the top.',
      'Deliveries are internal. Subcontractors never see the register.',
    ],
  },
  {
    id: 'claims-reports',
    title: 'Claims, variations, costs, and reports',
    summary:
      'Turn conformed work and approved variations into progress claims, and use reports to prove the story behind the numbers.',
    icon: DollarSign,
    steps: [
      {
        title: 'Create claims from ready lots',
        description:
          'Only conformed, budgeted lots with remaining percentage can be selected. Readiness explains every disabled lot in the modal.',
      },
      {
        title: 'Track variations from proposal to claim',
        description:
          'Raise changed or extra work in the Variations register with evidence and a client reference. Once approved with a final amount, a variation can be added to a progress claim as its own line.',
      },
      {
        title: 'Move through the claim lifecycle',
        description:
          'Draft, submit, certify, dispute if contested, and record payment. Submitting records the date — download the evidence package PDF and send it to your client yourself.',
      },
      {
        title: 'Use reports for review and handover',
        description:
          'Reports bring together lot status, evidence, dockets, NCRs, claims, and project progress in one place.',
      },
    ],
    tips: [
      'Budget amount is required before a conformed lot can be claimed.',
      'The evidence package PDF compiles ITPs, hold points, tests, NCRs, photos, and claimed variations per claim.',
      'The Xero export produces a draft-invoice CSV with a line per lot and per variation.',
      'The Costs page tracks labour and plant spend from approved dockets against lot budgets, broken down by subcontractor and by lot.',
      'Reports can be scheduled to arrive by email on a recurring basis on Professional and Enterprise plans.',
      'Reports are strongest when field teams maintain lots, dockets, tests, and diaries daily.',
    ],
  },
  {
    id: 'handover',
    title: 'Handover and the evidence folio',
    summary:
      'Issue per-lot evidence folios and export the whole project as a verified handover package.',
    icon: Package,
    steps: [
      {
        title: 'Issue a lot evidence folio',
        description:
          'From the lot page, issue a versioned folio PDF that brings together the lot tests, hold points, ITP completions, NCRs, deliveries, and a listing of the documents and photos held, with its SHA-256 hash shown in the app.',
      },
      {
        title: 'Request the project handover export',
        description:
          'Handover Exports assembles the whole project into one download — the snapshot is sized up front and refused if it is too large, then frozen in a single transaction, and the ZIP is hash-verified.',
      },
      {
        title: 'Check closeout readiness first',
        description:
          'The export page nudges when lots lack an evidence folio, but it never blocks the export.',
      },
    ],
    tips: [
      'Re-issuing a folio mints a new version. Version numbers are never reused and old versions are never overwritten.',
      'A folio prints what is expected, present, and missing — and above 5,000 evidence rows it refuses to issue rather than silently omit records.',
      'Requesting an export and issuing folios is owner, admin, project manager, and quality manager. Downloading a handover export is owner, admin, and project manager — plus the person who requested that export.',
      'A handover export expires on its stated date and can no longer be downloaded after that — unless a legal hold has been placed on it, which keeps it downloadable.',
      'Reports are the day-to-day review surface; the handover export is the end-of-job evidence package for the principal.',
    ],
  },
  {
    id: 'admin',
    title: 'Admin, audit, and settings',
    summary:
      'Manage users, company settings, project settings, notifications, support, and the audit trail.',
    icon: Building2,
    steps: [
      {
        title: 'Set company and project controls',
        description:
          'Owners and admins manage company profile, project users, areas, navigation module shortcuts, specification sets, and commercial access.',
      },
      {
        title: 'Review audit activity',
        description:
          'Audit Log records critical workflow events, including lot changes, dockets, hold points, claims, portal access, and auth events.',
      },
      {
        title: 'Use support when the workflow is blocked',
        description:
          'The Support page submits tickets with configured contact details and provides direct support contact options.',
      },
    ],
    tips: [
      'Audit log search covers actions, entities, users, projects, and detail text.',
      'Subcontractor portal access is separate from head-contractor company membership.',
      'Use Notifications for pending approvals, queries, and workflow items that need attention.',
      'Test Frequency Checking in the project General settings decides whether a lot short of its required test count is only warned about or cannot be conformed. It can be off, warn, or block, and is set per project.',
      'Foremen and subcontractors use simplified mobile shells (foreman /m, subbie portal /p) rather than these office pages.',
    ],
  },
  {
    id: 'ai-copilot',
    title: 'AI in CIVOS: setup copilot and Clancy',
    summary:
      'AI reads your drawings and answers questions — and every AI-prepared change goes to a human review queue before it touches the project.',
    icon: Sparkles,
    route: '/projects',
    routeLabel: 'Open projects',
    steps: [
      {
        title: 'Run the setup copilot on a new project',
        description:
          'From the project Copilot page, four stages read your drawings for you: project facts from the title block, control line from a setout sheet, plan sheet registration, and lot breakdown along the alignment. Each stage produces proposals you review and apply — nothing is written to the project until you approve it.',
      },
      {
        title: 'Ask Clancy anything',
        description:
          'Clancy is the chat copilot in the header (or press Ctrl+J / Cmd+J). He answers from live project data and this documentation — lot status, hold point and NCR counts, module summaries, ITP suggestions, and how-to help — and he can take you to the right page. He is available to owners, admins, and project managers, and he never changes records.',
      },
      {
        title: 'Let AI lift data from paperwork',
        description:
          'Test certificate uploads can extract results automatically, setout sheets can be imported as control lines, and lot ITP photo uploads are classified automatically. Voice dictation (Australian English) is available on diary and docket notes.',
      },
    ],
    tips: [
      'Every AI extraction lands in a review queue with an audit trail — approve, edit, or discard before anything is applied.',
      'AI stages need the server AI to be configured; the lot breakdown stage is deterministic and works without it.',
      'Clancy says plainly when he does not know or cannot do something — he never guesses project data.',
    ],
  },
  {
    id: 'integrations',
    title: 'Integrations: API keys and webhooks',
    summary:
      'Connect your own systems: API keys pull data from the CIVOS REST API, webhooks push lot, hold point, and NCR events to your endpoint.',
    icon: Plug,
    route: '/company-settings',
    routeLabel: 'Open Company Settings',
    steps: [
      {
        title: 'Create an API key',
        description:
          'From Company Settings, API keys. A key acts as the user who created it, with the same project access. Scopes limit what it can do: read allows viewing data only, write also allows creating and updating, admin allows everything. The full key is shown once at creation — store it somewhere safe.',
      },
      {
        title: 'Call the REST API with the key',
        description:
          'Send the key in an x-api-key header. It works against the same REST API the app uses, so anything you can see in the app — lots, tests, NCRs, dockets, claims — can be pulled into your own reports, dashboards, or spreadsheets.',
      },
      {
        title: 'Add a webhook to hear about events',
        description:
          'From Company Settings, Webhooks. Paste your endpoint URL; it subscribes to all supported lot, hold point, and NCR events, and CIVOS notifies that URL the moment each event happens. Every delivery is signed with HMAC-SHA256 using the signing secret shown at creation, so your system can verify the notification really came from CIVOS.',
      },
    ],
    tips: [
      'Supported webhook events: lot created, updated, and deleted; hold point release requested and released; NCR created and closed.',
      'A read-scope key cannot change anything even if it leaks — prefer read unless you need more.',
      'Keys support expiry dates and instant revocation, and creation and revocation are audit-logged.',
      'An API key can never be used to create or manage other API keys.',
      'Regenerate a webhook signing secret at any time from the webhook row.',
    ],
  },
];

export const quickReference: QuickReferenceItem[] = [
  { label: 'Projects', icon: FolderKanban, href: '/projects' },
  { label: 'Lots', icon: MapPin, href: '/projects' },
  { label: 'Site map', icon: MapIcon, href: '/docs#site-map' },
  { label: 'ITPs', icon: ClipboardCheck, href: '/projects' },
  { label: 'Test Results', icon: TestTube, href: '/projects' },
  { label: 'Docket Approvals', icon: FileCheck, href: '/projects' },
  { label: 'Progress Claims', icon: DollarSign, href: '/projects' },
  { label: 'Variations', icon: GitPullRequest, href: '/projects' },
  { label: 'Reports', icon: BarChart3, href: '/projects' },
  { label: 'Documents', icon: FileText, href: '/projects' },
  {
    label: 'Portal',
    headContractorLabel: 'Subbie flow',
    icon: Briefcase,
    href: '/docs#subbie-dockets',
    subcontractorHref: '/subcontractor-portal',
  },
  { label: 'Support', icon: BookOpen, href: '/support' },
];
