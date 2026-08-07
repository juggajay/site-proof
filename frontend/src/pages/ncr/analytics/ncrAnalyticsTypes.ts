/**
 * The `GET /api/ncrs/analytics/:projectId` payload, as Wave G G5 reshaped it
 * (`docs/plans/wave-g-execution-spec-2026-07-31.md` §5).
 *
 * The endpoint shipped in 2026 and had no frontend consumer until this page —
 * these types are the first thing that reads it, which is why they live next to
 * the page rather than in a shared api module.
 */

export interface ChartDatum {
  /** Canonical (folded) key — what to filter the register by. */
  key: string;
  /** Human label. */
  name: string;
  value: number;
  percentage: number;
}

export interface RepeatIssue {
  category: string;
  categoryLabel: string;
  rootCause: string;
  rootCauseLabel: string;
  count: number;
}

export interface RepeatOffender {
  subcontractorId: string;
  subcontractorName: string;
  ncrCount: number;
  categories: string[];
  categoryCount: number;
}

export interface RecurringChecklistItem {
  rootChecklistItemId: string;
  description: string;
  templateId: string;
  templateName: string;
  ncrCount: number;
  subcontractorCount: number;
  activitySlugs: string[];
  checklistItemIds: string[];
}

export interface ChecklistItemCoverage {
  linked: number;
  total: number;
  itemsWithoutLineage: number;
  itemsObserved: number;
}

export interface NcrAnalytics {
  summary: {
    total: number;
    open: number;
    closed: number;
    overdue: number;
    avgDaysToClose: number;
    closureRate: number;
  };
  charts: {
    rootCause: { title: string; data: ChartDatum[] };
    category: { title: string; data: ChartDatum[] };
    activity: { title: string; description?: string; data: ChartDatum[] };
    severity: { title: string; data: ChartDatum[] };
    status: { title: string; data: ChartDatum[] };
    closureTimeTrend: {
      title: string;
      description?: string;
      data: { month: string; avgDays: number; count: number }[];
      overallAvg: number;
    };
    volumeTrend: { title: string; description?: string; data: { month: string; count: number }[] };
  };
  repeatIssues: {
    title: string;
    description: string;
    data: RepeatIssue[];
    totalRepeatGroups: number;
  };
  repeatOffenders: { title: string; description: string; data: RepeatOffender[] };
  recurringItems: {
    title: string;
    description: string;
    data: RecurringChecklistItem[];
    coverage: ChecklistItemCoverage;
  };
}

export interface TemplateRevisionProposal {
  id: string;
  projectId: string;
  templateId: string;
  checklistItemId: string | null;
  ncrCount: number;
  subcontractorCount: number;
  activitySlug: string | null;
  proposedChange: string;
  status: 'open' | 'accepted' | 'rejected';
  proposedAt: string;
  decidedAt: string | null;
  decisionNote: string | null;
  // `supersededById` is already selected server-side; a proposal whose target
  // has acquired a successor can no longer be accepted against it.
  template: { id: string; name: string; supersededById?: string | null } | null;
  checklistItem: { id: string; description: string } | null;
  resultingTemplate: { id: string; name: string } | null;
  proposedBy: { id: string; fullName: string | null; email: string } | null;
  decidedBy: { id: string; fullName: string | null; email: string } | null;
}
