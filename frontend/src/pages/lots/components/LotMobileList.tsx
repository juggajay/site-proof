import React, { useRef } from 'react';
import { formatActivityLabel } from '@/lib/activityTaxonomy';
import { useNavigate } from 'react-router-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import { AlertTriangle, MapPin, Eye } from 'lucide-react';
import { usePullToRefresh, PullToRefreshIndicator } from '@/hooks/usePullToRefresh';
import { SwipeableCard } from '@/components/foreman/SwipeableCard';
import { LotMobileCardSkeleton } from '@/components/ui/Skeleton';
import { formatStatusLabel } from '@/lib/statusLabels';
import { getLotStatusBadgeClass } from '@/lib/lotStatusOverview';
import type { Lot } from '../lotsPageTypes';

// Status border colors for mobile cards. Benign states use a neutral border;
// colour is reserved for the hold-point / NCR exception states (INV-3).
const statusBorderColors: Record<string, string> = {
  not_started: 'border-l-border',
  in_progress: 'border-l-border',
  awaiting_test: 'border-l-border',
  hold_point: 'border-l-warning',
  ncr_raised: 'border-l-destructive',
  completed: 'border-l-border',
  conformed: 'border-l-border',
  claimed: 'border-l-border',
};

// Format chainage for display
function formatChainage(lot: Lot) {
  if (lot.chainageStart != null && lot.chainageEnd != null) {
    return lot.chainageStart === lot.chainageEnd
      ? `${lot.chainageStart}`
      : `${lot.chainageStart}-${lot.chainageEnd}`;
  }
  return lot.chainageStart ?? lot.chainageEnd ?? '\u2014';
}

interface LotMobileListProps {
  displayedLots: Lot[];
  filteredLots: Lot[];
  allLots: Lot[];
  isMobile: boolean;
  isSubcontractor: boolean;
  canCreate: boolean;
  projectId: string;
  onContextMenu: (e: React.MouseEvent, lot: Lot) => void;
  onRefresh: () => Promise<void>;
  // Initial-load state — true only while the first fetch is in-flight with no
  // cached data. Background refetches must NOT set this true (use TanStack Query
  // `isLoading` / `isPending` with no `data`, not `isFetching`).
  isLoading?: boolean;
  // Infinite scroll
  loadMoreRef: React.RefObject<HTMLDivElement | null>;
  loadingMore: boolean;
  hasMore: boolean;
}

export const LotMobileList = React.memo(function LotMobileList({
  displayedLots,
  filteredLots,
  allLots,
  isMobile,
  isSubcontractor,
  canCreate: _canCreate,
  projectId,
  onContextMenu,
  onRefresh,
  isLoading = false,
  loadMoreRef,
  loadingMore,
  hasMore,
}: LotMobileListProps) {
  const navigate = useNavigate();

  // Pull-to-refresh for mobile card view
  const {
    containerRef: pullToRefreshRef,
    pullDistance,
    isRefreshing,
    progress: pullProgress,
  } = usePullToRefresh({
    onRefresh,
    enabled: isMobile,
  });

  // Scroll container ref for virtualizer (uses pull-to-refresh ref on mobile)
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: displayedLots.length,
    getScrollElement: () =>
      isMobile ? (pullToRefreshRef.current as HTMLDivElement | null) : scrollContainerRef.current,
    estimateSize: () => 180, // estimated card height in px
    overscan: 5,
  });

  // Initial-load skeleton — shown while the first fetch is in-flight with no
  // cached data. 4 cards mirror a typical lot list. Layout-matched to the real
  // lot card so content landing causes no layout shift.
  if (isLoading && displayedLots.length === 0) {
    return (
      <div
        className="space-y-3 p-2"
        data-testid="lot-mobile-skeleton"
        aria-label="Loading lots"
        role="status"
      >
        <LotMobileCardSkeleton />
        <LotMobileCardSkeleton />
        <LotMobileCardSkeleton />
        <LotMobileCardSkeleton />
      </div>
    );
  }

  return (
    <div
      ref={isMobile ? pullToRefreshRef : scrollContainerRef}
      className="overflow-auto max-h-[calc(100vh-280px)] relative"
      data-testid="card-view-container"
    >
      {/* Pull-to-refresh indicator for mobile */}
      {isMobile && (
        <PullToRefreshIndicator
          pullDistance={pullDistance}
          isRefreshing={isRefreshing}
          progress={pullProgress}
        />
      )}
      {displayedLots.length === 0 ? (
        <div className="rounded-lg border p-12 text-center">
          {allLots.length === 0 ? (
            <div className="flex flex-col items-center gap-4">
              <div className="text-5xl">📋</div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  {isSubcontractor ? 'No lots assigned yet' : 'No lots yet'}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {isSubcontractor
                    ? 'No lots have been assigned to your company for this project.'
                    : 'Get started by creating your first lot for this project.'}
                </p>
              </div>
            </div>
          ) : (
            <span className="text-muted-foreground">No lots match the current filters.</span>
          )}
        </div>
      ) : (
        <div
          style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}
          data-testid="card-grid"
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const lot = displayedLots[virtualRow.index];
            if (!lot) return null;

            const cardContent = (
              <div
                className={`rounded-lg border bg-card p-4 hover:shadow-md transition-shadow cursor-pointer ${
                  isMobile
                    ? `border-l-4 ${statusBorderColors[lot.status] || 'border-l-border'}`
                    : ''
                }`}
                onClick={() => navigate(`/projects/${projectId}/lots/${lot.id}`)}
                onContextMenu={(e) => onContextMenu(e, lot)}
                data-testid={`lot-card-${lot.id}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-lg">{lot.lotNumber}</h3>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${getLotStatusBadgeClass(lot.status)}`}
                  >
                    {formatStatusLabel(lot.status)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                  {lot.description || 'No description'}
                </p>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {lot.activityType && (
                    <span className="flex items-center gap-1 bg-muted px-2 py-0.5 rounded">
                      {formatActivityLabel(lot.activityType)}
                    </span>
                  )}
                  {(lot.chainageStart != null || lot.chainageEnd != null) && (
                    <span className="flex items-center gap-1 bg-muted px-2 py-0.5 rounded">
                      <MapPin className="h-3 w-3" />
                      {formatChainage(lot)}
                    </span>
                  )}
                  {lot.areaZone && (
                    <span className="bg-muted px-2 py-0.5 rounded">{lot.areaZone}</span>
                  )}
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t text-xs text-muted-foreground">
                  <div className="flex gap-3">
                    <span>{lot.itpCount ?? 0} ITPs</span>
                    <span>{lot.testCount ?? 0} Tests</span>
                    {(lot.ncrCount ?? 0) > 0 && (
                      <span className="text-warning flex items-center gap-0.5">
                        <AlertTriangle className="h-3 w-3" />
                        {lot.ncrCount} NCRs
                      </span>
                    )}
                  </div>
                  <span>
                    {lot.createdAt ? new Date(lot.createdAt).toLocaleDateString('en-AU') : ''}
                  </span>
                </div>
              </div>
            );

            // On mobile, wrap in SwipeableCard for swipe gestures
            const cardElement = isMobile ? (
              <SwipeableCard
                onSwipeRight={() => navigate(`/projects/${projectId}/lots/${lot.id}`)}
                rightAction={{
                  label: 'View',
                  color: 'bg-primary',
                  icon: <Eye className="h-6 w-6" />,
                }}
              >
                {cardContent}
              </SwipeableCard>
            ) : (
              cardContent
            );

            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                  paddingBottom: '16px',
                }}
              >
                {cardElement}
              </div>
            );
          })}
        </div>
      )}
      {/* Infinite Scroll for Card View */}
      <div ref={loadMoreRef as React.RefObject<HTMLDivElement>} className="p-4">
        {loadingMore && (
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <span className="text-sm">Loading more lots...</span>
          </div>
        )}
        {!loadingMore && hasMore && (
          <div className="text-center text-sm text-muted-foreground">
            Showing {displayedLots.length} of {filteredLots.length} lots - Scroll down to load more
          </div>
        )}
        {!hasMore && filteredLots.length > 0 && (
          <div className="text-center text-sm text-muted-foreground">
            Showing all {filteredLots.length} lots
          </div>
        )}
      </div>
    </div>
  );
});
