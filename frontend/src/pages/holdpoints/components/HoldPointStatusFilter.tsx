import React from 'react'
import type { StatusFilter, HoldPointStats } from '../types'

interface HoldPointStatusFilterProps {
  statusFilter: StatusFilter
  onStatusFilterChange: (filter: StatusFilter) => void
  onExportCSV: () => void
}

export const HoldPointStatusFilter = React.memo(function HoldPointStatusFilter({
  statusFilter,
  onStatusFilterChange,
  onExportCSV,
}: HoldPointStatusFilterProps) {
  return (
    <>
      {/* Header filter/export row */}
      <div className="flex items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value as StatusFilter)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="notified">Awaiting Release</option>
          <option value="released">Released</option>
        </select>
        <button
          onClick={onExportCSV}
          className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
        >
          Export CSV
        </button>
      </div>
    </>
  )
})

interface SummaryCardsProps {
  stats: HoldPointStats
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
        <div className="text-2xl font-bold mt-1 text-gray-600">{stats.pending}</div>
      </div>
      <div className="rounded-lg border bg-card p-4">
        <div className="text-sm text-muted-foreground">Awaiting Release</div>
        <div className="text-2xl font-bold mt-1 text-amber-600">
          {stats.notified}
          {stats.overdue > 0 && (
            <span className="ml-2 text-sm font-normal text-red-600">
              ({stats.overdue} overdue)
            </span>
          )}
        </div>
      </div>
      <div className="rounded-lg border bg-card p-4">
        <div className="text-sm text-muted-foreground">Released This Week</div>
        <div className="text-2xl font-bold mt-1 text-green-600">{stats.releasedThisWeek}</div>
      </div>
    </div>
  )
})
