import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useEffect, useState, useMemo } from 'react'
import { useCommercialAccess } from '@/hooks/useCommercialAccess'
import { useSubcontractorAccess } from '@/hooks/useSubcontractorAccess'
import { useViewerAccess } from '@/hooks/useViewerAccess'
import { getAuthToken, useAuth } from '@/lib/auth'

// Roles that can delete lots
const LOT_DELETE_ROLES = ['owner', 'admin', 'project_manager']

// Pagination settings
const PAGE_SIZE = 5

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
  assignedSubcontractorName?: string | null
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

  // Get filter and pagination from URL
  const currentPage = parseInt(searchParams.get('page') || '1', 10)
  const statusFilter = searchParams.get('status') || ''
  const activityFilter = searchParams.get('activity') || ''

  // Check if user can delete lots
  const canDelete = user?.role ? LOT_DELETE_ROLES.includes(user.role) : false

  // Get unique activity types for filter dropdown
  const activityTypes = useMemo(() => {
    const types = new Set(lots.map((l) => l.activityType).filter(Boolean))
    return Array.from(types).sort()
  }, [lots])

  // Filter lots based on current filters
  const filteredLots = useMemo(() => {
    return lots.filter((lot) => {
      if (statusFilter && lot.status !== statusFilter) return false
      if (activityFilter && lot.activityType !== activityFilter) return false
      return true
    })
  }, [lots, statusFilter, activityFilter])

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

  const handlePageChange = (page: number) => {
    updateFilters({ page: page.toString() })
  }

  useEffect(() => {
    async function fetchLots() {
      if (!projectId) return

      const token = getAuthToken()
      if (!token) {
        navigate('/login')
        return
      }

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

      try {
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

    fetchLots()
  }, [projectId, navigate])

  // Format chainage for display
  const formatChainage = (lot: Lot) => {
    if (lot.chainageStart != null && lot.chainageEnd != null) {
      return lot.chainageStart === lot.chainageEnd
        ? `${lot.chainageStart}`
        : `${lot.chainageStart}-${lot.chainageEnd}`
    }
    return lot.chainageStart ?? lot.chainageEnd ?? '—'
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
    setCreateModalOpen(true)
  }

  const handleCloseCreateModal = () => {
    setCreateModalOpen(false)
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
      }
    }

    document.addEventListener('keydown', handleEscapeKey)
    return () => document.removeEventListener('keydown', handleEscapeKey)
  }, [createModalOpen, deleteModalOpen])

  // Handle create lot submission
  const handleCreateLot = async () => {
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

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Lot Register</h1>
        {!isSubcontractor && canCreate && (
          <button
            onClick={handleOpenCreateModal}
            className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
          >
            Create Lot
          </button>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        {isSubcontractor
          ? `Viewing lots assigned to your company for project ${projectId}.`
          : `Manage lots for project ${projectId}. The lot is the atomic unit of the system.`}
      </p>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label htmlFor="status-filter" className="text-sm font-medium">
            Status:
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => handleStatusFilter(e.target.value)}
            className="rounded-lg border bg-background px-3 py-1.5 text-sm"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="awaiting_test">Awaiting Test</option>
            <option value="hold_point">Hold Point</option>
            <option value="completed">Completed</option>
            <option value="conformed">Conformed</option>
            <option value="claimed">Claimed</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="activity-filter" className="text-sm font-medium">
            Activity:
          </label>
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
        </div>
        {(statusFilter || activityFilter) && (
          <button
            onClick={() => {
              updateFilters({ status: '', activity: '' })
            }}
            className="text-sm text-primary hover:underline"
          >
            Clear Filters
          </button>
        )}
        <span className="text-sm text-muted-foreground">
          Showing {filteredLots.length} of {lots.length} lots
        </span>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex h-32 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Lot Table */}
      {!loading && !error && (
        <div className="rounded-lg border">
          <table className="w-full">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">Lot Number</th>
                <th className="text-left p-3 font-medium">Description</th>
                <th className="text-left p-3 font-medium">Chainage</th>
                <th className="text-left p-3 font-medium">Activity Type</th>
                <th className="text-left p-3 font-medium">Status</th>
                {!isSubcontractor && (
                  <th className="text-left p-3 font-medium">Subcontractor</th>
                )}
                {canViewBudgets && (
                  <th className="text-left p-3 font-medium">Budget</th>
                )}
                <th className="text-left p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedLots.length === 0 ? (
                <tr>
                  <td colSpan={isSubcontractor ? 6 : 8} className="p-6 text-center text-muted-foreground">
                    {lots.length === 0
                      ? (isSubcontractor ? 'No lots assigned to your company yet.' : 'No lots created yet.')
                      : 'No lots match the current filters.'}
                  </td>
                </tr>
              ) : (
                paginatedLots.map((lot) => (
                  <tr key={lot.id} className="border-b hover:bg-muted/25">
                    <td className="p-3 font-medium">{lot.lotNumber}</td>
                    <td className="p-3">{lot.description || '—'}</td>
                    <td className="p-3">{formatChainage(lot)}</td>
                    <td className="p-3 capitalize">{lot.activityType || '—'}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[lot.status] || 'bg-gray-100'}`}>
                        {lot.status.replace('_', ' ')}
                      </span>
                    </td>
                    {!isSubcontractor && (
                      <td className="p-3">{lot.assignedSubcontractorName || '—'}</td>
                    )}
                    {canViewBudgets && (
                      <td className="p-3">{lot.budgetAmount ? `$${lot.budgetAmount.toLocaleString()}` : '—'}</td>
                    )}
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <button
                          className="text-sm text-primary hover:underline"
                          onClick={() => navigate(`/projects/${projectId}/lots/${lot.id}`)}
                        >
                          View
                        </button>
                        {canCreate && lot.status !== 'conformed' && lot.status !== 'claimed' && (
                          <button
                            className="text-sm text-amber-600 hover:underline"
                            onClick={() => navigate(`/projects/${projectId}/lots/${lot.id}/edit`)}
                          >
                            Edit
                          </button>
                        )}
                        {canDelete && lot.status !== 'conformed' && lot.status !== 'claimed' && (
                          <button
                            className="text-sm text-red-600 hover:underline"
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
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="rounded-lg border px-3 py-1 text-sm hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => handlePageChange(page)}
                    className={`rounded-lg px-3 py-1 text-sm ${
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
                  className="rounded-lg border px-3 py-1 text-sm hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
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

      {/* Create Lot Modal */}
      {createModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={handleBackdropClick}
        >
          <div className="mx-4 w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
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
                </label>
                <input
                  id="lot-number"
                  type="text"
                  value={newLot.lotNumber}
                  onChange={(e) => setNewLot((prev) => ({ ...prev, lotNumber: e.target.value }))}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="e.g., LOT-001"
                />
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
                    onChange={(e) => setNewLot((prev) => ({ ...prev, chainageStart: e.target.value }))}
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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
                    onChange={(e) => setNewLot((prev) => ({ ...prev, chainageEnd: e.target.value }))}
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="e.g., 100"
                  />
                </div>
              </div>
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
                disabled={creating || !newLot.lotNumber.trim()}
                className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create Lot'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
