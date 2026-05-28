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
  MapPin,
  TestTube,
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
      'Create your company, add a project, then confirm users, areas, modules, and specification set before field work starts.',
  },
  {
    title: 'Break work into lots',
    description:
      'Create lots that match the way work is inspected, tested, conformed, and claimed. Lots are the backbone of SiteProof.',
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
      'Conformed, budgeted, unclaimed lots can flow into progress claims, reports, exports, and the audit trail without re-keying.',
  },
];

export const documentationSections: DocumentationSection[] = [
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
          'Use Projects to create the workspace, set the project number, client details, status, and enabled modules.',
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
    ],
    tips: [
      'Blockers stop the action. Warnings do not stop the action but should be reviewed.',
      'Hold points are claim evidence blockers, not conformance blockers.',
      'Force Conform is an admin override and requires an audit reason.',
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
      'Seeded jurisdictional templates are global and can be copied into a project.',
      'Verified ITP and test records are protected from unsafe edits.',
      'Hold point release and request events are written to the audit log.',
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
          'Use comments, test result certificates, drawings, and document references to keep evidence close to the relevant lot or workflow.',
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
    ],
  },
  {
    id: 'claims-reports',
    title: 'Claims, costs, and reports',
    summary:
      'Turn conformed work into progress claims and use reports to prove the story behind the numbers.',
    icon: DollarSign,
    steps: [
      {
        title: 'Create claims from ready lots',
        description:
          'Only conformed, budgeted, unclaimed lots can be selected. Readiness explains every disabled lot in the modal.',
      },
      {
        title: 'Move through the claim lifecycle',
        description:
          'Draft, submit, certify, and mark paid. Claim status changes are part of the commercial control path.',
      },
      {
        title: 'Use reports for review and handover',
        description:
          'Reports bring together lot status, evidence, dockets, NCRs, claims, and project progress in one place.',
      },
    ],
    tips: [
      'Budget amount is required before a conformed lot can be claimed.',
      'Claim PDFs and evidence packages use Australian date and currency formatting.',
      'Reports are strongest when field teams maintain lots, dockets, tests, and diaries daily.',
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
          'Owners and admins manage company profile, project users, areas, modules, specification sets, and commercial access.',
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
    ],
  },
];

export const quickReference: QuickReferenceItem[] = [
  { label: 'Projects', icon: FolderKanban, href: '/projects' },
  { label: 'Lots', icon: MapPin, href: '/projects' },
  { label: 'ITPs', icon: ClipboardCheck, href: '/projects' },
  { label: 'Tests', icon: TestTube, href: '/projects' },
  { label: 'Dockets', icon: FileCheck, href: '/projects' },
  { label: 'Claims', icon: DollarSign, href: '/projects' },
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
