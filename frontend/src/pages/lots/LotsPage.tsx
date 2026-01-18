import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useEffect, useState, useMemo } from 'react'
import { useCommercialAccess } from '@/hooks/useCommercialAccess'
import { useSubcontractorAccess } from '@/hooks/useSubcontractorAccess'
import { useViewerAccess } from '@/hooks/useViewerAccess'
import { getAuthToken, useAuth } from '@/lib/auth'
import { toast } from '@/components/ui/toaster'
import { BulkCreateLotsWizard } from '@/components/lots/BulkCreateLotsWizard'
import { Settings2, Check, ChevronUp, ChevronDown } from 'lucide-react'

// Roles that can delete lots
const LOT_DELETE_ROLES = ['owner', 'admin', 'project_manager']

// Pagination settings
const PAGE_SIZE = 5

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

interface Lot {
  id: string
  lotNumber: string
  description: string | null
  status: string
  activityType: string | null
  chainageStart: number | null
  chainageEnd: number | null
  offset: string | null
  layer: string | null
  areaZone: string | null
  budgetAmount?: number | null
  assignedSubcontractorId?: string | null
  assignedSubcontractor?: { companyName: string } | null
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  on_hold: 'bg-red-100 text-red-800',
}

export function LotsPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const { canViewBudgets } = useCommercialAccess()
  const { isSubcontractor } = useSubcontractorAccess()
  const { canCreate } = useViewerAccess()
  const [lots, setLots] = useState<Lot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [lotToDelete, setLotToDelete] = useState<Lot | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Create lot modal state
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newLot, setNewLot] = useState({
    lotNumber: '',
    description: '',
    activityType: 'Earthworks',
    chainageStart: '',
    chainageEnd: '',
  })
  const [chainageError, setChainageError] = useState<string | null>(null)
  const [lotNumberTouched, setLotNumberTouched] = useState(false)
  const [lotNumberError, setLotNumberError] = useState<string | null>(null)

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
  const currentPage = parseInt(searchParams.get('page') || '1', 10)
  const statusFilter = searchParams.get('status') || ''
  const activityFilter = searchParams.get('activity') || ''
  const searchQuery = searchParams.get('search') || ''
  const sortField = searchParams.get('sort') || 'lotNumber'
  const sortDirection = (searchParams.get('dir') || 'asc') as 'asc' | 'desc'

  // Check if user can delete lots
  const canDelete = user?.role ? LOT_DELETE_ROLES.includes(user.role) : false

  // Get unique activity types for filter dropdown
  const activityTypes = useMemo(() => {
    const types = new Set(lots.map((l) => l.activityType).filter(Boolean))
    return Array.from(types).sort()
  }, [lots])

  // Filter and sort lots based on current filters and sort order
  const filteredLots = useMemo(() => {
    const filtered = lots.filter((lot) => {
      if (statusFilter && lot.status !== statusFilter) return false
      if (activityFilter && lot.activityType !== activityFilter) return false
      // Case-insensitive search on lot number and description
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesLotNumber = lot.lotNumber.toLowerCase().includes(query)
        const matchesDescription = (lot.description || '').toLowerCase().includes(query)
        if (!matchesLotNumber && !matchesDescription) return false
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
  }, [lots, statusFilter, activityFilter, searchQuery, sortField, sortDirection])

  // Calculate pagination
  const totalPages = Math.ceil(filteredLots.length / PAGE_SIZE)
  const paginatedLots = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filteredLots.slice(start, start + PAGE_SIZE)
  }, [filteredLots, currentPage])

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

  const handleStatusFilter = (status: string) => {
    updateFilters({ status })
  }

  const handleActivityFilter = (activity: string) => {
    updateFilters({ activity })
  }

  const handleSearch = (query: string) => {
    updateFilters({ search: query })
  }

  const handlePageChange = (page: number) => {
    updateFilters({ page: page.toString() })
  }

  const handleSort = (field: string) => {
    // If clicking the same field, toggle direction; otherwise sort ascending
    if (field === sortField) {
      updateFilters({ dir: sortDirection === 'asc' ? 'desc' : 'asc', sort: field })
    } else {
      updateFilters({ sort: field, dir: 'asc' })
    }
  }

  // Sortable column header component
  const SortableHeader = ({ field, children }: { field: string; children: React.ReactNode }) => (
    <th
      className="text-left p-3 font-medium cursor-pointer hover:bg-muted/70 select-none"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <span className="text-muted-foreground">
          {sortField === field ? (
            sortDirection === 'asc' ? '↑' : '↓'
          ) : (
            <span className="opacity-0 group-hover:opacity-50">↕</span>
          )}
        </span>
      </div>
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
  const handleOpenCreateModal = () => {
    setNewLot({
      lotNumber: '',
      description: '',
      activityType: 'Earthworks',
      chainageStart: '',
      chainageEnd: '',
    })
    setChainageError(null)
    setCreateModalOpen(true)
  }

  const handleCloseCreateModal = () => {
    setCreateModalOpen(false)
    setLotNumberTouched(false)
    setNewLot({
      lotNumber: '',
      description: '',
      activityType: 'Earthworks',
      chainageStart: '',
      chainageEnd: '',
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
      }
    }

    document.addEventListener('keydown', handleEscapeKey)
    return () => document.removeEventListener('keydown', handleEscapeKey)
  }, [createModalOpen, deleteModalOpen, bulkWizardOpen, bulkDeleteModalOpen, bulkStatusModalOpen, bulkAssignModalOpen])

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

      // Show success toast with specific lot number
      toast({
        title: 'Lot Created',
        description: `Lot ${newLot.lotNumber} has been created successfully`,
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

  // Export lots to CSV
  const handleExportCSV = () => {
    // Define CSV headers
    const headers = ['Lot Number', 'Description', 'Chainage Start', 'Chainage End', 'Activity Type', 'Status']
    if (canViewBudgets) {
      headers.push('Budget')
    }
    if (!isSubcontractor) {
      headers.push('Subcontractor')
    }

    // Convert lots to CSV rows
    const rows = filteredLots.map((lot) => {
      const row = [
        lot.lotNumber,
        lot.description || '',
        lot.chainageStart?.toString() || '',
        lot.chainageEnd?.toString() || '',
        lot.activityType || '',
        lot.status,
      ]
      if (canViewBudgets) {
        row.push(lot.budgetAmount?.toString() || '')
      }
      if (!isSubcontractor) {
        row.push(lot.assignedSubcontractor?.companyName || '')
      }
      return row
    })

    // Escape CSV values (handle commas, quotes, newlines)
    const escapeCSV = (value: string) => {
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`
      }
      return value
    }

    // Build CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map(escapeCSV).join(','))
    ].join('\n')

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `lot-register-${projectId}-${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Handle bulk wizard success
  const handleBulkCreateSuccess = () => {
    setBulkWizardOpen(false)
    fetchLots() // Refresh the lot list
  }

  // Get deletable lots from current page (not conformed or claimed)
  const deletableLots = useMemo(() => {
    return paginatedLots.filter(lot => lot.status !== 'conformed' && lot.status !== 'claimed')
  }, [paginatedLots])

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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Lot Register</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            className="rounded-lg border border-primary px-4 py-2 text-sm text-primary hover:bg-primary/10"
          >
            Export CSV
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
          {!isSubcontractor && canCreate && (
            <>
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
          <label htmlFor="status-filter" className="text-sm font-medium">
            Status:
          </label>
          <div className="flex items-center">
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => handleStatusFilter(e.target.value)}
              className="rounded-lg border bg-background px-3 py-1.5 text-sm"
            >
              <option value="">All Statuses</option>
              <option value="not_started">Not Started</option>
              <option value="in_progress">In Progress</option>
              <option value="awaiting_test">Awaiting Test</option>
              <option value="hold_point">Hold Point</option>
              <option value="ncr_raised">NCR Raised</option>
              <option value="completed">Completed</option>
              <option value="conformed">Conformed</option>
              <option value="claimed">Claimed</option>
            </select>
            {statusFilter && (
              <button
                onClick={() => handleStatusFilter('')}
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
        {(statusFilter || activityFilter || searchQuery) && (
          <button
            onClick={() => {
              updateFilters({ status: '', activity: '', search: '' })
            }}
            className="text-sm text-primary hover:underline"
          >
            Clear All Filters
          </button>
        )}
        <span className="text-sm text-muted-foreground">
          Showing {filteredLots.length} of {lots.length} lots
        </span>

        {/* Column Settings */}
        <div className="relative ml-auto">
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

      {/* Loading State */}
      {loading && (
        <div className="flex h-32 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700" role="alert" aria-live="assertive">
          {error}
        </div>
      )}

      {/* Lot Table */}
      {!loading && !error && (
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="border-b bg-muted/50">
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

                  // Non-sortable columns
                  return (
                    <th key={columnId} className="text-left p-3 font-medium">
                      {column.label}
                    </th>
                  )
                })}
                <th className="text-left p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedLots.length === 0 ? (
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
                paginatedLots.map((lot) => (
                  <tr key={lot.id} className="border-b hover:bg-muted/25">
                    {canDelete && (
                      <td className="p-3">
                        {lot.status !== 'conformed' && lot.status !== 'claimed' && (
                          <input
                            type="checkbox"
                            checked={selectedLots.has(lot.id)}
                            onChange={() => handleSelectLot(lot.id)}
                            className="h-4 w-4 rounded border-gray-300"
                          />
                        )}
                      </td>
                    )}
                    {orderedVisibleColumns.map((columnId) => {
                      // Skip subcontractor for subcontractors, budget for non-commercial
                      if (columnId === 'subcontractor' && isSubcontractor) return null
                      if (columnId === 'budget' && !canViewBudgets) return null

                      switch (columnId) {
                        case 'lotNumber':
                          return <td key={columnId} className="p-3 font-medium">{lot.lotNumber}</td>
                        case 'description':
                          return (
                            <td key={columnId} className="p-3 max-w-xs">
                              <span className="block truncate" title={lot.description || ''}>
                                {lot.description || '—'}
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
                ))
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t p-4">
              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="rounded-lg border px-3 py-2 min-h-[44px] text-sm hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                >
                  Previous
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => handlePageChange(page)}
                    className={`rounded-lg px-3 py-2 min-h-[44px] min-w-[44px] text-sm touch-manipulation ${
                      page === currentPage
                        ? 'bg-primary text-primary-foreground'
                        : 'border hover:bg-muted'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="rounded-lg border px-3 py-2 min-h-[44px] text-sm hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                >
                  Next
                </button>
              </div>
            </div>
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
                  onChange={(e) => setNewLot((prev) => ({ ...prev, activityType: e.target.value }))}
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
    </div>
  )
}
