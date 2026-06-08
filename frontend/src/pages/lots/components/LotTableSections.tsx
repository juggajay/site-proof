import type { RefObject } from 'react';
import { AlertTriangle, Calendar, FileText, TestTube } from 'lucide-react';
import type { Lot } from '../lotsPageTypes';

interface LotTableEmptyStateProps {
  allLotsCount: number;
  colSpanCount: number;
  canCreate: boolean;
  isSubcontractor: boolean;
  onOpenCreateModal: () => void;
}

export function LotTableEmptyState({
  allLotsCount,
  colSpanCount,
  canCreate,
  isSubcontractor,
  onOpenCreateModal,
}: LotTableEmptyStateProps) {
  return (
    <tr>
      <td colSpan={colSpanCount} className="p-12 text-center">
        {allLotsCount === 0 ? (
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
            {!isSubcontractor && canCreate && (
              <button
                onClick={onOpenCreateModal}
                className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
              >
                Create your first lot
              </button>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground">No lots match the current filters.</span>
        )}
      </td>
    </tr>
  );
}

interface LotExpandedDetailsRowProps {
  lot: Lot;
  colSpanCount: number;
}

export function LotExpandedDetailsRow({ lot, colSpanCount }: LotExpandedDetailsRowProps) {
  return (
    <tr
      className="bg-muted/30 border-b animate-in fade-in slide-in-from-top-2 duration-200"
      data-testid={`expanded-row-${lot.id}`}
    >
      <td colSpan={colSpanCount} className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="space-y-2">
            <h4 className="font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Dates
            </h4>
            <div className="space-y-1 text-muted-foreground">
              <p>
                Created:{' '}
                {lot.createdAt ? new Date(lot.createdAt).toLocaleDateString('en-AU') : '\u2014'}
              </p>
              <p>
                Updated:{' '}
                {lot.updatedAt ? new Date(lot.updatedAt).toLocaleDateString('en-AU') : '\u2014'}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Linked Items
            </h4>
            <div className="space-y-1 text-muted-foreground">
              <p>ITPs: {lot.itpCount ?? 0}</p>
              <p>Test Results: {lot.testCount ?? 0}</p>
              <p>Documents: {lot.documentCount ?? 0}</p>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold flex items-center gap-2">
              <TestTube className="h-4 w-4" />
              Quality
            </h4>
            <div className="space-y-1 text-muted-foreground">
              <p className="flex items-center gap-1">
                {(lot.ncrCount ?? 0) > 0 && <AlertTriangle className="h-3 w-3 text-warning" />}
                NCRs: {lot.ncrCount ?? 0}
              </p>
              <p>Hold Points: {lot.holdPointCount ?? 0}</p>
              {lot.areaZone && <p>Area/Zone: {lot.areaZone}</p>}
            </div>
          </div>
        </div>
        {lot.notes && (
          <div className="mt-3 pt-3 border-t">
            <h4 className="font-semibold text-sm mb-1">Notes</h4>
            <p className="text-sm text-muted-foreground">{lot.notes}</p>
          </div>
        )}
      </td>
    </tr>
  );
}

interface LotTableLoadMoreIndicatorProps {
  displayedCount: number;
  filteredCount: number;
  hasMore: boolean;
  loadingMore: boolean;
  loadMoreRef: RefObject<HTMLDivElement>;
}

export function LotTableLoadMoreIndicator({
  displayedCount,
  filteredCount,
  hasMore,
  loadingMore,
  loadMoreRef,
}: LotTableLoadMoreIndicatorProps) {
  return (
    <div ref={loadMoreRef} className="border-t p-4">
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
          Showing {displayedCount} of {filteredCount} lots - Scroll down to load more
        </div>
      )}
      {!hasMore && filteredCount > 0 && (
        <div className="text-center text-sm text-muted-foreground">
          Showing all {filteredCount} lots
        </div>
      )}
    </div>
  );
}
