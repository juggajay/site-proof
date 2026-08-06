import { Button } from '@/components/ui/button';
import { ContextHelp, HELP_CONTENT } from '@/components/ContextHelp';
import { LazyHoldPointsChart } from '@/components/charts/LazyCharts';
import type { HoldPointLotOption, StatusFilter } from './types';
import type { HoldPointChartData } from './holdPointsPageData';
import { HoldPointStatusFilter } from './components/HoldPointStatusFilter';

interface HoldPointsPageHeaderProps {
  holdPointCount: number;
  isMobile: boolean;
  statusFilter: StatusFilter;
  selectedLotId: string;
  searchQuery: string;
  lotOptions: HoldPointLotOption[];
  onStatusFilterChange: (filter: StatusFilter) => void;
  onLotFilterChange: (lotId: string) => void;
  onSearchChange: (query: string) => void;
  onExportCSV: () => void;
}

export function HoldPointsPageHeader({
  holdPointCount,
  isMobile,
  statusFilter,
  selectedLotId,
  searchQuery,
  lotOptions,
  onStatusFilterChange,
  onLotFilterChange,
  onSearchChange,
  onExportCSV,
}: HoldPointsPageHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold">Hold Points</h1>
          <ContextHelp
            title={HELP_CONTENT['hold-points'].title}
            content={HELP_CONTENT['hold-points'].content}
          />
        </div>
        <p className="text-muted-foreground mt-1">
          Track and release hold points requiring third-party inspection
        </p>
      </div>
      {holdPointCount > 0 && (
        <HoldPointStatusFilter
          statusFilter={statusFilter}
          selectedLotId={selectedLotId}
          searchQuery={searchQuery}
          lotOptions={lotOptions}
          onStatusFilterChange={onStatusFilterChange}
          onLotFilterChange={onLotFilterChange}
          onSearchChange={onSearchChange}
          onExportCSV={onExportCSV}
          showExport={!isMobile}
        />
      )}
    </div>
  );
}

interface HoldPointsBatchSelectionBarProps {
  /** Pending hold points in the currently filtered lot — the batch candidates. */
  eligibleCount: number;
  selectedCount: number;
  /** Lot number the selection belongs to; null while no single lot is filtered. */
  selectedLotNumber: string | null;
  onSelectAll: () => void;
  onClear: () => void;
  onRequestSelected: () => void;
}

/**
 * Batch release controls, contextual. This used to be a permanent band between
 * the filters and the first row whose default state was three disabled buttons
 * and a filled-grey "Request selected (0)" — a live-looking action that could
 * never fire. Batch release needs one lot, so the bar has nothing to say until
 * a lot is filtered, and nothing to offer until rows are ticked.
 */
export function HoldPointsBatchSelectionBar({
  eligibleCount,
  selectedCount,
  selectedLotNumber,
  onSelectAll,
  onClear,
  onRequestSelected,
}: HoldPointsBatchSelectionBarProps) {
  if (selectedCount === 0 && eligibleCount === 0) return null;

  const lotSuffix = selectedLotNumber ? ` in ${selectedLotNumber}` : '';

  return (
    <div
      className="flex flex-col gap-2 rounded-lg border bg-card px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
      data-testid="hp-batch-bar"
    >
      <div className="text-sm">
        {selectedCount > 0 ? (
          <span className="font-medium">
            {selectedCount} hold point{selectedCount === 1 ? '' : 's'} selected{lotSuffix}
          </span>
        ) : (
          <span className="text-muted-foreground">
            {eligibleCount} pending hold point{eligibleCount === 1 ? '' : 's'}
            {lotSuffix} can be sent for superintendent review.
          </span>
        )}
      </div>
      {/* 44px touch targets below sm — these are the batch controls a foreman
          taps with gloves on. */}
      <div className="flex flex-wrap gap-2">
        {selectedCount < eligibleCount && (
          <Button
            type="button"
            variant="outline"
            className="h-11 flex-1 sm:h-9 sm:flex-none"
            onClick={onSelectAll}
          >
            Select all pending
          </Button>
        )}
        {selectedCount > 0 && (
          <>
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1 sm:h-9 sm:flex-none"
              onClick={onClear}
            >
              Clear
            </Button>
            <Button
              type="button"
              className="h-11 w-full sm:h-9 sm:w-auto"
              onClick={onRequestSelected}
            >
              Request selected ({selectedCount})
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

interface HoldPointsTrendsProps {
  chartData: HoldPointChartData;
  releasedCount: number;
}

/**
 * Release trends, below the register rather than in front of it. With no
 * releases in the window the bar chart was a bare labelled grid, so the empty
 * case is one line of text instead of 260px of chart chrome.
 */
export function HoldPointsTrends({ chartData, releasedCount }: HoldPointsTrendsProps) {
  const releasesInWindow = chartData.releasesOverTime.reduce(
    (total, day) => total + day.releases,
    0,
  );

  if (releasesInWindow === 0) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="hp-trends-empty">
        No hold point releases in the last 7 days.
      </p>
    );
  }

  return (
    <LazyHoldPointsChart
      releasesOverTime={chartData.releasesOverTime}
      avgTimeToRelease={chartData.avgTimeToRelease}
      releasedCount={releasedCount}
    />
  );
}

interface HoldPointsLoadErrorAlertProps {
  loadError: string | null;
  onRetry: () => void;
}

export function HoldPointsLoadErrorAlert({ loadError, onRetry }: HoldPointsLoadErrorAlertProps) {
  if (!loadError) return null;

  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4" role="alert">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium text-destructive">{loadError}</p>
        <Button type="button" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </div>
  );
}
