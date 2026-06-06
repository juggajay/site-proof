import { Button } from '@/components/ui/button';
import type { StatusFilter } from './types';
import { HoldPointStatusFilter } from './components/HoldPointStatusFilter';

interface HoldPointsPageHeaderProps {
  holdPointCount: number;
  isMobile: boolean;
  statusFilter: StatusFilter;
  onStatusFilterChange: (filter: StatusFilter) => void;
  onExportCSV: () => void;
}

export function HoldPointsPageHeader({
  holdPointCount,
  isMobile,
  statusFilter,
  onStatusFilterChange,
  onExportCSV,
}: HoldPointsPageHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold">Hold Points</h1>
        <p className="text-muted-foreground mt-1">
          Track and release hold points requiring third-party inspection
        </p>
      </div>
      {holdPointCount > 0 && (
        <HoldPointStatusFilter
          statusFilter={statusFilter}
          onStatusFilterChange={onStatusFilterChange}
          onExportCSV={onExportCSV}
          showExport={!isMobile}
        />
      )}
    </div>
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
