import type { PageKnowledge } from './types.js';

export const CORE_PAGE_KNOWLEDGE = [
  {
    route: 'dashboard',
    title: 'Company Dashboard',
    keywords: [
      'refresh dashboard',
      'export pdf',
      'date range',
      'customise widgets',
      'lot status',
      'needs attention',
    ],
    roles: 'Authenticated internal users; content and shortcuts vary by role.',
    surface: 'office',
    body: `The Dashboard is the company-level starting point for project health and work needing attention.

**Refresh** reloads the dashboard figures. **Export PDF** generates a dated dashboard summary. **Date range** changes the period used by time-based widgets. **Customise** opens the widget picker; ticking a widget shows or hides it for this user. Lot-status segments open Projects with that status applied. KPI tiles, issue summaries, recent activity and attention rows are links into the relevant project register. **Needs attention** opens the full cross-project queue. A pending-subcontractor-invitation banner opens the invitation screen. With no projects, the setup checklist links to each setup step and may offer **Create sample project**.`,
  },
  {
    route: 'dashboard/needs-attention',
    title: 'Needs Attention',
    keywords: ['attention queue', 'project filter', 'overdue', 'open item', 'all projects'],
    roles: 'Authenticated internal users who can see the company dashboard.',
    surface: 'office',
    body: `Needs Attention expands the dashboard's action queue across accessible projects.

The project chips filter the queue to one project; **All projects** removes that filter. Each row opens the source record or register and marks the row as seen where supported. The small control at the end of a row is part of the same link, not a second action. Retry reloads the queue after an error.`,
  },
  {
    route: 'onboarding',
    title: 'Company Onboarding',
    keywords: ['set up company', 'company name', 'abn', 'create company', 'onboarding'],
    roles: 'Signed-in users who do not yet belong to a head-contractor company.',
    surface: 'office',
    body: `Company Onboarding creates the user's company workspace before projects can be used.

The form captures the company details shown on CIVOS records. **Create company** submits the form and moves to Projects; it stays disabled while required information is missing or while submission is running. This is not the place to join an existing company—an invitation must be accepted instead.`,
  },
  {
    route: 'portfolio',
    title: 'Portfolio',
    keywords: [
      'cross project',
      'portfolio health',
      'cash flow',
      'critical ncr',
      'projects at risk',
    ],
    roles: 'Owner, admin and project manager.',
    surface: 'office',
    body: `Portfolio rolls up status, timeline, commercial and quality signals across accessible projects.

Project names and risk summaries open that project's dashboard. Critical-NCR rows open the NCR in its project. Cash-flow and status cards are summaries rather than editable values. **Try again** reloads any section that failed without changing project data.`,
  },
  {
    route: 'projects',
    title: 'Projects',
    keywords: [
      'project list',
      'new project',
      'create sample project',
      'archive status',
      'project cards',
    ],
    roles: 'Authenticated internal users; project creation is limited by role and plan.',
    surface: 'office',
    body: `Projects lists the workspaces this user can access and is where permitted users create a project.

Selecting a project card or name opens its dashboard. **New Project** opens the creation form for project name, number, client, state and initial settings; **Create Project** is disabled until required fields and plan limits pass. **Create sample project** creates a demonstration workspace when offered in the empty state. **Set up your company** returns an incomplete account to onboarding. Retry reloads the list. URL filters from dashboard lot-status tiles narrow the project results.`,
  },
  {
    route: 'projects/<projectId>',
    title: 'Project Dashboard',
    keywords: [
      'project overview',
      'project switcher',
      'quick links',
      'dashboard widgets',
      'closeout readiness',
    ],
    roles:
      'Internal project members and viewers; subcontractors are redirected to their assigned-work portal.',
    surface: 'office',
    body: `The Project Dashboard is the role-aware overview for one project.

**Switch project** changes the active project. Refresh reloads the current metrics. Date range and widget controls change the dashboard presentation for this user. KPI tiles, lot-status segments, attention items, critical NCRs, hold points and recent activity open their matching registers or records. Quick links open Lots, Diary, Hold Points, Tests, NCRs and other enabled modules. Closeout Readiness links to the evidence work still preventing handover. On a phone, a foreman normally redirects into the /m field shell; desktop foremen retain this overview.`,
  },
  {
    route: 'projects/<projectId>/foreman/today',
    title: 'Classic Foreman Today',
    keywords: ['foreman today', 'classic mobile', 'today worklist', 'capture', 'shell off'],
    roles:
      'Internal project roles; primarily the classic mobile foreman path when the new shell is opted out.',
    surface: 'office',
    body: `Classic Foreman Today is the older five-tab mobile worklist retained for users who turn the new field shell off.

Its cards open today's lots, hold points, dockets and diary tasks. Capture actions open the relevant photo, diary or docket sheet. Refresh retries failed worklist data. The bottom navigation changes classic foreman sections. Most foremen now land in the /m shell, so office users should describe this as the fallback interface rather than the default.`,
  },
  {
    route: 'projects/<projectId>/settings',
    title: 'Project Settings',
    keywords: [
      'general settings',
      'modules tab',
      'notifications tab',
      'danger zone',
      'complete project',
      'archive project',
    ],
    roles: 'Owner, admin and project manager on the project.',
    surface: 'office',
    body: `Project Settings controls the project's configuration, enabled modules and lifecycle.

The tab strip opens **General**, **Modules**, **Team**, **Areas**, **Control Lines**, **Plan Sheets**, **ITP Templates**, **Notifications** and **Danger Zone** without leaving the page. General saves project identity, status, client, state/specification and related defaults. Modules toggles which navigation modules are enabled. Team can add existing company users and links to the full Users page. Areas, Control Lines, Plan Sheets and ITP Templates link to their dedicated managers; disabled-looking buttons in those summary tabs are explanatory when the user is read-only. Notifications manages hold-point recipients and witness settings. Danger Zone offers **Mark complete**, **Archive project** and **Delete project**, each behind a confirmation; delete is destructive and may be blocked by retained records. Retry reloads settings.`,
  },
  {
    route: 'projects/<projectId>/users',
    title: 'Project Users',
    keywords: [
      'add team member',
      'project role',
      'change role',
      'remove user',
      'invite company first',
    ],
    roles: 'Owner, admin and project manager on the project.',
    surface: 'office',
    body: `Project Users manages which existing company members belong to this project and their project role.

**Add Team Member** opens a picker of company users; it does not invite a brand-new person. New people must first be invited under Company Settings → Team Members. **Change role** exposes the role selector for a row; **Save role** applies it and **Cancel** abandons the edit. **Remove from project** asks for confirmation and removes only project access, not the company account. Retry reloads available users. Read-only users see the list without write controls.`,
  },
  {
    route: 'projects/<projectId>/areas',
    title: 'Project Areas',
    keywords: ['area zones', 'add area', 'area colour', 'edit area', 'delete area'],
    roles: 'Owner, admin and project manager.',
    surface: 'office',
    body: `Project Areas defines named zones used to organise lots and filters.

**Add Area** opens the name/description/colour form. Preset colour buttons and the custom colour picker control the area marker colour. **Edit** changes an area; **Delete** opens a confirmation and may be refused while records still depend on it. Save is disabled without a name. Retry reloads the list.`,
  },
  {
    route: 'projects/<projectId>/control-lines',
    title: 'Control Lines',
    keywords: ['alignment', 'landxml', 'dxf', 'setout sheet', 'control points', 'chainage'],
    roles:
      'All internal project roles and viewers can read; owner, admin and project manager can write.',
    surface: 'office',
    body: `Control Lines manages surveyed alignments used for chainage, offsets and drawing lots spatially.

**Import LandXML/DXF** reads one or more alignments, lets the user include/rename them, then imports the selected rows. **Import from setout sheet** uses the AI-assisted setout reader when configured, but the user reviews the extracted points before saving. **Add Control Line** opens the manual point editor: add/remove rows, paste tabular points and set chainage/easting/northing/CRS. Row **Edit** changes a line; **Delete** asks for confirmation and can be blocked when geometry depends on it. Write controls are disabled or hidden for read-only roles.`,
  },
  {
    route: 'projects/<projectId>/plan-sheets',
    title: 'Plan Sheets',
    keywords: [
      'register plan',
      'geopdf',
      'control points',
      'perimeter',
      'upload pdf',
      'drawing overlay',
    ],
    roles:
      'All internal project roles and viewers can read; owner, admin and project manager can write.',
    surface: 'office',
    body: `Plan Sheets stores map-ready drawing pages and their registration.

**Add Plan Sheet** opens Upload/From Documents tabs, accepts a PDF or existing project document and lets the user choose PDF pages. A GeoPDF can use embedded coordinates; another PDF is registered by clicking control points and entering grid coordinates or chainage/offset. **Register** opens that placement editor and shows fit residuals. **Perimeter** traces the useful sheet area; Undo, Clear, Save and Remove control the clipping outline. **Rename** changes the sheet label. **Delete** confirms removal. Read-only roles can inspect sheets but cannot change them.`,
  },
  {
    route: 'projects/<projectId>/copilot',
    title: 'AI Setup Copilot',
    keywords: [
      'ai setup',
      'project facts',
      'control line proposal',
      'plan sheet proposal',
      'lot breakdown',
      'review queue',
    ],
    roles: 'Owner, admin and project manager.',
    surface: 'office',
    body: `AI Setup Copilot prepares cited proposals for project facts, control lines, plan registration and lot breakdown; nothing is applied without human review.

Each stage card's main action starts or resumes its review. **Upload/choose source** selects a drawing or import file. Review panes let the user correct extracted values, include or skip rows, resolve activity and point types, use a corporate master where offered, and inspect source sheets. **Apply** validates and writes the reviewed proposal; **Dismiss** rejects it. **Rollback** reverses an applied proposal only while dependent work has not made that unsafe. Import batches have Resume and Rollback controls. The page link back to project settings returns to manual setup.`,
  },
  {
    route: 'invitations',
    title: 'Invitations',
    keywords: [
      'pending invitation',
      'accept invite',
      'switch account',
      'decline invitation',
      'expired invite',
    ],
    roles: 'Signed-in users with a pending company or project invitation.',
    surface: 'office',
    body: `Invitations shows a pending company or project invitation and verifies which signed-in account will accept it.

**Accept invitation** joins the displayed account to the offered workspace. If the email or existing membership does not match, **Switch account** signs out and returns through login for the correct account. Password and sign-in controls appear only when the invitee is not authenticated. Expired, used or invalid links show recovery links instead of an accept action.`,
  },
] satisfies readonly PageKnowledge[];
