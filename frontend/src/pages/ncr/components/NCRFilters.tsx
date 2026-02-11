import { useState, useCallback, useMemo, memo } from 'react'
import { Search } from 'lucide-react'
import { FilterBottomSheet, FilterTriggerButton, type FilterConfig, type FilterValues } from '@/components/mobile/FilterBottomSheet'
import type { NCR } from '../types'

interface NCRFiltersProps {
  ncrs: NCR[]
  isMobile: boolean
  onFilteredNcrsChange: (filtered: NCR[]) => void
}

function NCRFiltersInner({ ncrs, isMobile, onFilteredNcrsChange }: NCRFiltersProps) {
  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [responsibleFilter, setResponsibleFilter] = useState<string>('')
  const [dateFromFilter, setDateFromFilter] = useState<string>('')
  const [dateToFilter, setDateToFilter] = useState<string>('')
  const [mobileSearchQuery, setMobileSearchQuery] = useState('')
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)

  // Get unique values for filter dropdowns
  const uniqueStatuses = useMemo(() => [...new Set(ncrs.map(ncr => ncr.status))], [ncrs])
  const uniqueCategories = useMemo(() => [...new Set(ncrs.map(ncr => ncr.category))], [ncrs])
  const uniqueResponsible = useMemo(() => [...new Set(ncrs.map(ncr =>
    ncr.responsibleUser?.fullName || ncr.responsibleUser?.email || 'Unassigned'
  ))], [ncrs])

  // Apply filters to NCRs
  const filteredNcrs = useMemo(() => {
    const result = ncrs.filter(ncr => {
      // Mobile search query filter
      if (mobileSearchQuery) {
        const query = mobileSearchQuery.toLowerCase()
        const matchesSearch =
          ncr.ncrNumber.toLowerCase().includes(query) ||
          ncr.description.toLowerCase().includes(query) ||
          ncr.category.toLowerCase().includes(query) ||
          (ncr.responsibleUser?.fullName?.toLowerCase().includes(query)) ||
          (ncr.responsibleUser?.email?.toLowerCase().includes(query))
        if (!matchesSearch) return false
      }

      if (statusFilter && ncr.status !== statusFilter) return false
      if (categoryFilter && ncr.category !== categoryFilter) return false

      if (responsibleFilter) {
        const responsibleName = ncr.responsibleUser?.fullName || ncr.responsibleUser?.email || 'Unassigned'
        if (responsibleName !== responsibleFilter) return false
      }

      if (dateFromFilter) {
        const ncrDate = new Date(ncr.createdAt)
        const fromDate = new Date(dateFromFilter)
        if (ncrDate < fromDate) return false
      }

      if (dateToFilter) {
        const ncrDate = new Date(ncr.createdAt)
        const toDate = new Date(dateToFilter)
        toDate.setHours(23, 59, 59, 999)
        if (ncrDate > toDate) return false
      }

      return true
    })

    onFilteredNcrsChange(result)
    return result
  }, [ncrs, mobileSearchQuery, statusFilter, categoryFilter, responsibleFilter, dateFromFilter, dateToFilter, onFilteredNcrsChange])

  // Mobile filter configuration
  const mobileFilters: FilterConfig[] = useMemo(() => [
    {
      type: 'select',
      id: 'status',
      label: 'Status',
      options: uniqueStatuses.map(status => ({
        value: status,
        label: status.replace(/_/g, ' '),
      })),
      value: statusFilter || null,
    },
    {
      type: 'select',
      id: 'category',
      label: 'Category',
      options: uniqueCategories.map(category => ({
        value: category,
        label: category.replace(/_/g, ' '),
      })),
      value: categoryFilter || null,
    },
    {
      type: 'select',
      id: 'responsible',
      label: 'Responsible',
      options: uniqueResponsible.map(responsible => ({
        value: responsible,
        label: responsible,
      })),
      value: responsibleFilter || null,
    },
    {
      type: 'date',
      id: 'dateRange',
      label: 'Date Range',
      value: { start: dateFromFilter || null, end: dateToFilter || null },
    },
  ], [uniqueStatuses, uniqueCategories, uniqueResponsible, statusFilter, categoryFilter, responsibleFilter, dateFromFilter, dateToFilter])

  // Mobile filter values for bottom sheet
  const mobileFilterValues: FilterValues = useMemo(() => ({
    status: statusFilter || null,
    category: categoryFilter || null,
    responsible: responsibleFilter || null,
    dateRange: { start: dateFromFilter || null, end: dateToFilter || null },
  }), [statusFilter, categoryFilter, responsibleFilter, dateFromFilter, dateToFilter])

  // Count active mobile filters
  const activeMobileFilterCount =
    (statusFilter ? 1 : 0) +
    (categoryFilter ? 1 : 0) +
    (responsibleFilter ? 1 : 0) +
    (dateFromFilter || dateToFilter ? 1 : 0)

  const hasActiveFilters = statusFilter || categoryFilter || responsibleFilter || dateFromFilter || dateToFilter

  // Handle mobile filter apply
  const handleMobileFilterApply = useCallback((values: FilterValues) => {
    setStatusFilter((values.status as string) || '')
    setCategoryFilter((values.category as string) || '')
    setResponsibleFilter((values.responsible as string) || '')
    const dateRange = values.dateRange as { start: string | null; end: string | null }
    setDateFromFilter(dateRange?.start || '')
    setDateToFilter(dateRange?.end || '')
    setFilterSheetOpen(false)
  }, [])

  // Handle mobile filter clear
  const handleMobileFilterClear = useCallback(() => {
    setStatusFilter('')
    setCategoryFilter('')
    setResponsibleFilter('')
    setDateFromFilter('')
    setDateToFilter('')
  }, [])

  // Handle mobile filter onChange
  const handleMobileFilterChange = useCallback((values: FilterValues) => {
    setStatusFilter((values.status as string) || '')
    setCategoryFilter((values.category as string) || '')
    setResponsibleFilter((values.responsible as string) || '')
    const dateRange = values.dateRange as { start: string | null; end: string | null }
    setDateFromFilter(dateRange?.start || '')
    setDateToFilter(dateRange?.end || '')
  }, [])

  const clearAllFilters = useCallback(() => {
    setStatusFilter('')
    setCategoryFilter('')
    setResponsibleFilter('')
    setDateFromFilter('')
    setDateToFilter('')
  }, [])

  return (
    <>
      {/* Filters - Mobile vs Desktop */}
      {isMobile ? (
        /* Mobile Filter Bar */
        <div className="bg-card rounded-lg border p-3">
          <div className="flex gap-3 items-center">
            {/* Mobile Search Input */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search NCRs..."
                value={mobileSearchQuery}
                onChange={(e) => setMobileSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border-2 border-slate-300 dark:border-slate-600 rounded-lg bg-background text-base focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
              />
            </div>
            {/* Filter Trigger Button */}
            <FilterTriggerButton
              onClick={() => setFilterSheetOpen(true)}
              activeCount={activeMobileFilterCount}
            />
          </div>
          {/* Filter Results Summary for Mobile */}
          {(hasActiveFilters || mobileSearchQuery) && (
            <div className="mt-2 text-sm text-muted-foreground">
              Showing {filteredNcrs.length} of {ncrs.length} NCRs
            </div>
          )}
        </div>
      ) : (
        /* Desktop Filters */
        <div className="bg-card rounded-lg border p-4">
          <div className="flex flex-wrap gap-4 items-end">
            {/* Status Filter */}
            <div className="flex flex-col min-w-[150px]">
              <label htmlFor="status-filter" className="text-sm font-medium text-muted-foreground mb-1">
                Status
              </label>
              <select
                id="status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border rounded-lg bg-background text-sm"
              >
                <option value="">All Statuses</option>
                {uniqueStatuses.map(status => (
                  <option key={status} value={status}>
                    {status.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>

            {/* Category Filter */}
            <div className="flex flex-col min-w-[150px]">
              <label htmlFor="category-filter" className="text-sm font-medium text-muted-foreground mb-1">
                Category
              </label>
              <select
                id="category-filter"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 border rounded-lg bg-background text-sm"
              >
                <option value="">All Categories</option>
                {uniqueCategories.map(category => (
                  <option key={category} value={category}>
                    {category.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>

            {/* Responsible Filter */}
            <div className="flex flex-col min-w-[150px]">
              <label htmlFor="responsible-filter" className="text-sm font-medium text-muted-foreground mb-1">
                Responsible
              </label>
              <select
                id="responsible-filter"
                value={responsibleFilter}
                onChange={(e) => setResponsibleFilter(e.target.value)}
                className="px-3 py-2 border rounded-lg bg-background text-sm"
              >
                <option value="">All Responsible</option>
                {uniqueResponsible.map(responsible => (
                  <option key={responsible} value={responsible}>
                    {responsible}
                  </option>
                ))}
              </select>
            </div>

            {/* Date From Filter */}
            <div className="flex flex-col min-w-[150px]">
              <label htmlFor="date-from-filter" className="text-sm font-medium text-muted-foreground mb-1">
                Date From
              </label>
              <input
                id="date-from-filter"
                type="date"
                value={dateFromFilter}
                onChange={(e) => setDateFromFilter(e.target.value)}
                className="px-3 py-2 border rounded-lg bg-background text-sm"
              />
            </div>

            {/* Date To Filter */}
            <div className="flex flex-col min-w-[150px]">
              <label htmlFor="date-to-filter" className="text-sm font-medium text-muted-foreground mb-1">
                Date To
              </label>
              <input
                id="date-to-filter"
                type="date"
                value={dateToFilter}
                onChange={(e) => setDateToFilter(e.target.value)}
                className="px-3 py-2 border rounded-lg bg-background text-sm"
              />
            </div>

            {/* Clear Filters Button */}
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground border rounded-lg hover:bg-muted/50"
              >
                Clear Filters
              </button>
            )}
          </div>

          {/* Filter Results Summary */}
          {hasActiveFilters && (
            <div className="mt-3 text-sm text-muted-foreground">
              Showing {filteredNcrs.length} of {ncrs.length} NCRs
            </div>
          )}
        </div>
      )}

      {/* Mobile Filter Bottom Sheet */}
      <FilterBottomSheet
        isOpen={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        title="Filter NCRs"
        filters={mobileFilters}
        values={mobileFilterValues}
        onChange={handleMobileFilterChange}
        onApply={handleMobileFilterApply}
        onClear={handleMobileFilterClear}
      />
    </>
  )
}

export const NCRFilters = memo(NCRFiltersInner)
