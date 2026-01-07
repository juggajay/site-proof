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
  const [actionLoading, setActionLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

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

      {/* NCR List */}
      {ncrs.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-lg border">
          <svg className="mx-auto h-12 w-12 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="mt-2 text-lg font-medium">No NCRs found</h3>
          <p className="mt-1 text-muted-foreground">Great! No non-conformances have been raised.</p>
        </div>
      ) : (
        <div className="bg-card rounded-lg border overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">NCR #</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Description</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Severity</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium">QM Approval</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Raised By</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {ncrs.map((ncr) => (
                <tr key={ncr.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3 font-mono text-sm">{ncr.ncrNumber}</td>
                  <td className="px-4 py-3">
                    <div className="max-w-xs truncate">{ncr.description}</div>
                    {ncr.ncrLots.length > 0 && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Lots: {ncr.ncrLots.map(nl => nl.lot.lotNumber).join(', ')}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs ${getSeverityBadgeColor(ncr.severity)}`}>
                      {ncr.severity.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs ${getStatusBadgeColor(ncr.status)}`}>
                      {ncr.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {ncr.severity === 'major' ? (
                      ncr.qmApprovedAt ? (
                        <span className="text-green-600 text-sm flex items-center gap-1">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          Approved
                        </span>
                      ) : (
                        <span className="text-amber-600 text-sm flex items-center gap-1">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd" />
                          </svg>
                          Required
                        </span>
                      )
                    ) : (
                      <span className="text-muted-foreground text-sm">N/A</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {ncr.raisedBy.fullName || ncr.raisedBy.email}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
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
                    </div>
                  </td>
                </tr>
              ))}
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
    </div>
  )
}

// Create NCR Modal Component
function CreateNCRModal({
  onClose,
  onSubmit,
  loading,
}: {
  onClose: () => void
  onSubmit: (data: { description: string; category: string; severity: string; specificationReference?: string }) => void
  loading: boolean
}) {
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [severity, setSeverity] = useState('minor')
  const [specificationReference, setSpecificationReference] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({ description, category, severity, specificationReference })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg">
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg">
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
