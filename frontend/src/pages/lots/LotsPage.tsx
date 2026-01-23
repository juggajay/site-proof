import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { useCommercialAccess } from '@/hooks/useCommercialAccess'
import { useSubcontractorAccess } from '@/hooks/useSubcontractorAccess'
import { useViewerAccess } from '@/hooks/useViewerAccess'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { getAuthToken, useAuth } from '@/lib/auth'
import { toast } from '@/components/ui/toaster'
import { BulkCreateLotsWizard } from '@/components/lots/BulkCreateLotsWizard'
import { ImportLotsModal } from '@/components/lots/ImportLotsModal'
import { ExportLotsModal } from '@/components/lots/ExportLotsModal'
import { LotQuickView } from '@/components/lots/LotQuickView'
import { PrintLabelsModal } from '@/components/lots/PrintLabelsModal'
import { LinearMapView } from '@/components/lots/LinearMapView'  // Feature #151
import { Settings2, Check, ChevronUp, ChevronDown, ChevronRight, Save, Bookmark, Trash2, Printer, Calendar, FileText, AlertTriangle, TestTube, LayoutGrid, LayoutList, MapPin } from 'lucide-react'
import { ContextHelp, HELP_CONTENT } from '@/components/ContextHelp'

// Roles that can delete lots
const LOT_DELETE_ROLES = ['owner', 'admin', 'project_manager']

// Infinite scroll settings
const INITIAL_DISPLAY_COUNT = 20
const LOAD_MORE_COUNT = 15

// Column configuration
const COLUMN_CONFIG = [
  { id: 'lotNumber', label: 'Lot Number', required: true },
  { id: 'description', label: 'Description', required: false },
  { id: 'chainage', label: 'Chainage', required: false },
  { id: 'activityType', label: 'Activity Type', required: false },
  { id: 'status', label: 'Status', required: false },
  { id: 'subcontractor', label: 'Subcontractor', required: false },
  { id: 'budget', label: 'Budget', required: false },
] as const

type ColumnId = typeof COLUMN_CONFIG[number]['id']

const DEFAULT_COLUMN_ORDER: ColumnId[] = ['lotNumber', 'description', 'chainage', 'activityType', 'status', 'subcontractor', 'budget']

const COLUMN_STORAGE_KEY = 'siteproof_lot_columns'
const COLUMN_ORDER_STORAGE_KEY = 'siteproof_lot_column_order'
const COLUMN_WIDTH_STORAGE_KEY = 'siteproof_lot_column_widths'
const SAVED_FILTERS_STORAGE_KEY = 'siteproof_lot_saved_filters'

// Default column widths in pixels
const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  lotNumber: 140,
  description: 200,
  chainage: 100,
  activityType: 130,
  status: 110,
  subcontractor: 140,
  budget: 100,
}

interface SavedFilter {
  id: string
  name: string
  status: string
  activity: string
  search: string
  subcontractor?: string
  areaZone?: string
  createdAt: string
}

interface Lot {
  id: string
  lotNumber: string
  description: string | null
  status: string
  activityType?: string | null
  chainageStart: number | null
  chainageEnd: number | null
  offset: string | null
  layer: string | null
  areaZone: string | null
  budgetAmount?: number | null
  assignedSubcontractorId?: string | null
  assignedSubcontractor?: { companyName: string } | null
  // Additional properties for expanded view
  createdAt?: string | null
  updatedAt?: string | null
  itpCount?: number
  testCount?: number
  documentCount?: number
  ncrCount?: number
  holdPointCount?: number
  notes?: string | null
}

// Feature #438: Okabe-Ito color-blind safe palette
const statusColors: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  in_progress: 'bg-sky-100 text-sky-800',
  completed: 'bg-emerald-100 text-emerald-800',
  on_hold: 'bg-orange-100 text-orange-800',
  not_started: 'bg-gray-100 text-gray-700',
}

// Helper function to highlight search terms in text
function highlightSearchTerm(text: string, searchTerm: string): React.ReactNode {
  if (!searchTerm || !text) return text

  const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  const parts = text.split(regex)

  if (parts.length === 1) return text

  return parts.map((part, index) =>
    regex.test(part) ? (
      <mark key={index} className="bg-yellow-200 text-yellow-900 px-0.5 rounded">
        {part}
      </mark>
    ) : (
      part
    )
  )
}

// Status options for multi-select filter
const STATUS_OPTIONS = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'awaiting_test', label: 'Awaiting Test' },
  { value: 'hold_point', label: 'Hold Point' },
  { value: 'ncr_raised', label: 'NCR Raised' },
  { value: 'completed', label: 'Completed' },
  { value: 'conformed', label: 'Conformed' },
  { value: 'claimed', label: 'Claimed' },
]

export function LotsPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const { canViewBudgets } = useCommercialAccess()
  const { isSubcontractor } = useSubcontractorAccess()
  const { canCreate } = useViewerAccess()
  const isMobile = useIsMobile()
  const [lots, setLots] = useState<Lot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Infinite scroll state
  const [displayedCount, setDisplayedCount] = useState(INITIAL_DISPLAY_COUNT)
  const [loadingMore, setLoadingMore] = useState(false)
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [lotToDelete, setLotToDelete] = useState<Lot | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Project name for print header
  const [projectName, setProjectName] = useState<string>('')

  // Quick view state
  const [quickViewLot, setQuickViewLot] = useState<{ id: string; position: { x: number; y: number } } | null>(null)
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const statusDropdownRef = useRef<HTMLDivElement>(null)

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ lot: Lot; x: number; y: number } | null>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)

  // Create lot modal state
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newLot, setNewLot] = useState({
    lotNumber: '',
    description: '',
    activityType: 'Earthworks',
    chainageStart: '',
    chainageEnd: '',
    assignedSubcontractorId: '',
  })
  const [chainageError, setChainageError] = useState<string | null>(null)
  const [lotNumberTouched, setLotNumberTouched] = useState(false)
  const [lotNumberError, setLotNumberError] = useState<string | null>(null)

  // ITP template suggestion state
  const [itpTemplates, setItpTemplates] = useState<{ id: string; name: string; activityType: string }[]>([])
  const [suggestedTemplate, setSuggestedTemplate] = useState<{ id: string; name: string } | null>(null)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')

  // Lot number length constraints
  const LOT_NUMBER_MIN_LENGTH = 3
  const LOT_NUMBER_MAX_LENGTH = 50

  // Validate lot number length
  const validateLotNumber = (value: string): string | null => {
    if (!value.trim()) {
      return 'Lot Number is required'
    }
    if (value.trim().length < LOT_NUMBER_MIN_LENGTH) {
      return `Lot Number must be at least ${LOT_NUMBER_MIN_LENGTH} characters`
    }
    if (value.length > LOT_NUMBER_MAX_LENGTH) {
      return `Lot Number must be at most ${LOT_NUMBER_MAX_LENGTH} characters`
    }
    return null
  }

  // Bulk create wizard state
  const [bulkWizardOpen, setBulkWizardOpen] = useState(false)

  // Import modal state
  const [importModalOpen, setImportModalOpen] = useState(false)

  // Export modal state
  const [exportModalOpen, setExportModalOpen] = useState(false)

  // View mode state (list, card, or linear map) - Feature #151
  const [viewMode, setViewMode] = useState<'list' | 'card' | 'linear'>(() => {
    const stored = localStorage.getItem('siteproof_lot_view_mode')
    if (stored === 'card' || stored === 'linear') return stored
    return 'list'
  })

  const toggleViewMode = (mode: 'list' | 'card' | 'linear') => {
    setViewMode(mode)
    localStorage.setItem('siteproof_lot_view_mode', mode)
  }

  // Expandable rows state
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  const toggleRowExpansion = (lotId: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(lotId)) {
        next.delete(lotId)
      } else {
        next.add(lotId)
      }
      return next
    })
  }

  // Bulk delete state
  const [selectedLots, setSelectedLots] = useState<Set<string>>(new Set())
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)

  // Bulk status update state
  const [bulkStatusModalOpen, setBulkStatusModalOpen] = useState(false)
  const [bulkStatusUpdating, setBulkStatusUpdating] = useState(false)
  const [newBulkStatus, setNewBulkStatus] = useState('in_progress')

  // Bulk assign subcontractor state
  const [bulkAssignModalOpen, setBulkAssignModalOpen] = useState(false)
  const [bulkAssigning, setBulkAssigning] = useState(false)
  const [selectedSubcontractorId, setSelectedSubcontractorId] = useState<string>('')
  const [subcontractors, setSubcontractors] = useState<{ id: string; companyName: string }[]>([])

  // Feature #708 - Project areas for linear map highlighting
  const [projectAreas, setProjectAreas] = useState<{ id: string; name: string; chainageStart: number | null; chainageEnd: number | null; colour: string | null }[]>([])

  // Print labels state
  const [printLabelsModalOpen, setPrintLabelsModalOpen] = useState(false)

  // Column customization state
  const [visibleColumns, setVisibleColumns] = useState<ColumnId[]>(() => {
    try {
      const stored = localStorage.getItem(COLUMN_STORAGE_KEY)
      if (stored) {
        return JSON.parse(stored) as ColumnId[]
      }
    } catch (e) {
      console.error('Error loading column settings:', e)
    }
    return DEFAULT_COLUMN_ORDER
  })

  // Column order state (separate from visibility)
  const [columnOrder, setColumnOrder] = useState<ColumnId[]>(() => {
    try {
      const stored = localStorage.getItem(COLUMN_ORDER_STORAGE_KEY)
      if (stored) {
        return JSON.parse(stored) as ColumnId[]
      }
    } catch (e) {
      console.error('Error loading column order:', e)
    }
    return DEFAULT_COLUMN_ORDER
  })

  const [columnSettingsOpen, setColumnSettingsOpen] = useState(false)

  // Column widths state for resizing
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    try {
      const stored = localStorage.getItem(COLUMN_WIDTH_STORAGE_KEY)
      if (stored) {
        return { ...DEFAULT_COLUMN_WIDTHS, ...JSON.parse(stored) }
      }
    } catch (e) {
      console.error('Error loading column widths:', e)
    }
    return DEFAULT_COLUMN_WIDTHS
  })
  const [resizingColumn, setResizingColumn] = useState<string | null>(null)
  const resizeStartX = useRef<number>(0)
  const resizeStartWidth = useRef<number>(0)

  // Handle column resize
  const handleResizeStart = useCallback((e: React.MouseEvent, columnId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setResizingColumn(columnId)
    resizeStartX.current = e.clientX
    resizeStartWidth.current = columnWidths[columnId] || DEFAULT_COLUMN_WIDTHS[columnId] || 100
  }, [columnWidths])

  useEffect(() => {
    if (!resizingColumn) return

    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - resizeStartX.current
      const newWidth = Math.max(60, resizeStartWidth.current + diff) // Minimum 60px
      setColumnWidths(prev => ({
        ...prev,
        [resizingColumn]: newWidth,
      }))
    }

    const handleMouseUp = () => {
      if (resizingColumn) {
        // Save to localStorage
        setColumnWidths(prev => {
          localStorage.setItem(COLUMN_WIDTH_STORAGE_KEY, JSON.stringify(prev))
          return prev
        })
        setResizingColumn(null)
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [resizingColumn])

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

  // Save filter to localStorage
  const saveCurrentFilter = () => {
    if (!newFilterName.trim()) return

    const newFilter: SavedFilter = {
      id: crypto.randomUUID(),
      name: newFilterName.trim(),
      status: statusFilters.join(','), // Save comma-separated statuses
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
    toast({ description: `Filter "${newFilter.name}" saved`, variant: 'success' })
  }

  // Load a saved filter
  const loadSavedFilter = (filter: SavedFilter) => {
    updateFilters({
      status: filter.status,
      activity: filter.activity,
      search: filter.search,
      subcontractor: filter.subcontractor || '',
      areaZone: filter.areaZone || '',
    })
    setSavedFiltersDropdownOpen(false)
    toast({ description: `Filter "${filter.name}" loaded`, variant: 'success' })
  }

  // Delete a saved filter
  const deleteSavedFilter = (filterId: string) => {
    const filterName = savedFilters.find(f => f.id === filterId)?.name
    const updatedFilters = savedFilters.filter(f => f.id !== filterId)
    setSavedFilters(updatedFilters)
    localStorage.setItem(SAVED_FILTERS_STORAGE_KEY, JSON.stringify(updatedFilters))
    toast({ description: `Filter "${filterName}" deleted`, variant: 'success' })
  }

  // Toggle column visibility
  const toggleColumn = (columnId: ColumnId) => {
    const column = COLUMN_CONFIG.find(c => c.id === columnId)
    if (column?.required) return // Can't hide required columns

    setVisibleColumns(prev => {
      const newColumns = prev.includes(columnId)
        ? prev.filter(c => c !== columnId)
        : [...prev, columnId]

      // Save to localStorage
      localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(newColumns))
      return newColumns
    })
  }

  // Move column up in order
  const moveColumnUp = (columnId: ColumnId) => {
    setColumnOrder(prev => {
      const index = prev.indexOf(columnId)
      if (index <= 0) return prev // Can't move first column up

      // Don't allow moving above lotNumber (required first column)
      if (prev[index - 1] === 'lotNumber') return prev

      const newOrder = [...prev]
      ;[newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]]
      localStorage.setItem(COLUMN_ORDER_STORAGE_KEY, JSON.stringify(newOrder))
      return newOrder
    })
  }

  // Move column down in order
  const moveColumnDown = (columnId: ColumnId) => {
    setColumnOrder(prev => {
      const index = prev.indexOf(columnId)
      if (index < 0 || index >= prev.length - 1) return prev // Can't move last column down

      // Don't allow moving lotNumber (required first column)
      if (columnId === 'lotNumber') return prev

      const newOrder = [...prev]
      ;[newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]]
      localStorage.setItem(COLUMN_ORDER_STORAGE_KEY, JSON.stringify(newOrder))
      return newOrder
    })
  }

  // Check if column is visible
  const isColumnVisible = (columnId: ColumnId) => visibleColumns.includes(columnId)

  // Get ordered and visible columns
  const orderedVisibleColumns = useMemo(() => {
    return columnOrder.filter(colId => isColumnVisible(colId))
  }, [columnOrder, visibleColumns])

  // Get filter, sort, and pagination from URL
  // Note: currentPage is available via searchParams.get('page') if needed later
  const statusFilterParam = searchParams.get('status') || ''
  // Support comma-separated status filter for multi-select
  const statusFilters = statusFilterParam ? statusFilterParam.split(',').filter(Boolean) : []
  const activityFilter = searchParams.get('activity') || ''
  const searchQuery = searchParams.get('search') || ''
  const sortField = searchParams.get('sort') || 'lotNumber'
  const sortDirection = (searchParams.get('dir') || 'asc') as 'asc' | 'desc'

  // Chainage range filter
  const chainageMinFilter = searchParams.get('chMin') || ''
  const chainageMaxFilter = searchParams.get('chMax') || ''

  // Subcontractor filter
  const subcontractorFilter = searchParams.get('subcontractor') || ''

  // Area/Zone filter
  const areaZoneFilter = searchParams.get('areaZone') || ''

  // Status filter dropdown state
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false)

  // Check if user can delete lots
  const canDelete = user?.role ? LOT_DELETE_ROLES.includes(user.role) : false

  // Get unique activity types for filter dropdown
  const activityTypes = useMemo(() => {
    const types = new Set(lots.map((l) => l.activityType).filter(Boolean))
    return Array.from(types).sort()
  }, [lots])

  // Get unique area zones for filter dropdown
  const areaZones = useMemo(() => {
    const zones = new Set(lots.map((l) => l.areaZone).filter(Boolean))
    return Array.from(zones).sort() as string[]
  }, [lots])

  // Filter and sort lots based on current filters and sort order
  const filteredLots = useMemo(() => {
    const filtered = lots.filter((lot) => {
      // Multi-select status filter: if any statuses are selected, lot must match one
      if (statusFilters.length > 0 && !statusFilters.includes(lot.status)) return false
      if (activityFilter && lot.activityType !== activityFilter) return false
      // Case-insensitive search on lot number and description
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesLotNumber = lot.lotNumber.toLowerCase().includes(query)
        const matchesDescription = (lot.description || '').toLowerCase().includes(query)
        if (!matchesLotNumber && !matchesDescription) return false
      }

      // Chainage range filter: lot's chainage range must overlap with filter range
      const minFilter = chainageMinFilter ? parseFloat(chainageMinFilter) : null
      const maxFilter = chainageMaxFilter ? parseFloat(chainageMaxFilter) : null

      if (minFilter !== null || maxFilter !== null) {
        // If lot has no chainage, skip it when chainage filter is active
        if (lot.chainageStart === null && lot.chainageEnd === null) return false

        const lotStart = lot.chainageStart ?? lot.chainageEnd ?? 0
        const lotEnd = lot.chainageEnd ?? lot.chainageStart ?? 0

        // Check for overlap: lot range must intersect with filter range
        if (minFilter !== null && lotEnd < minFilter) return false
        if (maxFilter !== null && lotStart > maxFilter) return false
      }

      // Subcontractor filter: filter by assigned subcontractor
      if (subcontractorFilter) {
        if (subcontractorFilter === 'unassigned') {
          // Show only lots with no subcontractor assigned
          if (lot.assignedSubcontractorId) return false
        } else {
          // Show only lots assigned to the selected subcontractor
          if (lot.assignedSubcontractorId !== subcontractorFilter) return false
        }
      }

      // Area/Zone filter: filter by area zone
      if (areaZoneFilter) {
        if (areaZoneFilter === 'unassigned') {
          // Show only lots with no area zone assigned
          if (lot.areaZone) return false
        } else {
          // Show only lots in the selected area zone
          if (lot.areaZone !== areaZoneFilter) return false
        }
      }

      return true
    })

    // Sort the filtered lots
    return filtered.sort((a, b) => {
      let aVal: string | number | null = null
      let bVal: string | number | null = null

      switch (sortField) {
        case 'lotNumber':
          aVal = a.lotNumber.toLowerCase()
          bVal = b.lotNumber.toLowerCase()
          break
        case 'description':
          aVal = (a.description || '').toLowerCase()
          bVal = (b.description || '').toLowerCase()
          break
        case 'chainage':
          aVal = a.chainageStart ?? Number.MAX_SAFE_INTEGER
          bVal = b.chainageStart ?? Number.MAX_SAFE_INTEGER
          break
        case 'activityType':
          aVal = (a.activityType || '').toLowerCase()
          bVal = (b.activityType || '').toLowerCase()
          break
        case 'status':
          aVal = a.status.toLowerCase()
          bVal = b.status.toLowerCase()
          break
        default:
          return 0
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
      return 0
    })
  }, [lots, statusFilters, activityFilter, searchQuery, sortField, sortDirection])

  // Calculate displayed lots for infinite scroll
  const displayedLots = useMemo(() => {
    return filteredLots.slice(0, displayedCount)
  }, [filteredLots, displayedCount])

  const hasMore = displayedCount < filteredLots.length

  // Load more lots when scrolling to bottom
  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    // Simulate a brief loading delay for smooth UX
    setTimeout(() => {
      setDisplayedCount(prev => Math.min(prev + LOAD_MORE_COUNT, filteredLots.length))
      setLoadingMore(false)
    }, 200)
  }, [loadingMore, hasMore, filteredLots.length])

  // Reset displayed count when filters change
  useEffect(() => {
    setDisplayedCount(INITIAL_DISPLAY_COUNT)
  }, [statusFilters.join(','), activityFilter, searchQuery, sortField, sortDirection, chainageMinFilter, chainageMaxFilter, subcontractorFilter, areaZoneFilter])

  // Calculate active filter count for badge display
  const activeFilterCount = useMemo(() => {
    let count = 0
    if (statusFilters.length > 0) count++
    if (activityFilter) count++
    if (searchQuery) count++
    if (chainageMinFilter || chainageMaxFilter) count++ // Chainage range counts as 1 filter
    if (subcontractorFilter) count++
    if (areaZoneFilter) count++
    return count
  }, [statusFilters, activityFilter, searchQuery, chainageMinFilter, chainageMaxFilter, subcontractorFilter, areaZoneFilter])

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          loadMore()
        }
      },
      { threshold: 0.1 }
    )

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current)
    }

    return () => observer.disconnect()
  }, [hasMore, loadingMore, loadMore])

  // Update URL params
  const updateFilters = (newParams: Record<string, string>) => {
    const params = new URLSearchParams(searchParams)
    Object.entries(newParams).forEach(([key, value]) => {
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
    })
    // Reset to page 1 when filters change (unless page is being set)
    if (!('page' in newParams)) {
      params.set('page', '1')
    }
    setSearchParams(params)
  }

  // Multi-select status filter: toggle individual status
  const handleStatusToggle = (status: string) => {
    let newFilters: string[]
    if (statusFilters.includes(status)) {
      // Remove status
      newFilters = statusFilters.filter(s => s !== status)
    } else {
      // Add status
      newFilters = [...statusFilters, status]
    }
    updateFilters({ status: newFilters.join(',') })
  }

  const clearStatusFilters = () => {
    updateFilters({ status: '' })
  }

  const handleActivityFilter = (activity: string) => {
    updateFilters({ activity })
  }

  const handleSubcontractorFilter = (subcontractor: string) => {
    updateFilters({ subcontractor })
  }

  const handleAreaZoneFilter = (areaZone: string) => {
    updateFilters({ areaZone })
  }

  const handleSearch = (query: string) => {
    updateFilters({ search: query })
  }

  // Note: handlePageChange removed - using infinite scroll instead
  // Can be restored with: const handlePageChange = (page: number) => updateFilters({ page: page.toString() })

  const handleSort = (field: string) => {
    // If clicking the same field, toggle direction; otherwise sort ascending
    if (field === sortField) {
      updateFilters({ dir: sortDirection === 'asc' ? 'desc' : 'asc', sort: field })
    } else {
      updateFilters({ sort: field, dir: 'asc' })
    }
  }

  // Sortable column header component with resize handle
  const SortableHeader = ({ field, children }: { field: string; children: React.ReactNode }) => (
    <th
      className="text-left p-3 font-medium cursor-pointer hover:bg-muted/70 select-none relative group/resize"
      style={{ width: columnWidths[field] || DEFAULT_COLUMN_WIDTHS[field] || 'auto', minWidth: 60 }}
      onClick={() => handleSort(field)}
      data-testid={`column-header-${field}`}
    >
      <div className="flex items-center gap-1 pr-2">
        {children}
        <span className="text-muted-foreground">
          {sortField === field ? (
            sortDirection === 'asc' ? '↑' : '↓'
          ) : (
            <span className="opacity-0 group-hover:opacity-50">↕</span>
          )}
        </span>
      </div>
      {/* Resize handle */}
      <div
        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 group-hover/resize:bg-muted-foreground/30"
        onMouseDown={(e) => handleResizeStart(e, field)}
        onClick={(e) => e.stopPropagation()}
        data-testid={`column-resize-${field}`}
      />
    </th>
  )

  const fetchLots = async () => {
    if (!projectId) return

    const token = getAuthToken()
    if (!token) {
      navigate('/login')
      return
    }

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

    try {
      setLoading(true)
      const response = await fetch(`${apiUrl}/api/lots?projectId=${projectId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch lots')
      }

      const data = await response.json()
      setLots(data.lots || [])
    } catch (err) {
      setError('Failed to load lots')
      console.error('Fetch lots error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLots()
  }, [projectId, navigate])

  // Feature #732: Real-time lot update polling
  // Poll for updates every 30 seconds when the tab is visible
  useEffect(() => {
    let pollInterval: NodeJS.Timeout | null = null

    const startPolling = () => {
      // Poll every 30 seconds
      pollInterval = setInterval(() => {
        // Only poll if document is visible (not in background tab)
        if (document.visibilityState === 'visible' && projectId) {
          // Silent fetch without setting loading state to avoid UI flicker
          const silentFetchLots = async () => {
            const token = getAuthToken()
            if (!token) return

            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

            try {
              const response = await fetch(`${apiUrl}/api/lots?projectId=${projectId}`, {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              })

              if (response.ok) {
                const data = await response.json()
                // Only update if there are actual changes
                const newLots = data.lots || []
                setLots(prevLots => {
                  // Check if lots have changed by comparing IDs and updated timestamps
                  const hasChanges = newLots.length !== prevLots.length ||
                    newLots.some((newLot: Lot, index: number) =>
                      !prevLots[index] || newLot.id !== prevLots[index].id ||
                      newLot.status !== prevLots[index].status
                    )
                  return hasChanges ? newLots : prevLots
                })
              }
            } catch (err) {
              // Silent fail for background polling
              console.debug('Background lot fetch failed:', err)
            }
          }
          silentFetchLots()
        }
      }, 30000) // 30 seconds
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && projectId) {
        // Fetch immediately when tab becomes visible
        fetchLots()
      }
    }

    startPolling()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      if (pollInterval) clearInterval(pollInterval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [projectId])

  // Fetch project name for print header
  useEffect(() => {
    const fetchProjectName = async () => {
      if (!projectId) return

      const token = getAuthToken()
      if (!token) return

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

      try {
        const response = await fetch(`${apiUrl}/api/projects/${projectId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (response.ok) {
          const data = await response.json()
          setProjectName(data.project?.name || data.name || '')
        }
      } catch (err) {
        console.error('Error fetching project name:', err)
      }
    }

    fetchProjectName()
  }, [projectId])

  // Fetch subcontractors on mount for the filter dropdown
  useEffect(() => {
    if (projectId && !isSubcontractor) {
      fetchSubcontractors()
    }
  }, [projectId, isSubcontractor])

  // Feature #708 - Fetch project areas for linear map highlighting
  useEffect(() => {
    const fetchProjectAreas = async () => {
      if (!projectId) return

      const token = getAuthToken()
      if (!token) return

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

      try {
        const response = await fetch(`${apiUrl}/api/projects/${projectId}/areas`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (response.ok) {
          const data = await response.json()
          setProjectAreas(data.areas || [])
        }
      } catch (err) {
        console.error('Error fetching project areas:', err)
      }
    }

    fetchProjectAreas()
  }, [projectId])

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

  // Fetch subcontractors for the project
  const fetchSubcontractors = async () => {
    if (!projectId) return

    const token = getAuthToken()
    if (!token) return

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

    try {
      const response = await fetch(`${apiUrl}/api/subcontractors/for-project/${projectId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setSubcontractors(data.subcontractors || [])
      }
    } catch (err) {
      console.error('Fetch subcontractors error:', err)
    }
  }

  // Format chainage for display
  const formatChainage = (lot: Lot) => {
    if (lot.chainageStart != null && lot.chainageEnd != null) {
      return lot.chainageStart === lot.chainageEnd
        ? `${lot.chainageStart}`
        : `${lot.chainageStart}-${lot.chainageEnd}`
    }
    return lot.chainageStart ?? lot.chainageEnd ?? '—'
  }

  // Chainage min/max constraints
  const CHAINAGE_MIN = 0
  const CHAINAGE_MAX = 999999

  // Validate chainage values
  const validateChainage = (start: string, end: string) => {
    // Check min/max for start value
    if (start) {
      const startNum = parseInt(start)
      if (!isNaN(startNum)) {
        if (startNum < CHAINAGE_MIN) {
          return `Chainage Start must be at least ${CHAINAGE_MIN}`
        }
        if (startNum > CHAINAGE_MAX) {
          return `Chainage Start must be at most ${CHAINAGE_MAX}`
        }
      }
    }
    // Check min/max for end value
    if (end) {
      const endNum = parseInt(end)
      if (!isNaN(endNum)) {
        if (endNum < CHAINAGE_MIN) {
          return `Chainage End must be at least ${CHAINAGE_MIN}`
        }
        if (endNum > CHAINAGE_MAX) {
          return `Chainage End must be at most ${CHAINAGE_MAX}`
        }
      }
    }
    // Check start <= end
    if (start && end) {
      const startNum = parseInt(start)
      const endNum = parseInt(end)
      if (!isNaN(startNum) && !isNaN(endNum) && endNum < startNum) {
        return 'Chainage End must be greater than or equal to Chainage Start'
      }
    }
    return null
  }

  // Handle chainage change with validation
  const handleChainageStartChange = (value: string) => {
    setNewLot((prev) => ({ ...prev, chainageStart: value }))
    const error = validateChainage(value, newLot.chainageEnd)
    setChainageError(error)
  }

  const handleChainageEndChange = (value: string) => {
    setNewLot((prev) => ({ ...prev, chainageEnd: value }))
    const error = validateChainage(newLot.chainageStart, value)
    setChainageError(error)
  }

  // Open/close create lot modal
  const handleOpenCreateModal = async () => {
    setNewLot({
      lotNumber: '',
      description: '',
      activityType: 'Earthworks',
      chainageStart: '',
      chainageEnd: '',
      assignedSubcontractorId: '',
    })
    setChainageError(null)
    setSuggestedTemplate(null)
    setSelectedTemplateId('')
    setCreateModalOpen(true)

    const token = getAuthToken()
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
    if (projectId && token) {
      // Fetch suggested lot number, ITP templates, and subcontractors in parallel
      try {
        const [lotResponse, itpResponse, subResponse] = await Promise.all([
          fetch(`${apiUrl}/api/lots/suggest-number?projectId=${projectId}`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          fetch(`${apiUrl}/api/itp/templates?projectId=${projectId}&includeGlobal=true`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          fetch(`${apiUrl}/api/subcontractors/for-project/${projectId}`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        ])

        if (lotResponse.ok) {
          const data = await lotResponse.json()
          if (data.suggestedNumber) {
            setNewLot(prev => ({ ...prev, lotNumber: data.suggestedNumber }))
          }
        }

        if (itpResponse.ok) {
          const data = await itpResponse.json()
          const templates = data.templates || []
          setItpTemplates(templates.filter((t: any) => t.isActive !== false))
          // Find suggested template for default activity type (Earthworks)
          const suggested = templates.find((t: any) =>
            t.activityType?.toLowerCase() === 'earthworks' && t.isActive !== false
          )
          if (suggested) {
            setSuggestedTemplate({ id: suggested.id, name: suggested.name })
            setSelectedTemplateId(suggested.id)
          }
        }

        if (subResponse.ok) {
          const data = await subResponse.json()
          setSubcontractors(data.subcontractors || [])
        }
      } catch (err) {
        console.error('Failed to fetch lot data:', err)
      }
    }
  }

  // Update suggested ITP template when activity type changes
  const handleActivityTypeChange = (activityType: string) => {
    setNewLot(prev => ({ ...prev, activityType }))

    // Find matching template
    const suggested = itpTemplates.find(t =>
      t.activityType?.toLowerCase() === activityType.toLowerCase()
    )
    if (suggested) {
      setSuggestedTemplate({ id: suggested.id, name: suggested.name })
      setSelectedTemplateId(suggested.id)
    } else {
      setSuggestedTemplate(null)
      setSelectedTemplateId('')
    }
  }

  const handleCloseCreateModal = () => {
    setCreateModalOpen(false)
    setLotNumberTouched(false)
    setSuggestedTemplate(null)
    setSelectedTemplateId('')
    setNewLot({
      lotNumber: '',
      description: '',
      activityType: 'Earthworks',
      chainageStart: '',
      chainageEnd: '',
      assignedSubcontractorId: '',
    })
  }

  // Handle clicking outside modal (on backdrop)
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      setCreateModalOpen(false)
    }
  }

  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (createModalOpen) {
          setCreateModalOpen(false)
        }
        if (deleteModalOpen) {
          setDeleteModalOpen(false)
          setLotToDelete(null)
        }
        if (bulkWizardOpen) {
          setBulkWizardOpen(false)
        }
        if (bulkDeleteModalOpen) {
          setBulkDeleteModalOpen(false)
        }
        if (bulkStatusModalOpen) {
          setBulkStatusModalOpen(false)
        }
        if (bulkAssignModalOpen) {
          setBulkAssignModalOpen(false)
        }
        if (printLabelsModalOpen) {
          setPrintLabelsModalOpen(false)
        }
      }
    }

    document.addEventListener('keydown', handleEscapeKey)
    return () => document.removeEventListener('keydown', handleEscapeKey)
  }, [createModalOpen, deleteModalOpen, bulkWizardOpen, bulkDeleteModalOpen, bulkStatusModalOpen, bulkAssignModalOpen, printLabelsModalOpen])

  // Handle create lot submission
  const handleCreateLot = async () => {
    // Prevent concurrent submissions (double-click protection)
    if (creating) {
      return
    }

    if (!newLot.lotNumber.trim()) {
      setError('Lot number is required')
      return
    }

    setCreating(true)
    const token = getAuthToken()
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

    try {
      const response = await fetch(`${apiUrl}/api/lots`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          lotNumber: newLot.lotNumber,
          description: newLot.description || null,
          activityType: newLot.activityType,
          chainageStart: newLot.chainageStart ? parseInt(newLot.chainageStart) : null,
          chainageEnd: newLot.chainageEnd ? parseInt(newLot.chainageEnd) : null,
          itpTemplateId: selectedTemplateId || null,
          assignedSubcontractorId: newLot.assignedSubcontractorId || null,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Failed to create lot')
      }

      const data = await response.json()

      // Add new lot to the list
      setLots((prev) => [...prev, {
        ...data.lot,
        activityType: newLot.activityType,
        chainageStart: newLot.chainageStart ? parseInt(newLot.chainageStart) : null,
        chainageEnd: newLot.chainageEnd ? parseInt(newLot.chainageEnd) : null,
      }])
      setCreateModalOpen(false)

      // Find template name for toast message
      const assignedTemplate = selectedTemplateId
        ? itpTemplates.find(t => t.id === selectedTemplateId)
        : null

      // Show success toast with specific lot number
      toast({
        title: 'Lot Created',
        description: assignedTemplate
          ? `Lot ${newLot.lotNumber} created with ITP template "${assignedTemplate.name}"`
          : `Lot ${newLot.lotNumber} has been created successfully`,
        variant: 'success',
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create lot')
    } finally {
      setCreating(false)
    }
  }

  // Open delete confirmation modal
  const handleDeleteClick = (lot: Lot) => {
    setLotToDelete(lot)
    setDeleteModalOpen(true)
  }

  // Clone lot - creates a copy with suggested adjacent chainage
  const handleCloneLot = async (lot: Lot) => {
    const token = getAuthToken()
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

    try {
      const response = await fetch(`${apiUrl}/api/lots/${lot.id}/clone`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}), // Backend will auto-generate lot number and adjacent chainage
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Failed to clone lot')
      }

      const data = await response.json()

      // Add cloned lot to the list
      setLots(prev => [...prev, data.lot])

      toast({
        title: 'Lot Cloned',
        description: `${lot.lotNumber} cloned as ${data.lot.lotNumber}`,
        variant: 'success',
      })
    } catch (err) {
      toast({
        title: 'Clone Failed',
        description: err instanceof Error ? err.message : 'Failed to clone lot',
        variant: 'error',
      })
    }
  }

  // Context menu handlers
  const handleContextMenu = (e: React.MouseEvent, lot: Lot) => {
    e.preventDefault()
    setContextMenu({ lot, x: e.clientX, y: e.clientY })
  }

  const closeContextMenu = () => {
    setContextMenu(null)
  }

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        closeContextMenu()
      }
    }

    if (contextMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [contextMenu])

  // Quick view hover handlers
  const handleLotMouseEnter = (lotId: string, event: React.MouseEvent) => {
    // Clear any existing timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
    }
    // Delay showing the quick view to avoid flickering
    hoverTimeoutRef.current = setTimeout(() => {
      setQuickViewLot({
        id: lotId,
        position: { x: event.clientX, y: event.clientY }
      })
    }, 400) // 400ms delay before showing
  }

  const handleLotMouseLeave = () => {
    // Clear the hover timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
    // Don't immediately close - let the popup handle its own close
  }

  const handleQuickViewClose = () => {
    setQuickViewLot(null)
  }

  // Cancel deletion
  const handleCancelDelete = () => {
    setDeleteModalOpen(false)
    setLotToDelete(null)
  }

  // Confirm and execute deletion
  const handleConfirmDelete = async () => {
    if (!lotToDelete) return

    // Prevent concurrent submissions (double-click protection)
    if (deleting) {
      return
    }

    setDeleting(true)
    const token = getAuthToken()
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

    try {
      const response = await fetch(`${apiUrl}/api/lots/${lotToDelete.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Failed to delete lot')
      }

      // Remove lot from list
      setLots((prev) => prev.filter((l) => l.id !== lotToDelete.id))
      setDeleteModalOpen(false)
      setLotToDelete(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete lot')
    } finally {
      setDeleting(false)
    }
  }

  // Note: CSV export functionality moved to ExportLotsModal component

  // Handle bulk wizard success
  const handleBulkCreateSuccess = () => {
    setBulkWizardOpen(false)
    fetchLots() // Refresh the lot list
  }

  // Get deletable lots from current page (not conformed or claimed)
  const deletableLots = useMemo(() => {
    return displayedLots.filter(lot => lot.status !== 'conformed' && lot.status !== 'claimed')
  }, [displayedLots])

  // Check if all deletable lots on current page are selected
  const allDeletableSelected = deletableLots.length > 0 && deletableLots.every(lot => selectedLots.has(lot.id))

  // Toggle select all for current page
  const handleSelectAll = () => {
    if (allDeletableSelected) {
      // Deselect all on current page
      const newSelected = new Set(selectedLots)
      deletableLots.forEach(lot => newSelected.delete(lot.id))
      setSelectedLots(newSelected)
    } else {
      // Select all deletable on current page
      const newSelected = new Set(selectedLots)
      deletableLots.forEach(lot => newSelected.add(lot.id))
      setSelectedLots(newSelected)
    }
  }

  // Toggle single lot selection
  const handleSelectLot = (lotId: string) => {
    const newSelected = new Set(selectedLots)
    if (newSelected.has(lotId)) {
      newSelected.delete(lotId)
    } else {
      newSelected.add(lotId)
    }
    setSelectedLots(newSelected)
  }

  // Bulk delete handler
  const handleBulkDelete = async () => {
    if (selectedLots.size === 0) return

    // Prevent concurrent submissions (double-click protection)
    if (bulkDeleting) {
      return
    }

    setBulkDeleting(true)
    const token = getAuthToken()
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

    try {
      const response = await fetch(`${apiUrl}/api/lots/bulk-delete`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lotIds: Array.from(selectedLots),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Failed to delete lots')
      }

      const data = await response.json()

      // Remove deleted lots from list
      setLots((prev) => prev.filter((l) => !selectedLots.has(l.id)))
      setSelectedLots(new Set())
      setBulkDeleteModalOpen(false)

      toast({
        title: 'Lots Deleted',
        description: data.message,
        variant: 'success',
      })
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to delete lots',
        variant: 'error',
      })
    } finally {
      setBulkDeleting(false)
    }
  }

  // Bulk status update handler
  const handleBulkStatusUpdate = async () => {
    if (selectedLots.size === 0) return

    // Prevent concurrent submissions (double-click protection)
    if (bulkStatusUpdating) {
      return
    }

    setBulkStatusUpdating(true)
    const token = getAuthToken()
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

    try {
      const response = await fetch(`${apiUrl}/api/lots/bulk-update-status`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lotIds: Array.from(selectedLots),
          status: newBulkStatus,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Failed to update lot status')
      }

      const data = await response.json()

      // Update lots in state
      setLots((prev) => prev.map((lot) =>
        selectedLots.has(lot.id)
          ? { ...lot, status: newBulkStatus }
          : lot
      ))
      setSelectedLots(new Set())
      setBulkStatusModalOpen(false)

      toast({
        title: 'Status Updated',
        description: data.message,
        variant: 'success',
      })
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to update lot status',
        variant: 'error',
      })
    } finally {
      setBulkStatusUpdating(false)
    }
  }

  // Open bulk assign modal (fetch subcontractors first)
  const handleOpenBulkAssignModal = async () => {
    await fetchSubcontractors()
    setSelectedSubcontractorId('')
    setBulkAssignModalOpen(true)
  }

  // Bulk assign subcontractor handler
  const handleBulkAssignSubcontractor = async () => {
    if (selectedLots.size === 0) return

    // Prevent concurrent submissions (double-click protection)
    if (bulkAssigning) {
      return
    }

    setBulkAssigning(true)
    const token = getAuthToken()
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

    try {
      const response = await fetch(`${apiUrl}/api/lots/bulk-assign-subcontractor`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lotIds: Array.from(selectedLots),
          subcontractorId: selectedSubcontractorId || null,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Failed to assign subcontractor')
      }

      const data = await response.json()

      // Update lots in state
      const selectedSub = subcontractors.find(s => s.id === selectedSubcontractorId)
      setLots((prev) => prev.map((lot) =>
        selectedLots.has(lot.id)
          ? {
              ...lot,
              assignedSubcontractorId: selectedSubcontractorId || null,
              assignedSubcontractor: selectedSubcontractorId && selectedSub
                ? { companyName: selectedSub.companyName }
                : null
            }
          : lot
      ))
      setSelectedLots(new Set())
      setBulkAssignModalOpen(false)

      toast({
        title: 'Subcontractor Assigned',
        description: data.message,
        variant: 'success',
      })
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to assign subcontractor',
        variant: 'error',
      })
    } finally {
      setBulkAssigning(false)
    }
  }

  return (
    <div className="space-y-6 p-6">
      {/* Print-only Header */}
      <div className="hidden print:block report-header mb-6 text-center">
        <h1 className="text-2xl font-bold mb-2">Lot Register</h1>
        {projectName && <p className="text-gray-600 mb-1">{projectName}</p>}
        <div className="text-sm text-gray-500">
          Generated: {new Date().toLocaleDateString('en-AU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </div>
        <div className="text-xs text-gray-400 mt-2">SiteProof - Quality Management System</div>
      </div>

      {/* Print-only Footer */}
      <div className="hidden print:block report-footer fixed bottom-0 left-0 right-0 text-center text-xs text-gray-400 py-2 bg-white border-t">
        © {new Date().getFullYear()} SiteProof - Confidential
      </div>

      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">Lot Register</h1>
          <ContextHelp
            title={HELP_CONTENT.lots.title}
            content={HELP_CONTENT.lots.content}
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setExportModalOpen(true)}
            className="rounded-lg border border-primary px-4 py-2 text-sm text-primary hover:bg-primary/10"
          >
            Export CSV
          </button>
          <button
            onClick={() => window.print()}
            className="rounded-lg border border-gray-500 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 print:hidden"
          >
            <Printer className="h-4 w-4" />
            Print Register
          </button>
          {canCreate && selectedLots.size > 0 && (
            <>
              <button
                onClick={() => setBulkStatusModalOpen(true)}
                className="rounded-lg border border-blue-500 px-4 py-2 text-sm text-blue-500 hover:bg-blue-50"
              >
                Update Status ({selectedLots.size})
              </button>
              {!isSubcontractor && (
                <button
                  onClick={handleOpenBulkAssignModal}
                  className="rounded-lg border border-purple-500 px-4 py-2 text-sm text-purple-500 hover:bg-purple-50"
                >
                  Assign Subcontractor ({selectedLots.size})
                </button>
              )}
            </>
          )}
          {canDelete && selectedLots.size > 0 && (
            <button
              onClick={() => setBulkDeleteModalOpen(true)}
              className="rounded-lg border border-red-500 px-4 py-2 text-sm text-red-500 hover:bg-red-50"
            >
              Delete Selected ({selectedLots.size})
            </button>
          )}
          {selectedLots.size > 0 && (
            <button
              onClick={() => setPrintLabelsModalOpen(true)}
              className="rounded-lg border border-green-500 px-4 py-2 text-sm text-green-500 hover:bg-green-50"
            >
              Print Labels ({selectedLots.size})
            </button>
          )}
          {!isSubcontractor && canCreate && (
            <>
              <button
                onClick={() => setImportModalOpen(true)}
                className="rounded-lg border px-4 py-2 text-sm hover:bg-muted"
              >
                Import CSV
              </button>
              <button
                onClick={() => setBulkWizardOpen(true)}
                className="rounded-lg border border-primary px-4 py-2 text-sm text-primary hover:bg-primary/10"
              >
                Bulk Create Lots
              </button>
              <button
                onClick={handleOpenCreateModal}
                className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
              >
                Create Lot
              </button>
            </>
          )}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        {isSubcontractor
          ? `Viewing lots assigned to your company for project ${projectId}.`
          : `Manage lots for project ${projectId}. The lot is the atomic unit of the system.`}
      </p>

      {/* Filters */}
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
              onChange={(e) => updateFilters({ chMin: e.target.value })}
              placeholder="Min"
              className="rounded-lg border bg-background px-2 py-1.5 text-sm w-20"
              aria-label="Minimum chainage"
            />
            <span className="text-muted-foreground">-</span>
            <input
              type="number"
              value={chainageMaxFilter}
              onChange={(e) => updateFilters({ chMax: e.target.value })}
              placeholder="Max"
              className="rounded-lg border bg-background px-2 py-1.5 text-sm w-20"
              aria-label="Maximum chainage"
            />
            {(chainageMinFilter || chainageMaxFilter) && (
              <button
                onClick={() => updateFilters({ chMin: '', chMax: '' })}
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
        {/* Subcontractor Filter - hidden for subcontractor users */}
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
                updateFilters({ status: '', activity: '', search: '', chMin: '', chMax: '', subcontractor: '', areaZone: '' })
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
          Showing {filteredLots.length} of {lots.length} lots
        </span>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 border rounded-lg p-0.5 bg-muted/30">
          <button
            onClick={() => toggleViewMode('list')}
            className={`p-1.5 rounded transition-colors ${viewMode === 'list' ? 'bg-background shadow-sm' : 'hover:bg-muted'}`}
            title="List view"
            data-testid="view-toggle-list"
          >
            <LayoutList className="h-4 w-4" />
          </button>
          <button
            onClick={() => toggleViewMode('card')}
            className={`p-1.5 rounded transition-colors ${viewMode === 'card' ? 'bg-background shadow-sm' : 'hover:bg-muted'}`}
            title="Card view"
            data-testid="view-toggle-card"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          {/* Feature #151 - Linear Map View */}
          <button
            onClick={() => toggleViewMode('linear')}
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
                    // Skip subcontractor for subcontractors, budget for non-commercial
                    if (column.id === 'subcontractor' && isSubcontractor) return null
                    if (column.id === 'budget' && !canViewBudgets) return null

                    const isFirst = index === 0 || columnOrder[index - 1] === 'lotNumber'
                    const isLast = index === columnOrder.length - 1

                    return (
                      <div
                        key={column.id}
                        className="flex items-center gap-1 px-2 py-1.5 text-sm rounded hover:bg-muted"
                      >
                        {/* Visibility toggle */}
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
                        {/* Reorder buttons */}
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

      {/* Loading State - Skeleton */}
      {loading && (
        <div className="rounded-lg border overflow-hidden">
          {/* Table header skeleton */}
          <div className="bg-muted/50 border-b px-4 py-3">
            <div className="flex gap-4">
              <div className="h-4 w-4 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-4 w-20 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-4 w-20 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-4 w-20 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
          </div>
          {/* Table row skeletons */}
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
              <div className="flex gap-4 items-center">
                <div className="h-4 w-4 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="h-4 w-20 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="h-4 w-40 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="h-4 w-16 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="h-6 w-20 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="h-4 w-20 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700" role="alert" aria-live="assertive">
          {error}
        </div>
      )}

      {/* Lot Table / Card View - Table hidden on mobile, use card view instead */}
      {!loading && !error && viewMode === 'list' && !isMobile && (
        <div
          className={`rounded-lg border overflow-auto max-h-[calc(100vh-280px)] ${resizingColumn ? 'cursor-col-resize select-none' : ''}`}
          data-testid="scrollable-table-container"
        >
          <table className="w-full" style={{ tableLayout: 'fixed' }} data-testid="lots-table">
            <thead className="border-b sticky top-0 z-10 bg-muted" data-testid="sticky-table-header">
              <tr>
                {canDelete && (
                  <th className="p-3 w-10">
                    <input
                      type="checkbox"
                      checked={allDeletableSelected}
                      onChange={handleSelectAll}
                      className="h-4 w-4 rounded border-gray-300"
                      title="Select all"
                    />
                  </th>
                )}
                {orderedVisibleColumns.map((columnId) => {
                  // Skip subcontractor for subcontractors, budget for non-commercial
                  if (columnId === 'subcontractor' && isSubcontractor) return null
                  if (columnId === 'budget' && !canViewBudgets) return null

                  const column = COLUMN_CONFIG.find(c => c.id === columnId)
                  if (!column) return null

                  // Sortable columns
                  if (['lotNumber', 'description', 'chainage', 'activityType', 'status'].includes(columnId)) {
                    return (
                      <SortableHeader key={columnId} field={columnId}>
                        {column.label}
                      </SortableHeader>
                    )
                  }

                  // Non-sortable columns with resize handle
                  return (
                    <th
                      key={columnId}
                      className="text-left p-3 font-medium relative group/resize"
                      style={{ width: columnWidths[columnId] || DEFAULT_COLUMN_WIDTHS[columnId] || 'auto', minWidth: 60 }}
                      data-testid={`column-header-${columnId}`}
                    >
                      <div className="pr-2">{column.label}</div>
                      {/* Resize handle */}
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 group-hover/resize:bg-muted-foreground/30"
                        onMouseDown={(e) => handleResizeStart(e, columnId)}
                        data-testid={`column-resize-${columnId}`}
                      />
                    </th>
                  )
                })}
                <th className="text-left p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayedLots.length === 0 ? (
                <tr>
                  <td colSpan={canDelete ? (isSubcontractor ? 7 : 9) : (isSubcontractor ? 6 : 8)} className="p-12 text-center">
                    {lots.length === 0 ? (
                      <div className="flex flex-col items-center gap-4">
                        <div className="text-5xl">📋</div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">
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
                            onClick={handleOpenCreateModal}
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
              ) : (
                displayedLots.map((lot) => (
                  <React.Fragment key={lot.id}>
                    <tr
                      className="border-b hover:bg-muted/25 cursor-pointer"
                      onMouseEnter={(e) => handleLotMouseEnter(lot.id, e)}
                      onMouseLeave={handleLotMouseLeave}
                      onContextMenu={(e) => handleContextMenu(e, lot)}
                    >
                      {canDelete && (
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleRowExpansion(lot.id)
                              }}
                              className="p-1 hover:bg-muted rounded transition-transform"
                              data-testid={`expand-row-${lot.id}`}
                              title={expandedRows.has(lot.id) ? 'Collapse details' : 'Expand details'}
                            >
                              {expandedRows.has(lot.id) ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </button>
                            {lot.status !== 'conformed' && lot.status !== 'claimed' && (
                              <input
                                type="checkbox"
                                checked={selectedLots.has(lot.id)}
                                onChange={() => handleSelectLot(lot.id)}
                                className="h-4 w-4 rounded border-gray-300"
                              />
                            )}
                          </div>
                        </td>
                      )}
                    {orderedVisibleColumns.map((columnId) => {
                      // Skip subcontractor for subcontractors, budget for non-commercial
                      if (columnId === 'subcontractor' && isSubcontractor) return null
                      if (columnId === 'budget' && !canViewBudgets) return null

                      switch (columnId) {
                        case 'lotNumber':
                          return (
                            <td key={columnId} className="p-3 font-medium">
                              {highlightSearchTerm(lot.lotNumber, searchQuery)}
                            </td>
                          )
                        case 'description':
                          return (
                            <td key={columnId} className="p-3 max-w-xs">
                              <span className="block truncate" title={lot.description || ''}>
                                {lot.description ? highlightSearchTerm(lot.description, searchQuery) : '—'}
                              </span>
                            </td>
                          )
                        case 'chainage':
                          return <td key={columnId} className="p-3">{formatChainage(lot)}</td>
                        case 'activityType':
                          return <td key={columnId} className="p-3 capitalize">{lot.activityType || '—'}</td>
                        case 'status':
                          return (
                            <td key={columnId} className="p-3">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[lot.status] || 'bg-gray-100'}`}>
                                {lot.status.replace('_', ' ')}
                              </span>
                            </td>
                          )
                        case 'subcontractor':
                          return <td key={columnId} className="p-3">{lot.assignedSubcontractor?.companyName || '—'}</td>
                        case 'budget':
                          return <td key={columnId} className="p-3">{lot.budgetAmount ? `$${lot.budgetAmount.toLocaleString()}` : '—'}</td>
                        default:
                          return null
                      }
                    })}
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <button
                          className="text-sm text-primary hover:underline px-2 py-3 min-h-[44px] touch-manipulation"
                          onClick={() => navigate(`/projects/${projectId}/lots/${lot.id}`, {
                            state: { returnFilters: searchParams.toString() }
                          })}
                        >
                          View
                        </button>
                        {canCreate && lot.status !== 'conformed' && lot.status !== 'claimed' && (
                          <button
                            className="text-sm text-amber-600 hover:underline px-2 py-3 min-h-[44px] touch-manipulation"
                            onClick={() => navigate(`/projects/${projectId}/lots/${lot.id}/edit`)}
                          >
                            Edit
                          </button>
                        )}
                        {canCreate && (
                          <button
                            className="text-sm text-blue-600 hover:underline px-2 py-3 min-h-[44px] touch-manipulation"
                            onClick={() => handleCloneLot(lot)}
                            title="Clone lot with adjacent chainage"
                          >
                            Clone
                          </button>
                        )}
                        {canDelete && lot.status !== 'conformed' && lot.status !== 'claimed' && (
                          <button
                            className="text-sm text-red-600 hover:underline px-2 py-3 min-h-[44px] touch-manipulation"
                            onClick={() => handleDeleteClick(lot)}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                    </tr>
                    {/* Expanded detail row */}
                    {expandedRows.has(lot.id) && (
                      <tr className="bg-muted/30 border-b animate-in fade-in slide-in-from-top-2 duration-200" data-testid={`expanded-row-${lot.id}`}>
                        <td colSpan={canDelete ? (isSubcontractor ? 7 : 9) : (isSubcontractor ? 6 : 8)} className="p-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            {/* Dates Section */}
                            <div className="space-y-2">
                              <h4 className="font-semibold flex items-center gap-2">
                                <Calendar className="h-4 w-4" />
                                Dates
                              </h4>
                              <div className="space-y-1 text-muted-foreground">
                                <p>Created: {lot.createdAt ? new Date(lot.createdAt).toLocaleDateString() : '—'}</p>
                                <p>Updated: {lot.updatedAt ? new Date(lot.updatedAt).toLocaleDateString() : '—'}</p>
                              </div>
                            </div>

                            {/* Linked Items Section */}
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

                            {/* Status & Quality Section */}
                            <div className="space-y-2">
                              <h4 className="font-semibold flex items-center gap-2">
                                <TestTube className="h-4 w-4" />
                                Quality
                              </h4>
                              <div className="space-y-1 text-muted-foreground">
                                <p className="flex items-center gap-1">
                                  {(lot.ncrCount ?? 0) > 0 && (
                                    <AlertTriangle className="h-3 w-3 text-amber-500" />
                                  )}
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
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>

          {/* Infinite Scroll - Load More Indicator */}
          <div ref={loadMoreRef} className="border-t p-4">
            {loadingMore && (
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-sm">Loading more lots...</span>
              </div>
            )}
            {!loadingMore && hasMore && (
              <div className="text-center text-sm text-muted-foreground">
                Showing {displayedLots.length} of {filteredLots.length} lots • Scroll down to load more
              </div>
            )}
            {!hasMore && filteredLots.length > 0 && (
              <div className="text-center text-sm text-muted-foreground">
                Showing all {filteredLots.length} lots
              </div>
            )}
          </div>
        </div>
      )}

      {/* Card View - Also shows on mobile when list view is selected */}
      {!loading && !error && (viewMode === 'card' || (viewMode === 'list' && isMobile)) && (
        <div className="overflow-auto max-h-[calc(100vh-280px)]" data-testid="card-view-container">
          {displayedLots.length === 0 ? (
            <div className="rounded-lg border p-12 text-center">
              {lots.length === 0 ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="text-5xl">📋</div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {isSubcontractor ? 'No lots assigned yet' : 'No lots yet'}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {isSubcontractor
                        ? 'No lots have been assigned to your company for this project.'
                        : 'Get started by creating your first lot for this project.'}
                    </p>
                  </div>
                </div>
              ) : (
                <span className="text-muted-foreground">No lots match the current filters.</span>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="card-grid">
              {displayedLots.map((lot) => (
                <div
                  key={lot.id}
                  className="rounded-lg border bg-card p-4 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => navigate(`/projects/${projectId}/lots/${lot.id}`)}
                  onContextMenu={(e) => handleContextMenu(e, lot)}
                  data-testid={`lot-card-${lot.id}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-lg">{lot.lotNumber}</h3>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[lot.status] || 'bg-gray-100'}`}>
                      {lot.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {lot.description || 'No description'}
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {lot.activityType && (
                      <span className="flex items-center gap-1 bg-muted px-2 py-0.5 rounded">
                        {lot.activityType}
                      </span>
                    )}
                    {(lot.chainageStart != null || lot.chainageEnd != null) && (
                      <span className="flex items-center gap-1 bg-muted px-2 py-0.5 rounded">
                        <MapPin className="h-3 w-3" />
                        {formatChainage(lot)}
                      </span>
                    )}
                    {lot.areaZone && (
                      <span className="bg-muted px-2 py-0.5 rounded">
                        {lot.areaZone}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t text-xs text-muted-foreground">
                    <div className="flex gap-3">
                      <span>{lot.itpCount ?? 0} ITPs</span>
                      <span>{lot.testCount ?? 0} Tests</span>
                      {(lot.ncrCount ?? 0) > 0 && (
                        <span className="text-amber-600 flex items-center gap-0.5">
                          <AlertTriangle className="h-3 w-3" />
                          {lot.ncrCount} NCRs
                        </span>
                      )}
                    </div>
                    <span>{lot.createdAt ? new Date(lot.createdAt).toLocaleDateString() : ''}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* Infinite Scroll for Card View */}
          <div ref={loadMoreRef} className="p-4">
            {loadingMore && (
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-sm">Loading more lots...</span>
              </div>
            )}
            {!loadingMore && hasMore && (
              <div className="text-center text-sm text-muted-foreground">
                Showing {displayedLots.length} of {filteredLots.length} lots • Scroll down to load more
              </div>
            )}
            {!hasMore && filteredLots.length > 0 && (
              <div className="text-center text-sm text-muted-foreground">
                Showing all {filteredLots.length} lots
              </div>
            )}
          </div>
        </div>
      )}

      {/* Feature #151 - Linear Map View */}
      {!loading && !error && viewMode === 'linear' && (
        <div className="rounded-lg border overflow-hidden" data-testid="linear-map-view">
          {filteredLots.filter(l => l.chainageStart !== null || l.chainageEnd !== null).length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-5xl mb-4">🗺️</div>
              <h3 className="text-lg font-semibold text-gray-900">No chainage data</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Add chainage values to lots to see them on the linear map.
              </p>
            </div>
          ) : (
            <LinearMapView
              lots={filteredLots}
              onLotClick={(lot) => navigate(`/projects/${projectId}/lots/${lot.id}`)}
              statusColors={statusColors}
              areas={projectAreas}  // Feature #708 - Pass project areas for background highlighting
            />
          )}
        </div>
      )}

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
                {searchQuery && <li>Search: "{searchQuery}"</li>}
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

      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 min-w-[160px] rounded-lg border bg-white shadow-lg py-1"
          style={{
            top: Math.min(contextMenu.y, window.innerHeight - 200),
            left: Math.min(contextMenu.x, window.innerWidth - 180),
          }}
        >
          <button
            className="w-full px-4 py-2 text-left text-sm hover:bg-muted flex items-center gap-2"
            onClick={() => {
              navigate(`/projects/${projectId}/lots/${contextMenu.lot.id}`, {
                state: { returnFilters: searchParams.toString() }
              })
              closeContextMenu()
            }}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            View Details
          </button>
          {canCreate && contextMenu.lot.status !== 'conformed' && contextMenu.lot.status !== 'claimed' && (
            <button
              className="w-full px-4 py-2 text-left text-sm hover:bg-muted flex items-center gap-2"
              onClick={() => {
                navigate(`/projects/${projectId}/lots/${contextMenu.lot.id}/edit`)
                closeContextMenu()
              }}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit Lot
            </button>
          )}
          {canCreate && (
            <button
              className="w-full px-4 py-2 text-left text-sm hover:bg-muted flex items-center gap-2"
              onClick={() => {
                handleCloneLot(contextMenu.lot)
                closeContextMenu()
              }}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Clone Lot
            </button>
          )}
          <div className="border-t my-1" />
          <button
            className="w-full px-4 py-2 text-left text-sm hover:bg-muted flex items-center gap-2"
            onClick={() => {
              navigator.clipboard.writeText(`${window.location.origin}/projects/${projectId}/lots/${contextMenu.lot.id}`)
              toast({ title: 'Link Copied', description: 'Lot link copied to clipboard', variant: 'success' })
              closeContextMenu()
            }}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
            </svg>
            Copy Link
          </button>
          {canDelete && contextMenu.lot.status !== 'conformed' && contextMenu.lot.status !== 'claimed' && (
            <>
              <div className="border-t my-1" />
              <button
                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                onClick={() => {
                  handleDeleteClick(contextMenu.lot)
                  closeContextMenu()
                }}
              >
                <Trash2 className="h-4 w-4" />
                Delete Lot
              </button>
            </>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && lotToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900">Confirm Deletion</h2>
            <p className="mt-2 text-sm text-gray-600">
              Are you sure you want to delete lot{' '}
              <span className="font-semibold text-gray-900">{lotToDelete.lotNumber}</span>?
            </p>
            {lotToDelete.description && (
              <p className="mt-1 text-sm text-gray-500">
                "{lotToDelete.description}"
              </p>
            )}
            <p className="mt-3 text-sm text-red-600">
              This action cannot be undone. All associated data will be permanently deleted.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={handleCancelDelete}
                disabled={deleting}
                className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete Lot'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lot Quick View Popup */}
      {quickViewLot && projectId && (
        <LotQuickView
          lotId={quickViewLot.id}
          projectId={projectId}
          position={quickViewLot.position}
          onClose={handleQuickViewClose}
        />
      )}

      {/* Bulk Delete Confirmation Modal */}
      {bulkDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900">Confirm Bulk Deletion</h2>
            <p className="mt-2 text-sm text-gray-600">
              Are you sure you want to delete{' '}
              <span className="font-semibold text-gray-900">{selectedLots.size} lot(s)</span>?
            </p>
            <p className="mt-3 text-sm text-red-600">
              This action cannot be undone. All associated data will be permanently deleted.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setBulkDeleteModalOpen(false)}
                disabled={bulkDeleting}
                className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
              >
                {bulkDeleting ? 'Deleting...' : `Delete ${selectedLots.size} Lot(s)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Status Update Modal */}
      {bulkStatusModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900">Update Lot Status</h2>
            <p className="mt-2 text-sm text-gray-600">
              Update status for{' '}
              <span className="font-semibold text-gray-900">{selectedLots.size} lot(s)</span>
            </p>
            <div className="mt-4">
              <label htmlFor="bulk-status-select" className="block text-sm font-medium text-gray-700 mb-1">
                New Status
              </label>
              <select
                id="bulk-status-select"
                value={newBulkStatus}
                onChange={(e) => setNewBulkStatus(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="not_started">Not Started</option>
                <option value="in_progress">In Progress</option>
                <option value="awaiting_test">Awaiting Test</option>
                <option value="hold_point">Hold Point</option>
                <option value="ncr_raised">NCR Raised</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setBulkStatusModalOpen(false)}
                disabled={bulkStatusUpdating}
                className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkStatusUpdate}
                disabled={bulkStatusUpdating}
                className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {bulkStatusUpdating ? 'Updating...' : 'Update Status'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Assign Subcontractor Modal */}
      {bulkAssignModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setBulkAssignModalOpen(false)
            }
          }}
        >
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Assign Subcontractor</h2>
            <p className="text-sm text-gray-600 mb-4">
              Assign {selectedLots.size} selected lot(s) to a subcontractor.
            </p>
            <div className="mb-4">
              <label htmlFor="bulk-subcontractor" className="block text-sm font-medium text-gray-700 mb-1">
                Subcontractor
              </label>
              <select
                id="bulk-subcontractor"
                value={selectedSubcontractorId}
                onChange={(e) => setSelectedSubcontractorId(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">-- Unassign --</option>
                {subcontractors.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.companyName}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setBulkAssignModalOpen(false)}
                disabled={bulkAssigning}
                className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkAssignSubcontractor}
                disabled={bulkAssigning}
                className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {bulkAssigning ? 'Assigning...' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Lot Modal */}
      {createModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={handleBackdropClick}
        >
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Create New Lot</h2>
              <button
                onClick={handleCloseCreateModal}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close modal"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="lot-number" className="block text-sm font-medium text-gray-700">
                  Lot Number <span className="text-red-500">*</span>
                  <span className="text-xs text-gray-500 ml-2">({LOT_NUMBER_MIN_LENGTH}-{LOT_NUMBER_MAX_LENGTH} chars)</span>
                </label>
                <input
                  id="lot-number"
                  type="text"
                  value={newLot.lotNumber}
                  onChange={(e) => {
                    setNewLot((prev) => ({ ...prev, lotNumber: e.target.value }))
                    if (lotNumberTouched) {
                      setLotNumberError(validateLotNumber(e.target.value))
                    }
                  }}
                  onBlur={() => {
                    setLotNumberTouched(true)
                    setLotNumberError(validateLotNumber(newLot.lotNumber))
                  }}
                  maxLength={LOT_NUMBER_MAX_LENGTH}
                  className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                    lotNumberTouched && lotNumberError
                      ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                      : 'focus:border-primary focus:ring-primary'
                  }`}
                  placeholder="e.g., LOT-001"
                />
                {lotNumberTouched && lotNumberError && (
                  <p className="text-sm text-red-600 mt-1" role="alert" aria-live="assertive">{lotNumberError}</p>
                )}
              </div>

              <div>
                <label htmlFor="lot-description" className="block text-sm font-medium text-gray-700">
                  Description
                </label>
                <input
                  id="lot-description"
                  type="text"
                  value={newLot.description}
                  onChange={(e) => setNewLot((prev) => ({ ...prev, description: e.target.value }))}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Optional description"
                />
              </div>

              <div>
                <label htmlFor="lot-activity" className="block text-sm font-medium text-gray-700">
                  Activity Type
                </label>
                <select
                  id="lot-activity"
                  value={newLot.activityType}
                  onChange={(e) => handleActivityTypeChange(e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="Earthworks">Earthworks</option>
                  <option value="Concrete">Concrete</option>
                  <option value="Drainage">Drainage</option>
                  <option value="Pavement">Pavement</option>
                  <option value="Structures">Structures</option>
                  <option value="Utilities">Utilities</option>
                </select>
              </div>

              {/* ITP Template suggestion */}
              {suggestedTemplate && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <p className="text-sm text-blue-800">
                    <span className="font-medium">Suggested ITP Template:</span>{' '}
                    {suggestedTemplate.name}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="use-suggested-itp"
                      checked={selectedTemplateId === suggestedTemplate.id}
                      onChange={(e) => setSelectedTemplateId(e.target.checked ? suggestedTemplate.id : '')}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <label htmlFor="use-suggested-itp" className="text-sm text-blue-700">
                      Assign this ITP template to the lot
                    </label>
                  </div>
                </div>
              )}

              {/* ITP template dropdown for manual selection */}
              <div>
                <label htmlFor="lot-itp-template" className="block text-sm font-medium text-gray-700">
                  ITP Template (Optional)
                </label>
                <select
                  id="lot-itp-template"
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">No ITP template</option>
                  {itpTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name} ({template.activityType})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="chainage-start" className="block text-sm font-medium text-gray-700">
                    Chainage Start
                  </label>
                  <input
                    id="chainage-start"
                    type="number"
                    value={newLot.chainageStart}
                    onChange={(e) => handleChainageStartChange(e.target.value)}
                    min={CHAINAGE_MIN}
                    max={CHAINAGE_MAX}
                    className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                      chainageError
                        ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                        : 'focus:border-primary focus:ring-primary'
                    }`}
                    placeholder="e.g., 0"
                  />
                </div>
                <div>
                  <label htmlFor="chainage-end" className="block text-sm font-medium text-gray-700">
                    Chainage End
                  </label>
                  <input
                    id="chainage-end"
                    type="number"
                    value={newLot.chainageEnd}
                    onChange={(e) => handleChainageEndChange(e.target.value)}
                    min={CHAINAGE_MIN}
                    max={CHAINAGE_MAX}
                    className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                      chainageError
                        ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                        : 'focus:border-primary focus:ring-primary'
                    }`}
                    placeholder="e.g., 100"
                  />
                </div>
              </div>
              {chainageError && (
                <p className="text-sm text-red-600 mt-1" role="alert" aria-live="assertive">{chainageError}</p>
              )}

              {/* Subcontractor assignment */}
              {subcontractors.length > 0 && (
                <div>
                  <label htmlFor="lot-subcontractor" className="block text-sm font-medium text-gray-700">
                    Assign to Subcontractor (Optional)
                  </label>
                  <select
                    id="lot-subcontractor"
                    value={newLot.assignedSubcontractorId}
                    onChange={(e) => setNewLot((prev) => ({ ...prev, assignedSubcontractorId: e.target.value }))}
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">No subcontractor assigned</option>
                    {subcontractors.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.companyName}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={handleCloseCreateModal}
                disabled={creating}
                className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateLot}
                disabled={creating || !newLot.lotNumber.trim() || !!chainageError}
                className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? 'Creating...' : 'Create Lot'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Create Lots Wizard */}
      {bulkWizardOpen && projectId && (
        <BulkCreateLotsWizard
          projectId={projectId}
          onClose={() => setBulkWizardOpen(false)}
          onSuccess={handleBulkCreateSuccess}
        />
      )}

      {/* Import Lots Modal */}
      {importModalOpen && projectId && (
        <ImportLotsModal
          projectId={projectId}
          onClose={() => setImportModalOpen(false)}
          onSuccess={() => {
            setImportModalOpen(false)
            fetchLots()
          }}
        />
      )}

      {/* Export Lots Modal */}
      {exportModalOpen && projectId && (
        <ExportLotsModal
          projectId={projectId}
          lots={filteredLots}
          canViewBudgets={canViewBudgets}
          isSubcontractor={isSubcontractor}
          onClose={() => setExportModalOpen(false)}
        />
      )}

      {/* Print Labels Modal */}
      {printLabelsModalOpen && projectId && (
        <PrintLabelsModal
          lots={lots.filter(lot => selectedLots.has(lot.id))}
          projectId={projectId}
          onClose={() => setPrintLabelsModalOpen(false)}
        />
      )}
    </div>
  )
}
