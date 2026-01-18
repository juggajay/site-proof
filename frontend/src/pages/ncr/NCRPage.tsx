import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth, getAuthToken } from '../../lib/auth'
import { toast } from '@/components/ui/toaster'
import { Link2, Check } from 'lucide-react'

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
  project: { id?: string; name: string; projectNumber: string }
  ncrLots: Array<{ lot: { lotNumber: string; description: string } }>
  clientNotificationRequired?: boolean // Feature #213
  clientNotifiedAt?: string | null // Feature #213
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
  const [copiedNcrId, setCopiedNcrId] = useState<string | null>(null)

  // Feature #213: Client notification state
  const [showNotifyClientModal, setShowNotifyClientModal] = useState(false)
  const [notifyingNcr, setNotifyingNcr] = useState<NCR | null>(null)
  const [notifyClientEmail, setNotifyClientEmail] = useState('')
  const [notifyClientMessage, setNotifyClientMessage] = useState('')
  const [notifyingClient, setNotifyingClient] = useState(false)

  // Feature #215: QM Review state
  const [showQmReviewModal, setShowQmReviewModal] = useState(false)
  const [reviewingNcr, setReviewingNcr] = useState<NCR | null>(null)
  const [qmReviewComments, setQmReviewComments] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)

  // Feature #216: Rectification evidence state
  const [showRectifyModal, setShowRectifyModal] = useState(false)
  const [rectifyingNcr, setRectifyingNcr] = useState<NCR | null>(null)
  const [rectificationNotes, setRectificationNotes] = useState('')
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([])
  const [uploadingEvidence, setUploadingEvidence] = useState(false)
  const [submittingRectification, setSubmittingRectification] = useState(false)

  // Feature #218: Reject rectification state
  const [showRejectRectificationModal, setShowRejectRectificationModal] = useState(false)
  const [rejectingRectificationNcr, setRejectingRectificationNcr] = useState<NCR | null>(null)
  const [rejectFeedback, setRejectFeedback] = useState('')
  const [rejectingRectification, setRejectingRectification] = useState(false)

  // Copy NCR link handler
  const handleCopyNcrLink = async (ncrId: string, ncrNumber: string) => {
    const url = `${window.location.origin}/projects/${projectId}/ncrs?ncr=${ncrId}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedNcrId(ncrId)
      toast({
        title: 'Link copied!',
        description: `Link to ${ncrNumber} has been copied to your clipboard.`,
      })
      setTimeout(() => setCopiedNcrId(null), 2000)
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = url
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopiedNcrId(ncrId)
      toast({
        title: 'Link copied!',
        description: `Link to ${ncrNumber} has been copied to your clipboard.`,
      })
      setTimeout(() => setCopiedNcrId(null), 2000)
    }
  }

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

    // Prevent concurrent submissions (double-click protection)
    if (actionLoading) return

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
    // Prevent concurrent submissions (double-click protection)
    if (actionLoading) return

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

  // Feature #216: Open rectification modal
  const openRectifyModal = (ncr: NCR) => {
    setRectifyingNcr(ncr)
    setRectificationNotes('')
    setEvidenceFiles([])
    setShowRectifyModal(true)
  }

  // Feature #216: Upload evidence file
  const handleEvidenceUpload = async (file: File, evidenceType: string) => {
    if (!rectifyingNcr) return

    setUploadingEvidence(true)
    try {
      // Create form data for file upload
      const formData = new FormData()
      formData.append('file', file)
      formData.append('projectId', rectifyingNcr.project?.id || projectId || '')

      // Upload the file first
      const uploadResponse = await fetch(`${API_URL}/api/documents/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      })

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file')
      }

      const uploadData = await uploadResponse.json()

      // Link the document to the NCR as evidence
      const evidenceResponse = await fetch(`${API_URL}/api/ncrs/${rectifyingNcr.id}/evidence`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentId: uploadData.document?.id,
          evidenceType,
          filename: file.name,
          fileSize: file.size,
          mimeType: file.type,
          projectId: rectifyingNcr.project?.id || projectId,
        }),
      })

      if (!evidenceResponse.ok) {
        throw new Error('Failed to link evidence to NCR')
      }

      toast({
        title: 'Evidence Uploaded',
        description: `${file.name} has been added as ${evidenceType} evidence`,
      })

      // Add to local state
      setEvidenceFiles(prev => [...prev, file])
    } catch (err) {
      toast({
        title: 'Upload Failed',
        description: err instanceof Error ? err.message : 'Failed to upload evidence',
        variant: 'error',
      })
    } finally {
      setUploadingEvidence(false)
    }
  }

  // Feature #216: Submit rectification with evidence
  const handleSubmitRectification = async () => {
    if (!rectifyingNcr) return

    setSubmittingRectification(true)
    try {
      const response = await fetch(`${API_URL}/api/ncrs/${rectifyingNcr.id}/submit-for-verification`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rectificationNotes }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Failed to submit rectification')
      }

      toast({
        title: 'Rectification Submitted',
        description: 'NCR has been submitted for verification',
      })
      setShowRectifyModal(false)
      setRectifyingNcr(null)
      setRectificationNotes('')
      setEvidenceFiles([])
      fetchNcrs()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to submit rectification',
        variant: 'error',
      })
    } finally {
      setSubmittingRectification(false)
    }
  }

  // Feature #218: Handle reject rectification
  const handleRejectRectification = async () => {
    if (!rejectingRectificationNcr || !rejectFeedback.trim()) {
      toast({
        title: 'Error',
        description: 'Feedback is required when rejecting rectification',
        variant: 'error',
      })
      return
    }

    setRejectingRectification(true)
    try {
      const response = await fetch(`${API_URL}/api/ncrs/${rejectingRectificationNcr.id}/reject-rectification`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ feedback: rejectFeedback }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Failed to reject rectification')
      }

      toast({
        title: 'Rectification Rejected',
        description: 'NCR has been returned to rectification status and responsible party notified',
      })
      setShowRejectRectificationModal(false)
      setRejectingRectificationNcr(null)
      setRejectFeedback('')
      fetchNcrs()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to reject rectification',
        variant: 'error',
      })
    } finally {
      setRejectingRectification(false)
    }
  }

  // Feature #213: Handle client notification
  const handleNotifyClient = async () => {
    if (!notifyingNcr) return

    setNotifyingClient(true)
    try {
      const response = await fetch(`${API_URL}/api/ncrs/${notifyingNcr.id}/notify-client`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipientEmail: notifyClientEmail || undefined,
          additionalMessage: notifyClientMessage || undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Failed to notify client')
      }

      const data = await response.json()
      toast({
        title: 'Client Notified',
        description: `Client notification sent for ${notifyingNcr.ncrNumber}`,
      })
      setShowNotifyClientModal(false)
      setNotifyingNcr(null)
      setNotifyClientEmail('')
      setNotifyClientMessage('')
      fetchNcrs()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to notify client',
        variant: 'error',
      })
    } finally {
      setNotifyingClient(false)
    }
  }

  // Feature #215: Handle QM review of NCR response
  const handleQmReview = async (action: 'accept' | 'request_revision') => {
    if (!reviewingNcr) return

    setSubmittingReview(true)
    try {
      const response = await fetch(`${API_URL}/api/ncrs/${reviewingNcr.id}/qm-review`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          comments: qmReviewComments || undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Failed to submit review')
      }

      const data = await response.json()
      toast({
        title: action === 'accept' ? 'Response Accepted' : 'Revision Requested',
        description: data.message,
      })
      setShowQmReviewModal(false)
      setReviewingNcr(null)
      setQmReviewComments('')
      fetchNcrs()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to submit review',
        variant: 'error',
      })
    } finally {
      setSubmittingReview(false)
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

  // Export NCRs to CSV
  const handleExportCSV = () => {
    const headers = ['NCR Number', 'Lots', 'Description', 'Category', 'Severity', 'Status', 'Responsible', 'Due Date', 'Created At']
    const rows = filteredNcrs.map(ncr => [
      ncr.ncrNumber,
      ncr.ncrLots.map(nl => nl.lot.lotNumber).join('; ') || '-',
      `"${ncr.description.replace(/"/g, '""')}"`,
      ncr.category,
      ncr.severity,
      ncr.status.replace('_', ' '),
      ncr.responsibleUser ? (ncr.responsibleUser.fullName || ncr.responsibleUser.email) : 'Unassigned',
      ncr.dueDate ? new Date(ncr.dueDate).toLocaleDateString() : '-',
      new Date(ncr.createdAt).toLocaleDateString()
    ])

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.setAttribute('download', `ncr-register-${projectId || 'all'}-${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
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
        <div className="flex gap-2">
          {filteredNcrs.length > 0 && (
            <button
              onClick={() => handleExportCSV()}
              className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              Export CSV
            </button>
          )}
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
        <div className="bg-card rounded-lg border overflow-x-auto">
          <table className="w-full min-w-[800px]">
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
                      {/* Copy Link Button */}
                      <button
                        onClick={() => handleCopyNcrLink(ncr.id, ncr.ncrNumber)}
                        className="p-1.5 text-xs border rounded hover:bg-muted/50 transition-colors"
                        title="Copy link to this NCR"
                      >
                        {copiedNcrId === ncr.id ? (
                          <Check className="h-3.5 w-3.5 text-green-600" />
                        ) : (
                          <Link2 className="h-3.5 w-3.5" />
                        )}
                      </button>
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

                      {/* Feature #215: QM Review Button for NCRs in investigating status */}
                      {ncr.status === 'investigating' &&
                       (userRole?.isQualityManager || userRole?.role === 'project_manager' || userRole?.role === 'admin') && (
                        <button
                          onClick={() => {
                            setReviewingNcr(ncr)
                            setShowQmReviewModal(true)
                          }}
                          disabled={actionLoading}
                          className="px-3 py-1 text-xs bg-cyan-600 text-white rounded hover:bg-cyan-700 disabled:opacity-50"
                          title="Review the submitted response"
                        >
                          Review Response
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

                      {/* Feature #213: Notify Client Button for major NCRs */}
                      {ncr.severity === 'major' &&
                       ncr.clientNotificationRequired &&
                       !ncr.clientNotifiedAt &&
                       (userRole?.role === 'project_manager' || userRole?.role === 'quality_manager' || userRole?.role === 'admin' || userRole?.role === 'owner') && (
                        <button
                          onClick={() => {
                            setNotifyingNcr(ncr)
                            setShowNotifyClientModal(true)
                          }}
                          disabled={actionLoading}
                          className="px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                          title="Notify client about this major NCR"
                        >
                          Notify Client
                        </button>
                      )}

                      {/* Client Notified Badge */}
                      {ncr.clientNotifiedAt && (
                        <span className="px-2 py-0.5 text-xs bg-indigo-100 text-indigo-800 rounded" title={`Client notified on ${new Date(ncr.clientNotifiedAt).toLocaleDateString()}`}>
                          ✓ Client Notified
                        </span>
                      )}

                      {/* Feature #216: Rectify Button - opens modal with evidence upload */}
                      {(ncr.status === 'investigating' || ncr.status === 'rectification') && (
                        <button
                          onClick={() => openRectifyModal(ncr)}
                          disabled={actionLoading}
                          className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                          Submit Rectification
                        </button>
                      )}

                      {/* Feature #218: Reject Rectification Button */}
                      {ncr.status === 'verification' &&
                       (userRole?.isQualityManager || userRole?.role === 'project_manager' || userRole?.role === 'admin') && (
                        <button
                          onClick={() => {
                            setRejectingRectificationNcr(ncr)
                            setShowRejectRectificationModal(true)
                          }}
                          disabled={actionLoading}
                          className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                          title="Reject rectification and return to responsible party"
                        >
                          Reject
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

      {/* Feature #213: Notify Client Modal */}
      {showNotifyClientModal && notifyingNcr && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Notify Client - Major NCR</h2>
              <button
                type="button"
                onClick={() => {
                  setShowNotifyClientModal(false)
                  setNotifyingNcr(null)
                  setNotifyClientEmail('')
                  setNotifyClientMessage('')
                }}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm font-medium text-red-800">Major NCR: {notifyingNcr.ncrNumber}</p>
              <p className="text-sm text-red-700 mt-1">{notifyingNcr.description.substring(0, 100)}{notifyingNcr.description.length > 100 ? '...' : ''}</p>
              <p className="text-xs text-red-600 mt-2">
                Affected Lots: {notifyingNcr.ncrLots.map(nl => nl.lot.lotNumber).join(', ') || 'None'}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Client Email (optional)</label>
                <input
                  type="email"
                  value={notifyClientEmail}
                  onChange={(e) => setNotifyClientEmail(e.target.value)}
                  placeholder="Enter client email address"
                  className="w-full border rounded-lg px-3 py-2"
                />
                <p className="text-xs text-gray-500 mt-1">Leave blank to record notification without sending email</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Additional Message (optional)</label>
                <textarea
                  value={notifyClientMessage}
                  onChange={(e) => setNotifyClientMessage(e.target.value)}
                  placeholder="Add any additional context for the client..."
                  rows={3}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
              <p className="text-sm text-blue-800 font-medium">Notification Package will include:</p>
              <ul className="text-xs text-blue-700 mt-1 list-disc list-inside">
                <li>NCR Number and Description</li>
                <li>Category and Severity</li>
                <li>Affected Lots</li>
                <li>Specification Reference</li>
                <li>Raised By and Date</li>
              </ul>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => {
                  setShowNotifyClientModal(false)
                  setNotifyingNcr(null)
                  setNotifyClientEmail('')
                  setNotifyClientMessage('')
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                disabled={notifyingClient}
              >
                Cancel
              </button>
              <button
                onClick={handleNotifyClient}
                disabled={notifyingClient}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {notifyingClient ? 'Sending...' : 'Send Notification'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Feature #215: QM Review Modal */}
      {showQmReviewModal && reviewingNcr && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Review NCR Response</h2>
              <button
                type="button"
                onClick={() => {
                  setShowQmReviewModal(false)
                  setReviewingNcr(null)
                  setQmReviewComments('')
                }}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <p className="text-sm font-medium text-gray-800">{reviewingNcr.ncrNumber}</p>
              <p className="text-sm text-gray-600 mt-1">{reviewingNcr.description}</p>
            </div>

            {/* Show submitted response details - would need to extend NCR interface */}
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Submitted Response:</p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
                <p className="text-amber-800">The responsible party has submitted a response. Review the root cause analysis and proposed corrective action.</p>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Review Comments (optional)</label>
              <textarea
                value={qmReviewComments}
                onChange={(e) => setQmReviewComments(e.target.value)}
                placeholder="Add feedback or comments..."
                rows={3}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => {
                  setShowQmReviewModal(false)
                  setReviewingNcr(null)
                  setQmReviewComments('')
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                disabled={submittingReview}
              >
                Cancel
              </button>
              <button
                onClick={() => handleQmReview('request_revision')}
                disabled={submittingReview}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
              >
                {submittingReview ? 'Processing...' : 'Request Revision'}
              </button>
              <button
                onClick={() => handleQmReview('accept')}
                disabled={submittingReview}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {submittingReview ? 'Processing...' : 'Accept Response'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Feature #216: Rectification Evidence Modal */}
      {showRectifyModal && rectifyingNcr && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Submit Rectification Evidence</h2>
              <button
                type="button"
                onClick={() => {
                  setShowRectifyModal(false)
                  setRectifyingNcr(null)
                  setRectificationNotes('')
                  setEvidenceFiles([])
                }}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm font-medium text-blue-800">{rectifyingNcr.ncrNumber}</p>
              <p className="text-sm text-blue-700 mt-1">{rectifyingNcr.description}</p>
            </div>

            {/* Evidence Upload Section */}
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Upload Evidence</p>

              {/* Photo Evidence */}
              <div className="mb-3">
                <label className="block text-sm text-gray-600 mb-1">Photos (Rectification Evidence)</label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    const files = e.target.files
                    if (files) {
                      Array.from(files).forEach(file => handleEvidenceUpload(file, 'photo'))
                    }
                  }}
                  disabled={uploadingEvidence}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>

              {/* Re-test Certificate */}
              <div className="mb-3">
                <label className="block text-sm text-gray-600 mb-1">Re-test Certificates (PDF)</label>
                <input
                  type="file"
                  accept=".pdf"
                  multiple
                  onChange={(e) => {
                    const files = e.target.files
                    if (files) {
                      Array.from(files).forEach(file => handleEvidenceUpload(file, 'retest_certificate'))
                    }
                  }}
                  disabled={uploadingEvidence}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>

              {uploadingEvidence && (
                <p className="text-sm text-amber-600">Uploading evidence...</p>
              )}

              {/* Uploaded files list */}
              {evidenceFiles.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-xs font-medium text-gray-500">Uploaded Evidence:</p>
                  {evidenceFiles.map((file, index) => (
                    <p key={index} className="text-xs text-green-600">✓ {file.name}</p>
                  ))}
                </div>
              )}
            </div>

            {/* Notes Section */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Rectification Notes</label>
              <textarea
                value={rectificationNotes}
                onChange={(e) => setRectificationNotes(e.target.value)}
                placeholder="Describe the corrective actions taken..."
                rows={4}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-amber-800">
                <strong>Note:</strong> Please upload at least one piece of evidence (photo or re-test certificate) before submitting for verification.
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowRectifyModal(false)
                  setRectifyingNcr(null)
                  setRectificationNotes('')
                  setEvidenceFiles([])
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                disabled={submittingRectification}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitRectification}
                disabled={submittingRectification || evidenceFiles.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                title={evidenceFiles.length === 0 ? 'Please upload at least one piece of evidence' : 'Submit for verification'}
              >
                {submittingRectification ? 'Submitting...' : 'Submit for Verification'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Feature #218: Reject Rectification Modal */}
      {showRejectRectificationModal && rejectingRectificationNcr && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-red-600">Reject Rectification</h2>
              <button
                type="button"
                onClick={() => {
                  setShowRejectRectificationModal(false)
                  setRejectingRectificationNcr(null)
                  setRejectFeedback('')
                }}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <p className="text-sm font-medium text-gray-800">{rejectingRectificationNcr.ncrNumber}</p>
              <p className="text-sm text-gray-600 mt-1">{rejectingRectificationNcr.description}</p>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              The rectification will be rejected and returned to the responsible party for additional work.
              Please provide feedback explaining what needs to be improved.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Feedback / Issues Found *</label>
              <textarea
                value={rejectFeedback}
                onChange={(e) => setRejectFeedback(e.target.value)}
                placeholder="Describe the issues with the rectification and what needs to be addressed..."
                rows={4}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowRejectRectificationModal(false)
                  setRejectingRectificationNcr(null)
                  setRejectFeedback('')
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                disabled={rejectingRectification}
              >
                Cancel
              </button>
              <button
                onClick={handleRejectRectification}
                disabled={rejectingRectification || !rejectFeedback.trim()}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {rejectingRectification ? 'Rejecting...' : 'Reject Rectification'}
              </button>
            </div>
          </div>
        </div>,
        document.body
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

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Raise Non-Conformance Report</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="ncr-description" className="block text-sm font-medium mb-1">Description *</label>
            <textarea
              id="ncr-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              rows={3}
              required
            />
          </div>
          <div>
            <label htmlFor="ncr-category" className="block text-sm font-medium mb-1">Category *</label>
            <select
              id="ncr-category"
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
            <label htmlFor="ncr-spec-reference" className="block text-sm font-medium mb-1">Specification Reference</label>
            <input
              id="ncr-spec-reference"
              type="text"
              value={specificationReference}
              onChange={(e) => setSpecificationReference(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="e.g., MRTS05, Q6-2021"
            />
          </div>
          <div>
            <label htmlFor="ncr-due-date" className="block text-sm font-medium mb-1">Due Date</label>
            <input
              id="ncr-due-date"
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
    </div>,
    document.body
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

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Close NCR {ncr.ncrNumber}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

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
    </div>,
    document.body
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

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Respond to NCR {ncr.ncrNumber}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-4 bg-gray-50 border border-gray-200 px-3 py-2 rounded-lg text-sm">
          <span className="font-medium">Issue:</span> {ncr.description}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="root-cause-category" className="block text-sm font-medium mb-1">Root Cause Category *</label>
            <select
              id="root-cause-category"
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
            <label htmlFor="root-cause-description" className="block text-sm font-medium mb-1">Root Cause Description *</label>
            <textarea
              id="root-cause-description"
              value={rootCauseDescription}
              onChange={(e) => setRootCauseDescription(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              rows={3}
              placeholder="Describe the root cause of this non-conformance..."
              required
            />
          </div>
          <div>
            <label htmlFor="proposed-corrective-action" className="block text-sm font-medium mb-1">Proposed Corrective Action *</label>
            <textarea
              id="proposed-corrective-action"
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
    </div>,
    document.body
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

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold">Close NCR with Concession</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
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
    </div>,
    document.body
  )
}
