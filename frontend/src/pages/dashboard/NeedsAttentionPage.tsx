import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ChevronRight,
  ClipboardCheck,
  FileWarning,
  FlaskConical,
  Receipt,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { cn } from '@/lib/utils';
import { getRoleDisplayName } from '@/lib/roles';
import { formatStatusLabel } from '@/lib/statusLabels';
import { extractErrorMessage } from '@/lib/errorHandling';
import { buttonVariants } from '@/components/ui/button';
import {
  DEFAULT_DASHBOARD_DATE_PRESET,
  getDashboardDateRange,
  useDashboardStats,
  type ActionAssignee,
  type ActionAssignment,
} from '@/hooks/useDashboardStats';

/**
 * A4 P1.2 — the Needs-Attention destination (design spec
 * `docs/plans/a4-my-work-design-2026-07-26.md` §6.1).
 *
 * Renders the `actionAssignments` feed the dashboard stats payload already
 * carries (P1.1, #1609). No new endpoint, no new query key: it reads the same
 * cache entry the dashboard's own widget is fed from.
 *
 * The rules this screen exists to make visible:
 *  - Ball in court is the ONLY grouping axis (§4.1). Phase 1 renders two of the
 *    three groups; "your court — needs another role" stays unrendered because
 *    the phase-1 producer cannot honestly populate it (§9).
 *  - `isOverdue` is ORTHOGONAL to `status` (§4.2 rule 3): it is a time chip and
 *    never a group, so an overdue item waiting on a lab stays in Waiting on
 *    others. Overdue changes urgency, never ownership.
 *  - The primary action renders iff `needsAction === true` (§5.1). The UI never
 *    offers a verb the viewer cannot perform.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Spec §10: "Due-soon horizon is 7 days ... make it a constant, not a scattered literal." */
const DUE_SOON_DAYS = 7;

const SUBJECT_ICONS: Record<string, LucideIcon> = {
  ncr: FileWarning,
  hold_point: AlertTriangle,
  lot: ClipboardCheck,
  test: FlaskConical,
  claim: Receipt,
};

// Colour only where a human must act — the discipline already written down at
// `lib/lotStatusOverview.ts:63`.
const SEVERITY_CHIP: Record<ActionAssignment['severity'], string> = {
  blocker: 'bg-destructive/10 text-destructive',
  warning: 'bg-warning/10 text-warning',
  support: 'bg-muted text-muted-foreground',
};

const SEVERITY_LABEL: Record<ActionAssignment['severity'], string> = {
  blocker: 'Blocker',
  warning: 'Warning',
  support: 'Support',
};

const SEVERITY_RANK: Record<ActionAssignment['severity'], number> = {
  blocker: 0,
  warning: 1,
  support: 2,
};

const CHIP_CLASS = 'rounded-full px-2 py-0.5 text-xs font-medium';

interface DashboardProject {
  id: string;
  name?: string | null;
}

/**
 * Same-origin guard, mirroring `ItemsRequiringAttentionWidget.tsx:31-36` and the
 * `getSafeInternalPath` envelope (spec §8 R3): a single leading `/`, never `//`.
 */
function safeInternalHref(href: string | undefined): string {
  return href?.startsWith('/') && !href.startsWith('//') ? href : '/projects';
}

/**
 * The phase-1 contract carries no project field, but every `primaryAction.href`
 * the P1.1 adapter emits is `/projects/:projectId/...`, so the project lens
 * (decision D3) reads it back off the href rather than inventing a second fetch.
 * ponytail: delete this the moment the contract grows a real project field.
 */
function projectIdFromHref(href: string | undefined): string | null {
  const match = /^\/projects\/([^/?#]+)/.exec(href ?? '');
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Spec §5.1 ranking rule. Severity deliberately outranks overdue: an overdue
 * advisory must not outrank a blocking hold point.
 * ponytail: key 5 (ageDays, descending) is skipped — the phase-1 payload carries
 * no created-at. `subjectId` still supplies the stable tiebreak so the order
 * never flickers; add age when the producer emits it.
 */
function compareAssignments(a: ActionAssignment, b: ActionAssignment): number {
  if (a.needsAction !== b.needsAction) return a.needsAction ? -1 : 1;
  const bySeverity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
  if (bySeverity !== 0) return bySeverity;
  if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
  const aDue = a.dueAt ? Date.parse(a.dueAt) : Number.POSITIVE_INFINITY;
  const bDue = b.dueAt ? Date.parse(b.dueAt) : Number.POSITIVE_INFINITY;
  if (aDue !== bDue) return aDue < bDue ? -1 : 1;
  return a.subjectId.localeCompare(b.subjectId);
}

function pluralDays(count: number): string {
  return `${count} day${count === 1 ? '' : 's'}`;
}

/**
 * Timing as a CHIP, never a group. Overdue wins the chip because it is the one
 * timing fact that changes what you do today.
 */
function timeChip(assignment: ActionAssignment, now: number): { label: string; className: string } {
  if (assignment.isOverdue) {
    // M3 — RENDER the server's count, never re-derive it. This used to floor
    // `dueAt` against the browser clock while the dashboard widget rendered the
    // backend's `daysOverdue` from the same cached payload, so one NCR read
    // "2 days overdue" on the dashboard and "3 days overdue" here fifteen
    // minutes later across midnight (and permanently, on a skewed tablet).
    // The number is computed once, by `lib/readiness/predicates.ts daysOverdue`.
    const days = assignment.daysOverdue;
    return {
      label: days > 0 ? `${pluralDays(days)} overdue` : 'Overdue',
      className: 'bg-destructive/10 text-destructive',
    };
  }
  if (!assignment.dueAt) {
    return { label: 'No due date', className: 'bg-muted text-muted-foreground' };
  }
  const days = Math.ceil((Date.parse(assignment.dueAt) - now) / DAY_MS);
  if (days <= DUE_SOON_DAYS) {
    return {
      label: days <= 0 ? 'Due today' : `Due in ${pluralDays(days)}`,
      className: 'bg-warning/10 text-warning',
    };
  }
  return {
    label: `Due ${new Date(assignment.dueAt).toLocaleDateString('en-AU')}`,
    className: 'bg-muted text-muted-foreground',
  };
}

/**
 * Spec §4.3. Phase 1 only ever emits `role`, `user` and `company` assignees, and
 * carries ids rather than names — so a firm and a person are still visibly
 * different (they imply different chase behaviour in AU civil) without printing
 * a raw UUID at anybody. P2.2 populates real names.
 */
function ownerLabel(
  assignee: ActionAssignee,
  viewerUserId: string | null | undefined,
  viewerRole: string | null | undefined,
): string {
  switch (assignee.kind) {
    case 'role': {
      const label = getRoleDisplayName(assignee.role ?? '');
      return assignee.role && assignee.role === viewerRole ? `${label} (you)` : label;
    }
    case 'user':
      return assignee.id && assignee.id === viewerUserId ? 'You' : 'Assigned user';
    case 'company':
      return 'Subcontractor company';
    case 'external':
      return 'External party';
    case 'system':
      return 'CIVOS automation';
    default:
      return 'Unassigned';
  }
}

interface AssignmentRowProps {
  assignment: ActionAssignment;
  projectName: string | null;
  ownerName: string;
  now: number;
}

function AssignmentRow({ assignment, projectName, ownerName, now }: AssignmentRowProps) {
  const Icon = SUBJECT_ICONS[assignment.subjectType] ?? ClipboardCheck;
  const time = timeChip(assignment, now);

  return (
    <Link
      to={safeInternalHref(assignment.primaryAction.href)}
      className="flex items-center gap-3 rounded-md border border-transparent p-3 transition-colors hover:border-border hover:bg-muted"
    >
      <Icon className="h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />

      <div className="min-w-0 flex-1">
        {/* Line 1 — icon + title + severity chip. */}
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">{assignment.title}</span>
          <span className={cn(CHIP_CLASS, 'flex-shrink-0', SEVERITY_CHIP[assignment.severity])}>
            {SEVERITY_LABEL[assignment.severity]}
          </span>
        </div>
        {/* Line 2 — two structured fields plus the reason code. NEVER prose: that
            is what keeps every row the same height even with the richer-card
            exception granted (spec §6.1). */}
        <p className="mt-1 truncate text-xs text-muted-foreground">
          <span className="font-mono text-[10px] uppercase tracking-wide">
            {assignment.assignee.kind}
          </span>{' '}
          {ownerName}
          {projectName ? <> &middot; {projectName}</> : null} &middot;{' '}
          {/* L13 — the raw code (`hold_point_overdue`) used to render here in
              font-mono. Through the shared label helper it reads as English. */}
          <span>{formatStatusLabel(assignment.reasonCode)}</span>
        </p>
      </div>

      <div className="flex flex-shrink-0 items-center gap-3">
        <span className={cn(CHIP_CLASS, 'font-mono tabular-nums', time.className)}>
          {time.label}
        </span>
        {/* §5.1 render rule: the solid action renders iff `needsAction`. It is a
            span, not a nested <button>, because the row is already the link and
            the action only ever navigates to the decision surface (§5.3). */}
        {assignment.needsAction ? (
          <span className={cn(buttonVariants({ size: 'sm' }))}>
            {assignment.primaryAction.label}
          </span>
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        )}
      </div>
    </Link>
  );
}

interface AssignmentGroupProps {
  title: string;
  assignments: ActionAssignment[];
  projectNameFor: (assignment: ActionAssignment) => string | null;
  ownerNameFor: (assignment: ActionAssignment) => string;
  now: number;
}

function AssignmentGroup({
  title,
  assignments,
  projectNameFor,
  ownerNameFor,
  now,
}: AssignmentGroupProps) {
  if (assignments.length === 0) return null;

  return (
    <section className="rounded-lg border bg-card">
      <div className="flex items-center gap-2 border-b p-4">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-xs font-semibold tabular-nums text-muted-foreground">
          {assignments.length}
        </span>
      </div>
      <div className="space-y-px p-2">
        {assignments.map((assignment) => (
          <AssignmentRow
            key={`${assignment.subjectType}:${assignment.subjectId}`}
            assignment={assignment}
            projectName={projectNameFor(assignment)}
            ownerName={ownerNameFor(assignment)}
            now={now}
          />
        ))}
      </div>
    </section>
  );
}

export function NeedsAttentionPage() {
  const { user, actualRole } = useAuth();
  const [projectFilter, setProjectFilter] = useState<string | null>(null);

  // Same preset the dashboard opens on, so this screen reads the dashboard's own
  // cache entry instead of refetching under a near-miss key. The attention feeds
  // are deliberately not date-filtered server-side (statsRoute), so the range
  // only picks the cache slot.
  const dateRange = useMemo(() => getDashboardDateRange(DEFAULT_DASHBOARD_DATE_PRESET), []);
  const { data, isLoading, error } = useDashboardStats(dateRange.startDate, dateRange.endDate);

  const { data: projectsData } = useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => apiFetch<{ projects: DashboardProject[] }>('/api/projects'),
    staleTime: 30_000,
  });

  const projectNames = useMemo(() => {
    const names = new Map<string, string>();
    for (const project of projectsData?.projects ?? []) {
      if (project.name) names.set(project.id, project.name);
    }
    return names;
  }, [projectsData?.projects]);

  const feed = data?.actionAssignments;
  const items = useMemo(() => feed?.items ?? [], [feed]);
  const totalCount = feed?.totalCount ?? 0;
  const now = Date.now();

  // D3 — the list is company-wide; the project lens filters it, it never scopes
  // what was fetched.
  const projectOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      const projectId = projectIdFromHref(item.primaryAction.href);
      if (projectId) counts.set(projectId, (counts.get(projectId) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([id, count]) => ({ id, name: projectNames.get(id) ?? 'Unnamed project', count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items, projectNames]);

  const visible = useMemo(() => {
    const filtered = projectFilter
      ? items.filter((item) => projectIdFromHref(item.primaryAction.href) === projectFilter)
      : items;
    return [...filtered].sort(compareAssignments);
  }, [items, projectFilter]);

  // §4.1 — ball in court is the only grouping axis, and it is a partition. An
  // `isOverdue` row stays in the group its `status` puts it in; overdue is a chip
  // (see `timeChip`), never a group and never a promotion into "Needs you".
  const needsYou = visible.filter((item) => item.status === 'waiting_on_me' && item.needsAction);
  const waitingOnOthers = visible.filter((item) => item.status === 'waiting_on_others');

  const ownerNameFor = (assignment: ActionAssignment) =>
    ownerLabel(assignment.assignee, user?.id, actualRole);
  const projectNameFor = (assignment: ActionAssignment) => {
    const projectId = projectIdFromHref(assignment.primaryAction.href);
    return projectId ? (projectNames.get(projectId) ?? null) : null;
  };

  if (isLoading) {
    return (
      <div
        className="flex h-64 items-center justify-center"
        role="status"
        aria-label="Loading needs attention"
      >
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  const header = (
    <div className="min-w-0">
      <h1 className="text-2xl font-semibold tracking-tight">Needs Attention</h1>
      {/* The feed is capped per source, so the screen says so rather than letting
          the cap masquerade as the truth. It says only what is true: the NCR limb
          is fetched `dueDate asc` but the hold-point limb is `createdAt asc` and
          deliberately carries rows that are not overdue at all (`statsRoute.ts`),
          so "the N most overdue" was a claim the query never made. */}
      {totalCount > items.length && (
        <p className="mt-1 text-sm text-muted-foreground">
          Showing {items.length} of {totalCount} items needing attention.
        </p>
      )}
    </div>
  );

  if (error) {
    return (
      <div className="space-y-6">
        {header}
        <p role="alert" className="text-sm text-muted-foreground">
          {extractErrorMessage(error, 'Needs Attention could not be loaded.')}
        </p>
      </div>
    );
  }

  // §6.1 empty state: one line, nothing else. It never invents work to fill the page.
  if (items.length === 0) {
    return (
      <div className="space-y-6">
        {header}
        <p className="text-sm text-muted-foreground">Nothing is waiting on you.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      {projectOptions.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by project">
          <ProjectLens
            label="All projects"
            count={items.length}
            active={projectFilter === null}
            onClick={() => setProjectFilter(null)}
          />
          {projectOptions.map((option) => (
            <ProjectLens
              key={option.id}
              label={option.name}
              count={option.count}
              active={projectFilter === option.id}
              onClick={() => setProjectFilter(option.id)}
            />
          ))}
        </div>
      )}

      {/* Group order IS the hierarchy — demotion by position, never by card size. */}
      <AssignmentGroup
        title="Needs you"
        assignments={needsYou}
        projectNameFor={projectNameFor}
        ownerNameFor={ownerNameFor}
        now={now}
      />
      <AssignmentGroup
        title="Waiting on others"
        assignments={waitingOnOthers}
        projectNameFor={projectNameFor}
        ownerNameFor={ownerNameFor}
        now={now}
      />

      {visible.length === 0 && (
        <p className="text-sm text-muted-foreground">Nothing is waiting on you.</p>
      )}
    </div>
  );
}

function ProjectLens({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
        active
          ? 'border-foreground/20 bg-muted text-foreground'
          : 'border-transparent text-muted-foreground hover:bg-muted',
      )}
    >
      {label}
      <span className="font-mono tabular-nums">{count}</span>
    </button>
  );
}
