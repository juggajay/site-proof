/**
 * DocketsListScreen — /p/dockets — the subbie's docket history / payment trail.
 *
 * Design spec: docs/design-subbie-shell-mock-v1.html #dockets.
 * Month-total approved sub-line; filter chips All / Needs attention / Pending /
 * Approved (needs-attention groups queried + rejected — the same statuses the
 * classic All/Pending/Approved/Queried tabs reach, with the approved grouping
 * label change). Rows grouped by month show date, entry count, $ total, status
 * badge; queried/rejected rows surface a foremanNotes snippet. Rows → /p/docket/:id.
 *
 * Data: the SAME classic dockets query key (queryKeys.portalDockets) → shared
 * cache with the classic DocketsListPage and the Home hero.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { ShellScreen } from '@/shell/components/ShellScreen';
import { formatCurrency } from '@/pages/subcontractor-portal/subcontractorDashboardHelpers';
import { getDocketDisplayTotalCost } from '@/pages/subcontractor-portal/docketEditData';
import { useSubbieShellContext } from '../../subbieShellContext';

interface Docket {
  id: string;
  date: string;
  status: string;
  totalLabourSubmitted: number;
  totalPlantSubmitted: number;
  totalLabourApprovedCost?: number | null;
  totalPlantApprovedCost?: number | null;
  labourEntries?: { id: string }[];
  plantEntries?: { id: string }[];
  foremanNotes?: string;
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'needs_attention', label: 'Needs attention' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
] as const;

type FilterKey = (typeof FILTERS)[number]['key'];

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  draft: { label: 'DRAFT', cls: 'shell-badge-draft' },
  pending_approval: { label: 'PENDING', cls: 'shell-badge-pend' },
  approved: { label: 'APPROVED', cls: 'shell-badge-ok' },
  queried: { label: 'QUERIED', cls: 'shell-badge-pend' },
  rejected: { label: 'REJECTED', cls: 'shell-badge-bad' },
};

function matchesFilter(status: string, filter: FilterKey): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'needs_attention':
      return status === 'queried' || status === 'rejected';
    case 'pending':
      return status === 'pending_approval';
    case 'approved':
      return status === 'approved';
    default:
      return true;
  }
}

function entryCount(d: Docket): number {
  return (d.labourEntries?.length ?? 0) + (d.plantEntries?.length ?? 0);
}

function docketTotal(d: Docket): number {
  return getDocketDisplayTotalCost(d);
}

function formatRowDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return new Intl.DateTimeFormat('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(date);
}

export function DocketsListScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { projectId } = useSubbieShellContext();
  const projectQuery = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
  const [filter, setFilter] = useState<FilterKey>('all');

  const { data: dockets = [], isLoading } = useQuery({
    queryKey: queryKeys.portalDockets(user?.id, projectId),
    queryFn: async () => {
      const res = await apiFetch<{ dockets: Docket[] }>(`/api/dockets?projectId=${projectId}`);
      return res.dockets ?? [];
    },
    enabled: !!user?.id && !!projectId,
  });

  // Month-approved total for the sub-line: approved $ in the current month.
  const monthApproved = useMemo(() => {
    const now = new Date();
    const m = now.getMonth();
    const y = now.getFullYear();
    return dockets
      .filter((d) => {
        if (d.status !== 'approved') return false;
        const dd = new Date(d.date);
        return dd.getMonth() === m && dd.getFullYear() === y;
      })
      .reduce((sum, d) => sum + docketTotal(d), 0);
  }, [dockets]);

  const needsAttentionCount = useMemo(
    () => dockets.filter((d) => d.status === 'queried' || d.status === 'rejected').length,
    [dockets],
  );

  const visible = useMemo(
    () => dockets.filter((d) => matchesFilter(d.status, filter)),
    [dockets, filter],
  );

  // Group by month.
  const monthGroups = useMemo(() => {
    const groups = visible.reduce(
      (acc, d) => {
        const date = new Date(d.date);
        const key = `${date.getFullYear()}-${date.getMonth()}`;
        const label = date
          .toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
          .toUpperCase();
        if (!acc[key]) acc[key] = { label, dockets: [] as Docket[] };
        acc[key].dockets.push(d);
        return acc;
      },
      {} as Record<string, { label: string; dockets: Docket[] }>,
    );
    return Object.values(groups);
  }, [visible]);

  const docketHref = (id: string) => `/p/docket/${id}${projectQuery}`;

  const sub = (
    <span>
      This month:{' '}
      <span className="shell-mono text-foreground">{formatCurrency(monthApproved)}</span> approved
    </span>
  );

  if (isLoading) {
    return (
      <ShellScreen variant="inner" title="My Dockets" parent="/p" sub={<span>Loading…</span>}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-[76px] animate-pulse rounded-2xl bg-muted" />
        ))}
      </ShellScreen>
    );
  }

  return (
    <ShellScreen variant="inner" title="My Dockets" parent="/p" sub={sub}>
      {/* Filter chips */}
      <div
        className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
        role="group"
        aria-label="Filter dockets by status"
      >
        {FILTERS.map((f) => {
          const active = filter === f.key;
          const showCount = f.key === 'needs_attention' && needsAttentionCount > 0;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              aria-pressed={active}
              className={cn(
                'min-h-[40px] whitespace-nowrap rounded-full px-3.5 py-2 text-[13px] font-semibold touch-manipulation',
                active
                  ? 'bg-foreground text-[hsl(40_33%_98%)]'
                  : 'bg-secondary text-muted-foreground',
              )}
            >
              {f.label}
              {showCount ? ` (${needsAttentionCount})` : ''}
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <div className="py-16 text-center text-[14px] leading-relaxed text-muted-foreground">
          {filter === 'all' ? (
            <>No dockets yet.</>
          ) : filter === 'needs_attention' ? (
            <>
              Nothing needs your attention.
              <br />
              Queried or rejected dockets show up here.
            </>
          ) : (
            <>No {filter} dockets here.</>
          )}
        </div>
      ) : (
        monthGroups.map((group) => (
          <div key={group.label} className="flex flex-col gap-2">
            <div className="shell-sect">
              <span className="t">{group.label}</span>
            </div>
            {group.dockets.map((d) => {
              const badge = STATUS_BADGE[d.status] ?? STATUS_BADGE.draft;
              const note =
                (d.status === 'queried' || d.status === 'rejected') && d.foremanNotes
                  ? d.foremanNotes
                  : null;
              const count = entryCount(d);
              return (
                <button
                  key={d.id}
                  type="button"
                  className="shell-card flex items-center gap-3"
                  onClick={() => navigate(docketHref(d.id))}
                  aria-label={`${formatRowDate(d.date)}, ${count} entries, ${formatCurrency(
                    docketTotal(d),
                  )}, ${badge.label}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold text-foreground">
                      {formatRowDate(d.date)}
                    </span>
                    <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">
                      {count} {count === 1 ? 'entry' : 'entries'} · {formatCurrency(docketTotal(d))}
                      {note ? ` — ${note}` : ''}
                    </span>
                  </span>
                  <span className={cn('shell-badge', badge.cls)}>{badge.label}</span>
                  <ChevronRight
                    size={18}
                    className="flex-shrink-0 text-muted-foreground/50"
                    aria-hidden="true"
                  />
                </button>
              );
            })}
          </div>
        ))
      )}
    </ShellScreen>
  );
}
