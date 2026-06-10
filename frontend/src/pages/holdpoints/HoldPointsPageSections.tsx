import { Button } from '@/components/ui/button';
import { ContextHelp, HELP_CONTENT } from '@/components/ContextHelp';
import type { StatusFilter } from './types';
import { HoldPointStatusFilter } from './components/HoldPointStatusFilter';

interface HoldPointsPageHeaderProps {
  holdPointCount: number;
  isMobile: boolean;
  statusFilter: StatusFilter;
  searchQuery: string;
  onStatusFilterChange: (filter: StatusFilter) => void;
  onSearchChange: (query: string) => void;
  onExportCSV: () => void;
}

export function HoldPointsPageHeader({
  holdPointCount,
  isMobile,
  statusFilter,
  searchQuery,
  onStatusFilterChange,
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
          searchQuery={searchQuery}
          onStatusFilterChange={onStatusFilterChange}
          onSearchChange={onSearchChange}
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
