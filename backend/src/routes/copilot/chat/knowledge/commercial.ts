import type { PageKnowledge } from './types.js';

export const COMMERCIAL_PAGE_KNOWLEDGE = [
  {
    route: 'projects/<projectId>/diary',
    title: 'Daily Diary',
    keywords: ['diary date', 'weather', 'personnel', 'plant', 'activities', 'delays', 'addendum'],
    roles: 'All internal project roles; edit and submit controls depend on role and diary state.',
    surface: 'office',
    body: `Daily Diary creates the contemporaneous site record for one project day.

The date selector moves to another day or returns to today. Tabs are **Weather**, **Personnel**, **Plant**, **Activities**, **Delays** and **Photos**; count badges show recorded rows. Weather can fetch observed conditions or save manual values. Personnel and Plant can copy yesterday, add rows and remove rows. Activities and Delays add/edit/delete their detailed entries. Photos opens captured attachments.

Before submission, **Save** controls persist the current section. **Print Diary** generates the diary PDF. **Submit Diary** opens a confirmation and locks the main record when confirmed. After locking, ordinary fields are read-only; **Add addendum** appends a dated correction rather than rewriting history. Missing-day and failed-load states offer Start/Create or Retry where permitted.`,
  },
  {
    route: 'projects/<projectId>/deliveries',
    title: 'Delivery Register',
    keywords: [
      'supplier docket',
      'docket not filed',
      'unlinked delivery',
      'batch reference',
      'edit evidence',
    ],
    roles: 'All internal project roles; evidence fix-up depends on role.',
    surface: 'office',
    body: `The Delivery Register rolls every delivery logged in daily diaries into a project-wide evidence queue.

Search filters by supplier. Filter controls narrow docket state, lot link and other register fields. The **Docket not filed** and **Unlinked** summary buttons apply those high-value filters; Clear removes them. **Export CSV** downloads the current results. Previous/Next pages through the server result set.

Opening a delivery shows its diary date and details. **Edit evidence** can attach or replace the actual supplier docket, batch reference and lot link—even after the diary is locked—because those three evidence fields have a dedicated audited fix-up path. A typed docket number alone is not a filed document. The diary link opens the source daily diary.`,
  },
  {
    route: 'projects/<projectId>/delays',
    title: 'Delay Register',
    keywords: ['delay type', 'hours lost', 'date range', 'export delay', 'weather delay'],
    roles: 'All internal project roles.',
    surface: 'office',
    body: `The Delay Register consolidates delay entries from submitted and draft daily diaries.

Delay Type filters Weather, Material Shortage, Equipment Breakdown, Labour Shortage, Client Instruction, Design Issue, Site Access or Other. Date and lot filters narrow the list. **Export to Excel (CSV)** downloads the filtered register. A row/card shows duration, time, lot and impact and links back to the diary record where available. This page reports diary data; new delays are recorded in the Daily Diary or field shell.`,
  },
  {
    route: 'projects/<projectId>/dockets',
    title: 'Docket Approvals',
    keywords: [
      'approve docket',
      'bulk approve',
      'query docket',
      'reject docket',
      'adjust hours',
      'print docket',
    ],
    roles:
      'All internal project roles can view; authorised project roles approve, query, reject or create.',
    surface: 'office',
    body: `Docket Approvals is the head contractor's review queue for subcontractor labour and plant dockets.

**All** and **Pending Approval** filter chips change the queue. **Create Docket** opens a head-contractor draft with date and notes. **Export CSV** downloads displayed dockets, with commercial amounts restricted by role. Checkboxes select eligible pending dockets; **Approve N selected** performs unadjusted approvals and reports partial failures instead of hiding them.

Opening a row shows labour/plant entries, allocation and submitted totals. Draft **Submit** sends it for approval. Pending **Approve** accepts submitted hours, **Query** sends a required question back, and **Reject** records a reason. The approval action can adjust hours and notes before confirming. **Print** generates the docket PDF. Queried dockets retain the query/reply trail; already final dockets are view-only.`,
  },
  {
    route: 'projects/<projectId>/claims',
    title: 'Progress Claims',
    keywords: [
      'new claim',
      'evidence review',
      'record payment schedule',
      'record payment',
      'export xero',
      'blocked value',
    ],
    roles: 'Owner, admin and project manager.',
    surface: 'office',
    body: `Progress Claims compiles eligible lots and approved variations into claim records and tracks claimed, certified and paid amounts separately.

**New Claim** opens the claim period and item picker. Lot and variation checkboxes include eligible items; Load more retrieves further readiness pages. Blocked items link to the exact readiness issue. **Create Claim** saves a draft. **Export CSV** exports the register; chart Export controls download cumulative or monthly series.

Draft **Submit Claim** confirms the declaration and changes workflow state; **Delete Draft Claim** removes only a draft. **Claim Evidence Review** shows completeness without changing the claim. **Generate Evidence Package** lets the user include or exclude report sections and creates a PDF—the claim does not store that PDF automatically. **Mark as Disputed** records the dispute. **Record Payment Schedule** records certified amount/date and variation notes. **Record Payment** records payment amount/date/reference. **Download CSV** exports one claim. **Export to Xero** creates the accounting export when configured; Xero remains the accounting system of record. Summary cards deliberately distinguish total claimed, certified, paid and outstanding.`,
  },
  {
    route: 'projects/<projectId>/variations',
    title: 'Variation Register',
    keywords: [
      'new variation',
      'submit variation',
      'approve variation',
      'reject variation',
      'variation evidence',
      'copy link',
    ],
    roles: 'Owner, admin and project manager.',
    surface: 'office',
    body: `The Variation Register tracks commercial variations through draft, submission and decision.

Status chips filter All and each variation status. **New Variation** opens number, description, reason, amount, dates, lot links and evidence. **Export CSV** downloads displayed rows. Clicking a row opens details; **Copy link** shares that record.

A draft can be **Edit**, **Submit** or **Delete**. A submitted variation can be **Approve** or **Reject** with the required decision details. Evidence can be opened and, where permitted, removed before the workflow locks it. Confirmation dialogs protect approval, rejection and deletion. Approved variations become selectable in claims; the register itself does not certify or pay them.`,
  },
  {
    route: 'projects/<projectId>/costs',
    title: 'Project Costs',
    keywords: [
      'cost summary',
      'subcontractor costs',
      'lot budget actual',
      'export excel',
      'date filter',
    ],
    roles: 'Owner, admin and project manager.',
    surface: 'office',
    body: `Project Costs reports labour, plant, subcontractor and lot cost signals from project records.

**Filters** expands the available date/status filters; active inputs narrow the displayed totals. **Export to Excel** downloads the report. Tabs switch between **Summary**, **Subcontractors** and **Lots**. Summary shows overall breakdowns; Subcontractors compares total/labour/plant by company; Lots compares budget and actual by lot. These are reporting views—editing a lot budget happens on the lot, and correcting docket amounts happens in the docket workflow. Retry reloads failed cost data.`,
  },
  {
    route: 'projects/<projectId>/subcontractors',
    title: 'Project Subcontractors',
    keywords: [
      'invite subcontractor',
      'portal access',
      'enable all modules',
      'remove subcontractor',
      'crew plant',
    ],
    roles: 'Owner, admin, project manager and site manager.',
    surface: 'office',
    body: `Project Subcontractors invites external companies and controls what their portal can expose.

**Invite Subcontractor** can select a company from the global directory or enter company/contact details and sends the invite. Expand a company row to see contacts, assignments, employees and plant. **Portal access** opens module toggles; each switch grants or removes that portal module, while **Enable all** and **Disable all** change the whole set. Module changes can make a portal screen disappear immediately.

Expanded-row actions manage lot assignments, contacts, employees and plant where supported. Remove/deactivate asks for confirmation; **Show removed subcontractors** reveals those records. **Review pending approvals** opens the relevant portal/docket queue. Retry reloads the list.`,
  },
  {
    route: 'projects/<projectId>/reports',
    title: 'Reports and Analytics',
    keywords: [
      'lot status report',
      'ncr report',
      'test report',
      'diary report',
      'claims report',
      'schedule reports',
    ],
    roles:
      'Internal project roles and viewers; Claims and scheduling are additionally role/tier-gated.',
    surface: 'office',
    body: `Reports & Analytics generates current project summaries rather than editing source records.

Tabs are **Lot Status**, **NCR Report**, **Test Results**, **Diary Report** and, for commercial roles, **Claims**. **Refresh Report** reloads the active report and is disabled when there is no data tab to refresh. Test filters choose dates/types; Diary filters choose dates and included sections; Claims filters choose dates/statuses. Their Generate/Refresh controls apply those choices. Date shortcut buttons such as Today, This week and This month fill the range.

**Schedule Reports** opens recurring email/report settings for authorised users with the required plan; otherwise it shows an upgrade prompt or stays disabled until tier information loads. Report tables and charts contain their own CSV/PDF/print controls where shipped. Printing uses the loaded report timestamp and company branding, not live values fetched during print.`,
  },
  {
    route: 'reports/scheduled-runs/<runId>/artifact',
    title: 'Scheduled Report Artifact',
    keywords: [
      'scheduled report download',
      'report artifact',
      'back',
      'download report',
      'expired report',
    ],
    roles: 'Internal project roles and viewers with access to the report run.',
    surface: 'office',
    body: `Scheduled Report Artifact opens one generated output from a scheduled report run.

**Download Report** retrieves the secured artifact and is disabled while the download is being prepared. **Back** returns to the prior in-app page. If the run, project access or file has expired, the page shows the access/load error rather than exposing the stored file location.`,
  },
  {
    route: 'projects/<projectId>/handover-exports',
    title: 'Project Handover Export',
    keywords: [
      'handover archive',
      'preflight estimate',
      'narrow to area',
      'download archive',
      'cancel export',
    ],
    roles:
      'Owner, admin, project manager and quality manager can request; download permission is narrower except for the requester.',
    surface: 'office',
    body: `Project Handover Export builds the verified whole-project evidence archive as an asynchronous job.

Scope controls choose the whole project or a narrower area. **Check size and request archive** runs preflight and queues the job; it is not an instant one-click download. If the estimate needs multiple archives, **Narrow to area** changes the scope. The job list shows queued, snapshotting, processing, complete, failed, cancelled and expired states with progress.

**Download archive** appears only after completion and only for an authorised downloader. **Cancel** asks for confirmation and is available only while the job can still stop. A folio-coverage warning is a nudge, not a gate. Expired downloads are refused unless retained by legal hold.`,
  },
] satisfies readonly PageKnowledge[];
