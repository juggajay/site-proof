import React from 'react';
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
  return (
    <>
      {/* Header filter/export row */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search lot or description..."
          aria-label="Search hold points by lot or description"
          className="w-56 rounded-lg border border-border px-3 py-2 text-sm bg-card"
        />
        <select
          value={selectedLotId}
          onChange={(e) => onLotFilterChange(e.target.value)}
          aria-label="Filter hold points by lot"
          className="rounded-lg border border-border px-3 py-2 text-sm bg-card"
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
          className="rounded-lg border border-border px-3 py-2 text-sm bg-card"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="notified">Awaiting Release</option>
          <option value="notice-expired">Awaiting Release — Notice Expired</option>
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
      </div>
    </>
  );
});

interface SummaryCardsProps {
  stats: HoldPointStats;
}

export const HoldPointSummaryCards = React.memo(function HoldPointSummaryCards({
  stats,
}: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="rounded-lg border bg-card p-4">
        <div className="text-sm text-muted-foreground">Total HPs</div>
        <div className="text-2xl font-bold mt-1">{stats.total}</div>
      </div>
      <div className="rounded-lg border bg-card p-4">
        <div className="text-sm text-muted-foreground">Pending</div>
        <div className="text-2xl font-bold mt-1 text-muted-foreground">{stats.pending}</div>
      </div>
      <div className="rounded-lg border bg-card p-4">
        <div className="text-sm text-muted-foreground">Awaiting Release</div>
        <div className="text-2xl font-bold mt-1 text-warning">
          {stats.notified}
          {stats.overdue > 0 && (
            <span className="ml-2 text-sm font-normal text-destructive">
              ({stats.overdue} overdue)
            </span>
          )}
        </div>
      </div>
      <div className="rounded-lg border bg-card p-4">
        <div className="text-sm text-muted-foreground">Released This Week</div>
        <div className="text-2xl font-bold mt-1 text-foreground">{stats.releasedThisWeek}</div>
      </div>
    </div>
  );
});
