import { useState, useEffect, useMemo } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useAuth, getAuthToken } from '@/lib/auth'
import { toast } from '@/components/ui/toaster'
import { X, Printer } from 'lucide-react'
import { cn } from '@/lib/utils'
import { generateDocketDetailPDF, DocketDetailPDFData } from '@/lib/pdfGenerator'
import { VoiceInputButton } from '@/components/ui/VoiceInputButton'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { DocketApprovalsMobileView } from '@/components/foreman/DocketApprovalsMobileView'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3031'

interface Docket {
  id: string
  docketNumber: string
  subcontractor: string
  subcontractorId: string
  date: string
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected'
  notes: string | null
  labourHours: number
  plantHours: number
  totalLabourSubmitted: number
  totalLabourApproved: number
  totalPlantSubmitted: number
  totalPlantApproved: number
  submittedAt: string | null
  approvedAt: string | null
  foremanNotes: string | null
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  pending_approval: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
}

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  rejected: 'Rejected',
}

export function DocketApprovalsPage() {
  const { projectId } = useParams()
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const [searchParams, setSearchParams] = useSearchParams()

  // State for dockets and filtering — initialise from URL
  const [dockets, setDockets] = useState<Docket[]>([])
  const [loading, setLoading] = useState(true)
  const initialStatus = searchParams.get('status') || 'all'
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus)

  // State for create docket modal
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [newDocketDate, setNewDocketDate] = useState('')
  const [newDocketLabourHours, setNewDocketLabourHours] = useState('')
  const [newDocketPlantHours, setNewDocketPlantHours] = useState('')
  const [newDocketNotes, setNewDocketNotes] = useState('')
  const [creating, setCreating] = useState(false)

  // State for approve/reject/view modal
  const [actionModalOpen, setActionModalOpen] = useState(false)
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'view'>('approve')
  const [selectedDocket, setSelectedDocket] = useState<Docket | null>(null)
  const [actionNotes, setActionNotes] = useState('')
  const [actionInProgress, setActionInProgress] = useState(false)
  const [adjustedLabourHours, setAdjustedLabourHours] = useState('')
  const [adjustedPlantHours, setAdjustedPlantHours] = useState('')
  const [adjustmentReason, setAdjustmentReason] = useState('')

  // State for docket detail entries (fetched on modal open)
  const [detailLoading, setDetailLoading] = useState(false)
  const [labourEntries, setLabourEntries] = useState<Array<{
    id: string
    employee: { name: string; role: string }
    startTime: string | null
    finishTime: string | null
    submittedHours: number
    approvedHours: number
    hourlyRate: number
    submittedCost: number
    approvedCost: number
  }>>([])
  const [plantEntries, setPlantEntries] = useState<Array<{
    id: string
    plant: { type: string; description: string; idRego?: string }
    hoursOperated: number
    wetOrDry: string
    hourlyRate: number
    submittedCost: number
    approvedCost: number
  }>>([])

  // Role checks - use roleInCompany which is the field returned from the backend
  const userRole = (user as any)?.roleInCompany || user?.role
  const isSubcontractor = userRole === 'subcontractor' || userRole === 'subcontractor_admin'

  // Hours validation helper - warn if hours > 24
  const validateHours = (hours: string): { isValid: boolean; warning: string | null } => {
    const numHours = parseFloat(hours)
    if (isNaN(numHours) || hours === '') {
      return { isValid: true, warning: null }
    }
    if (numHours < 0) {
      return { isValid: false, warning: 'Hours cannot be negative' }
    }
    if (numHours > 24) {
      return { isValid: true, warning: 'Warning: Hours exceed 24 - please verify this is correct' }
    }
    return { isValid: true, warning: null }
  }

  // Validation state for hours inputs
  const labourHoursValidation = validateHours(newDocketLabourHours)
  const plantHoursValidation = validateHours(newDocketPlantHours)
  const adjustedLabourValidation = validateHours(adjustedLabourHours)
  const adjustedPlantValidation = validateHours(adjustedPlantHours)
  const canApprove = ['owner', 'admin', 'project_manager', 'site_manager', 'foreman'].includes(userRole || '')

  // Sync filter changes to URL query params
  const handleFilterChange = (newFilter: string) => {
    setStatusFilter(newFilter)
    if (newFilter === 'all') {
      setSearchParams({})
    } else {
      setSearchParams({ status: newFilter })
    }
  }

  // Mobile: tap a docket card — open detail view for any docket
  const handleTapDocket = (docket: Docket) => {
    if (docket.status === 'pending_approval' && canApprove) {
      openActionModal(docket, 'approve')
    } else {
      openActionModal(docket, 'view')
    }
  }

  // Exclude drafts from the approvals view — only submitted dockets belong here
  const submittedDockets = useMemo(() => {
    return dockets.filter((d) => d.status !== 'draft')
  }, [dockets])

  // Computed values
  const filteredDockets = useMemo(() => {
    if (statusFilter === 'all') return submittedDockets
    return submittedDockets.filter((d) => d.status === statusFilter)
  }, [submittedDockets, statusFilter])

  const pendingCount = useMemo(() => {
    return submittedDockets.filter((d) => d.status === 'pending_approval').length
  }, [submittedDockets])

  const totalLabourHours = useMemo(() => {
    return filteredDockets.reduce((sum, d) => sum + (d.labourHours || 0), 0)
  }, [filteredDockets])

  const totalPlantHours = useMemo(() => {
    return filteredDockets.reduce((sum, d) => sum + (d.plantHours || 0), 0)
  }, [filteredDockets])

  // Fetch dockets from API
  const fetchDockets = async () => {
    setLoading(true)
    const token = getAuthToken()

    try {
      const queryParams = new URLSearchParams()
      if (projectId) queryParams.append('projectId', projectId)
      if (statusFilter !== 'all') queryParams.append('status', statusFilter)

      const response = await fetch(`${API_URL}/api/dockets?${queryParams.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })

      if (response.ok) {
        const data = await response.json()
        setDockets(data.dockets || data || [])
      } else {
        const error = await response.json()
        toast({ variant: 'error', description: error.message || 'Failed to fetch dockets' })
        setDockets([])
      }
    } catch (error) {
      console.error('Error fetching dockets:', error)
      toast({ variant: 'error', description: 'Failed to fetch dockets' })
      setDockets([])
    } finally {
      setLoading(false)
    }
  }

  // Create a new docket
  const handleCreateDocket = async () => {
    if (!newDocketDate) {
      toast({ variant: 'error', description: 'Date is required' })
      return
    }

    setCreating(true)
    const token = getAuthToken()

    try {
      const response = await fetch(`${API_URL}/api/dockets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          projectId,
          date: newDocketDate,
          labourHours: parseFloat(newDocketLabourHours) || 0,
          plantHours: parseFloat(newDocketPlantHours) || 0,
          notes: newDocketNotes || null,
        }),
      })

      if (response.ok) {
        toast({ variant: 'success', description: 'Docket created successfully' })
        setCreateModalOpen(false)
        setNewDocketDate('')
        setNewDocketLabourHours('')
        setNewDocketPlantHours('')
        setNewDocketNotes('')
        await fetchDockets()
      } else {
        const error = await response.json()
        toast({ variant: 'error', description: error.message || 'Failed to create docket' })
      }
    } catch (error) {
      console.error('Error creating docket:', error)
      toast({ variant: 'error', description: 'Failed to create docket' })
    } finally {
      setCreating(false)
    }
  }

  // Submit a draft docket for approval
  const handleSubmitDocket = async (docket: Docket) => {
    const token = getAuthToken()

    try {
      const response = await fetch(`${API_URL}/api/dockets/${docket.id}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      if (response.ok) {
        toast({ variant: 'success', description: 'Docket submitted for approval' })
        await fetchDockets()
      } else {
        const error = await response.json()
        toast({ variant: 'error', description: error.message || 'Failed to submit docket' })
      }
    } catch (error) {
      console.error('Error submitting docket:', error)
      toast({ variant: 'error', description: 'Failed to submit docket' })
    }
  }

  // Open the approve/reject/view modal and fetch detail entries
  const openActionModal = async (docket: Docket, type: 'approve' | 'reject' | 'view') => {
    setSelectedDocket(docket)
    setActionType(type)
    setActionNotes('')
    // Initialize adjusted values with submitted values
    setAdjustedLabourHours(String(docket.labourHours || 0))
    setAdjustedPlantHours(String(docket.plantHours || 0))
    setAdjustmentReason('')
    setLabourEntries([])
    setPlantEntries([])
    setActionModalOpen(true)

    // Fetch full docket detail for labour/plant entries
    setDetailLoading(true)
    try {
      const token = getAuthToken()
      const res = await fetch(`${API_URL}/api/dockets/${docket.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      if (res.ok) {
        const data = await res.json()
        setLabourEntries(data.docket?.labourEntries || [])
        setPlantEntries(data.docket?.plantEntries || [])
      }
    } catch (err) {
      console.error('Error fetching docket detail:', err)
    } finally {
      setDetailLoading(false)
    }
  }

  // Handle approve or reject action
  const handleAction = async () => {
    if (!selectedDocket) return

    setActionInProgress(true)
    const token = getAuthToken()
    const endpoint = actionType === 'approve' ? 'approve' : 'reject'

    try {
      const response = await fetch(`${API_URL}/api/dockets/${selectedDocket.id}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(
          actionType === 'approve'
            ? {
                foremanNotes: actionNotes || null,
                adjustedLabourHours: parseFloat(adjustedLabourHours) || 0,
                adjustedPlantHours: parseFloat(adjustedPlantHours) || 0,
                adjustmentReason: adjustmentReason || null,
              }
            : {
                reason: actionNotes || null,
              }
        ),
      })

      if (response.ok) {
        toast({
          variant: 'success',
          description: `Docket ${actionType === 'approve' ? 'approved' : 'rejected'} successfully`,
        })
        setActionModalOpen(false)
        setSelectedDocket(null)
        setActionNotes('')
        await fetchDockets()
      } else {
        const error = await response.json()
        toast({
          variant: 'error',
          description: error.message || `Failed to ${actionType} docket`,
        })
      }
    } catch (error) {
      console.error(`Error ${actionType}ing docket:`, error)
      toast({ variant: 'error', description: `Failed to ${actionType} docket` })
    } finally {
      setActionInProgress(false)
    }
  }

  // Fetch dockets on mount and when filter changes
  useEffect(() => {
    fetchDockets()
  }, [projectId])

  // Feature #735: Real-time docket approval notification polling
  // Poll for updates every 30 seconds when the tab is visible
  useEffect(() => {
    if (!projectId) return

    let pollInterval: NodeJS.Timeout | null = null

    const silentFetchDockets = async () => {
      const token = getAuthToken()

      try {
        const queryParams = new URLSearchParams()
        queryParams.append('projectId', projectId)
        if (statusFilter !== 'all') queryParams.append('status', statusFilter)

        const response = await fetch(`${API_URL}/api/dockets?${queryParams.toString()}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })

        if (response.ok) {
          const data = await response.json()
          const newDockets = data.dockets || data || []

          // Only update if there are actual changes
          setDockets((prevDockets: Docket[]) => {
            const hasChanges = newDockets.length !== prevDockets.length ||
              newDockets.some((newDocket: Docket, index: number) =>
                !prevDockets[index] ||
                newDocket.id !== prevDockets[index].id ||
                newDocket.status !== prevDockets[index].status ||
                newDocket.approvedAt !== prevDockets[index].approvedAt ||
                newDocket.totalLabourApproved !== prevDockets[index].totalLabourApproved
              )
            return hasChanges ? newDockets : prevDockets
          })
        }
      } catch (err) {
        // Silent fail for background polling
        console.debug('Background docket fetch failed:', err)
      }
    }

    const startPolling = () => {
      pollInterval = setInterval(() => {
        if (document.visibilityState === 'visible') {
          silentFetchDockets()
        }
      }, 30000) // 30 seconds
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        silentFetchDockets()
      }
    }

    startPolling()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      if (pollInterval) clearInterval(pollInterval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [projectId, statusFilter])

  // Export dockets to CSV
  const handleExportCSV = () => {
    const headers = ['Docket #', 'Subcontractor', 'Date', 'Notes', 'Labour Hours', 'Plant Hours', 'Status', 'Submitted At', 'Approved At']
    const rows = filteredDockets.map(docket => [
      docket.docketNumber,
      docket.subcontractor,
      docket.date,
      docket.notes ? `"${docket.notes.replace(/"/g, '""')}"` : '-',
      docket.labourHours,
      docket.plantHours,
      statusLabels[docket.status] || docket.status,
      docket.submittedAt ? new Date(docket.submittedAt).toLocaleDateString() : '-',
      docket.approvedAt ? new Date(docket.approvedAt).toLocaleDateString() : '-'
    ])

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.setAttribute('download', `dockets-${projectId}-${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <>
      {isMobile ? (
        <DocketApprovalsMobileView
          dockets={dockets}
          filteredDockets={filteredDockets}
          loading={loading}
          statusFilter={statusFilter}
          setStatusFilter={handleFilterChange}
          pendingCount={pendingCount}
          totalLabourHours={totalLabourHours}
          totalPlantHours={totalPlantHours}
          canApprove={canApprove}
          onApprove={(d) => openActionModal(d, 'approve')}
          onReject={(d) => openActionModal(d, 'reject')}
          onTapDocket={handleTapDocket}
          onRefresh={fetchDockets}
        />
      ) : (
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Docket Approvals</h1>
            <p className="text-sm text-muted-foreground">
              Review and approve subcontractor dockets for project {projectId}
            </p>
          </div>
          <div className="flex gap-2">
            {dockets.length > 0 && (
              <button
                onClick={handleExportCSV}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Export CSV
              </button>
            )}
            {isSubcontractor && (
              <button
                onClick={() => setCreateModalOpen(true)}
                className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
              >
                Create Docket
              </button>
            )}
            <button
              onClick={() => handleFilterChange('all')}
              className={`rounded-lg border px-4 py-2 text-sm ${statusFilter === 'all' ? 'bg-muted' : 'hover:bg-muted'}`}
            >
              All Dockets
            </button>
            <button
              onClick={() => handleFilterChange('pending_approval')}
              className={`rounded-lg px-4 py-2 text-sm ${
                statusFilter === 'pending_approval'
                  ? 'bg-primary text-primary-foreground'
                  : 'border hover:bg-muted'
              }`}
            >
              Pending ({pendingCount})
            </button>
          </div>
        </div>

        {/* Dockets Table */}
        <div className="rounded-lg border">
          <table className="w-full">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">Docket #</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Subcontractor</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Date</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Notes</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Labour Hrs</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Plant Hrs</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                      <span className="ml-2">Loading dockets...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredDockets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    No dockets found
                  </td>
                </tr>
              ) : (
                filteredDockets.map((docket) => (
                  <tr key={docket.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => handleTapDocket(docket)}>
                    <td className="px-4 py-3 text-sm font-medium">{docket.docketNumber}</td>
                    <td className="px-4 py-3 text-sm">{docket.subcontractor}</td>
                    <td className="px-4 py-3 text-sm">{docket.date}</td>
                    <td className="px-4 py-3 text-sm max-w-xs truncate" title={docket.notes || ''}>
                      {docket.notes || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {docket.status === 'approved' && docket.totalLabourApproved !== docket.totalLabourSubmitted ? (
                        <span>
                          <span className="font-medium">{docket.totalLabourApproved}h</span>
                          <span className="text-muted-foreground line-through ml-1 text-xs">{docket.labourHours}h</span>
                        </span>
                      ) : (
                        <>{docket.labourHours}h</>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {docket.status === 'approved' && docket.totalPlantApproved !== docket.totalPlantSubmitted ? (
                        <span>
                          <span className="font-medium">{docket.totalPlantApproved}h</span>
                          <span className="text-muted-foreground line-through ml-1 text-xs">{docket.plantHours}h</span>
                        </span>
                      ) : (
                        <>{docket.plantHours}h</>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`rounded px-2 py-1 text-xs font-medium ${statusColors[docket.status] || 'bg-gray-100'}`}
                      >
                        {statusLabels[docket.status] || docket.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-2">
                        {/* Print button - always visible */}
                        <button
                          onClick={async () => {
                            try {
                              const token = getAuthToken()
                              // Fetch project info
                              const projectRes = await fetch(`${API_URL}/api/projects/${projectId}`, {
                                headers: token ? { Authorization: `Bearer ${token}` } : {}
                              })
                              const project = projectRes.ok ? await projectRes.json() : { name: 'Unknown Project', projectNumber: null }

                              const pdfData: DocketDetailPDFData = {
                                docket: {
                                  id: docket.id,
                                  docketNumber: docket.docketNumber,
                                  date: docket.date,
                                  status: docket.status,
                                  notes: docket.notes,
                                  labourHours: docket.labourHours,
                                  plantHours: docket.plantHours,
                                  totalLabourSubmitted: docket.totalLabourSubmitted,
                                  totalLabourApproved: docket.totalLabourApproved,
                                  totalPlantSubmitted: docket.totalPlantSubmitted,
                                  totalPlantApproved: docket.totalPlantApproved,
                                  submittedAt: docket.submittedAt,
                                  approvedAt: docket.approvedAt,
                                  foremanNotes: docket.foremanNotes
                                },
                                subcontractor: {
                                  name: docket.subcontractor
                                },
                                project: {
                                  name: project.name || 'Unknown Project',
                                  projectNumber: project.projectNumber || null
                                }
                              }

                              generateDocketDetailPDF(pdfData)
                              toast({ title: 'Docket PDF downloaded', variant: 'success' })
                            } catch (err) {
                              console.error('Error generating docket PDF:', err)
                              toast({ title: 'Failed to generate PDF', variant: 'error' })
                            }
                          }}
                          className="rounded border p-1.5 hover:bg-muted"
                          title="Print docket"
                        >
                          <Printer className="h-4 w-4" />
                        </button>
                        {/* Submit button for draft dockets (subcontractor only) */}
                        {docket.status === 'draft' && isSubcontractor && (
                          <button
                            onClick={() => handleSubmitDocket(docket)}
                            className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
                          >
                            Submit
                          </button>
                        )}
                        {/* Approve/Reject buttons for pending dockets (approvers only) */}
                        {docket.status === 'pending_approval' && canApprove && (
                          <>
                            <button
                              onClick={() => openActionModal(docket, 'approve')}
                              className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => openActionModal(docket, 'reject')}
                              className="rounded border border-red-600 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Operational Summary */}
        <div className="rounded-lg border p-4">
          <h2 className="text-lg font-semibold mb-4">Operational Summary</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <span className="text-sm text-muted-foreground">Pending Approvals</span>
              <p className="text-2xl font-bold">{pendingCount}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Total Labour Hours</span>
              <p className="text-2xl font-bold">{totalLabourHours}h</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Total Plant Hours</span>
              <p className="text-2xl font-bold">{totalPlantHours}h</p>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Create Docket Modal — renders for both mobile & desktop */}
      {createModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-xl font-semibold">Create Docket</h2>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="p-2 hover:bg-muted rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Date *</label>
                <input
                  type="date"
                  value={newDocketDate}
                  onChange={(e) => setNewDocketDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Labour Hours</label>
                <input
                  type="number"
                  value={newDocketLabourHours}
                  onChange={(e) => setNewDocketLabourHours(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                    labourHoursValidation.warning ? 'border-amber-500' : ''
                  }`}
                  placeholder="0"
                  min="0"
                  step="0.5"
                />
                {labourHoursValidation.warning && (
                  <p className="mt-1 text-sm text-amber-600 flex items-center gap-1">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    {labourHoursValidation.warning}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Plant Hours</label>
                <input
                  type="number"
                  value={newDocketPlantHours}
                  onChange={(e) => setNewDocketPlantHours(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                    plantHoursValidation.warning ? 'border-amber-500' : ''
                  }`}
                  placeholder="0"
                  min="0"
                  step="0.5"
                />
                {plantHoursValidation.warning && (
                  <p className="mt-1 text-sm text-amber-600 flex items-center gap-1">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    {plantHoursValidation.warning}
                  </p>
                )}
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium">Notes</label>
                  {/* Feature #289: Voice-to-text for docket notes */}
                  <VoiceInputButton
                    onTranscript={(text) => setNewDocketNotes((prev) => prev ? prev + ' ' + text : text)}
                    appendMode={true}
                  />
                </div>
                <textarea
                  value={newDocketNotes}
                  onChange={(e) => setNewDocketNotes(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  rows={3}
                  placeholder="Enter any notes about this docket..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 p-4 border-t">
              <button
                onClick={() => setCreateModalOpen(false)}
                className="px-4 py-2 border rounded-lg hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateDocket}
                disabled={creating || !newDocketDate}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create Docket'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approve/Reject/View Modal */}
      {actionModalOpen && selectedDocket && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-xl font-semibold">
                {actionType === 'approve' ? 'Approve Docket' : actionType === 'reject' ? 'Reject Docket' : 'Docket Details'}
              </h2>
              <button
                onClick={() => setActionModalOpen(false)}
                className="p-2 hover:bg-muted rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                <p className="text-sm">
                  <strong>Docket:</strong> {selectedDocket.docketNumber}
                </p>
                <p className="text-sm">
                  <strong>Subcontractor:</strong> {selectedDocket.subcontractor}
                </p>
                <p className="text-sm">
                  <strong>Date:</strong> {selectedDocket.date}
                </p>
                <p className="text-sm">
                  <strong>Status:</strong>{' '}
                  <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', statusColors[selectedDocket.status] || 'bg-gray-100 text-gray-800')}>
                    {statusLabels[selectedDocket.status] || selectedDocket.status}
                  </span>
                </p>
                <p className="text-sm">
                  <strong>Labour Hours:</strong> {selectedDocket.labourHours}h
                  {selectedDocket.totalLabourApproved > 0 && selectedDocket.totalLabourApproved !== selectedDocket.labourHours && (
                    <span className="text-muted-foreground"> (approved: {selectedDocket.totalLabourApproved}h)</span>
                  )}
                </p>
                <p className="text-sm">
                  <strong>Plant Hours:</strong> {selectedDocket.plantHours}h
                  {selectedDocket.totalPlantApproved > 0 && selectedDocket.totalPlantApproved !== selectedDocket.plantHours && (
                    <span className="text-muted-foreground"> (approved: {selectedDocket.totalPlantApproved}h)</span>
                  )}
                </p>
                {selectedDocket.notes && (
                  <p className="text-sm">
                    <strong>Notes:</strong> {selectedDocket.notes}
                  </p>
                )}
                {selectedDocket.foremanNotes && (
                  <p className="text-sm">
                    <strong>Foreman Notes:</strong> {selectedDocket.foremanNotes}
                  </p>
                )}
                {selectedDocket.submittedAt && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Submitted: {new Date(selectedDocket.submittedAt).toLocaleString('en-AU')}
                  </p>
                )}
                {selectedDocket.approvedAt && (
                  <p className="text-xs text-muted-foreground">
                    Approved: {new Date(selectedDocket.approvedAt).toLocaleString('en-AU')}
                  </p>
                )}
              </div>

              {/* Labour & Plant entry details */}
              {detailLoading ? (
                <p className="text-sm text-muted-foreground text-center py-3">Loading entries...</p>
              ) : (
                <>
                  {labourEntries.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold mb-2">Labour Entries</h3>
                      <div className="rounded-lg border overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="text-left px-3 py-2 font-medium">Name</th>
                              <th className="text-left px-3 py-2 font-medium">Role</th>
                              <th className="text-right px-3 py-2 font-medium">Hours</th>
                              <th className="text-right px-3 py-2 font-medium">Cost</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {labourEntries.map((entry) => (
                              <tr key={entry.id}>
                                <td className="px-3 py-2">{entry.employee.name}</td>
                                <td className="px-3 py-2 text-muted-foreground">{entry.employee.role}</td>
                                <td className="px-3 py-2 text-right">
                                  {entry.approvedHours > 0 && entry.approvedHours !== entry.submittedHours ? (
                                    <span>
                                      <span className="font-medium">{entry.approvedHours}h</span>
                                      <span className="text-muted-foreground line-through ml-1 text-xs">{entry.submittedHours}h</span>
                                    </span>
                                  ) : (
                                    <>{entry.submittedHours}h</>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {entry.approvedCost > 0 && entry.approvedCost !== entry.submittedCost ? (
                                    <span>
                                      <span className="font-medium">${entry.approvedCost.toFixed(2)}</span>
                                      <span className="text-muted-foreground line-through ml-1 text-xs">${entry.submittedCost.toFixed(2)}</span>
                                    </span>
                                  ) : (
                                    <>${entry.submittedCost.toFixed(2)}</>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {plantEntries.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold mb-2">Plant Entries</h3>
                      <div className="rounded-lg border overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="text-left px-3 py-2 font-medium">Plant</th>
                              <th className="text-left px-3 py-2 font-medium">Type</th>
                              <th className="text-right px-3 py-2 font-medium">Hours</th>
                              <th className="text-right px-3 py-2 font-medium">Cost</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {plantEntries.map((entry) => (
                              <tr key={entry.id}>
                                <td className="px-3 py-2">{entry.plant.description}{entry.plant.idRego ? ` (${entry.plant.idRego})` : ''}</td>
                                <td className="px-3 py-2 text-muted-foreground capitalize">{entry.wetOrDry}</td>
                                <td className="px-3 py-2 text-right">{entry.hoursOperated}h</td>
                                <td className="px-3 py-2 text-right">
                                  {entry.approvedCost > 0 && entry.approvedCost !== entry.submittedCost ? (
                                    <span>
                                      <span className="font-medium">${entry.approvedCost.toFixed(2)}</span>
                                      <span className="text-muted-foreground line-through ml-1 text-xs">${entry.submittedCost.toFixed(2)}</span>
                                    </span>
                                  ) : (
                                    <>${entry.submittedCost.toFixed(2)}</>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {labourEntries.length === 0 && plantEntries.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-2">No entries found</p>
                  )}
                </>
              )}

              {/* View mode: show approve/reject buttons if docket is pending */}
              {actionType === 'view' && selectedDocket.status === 'pending_approval' && canApprove && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setActionType('approve')}
                    className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => setActionType('reject')}
                    className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                  >
                    Reject
                  </button>
                </div>
              )}

              {actionType === 'approve' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Adjusted Labour Hours
                      </label>
                      <input
                        type="number"
                        value={adjustedLabourHours}
                        onChange={(e) => setAdjustedLabourHours(e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                          adjustedLabourValidation.warning ? 'border-amber-500' : ''
                        }`}
                        min="0"
                        step="0.5"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Submitted: {selectedDocket?.labourHours || 0}h
                      </p>
                      {adjustedLabourValidation.warning && (
                        <p className="mt-1 text-sm text-amber-600 flex items-center gap-1">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          {adjustedLabourValidation.warning}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Adjusted Plant Hours
                      </label>
                      <input
                        type="number"
                        value={adjustedPlantHours}
                        onChange={(e) => setAdjustedPlantHours(e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                          adjustedPlantValidation.warning ? 'border-amber-500' : ''
                        }`}
                        min="0"
                        step="0.5"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Submitted: {selectedDocket?.plantHours || 0}h
                      </p>
                      {adjustedPlantValidation.warning && (
                        <p className="mt-1 text-sm text-amber-600 flex items-center gap-1">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          {adjustedPlantValidation.warning}
                        </p>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Adjustment Reason {(parseFloat(adjustedLabourHours) !== (selectedDocket?.labourHours || 0) || parseFloat(adjustedPlantHours) !== (selectedDocket?.plantHours || 0)) && '*'}
                    </label>
                    <input
                      type="text"
                      value={adjustmentReason}
                      onChange={(e) => setAdjustmentReason(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Reason for adjustment (if hours changed)"
                    />
                  </div>
                </>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium">
                    {actionType === 'approve' ? 'Approval Notes' : 'Rejection Reason'}
                    {actionType === 'reject' && ' *'}
                  </label>
                  {/* Feature #289: Voice-to-text for approval/rejection notes */}
                  <VoiceInputButton
                    onTranscript={(text) => setActionNotes((prev) => prev ? prev + ' ' + text : text)}
                    appendMode={true}
                  />
                </div>
                <textarea
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  rows={3}
                  placeholder={
                    actionType === 'approve'
                      ? 'Add any notes (optional)...'
                      : 'Please provide a reason for rejection...'
                  }
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 p-4 border-t">
              <button
                onClick={() => setActionModalOpen(false)}
                className="px-4 py-2 border rounded-lg hover:bg-muted"
              >
                {actionType === 'view' ? 'Close' : 'Cancel'}
              </button>
              {actionType !== 'view' && (
                <button
                  onClick={handleAction}
                  disabled={actionInProgress || (actionType === 'reject' && !actionNotes.trim())}
                  className={`px-4 py-2 rounded-lg disabled:opacity-50 ${
                    actionType === 'approve'
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                >
                  {actionInProgress
                    ? actionType === 'approve'
                      ? 'Approving...'
                      : 'Rejecting...'
                    : actionType === 'approve'
                      ? 'Approve'
                      : 'Reject'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
