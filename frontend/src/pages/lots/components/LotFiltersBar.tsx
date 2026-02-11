import React, { useState, useRef, useEffect, useMemo } from 'react'
import { Settings2, Check, ChevronUp, ChevronDown, Save, Bookmark, Trash2, LayoutGrid, LayoutList, MapPin } from 'lucide-react'
import { FilterBottomSheet, FilterTriggerButton, type FilterConfig, type FilterValues } from '@/components/mobile/FilterBottomSheet'

// Column configuration
export const COLUMN_CONFIG = [
  { id: 'lotNumber', label: 'Lot Number', required: true },
  { id: 'description', label: 'Description', required: false },
  { id: 'chainage', label: 'Chainage', required: false },
  { id: 'activityType', label: 'Activity Type', required: false },
  { id: 'status', label: 'Status', required: false },
  { id: 'subcontractor', label: 'Subcontractor', required: false },
  { id: 'budget', label: 'Budget', required: false },
] as const

export type ColumnId = typeof COLUMN_CONFIG[number]['id']

export const DEFAULT_COLUMN_ORDER: ColumnId[] = ['lotNumber', 'description', 'chainage', 'activityType', 'status', 'subcontractor', 'budget']

const COLUMN_STORAGE_KEY = 'siteproof_lot_columns'
const COLUMN_ORDER_STORAGE_KEY = 'siteproof_lot_column_order'
const SAVED_FILTERS_STORAGE_KEY = 'siteproof_lot_saved_filters'

// Status options for multi-select filter
export const STATUS_OPTIONS = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'awaiting_test', label: 'Awaiting Test' },
  { value: 'hold_point', label: 'Hold Point' },
  { value: 'ncr_raised', label: 'NCR Raised' },
  { value: 'completed', label: 'Completed' },
  { value: 'conformed', label: 'Conformed' },
  { value: 'claimed', label: 'Claimed' },
]

export interface SavedFilter {
  id: string
  name: string
  status: string
  activity: string
  search: string
  subcontractor?: string
  areaZone?: string
  createdAt: string
}

interface LotFiltersBarProps {
  isMobile: boolean
  isSubcontractor: boolean
  canViewBudgets: boolean
  // Filter values from URL
  statusFilters: string[]
  activityFilter: string
  searchQuery: string
  chainageMinFilter: string
  chainageMaxFilter: string
  subcontractorFilter: string
  areaZoneFilter: string
  sortField: string
  sortDirection: 'asc' | 'desc'
  // Data for filter dropdowns
  activityTypes: (string | null | undefined)[]
  areaZones: string[]
  subcontractors: { id: string; companyName: string }[]
  // Counts
  totalLots: number
  filteredLotsCount: number
  // View mode
  viewMode: 'list' | 'card' | 'linear'
  onToggleViewMode: (mode: 'list' | 'card' | 'linear') => void
  // Update filters
  onUpdateFilters: (params: Record<string, string>) => void
  // Column config
  visibleColumns: ColumnId[]
  onSetVisibleColumns: React.Dispatch<React.SetStateAction<ColumnId[]>>
  columnOrder: ColumnId[]
  onSetColumnOrder: React.Dispatch<React.SetStateAction<ColumnId[]>>
}

export const LotFiltersBar = React.memo(function LotFiltersBar({
  isMobile,
  isSubcontractor,
  canViewBudgets,
  statusFilters,
  activityFilter,
  searchQuery,
  chainageMinFilter,
  chainageMaxFilter,
  subcontractorFilter,
  areaZoneFilter,
  activityTypes,
  areaZones,
  subcontractors,
  totalLots,
  filteredLotsCount,
  viewMode,
  onToggleViewMode,
  onUpdateFilters,
  visibleColumns,
  onSetVisibleColumns,
  columnOrder,
  onSetColumnOrder,
}: LotFiltersBarProps) {
  const statusDropdownRef = useRef<HTMLDivElement>(null)
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false)
  const [columnSettingsOpen, setColumnSettingsOpen] = useState(false)

  // Saved filters state
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>(() => {
    try {
      const stored = localStorage.getItem(SAVED_FILTERS_STORAGE_KEY)
      if (stored) {
        return JSON.parse(stored) as SavedFilter[]
      }
    } catch (e) {
      console.error('Error loading saved filters:', e)
    }
    return []
  })
  const [showSaveFilterModal, setShowSaveFilterModal] = useState(false)
  const [newFilterName, setNewFilterName] = useState('')
  const [savedFiltersDropdownOpen, setSavedFiltersDropdownOpen] = useState(false)

  // Mobile filter bottom sheet state
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const [mobileFilterValues, setMobileFilterValues] = useState<FilterValues>({
    status: statusFilters,
    activity: activityFilter || null,
    subcontractor: subcontractorFilter || null,
    areaZone: areaZoneFilter || null,
  })

  // Calculate active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0
    if (statusFilters.length > 0) count++
    if (activityFilter) count++
    if (searchQuery) count++
    if (chainageMinFilter || chainageMaxFilter) count++
    if (subcontractorFilter) count++
    if (areaZoneFilter) count++
    return count
  }, [statusFilters, activityFilter, searchQuery, chainageMinFilter, chainageMaxFilter, subcontractorFilter, areaZoneFilter])

  // Close status dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setStatusDropdownOpen(false)
      }
    }

    if (statusDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [statusDropdownOpen])

  const handleStatusToggle = (status: string) => {
    let newFilters: string[]
    if (statusFilters.includes(status)) {
      newFilters = statusFilters.filter(s => s !== status)
    } else {
      newFilters = [...statusFilters, status]
    }
    onUpdateFilters({ status: newFilters.join(',') })
  }

  const clearStatusFilters = () => {
    onUpdateFilters({ status: '' })
  }

  const handleSearch = (query: string) => {
    onUpdateFilters({ search: query })
  }

  const handleActivityFilter = (activity: string) => {
    onUpdateFilters({ activity })
  }

  const handleSubcontractorFilter = (subcontractor: string) => {
    onUpdateFilters({ subcontractor })
  }

  const handleAreaZoneFilter = (areaZone: string) => {
    onUpdateFilters({ areaZone })
  }

  // Save filter to localStorage
  const saveCurrentFilter = () => {
    if (!newFilterName.trim()) return

    const newFilter: SavedFilter = {
      id: crypto.randomUUID(),
      name: newFilterName.trim(),
      status: statusFilters.join(','),
      activity: activityFilter,
      search: searchQuery,
      subcontractor: subcontractorFilter,
      areaZone: areaZoneFilter,
      createdAt: new Date().toISOString(),
    }

    const updatedFilters = [...savedFilters, newFilter]
    setSavedFilters(updatedFilters)
    localStorage.setItem(SAVED_FILTERS_STORAGE_KEY, JSON.stringify(updatedFilters))
    setShowSaveFilterModal(false)
    setNewFilterName('')
  }

  // Load a saved filter
  const loadSavedFilter = (filter: SavedFilter) => {
    onUpdateFilters({
      status: filter.status,
      activity: filter.activity,
      search: filter.search,
      subcontractor: filter.subcontractor || '',
      areaZone: filter.areaZone || '',
    })
    setSavedFiltersDropdownOpen(false)
  }

  // Delete a saved filter
  const deleteSavedFilter = (filterId: string) => {
    const updatedFilters = savedFilters.filter(f => f.id !== filterId)
    setSavedFilters(updatedFilters)
    localStorage.setItem(SAVED_FILTERS_STORAGE_KEY, JSON.stringify(updatedFilters))
  }

  // Toggle column visibility
  const toggleColumn = (columnId: ColumnId) => {
    const column = COLUMN_CONFIG.find(c => c.id === columnId)
    if (column?.required) return

    onSetVisibleColumns(prev => {
      const newColumns = prev.includes(columnId)
        ? prev.filter(c => c !== columnId)
        : [...prev, columnId]

      localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(newColumns))
      return newColumns
    })
  }

  // Move column up in order
  const moveColumnUp = (columnId: ColumnId) => {
    onSetColumnOrder(prev => {
      const index = prev.indexOf(columnId)
      if (index <= 0) return prev
      if (prev[index - 1] === 'lotNumber') return prev

      const newOrder = [...prev]
      ;[newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]]
      localStorage.setItem(COLUMN_ORDER_STORAGE_KEY, JSON.stringify(newOrder))
      return newOrder
    })
  }

  // Move column down in order
  const moveColumnDown = (columnId: ColumnId) => {
    onSetColumnOrder(prev => {
      const index = prev.indexOf(columnId)
      if (index < 0 || index >= prev.length - 1) return prev
      if (columnId === 'lotNumber') return prev

      const newOrder = [...prev]
      ;[newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]]
      localStorage.setItem(COLUMN_ORDER_STORAGE_KEY, JSON.stringify(newOrder))
      return newOrder
    })
  }

  const isColumnVisible = (columnId: ColumnId) => visibleColumns.includes(columnId)

  if (isMobile) {
    return (
      <>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <input
              id="search-input-mobile"
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search lots..."
              className="w-full rounded-lg border bg-background px-4 py-3 text-base"
            />
          </div>
          <FilterTriggerButton
            onClick={() => setFilterSheetOpen(true)}
            activeCount={activeFilterCount}
          />
        </div>

        {/* Mobile Filter Bottom Sheet */}
        <FilterBottomSheet
          isOpen={filterSheetOpen}
          onClose={() => setFilterSheetOpen(false)}
          title="Filter Lots"
          filters={[
            {
              type: 'multiselect',
              id: 'status',
              label: 'Status',
              options: STATUS_OPTIONS,
              value: statusFilters,
            },
            {
              type: 'select',
              id: 'activity',
              label: 'Activity Type',
              options: activityTypes.filter((t): t is string => t !== null && t !== undefined).map(t => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) })),
              value: activityFilter || null,
            },
            ...(!isSubcontractor && subcontractors.length > 0 ? [{
              type: 'select' as const,
              id: 'subcontractor',
              label: 'Subcontractor',
              options: [
                { value: 'unassigned', label: 'Unassigned' },
                ...subcontractors.map(s => ({ value: s.id, label: s.companyName })),
              ],
              value: subcontractorFilter || null,
            }] : []),
            ...(areaZones.length > 0 ? [{
              type: 'select' as const,
              id: 'areaZone',
              label: 'Area/Zone',
              options: [
                { value: 'unassigned', label: 'Unassigned' },
                ...areaZones.map(z => ({ value: z, label: z })),
              ],
              value: areaZoneFilter || null,
            }] : []),
          ] as FilterConfig[]}
          values={mobileFilterValues}
          onChange={(values) => setMobileFilterValues(values)}
          onApply={(values) => {
            onUpdateFilters({
              status: (values.status as string[] || []).join(','),
              activity: values.activity as string || '',
              subcontractor: values.subcontractor as string || '',
              areaZone: values.areaZone as string || '',
            })
            setFilterSheetOpen(false)
          }}
          onClear={() => {
            setMobileFilterValues({
              status: [],
              activity: null,
              subcontractor: null,
              areaZone: null,
            })
            onUpdateFilters({ status: '', activity: '', subcontractor: '', areaZone: '' })
          }}
        />
      </>
    )
  }

  return (
    <>
      {/* Desktop: Full filter layout */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Filter label with badge count */}
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-muted-foreground">Filters:</span>
          {activeFilterCount > 0 && (
            <span
              className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-semibold rounded-full bg-primary text-primary-foreground"
              data-testid="filter-badge"
              title={`${activeFilterCount} active filter${activeFilterCount > 1 ? 's' : ''}`}
            >
              {activeFilterCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="search-input" className="text-sm font-medium">
            Search:
          </label>
          <div className="flex items-center">
            <input
              id="search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Lot # or description..."
              className="rounded-lg border bg-background px-3 py-1.5 text-sm w-48"
            />
            {searchQuery && (
              <button
                onClick={() => handleSearch('')}
                className="ml-1 p-1 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted"
                title="Clear search"
                aria-label="Clear search"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">
            Status:
          </label>
          <div className="relative" ref={statusDropdownRef}>
            <button
              onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
              className="rounded-lg border bg-background px-3 py-1.5 text-sm min-w-[140px] text-left flex items-center justify-between gap-2"
            >
              <span className="truncate">
                {statusFilters.length === 0
                  ? 'All Statuses'
                  : statusFilters.length === 1
                    ? STATUS_OPTIONS.find(s => s.value === statusFilters[0])?.label
                    : `${statusFilters.length} selected`}
              </span>
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform ${statusDropdownOpen ? 'rotate-180' : ''}`}>
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
            {statusDropdownOpen && (
              <div className="absolute z-50 mt-1 w-48 rounded-lg border bg-background shadow-lg">
                <div className="p-2 max-h-64 overflow-y-auto">
                  {STATUS_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={statusFilters.includes(option.value)}
                        onChange={() => handleStatusToggle(option.value)}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <span className="text-sm">{option.label}</span>
                    </label>
                  ))}
                </div>
                {statusFilters.length > 0 && (
                  <div className="border-t p-2">
                    <button
                      onClick={() => {
                        clearStatusFilters()
                        setStatusDropdownOpen(false)
                      }}
                      className="w-full text-sm text-primary hover:underline text-center py-1"
                    >
                      Clear all
                    </button>
                  </div>
                )}
              </div>
            )}
            {statusFilters.length > 0 && (
              <button
                onClick={clearStatusFilters}
                className="ml-1 p-1 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted"
                title="Clear status filter"
                aria-label="Clear status filter"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="activity-filter" className="text-sm font-medium">
            Activity:
          </label>
          <div className="flex items-center">
            <select
              id="activity-filter"
              value={activityFilter}
              onChange={(e) => handleActivityFilter(e.target.value)}
              className="rounded-lg border bg-background px-3 py-1.5 text-sm"
            >
              <option value="">All Activities</option>
              {activityTypes.map((type) => (
                <option key={type} value={type as string}>
                  {(type as string).charAt(0).toUpperCase() + (type as string).slice(1)}
                </option>
              ))}
            </select>
            {activityFilter && (
              <button
                onClick={() => handleActivityFilter('')}
                className="ml-1 p-1 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted"
                title="Clear activity filter"
                aria-label="Clear activity filter"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            )}
          </div>
        </div>
        {/* Chainage Range Filter */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">
            Chainage:
          </label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={chainageMinFilter}
              onChange={(e) => onUpdateFilters({ chMin: e.target.value })}
              placeholder="Min"
              className="rounded-lg border bg-background px-2 py-1.5 text-sm w-20"
              aria-label="Minimum chainage"
            />
            <span className="text-muted-foreground">-</span>
            <input
              type="number"
              value={chainageMaxFilter}
              onChange={(e) => onUpdateFilters({ chMax: e.target.value })}
              placeholder="Max"
              className="rounded-lg border bg-background px-2 py-1.5 text-sm w-20"
              aria-label="Maximum chainage"
            />
            {(chainageMinFilter || chainageMaxFilter) && (
              <button
                onClick={() => onUpdateFilters({ chMin: '', chMax: '' })}
                className="ml-1 p-1 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted"
                title="Clear chainage filter"
                aria-label="Clear chainage filter"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            )}
          </div>
        </div>
        {/* Subcontractor Filter */}
        {!isSubcontractor && subcontractors.length > 0 && (
          <div className="flex items-center gap-2">
            <label htmlFor="subcontractor-filter" className="text-sm font-medium">
              Subcontractor:
            </label>
            <div className="flex items-center">
              <select
                id="subcontractor-filter"
                value={subcontractorFilter}
                onChange={(e) => handleSubcontractorFilter(e.target.value)}
                className="rounded-lg border bg-background px-3 py-1.5 text-sm"
              >
                <option value="">All Subcontractors</option>
                <option value="unassigned">Unassigned</option>
                {subcontractors.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.companyName}
                  </option>
                ))}
              </select>
              {subcontractorFilter && (
                <button
                  onClick={() => handleSubcontractorFilter('')}
                  className="ml-1 p-1 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted"
                  title="Clear subcontractor filter"
                  aria-label="Clear subcontractor filter"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}
        {/* Area/Zone Filter */}
        {areaZones.length > 0 && (
          <div className="flex items-center gap-2">
            <label htmlFor="area-zone-filter" className="text-sm font-medium">
              Area/Zone:
            </label>
            <div className="flex items-center">
              <select
                id="area-zone-filter"
                value={areaZoneFilter}
                onChange={(e) => handleAreaZoneFilter(e.target.value)}
                className="rounded-lg border bg-background px-3 py-1.5 text-sm"
              >
                <option value="">All Areas</option>
                <option value="unassigned">Unassigned</option>
                {areaZones.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </select>
              {areaZoneFilter && (
                <button
                  onClick={() => handleAreaZoneFilter('')}
                  className="ml-1 p-1 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted"
                  title="Clear area/zone filter"
                  aria-label="Clear area/zone filter"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}
        {(statusFilters.length > 0 || activityFilter || searchQuery || chainageMinFilter || chainageMaxFilter || subcontractorFilter || areaZoneFilter) && (
          <>
            <button
              onClick={() => {
                onUpdateFilters({ status: '', activity: '', search: '', chMin: '', chMax: '', subcontractor: '', areaZone: '' })
              }}
              className="text-sm text-primary hover:underline"
            >
              Clear All Filters
            </button>
            <button
              onClick={() => setShowSaveFilterModal(true)}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              title="Save current filter"
            >
              <Save className="h-3.5 w-3.5" />
              Save Filter
            </button>
          </>
        )}

        {/* Saved Filters Dropdown */}
        {savedFilters.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setSavedFiltersDropdownOpen(!savedFiltersDropdownOpen)}
              className="flex items-center gap-1.5 rounded-lg border bg-background px-3 py-1.5 text-sm hover:bg-muted"
              title="Load saved filter"
            >
              <Bookmark className="h-4 w-4" />
              Saved ({savedFilters.length})
            </button>
            {savedFiltersDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setSavedFiltersDropdownOpen(false)}
                />
                <div className="absolute left-0 top-full mt-1 z-20 w-64 rounded-lg border bg-white dark:bg-card shadow-lg">
                  <div className="p-2 border-b">
                    <span className="text-xs font-medium text-muted-foreground">Saved Filters</span>
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    {savedFilters.map((filter) => (
                      <div
                        key={filter.id}
                        className="flex items-center justify-between px-3 py-2 hover:bg-muted group"
                      >
                        <button
                          onClick={() => loadSavedFilter(filter)}
                          className="flex-1 text-left text-sm truncate"
                          title={`Load filter: ${filter.name}`}
                        >
                          {filter.name}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteSavedFilter(filter.id)
                          }}
                          className="p-1 text-muted-foreground hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Delete filter"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        <span className="text-sm text-muted-foreground">
          Showing {filteredLotsCount} of {totalLots} lots
        </span>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 border rounded-lg p-0.5 bg-muted/30">
          <button
            onClick={() => onToggleViewMode('list')}
            className={`p-1.5 rounded transition-colors ${viewMode === 'list' ? 'bg-background shadow-sm' : 'hover:bg-muted'}`}
            title="List view"
            data-testid="view-toggle-list"
          >
            <LayoutList className="h-4 w-4" />
          </button>
          <button
            onClick={() => onToggleViewMode('card')}
            className={`p-1.5 rounded transition-colors ${viewMode === 'card' ? 'bg-background shadow-sm' : 'hover:bg-muted'}`}
            title="Card view"
            data-testid="view-toggle-card"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          {/* Feature #151 - Linear Map View */}
          <button
            onClick={() => onToggleViewMode('linear')}
            className={`p-1.5 rounded transition-colors ${viewMode === 'linear' ? 'bg-background shadow-sm' : 'hover:bg-muted'}`}
            title="Linear map view"
            data-testid="view-toggle-linear"
          >
            <MapPin className="h-4 w-4" />
          </button>
        </div>

        {/* Column Settings */}
        <div className="relative">
          <button
            onClick={() => setColumnSettingsOpen(!columnSettingsOpen)}
            className="flex items-center gap-1.5 rounded-lg border bg-background px-3 py-1.5 text-sm hover:bg-muted"
            title="Customize columns"
          >
            <Settings2 className="h-4 w-4" />
            Columns
          </button>
          {columnSettingsOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setColumnSettingsOpen(false)}
              />
              <div className="absolute right-0 top-full mt-1 z-20 w-64 rounded-lg border bg-white shadow-lg">
                <div className="p-2 border-b">
                  <span className="text-xs font-medium text-muted-foreground">Show/Hide & Reorder Columns</span>
                </div>
                <div className="p-1">
                  {columnOrder.map((columnId, index) => {
                    const column = COLUMN_CONFIG.find(c => c.id === columnId)
                    if (!column) return null
                    if (column.id === 'subcontractor' && isSubcontractor) return null
                    if (column.id === 'budget' && !canViewBudgets) return null

                    const isFirst = index === 0 || columnOrder[index - 1] === 'lotNumber'
                    const isLast = index === columnOrder.length - 1

                    return (
                      <div
                        key={column.id}
                        className="flex items-center gap-1 px-2 py-1.5 text-sm rounded hover:bg-muted"
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleColumn(column.id)
                          }}
                          disabled={column.required}
                          className={`flex items-center gap-2 flex-1 text-left ${
                            column.required ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                        >
                          <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                            isColumnVisible(column.id) ? 'bg-primary border-primary' : 'border-gray-300'
                          }`}>
                            {isColumnVisible(column.id) && (
                              <Check className="h-3 w-3 text-white" />
                            )}
                          </div>
                          <span className="truncate">{column.label}</span>
                          {column.required && (
                            <span className="text-xs text-muted-foreground">(req)</span>
                          )}
                        </button>
                        {!column.required && (
                          <div className="flex items-center gap-0.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                moveColumnUp(column.id)
                              }}
                              disabled={isFirst}
                              className={`p-0.5 rounded hover:bg-gray-200 ${isFirst ? 'opacity-30 cursor-not-allowed' : ''}`}
                              title="Move up"
                            >
                              <ChevronUp className="h-4 w-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                moveColumnDown(column.id)
                              }}
                              disabled={isLast}
                              className={`p-0.5 rounded hover:bg-gray-200 ${isLast ? 'opacity-30 cursor-not-allowed' : ''}`}
                              title="Move down"
                            >
                              <ChevronDown className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Save Filter Modal */}
      {showSaveFilterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-lg bg-white dark:bg-card p-6 shadow-xl">
            <h2 className="text-lg font-semibold">Save Current Filter</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Save the current filter settings for quick access later.
            </p>
            <div className="mt-4">
              <label className="block text-sm font-medium mb-1">Filter Name</label>
              <input
                type="text"
                value={newFilterName}
                onChange={(e) => setNewFilterName(e.target.value)}
                placeholder="e.g., Completed Earthworks"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveCurrentFilter()
                }}
              />
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              <p>Current filter:</p>
              <ul className="mt-1 ml-4 list-disc">
                {statusFilters.length > 0 && (
                  <li>Status: {statusFilters.map(s => s.replace('_', ' ')).join(', ')}</li>
                )}
                {activityFilter && <li>Activity: {activityFilter}</li>}
                {searchQuery && <li>Search: &quot;{searchQuery}&quot;</li>}
              </ul>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowSaveFilterModal(false)
                  setNewFilterName('')
                }}
                className="rounded-lg border px-4 py-2 text-sm hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={saveCurrentFilter}
                disabled={!newFilterName.trim()}
                className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                Save Filter
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
})
