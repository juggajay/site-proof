import React from 'react';
import { SavedViewsMenu } from '@/components/registers/SavedViewsMenu';
import type { HoldPointLotOption, StatusFilter, HoldPointStats } from '../types';

interface HoldPointStatusFilterProps {
  statusFilter: StatusFilter;
  selectedLotId: string;
  searchQuery: string;
  lotOptions: HoldPointLotOption[];
  onStatusFilterChange: (filter: StatusFilter) => void;
  onLotFilterChange: (lotId: string) => void;
  onSearchChange: (query: string) => void;
  onExportCSV: () => void;
  // Mobile hides the CSV export to keep the primary actions uncluttered; desktop
  // keeps it (default true), so this is a no-op for existing callers.
  showExport?: boolean;
}

export const HoldPointStatusFilter = React.memo(function HoldPointStatusFilter({
  statusFilter,
  selectedLotId,
  searchQuery,
  lotOptions,
  onStatusFilterChange,
  onLotFilterChange,
  onSearchChange,
  onExportCSV,
  showExport = true,
}: HoldPointStatusFilterProps) {
  // Below md every control is full-width and 44px tall on its own row. Wrapped
  // side by side they split across three ragged rows with the status select
  // squeezed to ~110px, which hid the option text that names the filter.
  const controlClass =
    'h-11 w-full rounded-lg border border-border bg-card px-3 text-sm md:h-auto md:w-auto md:py-2';

  return (
    <>
      {/* Header filter/export row */}
      <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:flex-wrap md:items-center md:gap-3">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search lot or description..."
          aria-label="Search hold points by lot or description"
          className={`${controlClass} md:w-56`}
        />
        <select
          value={selectedLotId}
          onChange={(e) => onLotFilterChange(e.target.value)}
          aria-label="Filter hold points by lot"
          className={controlClass}
        >
          <option value="all">All lots</option>
          {lotOptions.map((lot) => (
            <option key={lot.lotId} value={lot.lotId}>
              {lot.lotNumber}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value as StatusFilter)}
          aria-label="Filter hold points by status"
          className={controlClass}
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="notified">Awaiting Release</option>
          <option value="notice-expired">Awaiting Release — Notice Expired</option>
          <option value="refused">Release Refused</option>
          <option value="conditions-open">Conditions Open</option>
          <option value="released">Released</option>
        </select>
        {showExport && (
          <button
            onClick={onExportCSV}
            className="rounded-lg border border-border px-4 py-2 text-foreground hover:bg-muted/50"
          >
            Export CSV
          </button>
        )}
        <SavedViewsMenu registerKey="hold-points" />
      </div>
    </>
  );
});

interface SummaryLineProps {
  stats: HoldPointStats;
  statusFilter: StatusFilter;
  onStatusFilterChange: (filter: StatusFilter) => void;
}

/**
 * The register's counts in one quiet line, above the first row instead of in
 * front of it. The four KPI cards this replaces cost ~90px and read as
 * "Total 1728 / Pending 1727" — a near-duplicate pair plus two zeros. Only the
 * counts that name work survive, each one a shortcut into its filter view;
 * a zero count is not a thing to do, so it does not render.
 */
export const HoldPointSummaryLine = React.memo(function HoldPointSummaryLine({
  stats,
  statusFilter,
  onStatusFilterChange,
}: SummaryLineProps) {
  const counts = [
    { filter: 'pending' as const, label: 'pending', value: stats.pending },
    { filter: 'notified' as const, label: 'awaiting release', value: stats.notified },
    { filter: 'refused' as const, label: 'release refused', value: stats.refused },
    {
      filter: 'conditions-open' as const,
      label: 'with conditions open',
      value: stats.conditionsOpen,
    },
  ].filter((count) => count.value > 0);

  if (counts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="hp-summary-line">
        {stats.total > 0
          ? `All ${stats.total} hold points released.`
          : 'No hold points awaiting action.'}
      </p>
    );
  }

  return (
    <p
      className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground"
      data-testid="hp-summary-line"
    >
      {counts.map((count, index) => (
        <span key={count.filter} className="flex items-center gap-x-2">
          {index > 0 && <span aria-hidden="true">&middot;</span>}
          <button
            type="button"
            onClick={() =>
              onStatusFilterChange(statusFilter === count.filter ? 'all' : count.filter)
            }
            aria-pressed={statusFilter === count.filter}
            className={`rounded underline-offset-2 hover:underline ${
              statusFilter === count.filter ? 'font-medium text-foreground' : ''
            }`}
          >
            <span className="font-medium text-foreground">{count.value}</span> {count.label}
          </button>
        </span>
      ))}
      {stats.overdue > 0 && (
        <span className="flex items-center gap-x-2">
          <span aria-hidden="true">&middot;</span>
          <span className="font-medium text-destructive">{stats.overdue} overdue</span>
        </span>
      )}
      {stats.releasedThisWeek > 0 && (
        <span className="flex items-center gap-x-2">
          <span aria-hidden="true">&middot;</span>
          <span>{stats.releasedThisWeek} released this week</span>
        </span>
      )}
    </p>
  );
});
