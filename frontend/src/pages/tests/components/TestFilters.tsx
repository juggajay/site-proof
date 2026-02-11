import React, { useState, useCallback } from 'react'
import type { Lot } from '../types'

interface TestFiltersProps {
  searchQuery: string
  onSearchQueryChange: (value: string) => void
  filterTestType: string
  onFilterTestTypeChange: (value: string) => void
  filterStatus: string
  onFilterStatusChange: (value: string) => void
  filterPassFail: string
  onFilterPassFailChange: (value: string) => void
  filterLot: string
  onFilterLotChange: (value: string) => void
  filterDateFrom: string
  onFilterDateFromChange: (value: string) => void
  filterDateTo: string
  onFilterDateToChange: (value: string) => void
  uniqueTestTypes: string[]
  lots: Lot[]
  filteredCount: number
  totalCount: number
  hasActiveFilters: boolean
  onClearFilters: () => void
}

export const TestFilters = React.memo(function TestFilters({
  searchQuery,
  onSearchQueryChange,
  filterTestType,
  onFilterTestTypeChange,
  filterStatus,
  onFilterStatusChange,
  filterPassFail,
  onFilterPassFailChange,
  filterLot,
  onFilterLotChange,
  filterDateFrom,
  onFilterDateFromChange,
  filterDateTo,
  onFilterDateToChange,
  uniqueTestTypes,
  lots,
  filteredCount,
  totalCount,
  hasActiveFilters,
  onClearFilters,
}: TestFiltersProps) {
  const [showFilters, setShowFilters] = useState(false)

  const toggleFilters = useCallback(() => {
    setShowFilters(prev => !prev)
  }, [])

  return (
    <div className="mb-4">
      <div className="flex gap-3 items-center">
        {/* Feature #206: Search Input */}
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="Search by report #, lot #, lab name..."
            className="w-full rounded-lg border px-3 py-2 pl-9 text-sm"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{'\uD83D\uDD0D'}</span>
          {searchQuery && (
            <button
              onClick={() => onSearchQueryChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {'\u2715'}
            </button>
          )}
        </div>

        {/* Filters Toggle */}
        <button
          onClick={toggleFilters}
          className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border hover:bg-muted"
        >
          {'\u2699\uFE0F'} Filters {hasActiveFilters && <span className="bg-primary text-primary-foreground px-1.5 py-0.5 rounded text-xs">{filteredCount}/{totalCount}</span>}
        </button>
      </div>

      {showFilters && (
        <div className="mt-3 p-4 rounded-lg border bg-muted/30 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Test Type Filter */}
            <div>
              <label className="block text-xs font-medium mb-1">Test Type</label>
              <select
                value={filterTestType}
                onChange={(e) => onFilterTestTypeChange(e.target.value)}
                className="w-full rounded border px-2 py-1.5 text-sm"
              >
                <option value="">All Types</option>
                {uniqueTestTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-xs font-medium mb-1">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => onFilterStatusChange(e.target.value)}
                className="w-full rounded border px-2 py-1.5 text-sm"
              >
                <option value="">All Statuses</option>
                <option value="requested">Requested</option>
                <option value="at_lab">At Lab</option>
                <option value="results_received">Results Received</option>
                <option value="entered">Entered</option>
                <option value="verified">Verified</option>
              </select>
            </div>

            {/* Pass/Fail Filter */}
            <div>
              <label className="block text-xs font-medium mb-1">Pass/Fail</label>
              <select
                value={filterPassFail}
                onChange={(e) => onFilterPassFailChange(e.target.value)}
                className="w-full rounded border px-2 py-1.5 text-sm"
              >
                <option value="">All</option>
                <option value="pass">Pass</option>
                <option value="fail">Fail</option>
                <option value="pending">Pending</option>
              </select>
            </div>

            {/* Lot Filter */}
            <div>
              <label className="block text-xs font-medium mb-1">Linked Lot</label>
              <select
                value={filterLot}
                onChange={(e) => onFilterLotChange(e.target.value)}
                className="w-full rounded border px-2 py-1.5 text-sm"
              >
                <option value="">All Lots</option>
                {lots.map(lot => (
                  <option key={lot.id} value={lot.id}>{lot.lotNumber}</option>
                ))}
              </select>
            </div>

            {/* Date From */}
            <div>
              <label className="block text-xs font-medium mb-1">From Date</label>
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => onFilterDateFromChange(e.target.value)}
                className="w-full rounded border px-2 py-1.5 text-sm"
              />
            </div>

            {/* Date To */}
            <div>
              <label className="block text-xs font-medium mb-1">To Date</label>
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => onFilterDateToChange(e.target.value)}
                className="w-full rounded border px-2 py-1.5 text-sm"
              />
            </div>
          </div>

          {hasActiveFilters && (
            <div className="flex justify-between items-center pt-2 border-t">
              <span className="text-sm text-muted-foreground">
                Showing {filteredCount} of {totalCount} results
              </span>
              <button
                onClick={onClearFilters}
                className="text-sm text-red-600 hover:text-red-700"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
})
