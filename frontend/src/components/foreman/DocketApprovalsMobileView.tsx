import { useRef, useCallback, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { AlertCircle, Check, CheckSquare, MessageSquare, X } from 'lucide-react';
import { SwipeableCard } from './SwipeableCard';
import { DocketCardSkeleton } from '@/components/ui/Skeleton';
import { usePullToRefresh, PullToRefreshIndicator } from '@/hooks/usePullToRefresh';

interface Docket {
  id: string;
  docketNumber: string;
  subcontractor: string;
  subcontractorId: string;
  date: string;
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'queried';
  notes: string | null;
  labourHours: number;
  plantHours: number;
  totalLabourSubmitted: number;
  totalLabourApproved: number;
  totalPlantSubmitted: number;
  totalPlantApproved: number;
  submittedAt: string | null;
  approvedAt: string | null;
  foremanNotes: string | null;
}

interface DocketApprovalsMobileViewProps {
  dockets: Docket[];
  filteredDockets: Docket[];
  loading: boolean;
  statusFilter: string;
  setStatusFilter: (filter: string) => void;
  pendingCount: number;
  totalLabourHours: number;
  totalPlantHours: number;
  loadError?: string | null;
  canApprove: boolean;
  subcontractorSetupHref: string;
  onApprove: (docket: Docket) => void;
  onQuery: (docket: Docket) => void;
  onReject: (docket: Docket) => void;
  onTapDocket: (docket: Docket) => void;
  onRefresh: () => Promise<void>;
}

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  pending_approval: 'bg-warning/10 text-warning',
  approved: 'bg-muted text-muted-foreground',
  rejected: 'bg-destructive/10 text-destructive',
  queried: 'bg-warning/10 text-warning',
};

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  pending_approval: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  queried: 'Queried',
};

const filters = [
  { key: 'all', label: 'All' },
  { key: 'pending_approval', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

function formatDateAU(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function DocketCard({
  docket,
  onTap,
  actions,
}: {
  docket: Docket;
  onTap: () => void;
  actions?: ReactNode;
}) {
  const touchStartRef = useRef({ x: 0, y: 0 });

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  }, []);

  const handleClick = useCallback(() => {
    onTap();
  }, [onTap]);

  return (
    <div
      className={cn(
        'bg-card border rounded-xl p-4 space-y-3',
        'touch-manipulation active:scale-[0.98] transition-transform duration-100',
      )}
      onTouchStart={handleTouchStart}
      onClick={handleClick}
    >
      {/* Header: title + status badge */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-base truncate">{docket.subcontractor}</h3>
          <p className="text-sm text-muted-foreground">{docket.docketNumber}</p>
        </div>
        <span
          className={cn(
            'text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap',
            statusColors[docket.status] || 'bg-muted text-muted-foreground',
          )}
        >
          {statusLabels[docket.status] || docket.status}
        </span>
      </div>

      {/* Primary fields grid */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Date</p>
          <p className="font-medium text-sm">{formatDateAU(docket.date)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Labour</p>
          <p className="font-medium text-sm">{docket.labourHours}h</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Plant</p>
          <p className="font-medium text-sm">{docket.plantHours}h</p>
        </div>
      </div>

      {actions && (
        <div className="flex gap-2 border-t pt-3" onClick={(event) => event.stopPropagation()}>
          {actions}
        </div>
      )}
    </div>
  );
}

export function DocketApprovalsMobileView({
  dockets,
  filteredDockets,
  loading,
  statusFilter,
  setStatusFilter,
  pendingCount,
  totalLabourHours,
  totalPlantHours,
  loadError,
  canApprove,
  subcontractorSetupHref,
  onApprove,
  onQuery,
  onReject,
  onTapDocket,
  onRefresh,
}: DocketApprovalsMobileViewProps) {
  const { containerRef, pullDistance, isRefreshing, progress } = usePullToRefresh({ onRefresh });
  const hasSubmittedDockets = dockets.some((docket) => docket.status !== 'draft');

  return (
    <div className="flex flex-col h-full">
      {/* A. Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h1 className="text-xl font-bold">Approve</h1>
        {pendingCount > 0 && (
          <span className="inline-flex items-center justify-center h-6 min-w-[1.5rem] px-2 rounded-full bg-warning text-warning-foreground text-xs font-bold">
            {pendingCount}
          </span>
        )}
      </div>

      {/* B. Filter pills */}
      <div className="flex gap-2 overflow-x-auto px-4 pb-2 scrollbar-hide">
        {filters.map((f) => {
          const isActive = statusFilter === f.key;
          const count =
            f.key === 'pending_approval' && pendingCount > 0 ? ` (${pendingCount})` : '';
          return (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors',
                isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
              )}
            >
              {f.label}
              {count}
            </button>
          );
        })}
      </div>

      {/* C. Inline stats bar */}
      {!loading && filteredDockets.length > 0 && (
        <p className="text-xs text-muted-foreground px-4 py-2">
          {filteredDockets.length}{' '}
          {statusFilter === 'pending_approval'
            ? 'pending'
            : statusFilter === 'all'
              ? 'total'
              : statusFilter === 'approved'
                ? 'approved'
                : statusFilter === 'rejected'
                  ? 'rejected'
                  : ''}{' '}
          &middot; {totalLabourHours}h labour &middot; {totalPlantHours}h plant
        </p>
      )}

      {/* D. Pull-to-refresh container + E. Card list */}
      <div
        ref={containerRef as React.RefObject<HTMLDivElement>}
        className="flex-1 overflow-y-auto relative"
      >
        <PullToRefreshIndicator
          pullDistance={pullDistance}
          isRefreshing={isRefreshing}
          progress={progress}
        />

        <div
          className="px-4 pb-24 space-y-3"
          style={{
            transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : undefined,
            transition: pullDistance === 0 ? 'transform 0.2s ease-out' : 'none',
          }}
        >
          {/* G. Initial-load skeleton: layout-matched to DocketCard (header + 3-col grid).
              Shows only while loading with no cached data; pull-to-refresh keeps
              showing the data list (handled by the parent gate: `loading` from
              the caller is only true on initial load with no data). */}
          {loading && (
            <div data-testid="docket-approvals-skeleton">
              <DocketCardSkeleton />
              <DocketCardSkeleton />
              <DocketCardSkeleton />
            </div>
          )}

          {loadError && !loading && (
            <div
              className="rounded-xl border border-destructive/30 bg-destructive/10 p-4"
              role="alert"
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-destructive">{loadError}</p>
                  <button
                    type="button"
                    onClick={() => void onRefresh()}
                    className="mt-3 rounded-md border border-destructive/40 px-3 py-1.5 text-sm font-medium text-destructive"
                  >
                    Try again
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* F. Empty state */}
          {!loadError && !loading && filteredDockets.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CheckSquare className="h-12 w-12 text-muted-foreground/40 mb-3" />
              {!hasSubmittedDockets ? (
                <>
                  <p className="text-base font-medium text-foreground">
                    No subcontractor dockets yet
                  </p>
                  <p className="mt-1 max-w-xs text-sm text-muted-foreground/70">
                    Subcontractors submit dockets from their portal. Invite a subcontractor and
                    assign lots to start receiving dockets.
                  </p>
                  <Link
                    to={subcontractorSetupHref}
                    className="mt-4 rounded-md border px-3 py-2 text-sm font-medium text-foreground"
                  >
                    Invite a subcontractor
                  </Link>
                </>
              ) : (
                <>
                  <p className="text-base font-medium text-muted-foreground">
                    {statusFilter === 'pending_approval' ? 'All caught up' : 'No dockets found'}
                  </p>
                  <p className="text-sm text-muted-foreground/70 mt-1">
                    {statusFilter === 'pending_approval'
                      ? 'No dockets waiting for your review'
                      : 'Try changing the filter above'}
                  </p>
                </>
              )}
            </div>
          )}

          {/* E. Docket cards */}
          {!loadError &&
            !loading &&
            filteredDockets.map((docket) =>
              docket.status === 'pending_approval' ? (
                <SwipeableCard
                  key={docket.id}
                  onSwipeRight={() => onApprove(docket)}
                  onSwipeLeft={() => onReject(docket)}
                  rightAction={{
                    label: 'Approve',
                    color: 'bg-success',
                    icon: <Check className="h-6 w-6" />,
                  }}
                  leftAction={{
                    label: 'Reject',
                    color: 'bg-destructive',
                    icon: <X className="h-6 w-6" />,
                  }}
                  disabled={!canApprove}
                >
                  <DocketCard
                    docket={docket}
                    onTap={() => onTapDocket(docket)}
                    actions={
                      canApprove ? (
                        <>
                          <button
                            type="button"
                            className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-success px-3 py-2 text-sm font-medium text-success-foreground"
                            onClick={() => onApprove(docket)}
                          >
                            <Check className="h-4 w-4" />
                            Approve
                          </button>
                          <button
                            type="button"
                            className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md border border-warning px-3 py-2 text-sm font-medium text-warning"
                            onClick={() => onQuery(docket)}
                          >
                            <MessageSquare className="h-4 w-4" />
                            Query
                          </button>
                          <button
                            type="button"
                            className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md border border-destructive px-3 py-2 text-sm font-medium text-destructive"
                            onClick={() => onReject(docket)}
                          >
                            <X className="h-4 w-4" />
                            Reject
                          </button>
                        </>
                      ) : undefined
                    }
                  />
                </SwipeableCard>
              ) : (
                <DocketCard key={docket.id} docket={docket} onTap={() => onTapDocket(docket)} />
              ),
            )}
        </div>
      </div>
    </div>
  );
}
