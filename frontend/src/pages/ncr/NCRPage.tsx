import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth, getAuthToken } from '../../lib/auth'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3004'

interface NCR {
  id: string
  ncrNumber: string
  description: string
  category: string
  severity: 'minor' | 'major'
  status: string
  qmApprovalRequired: boolean
  qmApprovedAt: string | null
  qmApprovedBy?: { fullName: string; email: string } | null
  raisedBy: { fullName: string; email: string }
  responsibleUser?: { fullName: string; email: string } | null
  dueDate?: string
  createdAt: string
  project: { name: string; projectNumber: string }
  ncrLots: Array<{ lot: { lotNumber: string; description: string } }>
}

interface UserRole {
  role: string
  isQualityManager: boolean
  canApproveNCRs: boolean
}

export function NCRPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const token = getAuthToken()
  const [ncrs, setNcrs] = useState<NCR[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const [selectedNcr, setSelectedNcr] = useState<NCR | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showCloseModal, setShowCloseModal] = useState(false)
  const [showConcessionModal, setShowConcessionModal] = useState(false)
  const [showRespondModal, setShowRespondModal] = useState(false)
  const [respondingNcr, setRespondingNcr] = useState<NCR | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [responsibleFilter, setResponsibleFilter] = useState<string>('')
  const [dateFromFilter, setDateFromFilter] = useState<string>('')
  const [dateToFilter, setDateToFilter] = useState<string>('')

  // Get unique values for filter dropdowns
  const uniqueStatuses = [...new Set(ncrs.map(ncr => ncr.status))]
  const uniqueCategories = [...new Set(ncrs.map(ncr => ncr.category))]
  const uniqueResponsible = [...new Set(ncrs.map(ncr =>
    ncr.responsibleUser?.fullName || ncr.responsibleUser?.email || 'Unassigned'
  ))]

  // Apply filters to NCRs
  const filteredNcrs = ncrs.filter(ncr => {
    // Status filter
    if (statusFilter && ncr.status !== statusFilter) return false

    // Category filter
    if (categoryFilter && ncr.category !== categoryFilter) return false

    // Responsible filter
    if (responsibleFilter) {
      const responsibleName = ncr.responsibleUser?.fullName || ncr.responsibleUser?.email || 'Unassigned'
      if (responsibleName !== responsibleFilter) return false
    }

    // Date range filter
    if (dateFromFilter) {
      const ncrDate = new Date(ncr.createdAt)
      const fromDate = new Date(dateFromFilter)
      if (ncrDate < fromDate) return false
    }

    if (dateToFilter) {
      const ncrDate = new Date(ncr.createdAt)
      const toDate = new Date(dateToFilter)
      toDate.setHours(23, 59, 59, 999) // Include the entire day
      if (ncrDate > toDate) return false
    }

    return true
  })

  // Fetch NCRs
  const fetchNcrs = async () => {
    try {
      setLoading(true)
      const url = projectId
        ? `${API_URL}/api/ncrs?projectId=${projectId}`
        : `${API_URL}/api/ncrs`

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch NCRs')
      }

      const data = await response.json()
      setNcrs(data.ncrs)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load NCRs')
    } finally {
      setLoading(false)
    }
  }

  // Check user role
  const checkUserRole = async () => {
    if (!projectId) return

    try {
      const response = await fetch(`${API_URL}/api/ncrs/check-role/${projectId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setUserRole(data)
      }
    } catch (err) {
      console.error('Failed to check user role:', err)
    }
  }

  useEffect(() => {
    if (token) {
      fetchNcrs()
      checkUserRole()
    }
  }, [token, projectId])

  // Create NCR
  const handleCreateNcr = async (formData: {
    description: string
    category: string
    severity: string
    specificationReference?: string
    lotIds?: string[]
    dueDate?: string
  }) => {
    if (!projectId) return

    setActionLoading(true)
    try {
      const response = await fetch(`${API_URL}/api/ncrs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          ...formData,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Failed to create NCR')
      }

      setShowCreateModal(false)
      setSuccessMessage('NCR created successfully')
      fetchNcrs()
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create NCR')
    } finally {
      setActionLoading(false)
    }
  }

  // Respond to NCR (root cause analysis)
  const handleRespond = async (ncrId: string, responseData: {
    rootCauseCategory: string
    rootCauseDescription: string
    proposedCorrectiveAction: string
  }) => {
    setActionLoading(true)
    try {
      const response = await fetch(`${API_URL}/api/ncrs/${ncrId}/respond`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(responseData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to submit response')
      }

      setShowRespondModal(false)
      setRespondingNcr(null)
      setSuccessMessage('NCR response submitted - status changed to Investigating')
      fetchNcrs()
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit response')
    } finally {
      setActionLoading(false)
    }
  }

  // Request QM Approval
  const handleRequestQmApproval = async (ncrId: string) => {
    setActionLoading(true)
    try {
      const response = await fetch(`${API_URL}/api/ncrs/${ncrId}/qm-approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to approve NCR')
      }

      setSuccessMessage(data.message || 'QM approval granted')
      fetchNcrs()
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve NCR')
    } finally {
      setActionLoading(false)
    }
  }

  // Close NCR
  const handleCloseNcr = async (ncrId: string, verificationNotes: string) => {
    setActionLoading(true)
    try {
      const response = await fetch(`${API_URL}/api/ncrs/${ncrId}/close`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ verificationNotes }),
      })

      const data = await response.json()

      if (!response.ok) {
        // Handle specific error for major NCR requiring QM approval
        if (data.requiresQmApproval) {
          throw new Error('Major NCRs require Quality Manager approval before closure. Please request QM approval first.')
        }
        throw new Error(data.message || 'Failed to close NCR')
      }

      setShowCloseModal(false)
      setSelectedNcr(null)
      setSuccessMessage(data.message || 'NCR closed successfully')
      fetchNcrs()
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to close NCR')
    } finally {
      setActionLoading(false)
    }
  }

  // Close NCR with Concession
  const handleCloseWithConcession = async (
    ncrId: string,
    data: {
      concessionJustification: string
      concessionRiskAssessment: string
      clientApprovalDocId?: string
      verificationNotes?: string
    }
  ) => {
    setActionLoading(true)
    try {
      const response = await fetch(`${API_URL}/api/ncrs/${ncrId}/close`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          withConcession: true,
          concessionJustification: data.concessionJustification,
          concessionRiskAssessment: data.concessionRiskAssessment,
          clientApprovalDocId: data.clientApprovalDocId,
          verificationNotes: data.verificationNotes,
        }),
      })

      const responseData = await response.json()

      if (!response.ok) {
        if (responseData.requiresQmApproval) {
          throw new Error('Major NCRs require Quality Manager approval before closure with concession.')
        }
        throw new Error(responseData.message || 'Failed to close NCR with concession')
      }

      setShowConcessionModal(false)
      setSelectedNcr(null)
      setSuccessMessage('NCR closed with concession successfully')
      fetchNcrs()
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to close NCR with concession')
    } finally {
      setActionLoading(false)
    }
  }

  // Submit rectification
  const handleRectify = async (ncrId: string) => {
    setActionLoading(true)
    try {
      const response = await fetch(`${API_URL}/api/ncrs/${ncrId}/rectify`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rectificationNotes: 'Rectification completed' }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Failed to submit rectification')
      }

      setSuccessMessage('Rectification submitted for verification')
      fetchNcrs()
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit rectification')
    } finally {
      setActionLoading(false)
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-red-100 text-red-800'
      case 'investigating':
        return 'bg-yellow-100 text-yellow-800'
      case 'rectification':
        return 'bg-orange-100 text-orange-800'
      case 'verification':
        return 'bg-blue-100 text-blue-800'
      case 'closed':
        return 'bg-green-100 text-green-800'
      case 'closed_concession':
        return 'bg-green-100 text-green-700'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getSeverityBadgeColor = (severity: string) => {
    return severity === 'major'
      ? 'bg-red-500 text-white font-bold'
      : 'bg-yellow-100 text-yellow-800'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Non-Conformance Reports</h1>
          <p className="text-muted-foreground mt-1">
            {projectId ? 'Manage NCR lifecycle for this project' : 'All NCRs across your projects'}
          </p>
        </div>
        {projectId && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Raise NCR
          </button>
        )}
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-700 hover:text-red-900">&times;</button>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {successMessage}
        </div>
      )}

      {/* User Role Info */}
      {userRole && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg text-sm">
          Your role: <span className="font-medium">{userRole.role}</span>
          {userRole.isQualityManager && (
            <span className="ml-2 text-green-600">(Can approve major NCR closures)</span>
          )}
        </div>
      )}

      {/* Filters */}
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
          {(statusFilter || categoryFilter || responsibleFilter || dateFromFilter || dateToFilter) && (
            <button
              onClick={() => {
                setStatusFilter('')
                setCategoryFilter('')
                setResponsibleFilter('')
                setDateFromFilter('')
                setDateToFilter('')
              }}
              className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground border rounded-lg hover:bg-muted/50"
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* Filter Results Summary */}
        {(statusFilter || categoryFilter || responsibleFilter || dateFromFilter || dateToFilter) && (
          <div className="mt-3 text-sm text-muted-foreground">
            Showing {filteredNcrs.length} of {ncrs.length} NCRs
          </div>
        )}
      </div>

      {/* NCR List */}
      {filteredNcrs.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-lg border">
          <svg className="mx-auto h-12 w-12 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="mt-2 text-lg font-medium">
            {ncrs.length === 0 ? 'No NCRs found' : 'No NCRs match your filters'}
          </h3>
          <p className="mt-1 text-muted-foreground">
            {ncrs.length === 0 ? 'Great! No non-conformances have been raised.' : 'Try adjusting your filter criteria.'}
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-lg border overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">NCR #</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Lots</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Description</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Category</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Responsible</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Due</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Age</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredNcrs.map((ncr) => {
                // Calculate age in days
                const ageInDays = Math.floor((Date.now() - new Date(ncr.createdAt).getTime()) / (1000 * 60 * 60 * 24))
                const isOverdue = ncr.dueDate && new Date(ncr.dueDate) < new Date() && ncr.status !== 'closed' && ncr.status !== 'closed_concession'

                return (
                <tr key={ncr.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3 font-mono text-sm">{ncr.ncrNumber}</td>
                  <td className="px-4 py-3 text-sm">
                    {ncr.ncrLots.length > 0 ? (
                      <span className="text-muted-foreground">
                        {ncr.ncrLots.map(nl => nl.lot.lotNumber).join(', ')}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="max-w-xs truncate" title={ncr.description}>{ncr.description}</div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className="capitalize">{ncr.category.replace(/_/g, ' ')}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs ${getStatusBadgeColor(ncr.status)}`}>
                      {ncr.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {ncr.responsibleUser ? (
                      ncr.responsibleUser.fullName || ncr.responsibleUser.email
                    ) : (
                      <span className="text-muted-foreground">Unassigned</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {ncr.dueDate ? (
                      <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
                        {new Date(ncr.dueDate).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={ageInDays > 14 ? 'text-amber-600 font-medium' : ''}>
                      {ageInDays}d
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {/* Respond Button for open NCRs */}
                      {ncr.status === 'open' && (
                        <button
                          onClick={() => {
                            setRespondingNcr(ncr)
                            setShowRespondModal(true)
                          }}
                          disabled={actionLoading}
                          className="px-3 py-1 text-xs bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50"
                        >
                          Respond
                        </button>
                      )}

                      {/* QM Approval Button for major NCRs */}
                      {ncr.severity === 'major' &&
                       !ncr.qmApprovedAt &&
                       ncr.status === 'verification' &&
                       userRole?.isQualityManager && (
                        <button
                          onClick={() => handleRequestQmApproval(ncr.id)}
                          disabled={actionLoading}
                          className="px-3 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                        >
                          QM Approve
                        </button>
                      )}

                      {/* Rectify Button */}
                      {(ncr.status === 'investigating' || ncr.status === 'rectification') && (
                        <button
                          onClick={() => handleRectify(ncr.id)}
                          disabled={actionLoading}
                          className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                          Submit Rectification
                        </button>
                      )}

                      {/* Close Button */}
                      {ncr.status === 'verification' && (
                        <button
                          onClick={() => {
                            setSelectedNcr(ncr)
                            setShowCloseModal(true)
                          }}
                          disabled={actionLoading || (ncr.severity === 'major' && !ncr.qmApprovedAt)}
                          className={`px-3 py-1 text-xs rounded disabled:opacity-50 ${
                            ncr.severity === 'major' && !ncr.qmApprovedAt
                              ? 'bg-gray-400 text-gray-700 cursor-not-allowed'
                              : 'bg-green-600 text-white hover:bg-green-700'
                          }`}
                          title={ncr.severity === 'major' && !ncr.qmApprovedAt ? 'Requires QM approval first' : 'Close NCR'}
                        >
                          Close
                        </button>
                      )}

                      {/* Close with Concession Button */}
                      {(ncr.status === 'verification' || ncr.status === 'rectification') && (
                        <button
                          onClick={() => {
                            setSelectedNcr(ncr)
                            setShowConcessionModal(true)
                          }}
                          disabled={actionLoading || (ncr.severity === 'major' && !ncr.qmApprovedAt)}
                          className={`px-3 py-1 text-xs rounded disabled:opacity-50 ${
                            ncr.severity === 'major' && !ncr.qmApprovedAt
                              ? 'bg-gray-400 text-gray-700 cursor-not-allowed'
                              : 'bg-amber-600 text-white hover:bg-amber-700'
                          }`}
                          title={ncr.severity === 'major' && !ncr.qmApprovedAt ? 'Requires QM approval first' : 'Close with concession when full rectification is not possible'}
                        >
                          Concession
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      )}

      {/* Create NCR Modal */}
      {showCreateModal && (
        <CreateNCRModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateNcr}
          loading={actionLoading}
          projectId={projectId}
        />
      )}

      {/* Close NCR Modal */}
      {showCloseModal && selectedNcr && (
        <CloseNCRModal
          ncr={selectedNcr}
          onClose={() => {
            setShowCloseModal(false)
            setSelectedNcr(null)
          }}
          onSubmit={(notes) => handleCloseNcr(selectedNcr.id, notes)}
          loading={actionLoading}
        />
      )}

      {/* Respond NCR Modal */}
      {showRespondModal && respondingNcr && (
        <RespondNCRModal
          ncr={respondingNcr}
          onClose={() => {
            setShowRespondModal(false)
            setRespondingNcr(null)
          }}
          onSubmit={(data) => handleRespond(respondingNcr.id, data)}
          loading={actionLoading}
        />
      )}

      {/* Close with Concession Modal */}
      {showConcessionModal && selectedNcr && (
        <ConcessionModal
          ncr={selectedNcr}
          onClose={() => {
            setShowConcessionModal(false)
            setSelectedNcr(null)
          }}
          onSubmit={(data) => handleCloseWithConcession(selectedNcr.id, data)}
          loading={actionLoading}
        />
      )}
    </div>
  )
}

// Create NCR Modal Component
function CreateNCRModal({
  onClose,
  onSubmit,
  loading,
  projectId,
}: {
  onClose: () => void
  onSubmit: (data: { description: string; category: string; severity: string; specificationReference?: string; lotIds?: string[]; dueDate?: string }) => void
  loading: boolean
  projectId?: string
}) {
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [severity, setSeverity] = useState('minor')
  const [specificationReference, setSpecificationReference] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [selectedLotIds, setSelectedLotIds] = useState<string[]>([])
  const [lots, setLots] = useState<Array<{ id: string; lotNumber: string; description: string }>>([])
  const [lotsLoading, setLotsLoading] = useState(true)
  const token = getAuthToken()

  // Fetch lots for this project
  useEffect(() => {
    const fetchLots = async () => {
      if (!projectId) {
        setLotsLoading(false)
        return
      }
      try {
        const response = await fetch(`${API_URL}/api/lots?projectId=${projectId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        })
        if (response.ok) {
          const data = await response.json()
          setLots(data.lots || [])
        }
      } catch (err) {
        console.error('Failed to fetch lots:', err)
      } finally {
        setLotsLoading(false)
      }
    }
    fetchLots()
  }, [projectId, token])

  const handleLotToggle = (lotId: string) => {
    setSelectedLotIds(prev =>
      prev.includes(lotId)
        ? prev.filter(id => id !== lotId)
        : [...prev, lotId]
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({ description, category, severity, specificationReference, lotIds: selectedLotIds.length > 0 ? selectedLotIds : undefined, dueDate: dueDate || undefined })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Raise Non-Conformance Report</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Description *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              rows={3}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Category *</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              required
            >
              <option value="">Select category</option>
              <option value="materials">Materials</option>
              <option value="workmanship">Workmanship</option>
              <option value="documentation">Documentation</option>
              <option value="process">Process</option>
              <option value="design">Design</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Affected Lots</label>
            {lotsLoading ? (
              <p className="text-sm text-muted-foreground">Loading lots...</p>
            ) : lots.length === 0 ? (
              <p className="text-sm text-muted-foreground">No lots available</p>
            ) : (
              <div className="border rounded-lg max-h-40 overflow-y-auto p-2 space-y-1">
                {lots.map((lot) => (
                  <label key={lot.id} className="flex items-center gap-2 p-1 hover:bg-muted/50 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedLotIds.includes(lot.id)}
                      onChange={() => handleLotToggle(lot.id)}
                      className="rounded"
                    />
                    <span className="text-sm">
                      <span className="font-medium">{lot.lotNumber}</span>
                      {lot.description && <span className="text-muted-foreground"> - {lot.description}</span>}
                    </span>
                  </label>
                ))}
              </div>
            )}
            {selectedLotIds.length > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                {selectedLotIds.length} lot{selectedLotIds.length > 1 ? 's' : ''} selected
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Severity *</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="severity"
                  value="minor"
                  checked={severity === 'minor'}
                  onChange={(e) => setSeverity(e.target.value)}
                />
                <span>Minor</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="severity"
                  value="major"
                  checked={severity === 'major'}
                  onChange={(e) => setSeverity(e.target.value)}
                />
                <span className="text-red-600 font-medium">Major</span>
              </label>
            </div>
            {severity === 'major' && (
              <p className="text-amber-600 text-sm mt-1">
                Major NCRs require Quality Manager approval before closure.
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Specification Reference</label>
            <input
              type="text"
              value={specificationReference}
              onChange={(e) => setSpecificationReference(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="e.g., MRTS05, Q6-2021"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border rounded-lg hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !description || !category}
              className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Raise NCR'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Close NCR Modal Component
function CloseNCRModal({
  ncr,
  onClose,
  onSubmit,
  loading,
}: {
  ncr: NCR
  onClose: () => void
  onSubmit: (notes: string) => void
  loading: boolean
}) {
  const [verificationNotes, setVerificationNotes] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(verificationNotes)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Close NCR {ncr.ncrNumber}</h2>

        {ncr.severity === 'major' && ncr.qmApprovedAt && (
          <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded-lg text-sm">
            QM Approval granted by {ncr.qmApprovedBy?.fullName || 'Quality Manager'}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Verification Notes</label>
            <textarea
              value={verificationNotes}
              onChange={(e) => setVerificationNotes(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              rows={3}
              placeholder="Notes about the verification and closure..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border rounded-lg hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? 'Closing...' : 'Close NCR'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Respond NCR Modal Component
function RespondNCRModal({
  ncr,
  onClose,
  onSubmit,
  loading,
}: {
  ncr: NCR
  onClose: () => void
  onSubmit: (data: { rootCauseCategory: string; rootCauseDescription: string; proposedCorrectiveAction: string }) => void
  loading: boolean
}) {
  const [rootCauseCategory, setRootCauseCategory] = useState('')
  const [rootCauseDescription, setRootCauseDescription] = useState('')
  const [proposedCorrectiveAction, setProposedCorrectiveAction] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({ rootCauseCategory, rootCauseDescription, proposedCorrectiveAction })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Respond to NCR {ncr.ncrNumber}</h2>

        <div className="mb-4 bg-gray-50 border border-gray-200 px-3 py-2 rounded-lg text-sm">
          <span className="font-medium">Issue:</span> {ncr.description}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Root Cause Category *</label>
            <select
              value={rootCauseCategory}
              onChange={(e) => setRootCauseCategory(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              required
            >
              <option value="">Select root cause category</option>
              <option value="human_error">Human Error</option>
              <option value="equipment">Equipment</option>
              <option value="materials">Materials</option>
              <option value="process">Process</option>
              <option value="training">Training</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Root Cause Description *</label>
            <textarea
              value={rootCauseDescription}
              onChange={(e) => setRootCauseDescription(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              rows={3}
              placeholder="Describe the root cause of this non-conformance..."
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Proposed Corrective Action *</label>
            <textarea
              value={proposedCorrectiveAction}
              onChange={(e) => setProposedCorrectiveAction(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              rows={3}
              placeholder="Describe the proposed corrective action to address this issue..."
              required
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border rounded-lg hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !rootCauseCategory || !rootCauseDescription || !proposedCorrectiveAction}
              className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
            >
              {loading ? 'Submitting...' : 'Submit Response'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Close with Concession Modal Component
function ConcessionModal({
  ncr,
  onClose,
  onSubmit,
  loading,
}: {
  ncr: NCR
  onClose: () => void
  onSubmit: (data: {
    concessionJustification: string
    concessionRiskAssessment: string
    clientApprovalDocId?: string
    verificationNotes?: string
  }) => void
  loading: boolean
}) {
  const [justification, setJustification] = useState('')
  const [riskAssessment, setRiskAssessment] = useState('')
  const [verificationNotes, setVerificationNotes] = useState('')
  const [clientApprovalConfirmed, setClientApprovalConfirmed] = useState(false)
  const [clientApprovalReference, setClientApprovalReference] = useState('')

  const isMajor = ncr.severity === 'major'
  const requiresClientApproval = isMajor

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (requiresClientApproval && !clientApprovalConfirmed) {
      return
    }
    onSubmit({
      concessionJustification: justification,
      concessionRiskAssessment: riskAssessment,
      verificationNotes: verificationNotes || undefined,
      clientApprovalDocId: clientApprovalReference || undefined,
    })
  }

  const isFormValid = justification && riskAssessment && (!requiresClientApproval || clientApprovalConfirmed)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-2">Close NCR with Concession</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Use this when full rectification is not possible and a concession is required.
        </p>

        {/* NCR Info */}
        <div className="mb-4 bg-gray-50 border border-gray-200 px-3 py-2 rounded-lg text-sm">
          <div className="font-medium">{ncr.ncrNumber}</div>
          <div className="text-muted-foreground">{ncr.description}</div>
          <div className="mt-1">
            <span className={`px-2 py-0.5 rounded text-xs ${
              ncr.severity === 'major' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
            }`}>
              {ncr.severity.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Warning for Major NCRs */}
        {isMajor && (
          <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 rounded-lg text-sm flex items-start gap-2">
            <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <strong>Major NCR - Client Approval Required</strong>
              <p className="mt-1">Closing a major NCR with concession requires documented client approval.</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Justification */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Concession Justification *
            </label>
            <p className="text-xs text-muted-foreground mb-1">
              Explain why full rectification is not possible
            </p>
            <textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              rows={3}
              placeholder="Describe why the non-conformance cannot be fully rectified..."
              required
            />
          </div>

          {/* Risk Assessment */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Risk Assessment *
            </label>
            <p className="text-xs text-muted-foreground mb-1">
              Assess the risk of accepting this concession
            </p>
            <textarea
              value={riskAssessment}
              onChange={(e) => setRiskAssessment(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              rows={3}
              placeholder="Describe the risk implications, mitigation measures, and impact on quality/safety..."
              required
            />
          </div>

          {/* Client Approval Section for Major NCRs */}
          {requiresClientApproval && (
            <div className="border border-amber-200 bg-amber-50 rounded-lg p-4">
              <label className="block text-sm font-medium mb-2 text-amber-900">
                Client Approval *
              </label>

              <div className="space-y-3">
                {/* Approval Reference/Document ID */}
                <div>
                  <label className="block text-xs text-amber-800 mb-1">
                    Approval Document Reference
                  </label>
                  <input
                    type="text"
                    value={clientApprovalReference}
                    onChange={(e) => setClientApprovalReference(e.target.value)}
                    className="w-full px-3 py-2 border border-amber-300 rounded-lg bg-white"
                    placeholder="e.g., Email ref, Letter ID, Document number..."
                  />
                </div>

                {/* Confirmation Checkbox */}
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={clientApprovalConfirmed}
                    onChange={(e) => setClientApprovalConfirmed(e.target.checked)}
                    className="mt-1 rounded border-amber-400"
                  />
                  <span className="text-sm text-amber-900">
                    I confirm that the client has been notified of this concession and has provided documented approval to proceed.
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Verification Notes (Optional) */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Verification Notes
            </label>
            <textarea
              value={verificationNotes}
              onChange={(e) => setVerificationNotes(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              rows={2}
              placeholder="Any additional verification notes..."
            />
          </div>

          {/* Status Info */}
          <div className="bg-gray-50 border border-gray-200 px-3 py-2 rounded-lg text-sm">
            <span className="text-muted-foreground">NCR will be closed with status: </span>
            <span className="font-medium text-green-700">CLOSED_CONCESSION</span>
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border rounded-lg hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !isFormValid}
              className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
            >
              {loading ? 'Closing...' : 'Close with Concession'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
