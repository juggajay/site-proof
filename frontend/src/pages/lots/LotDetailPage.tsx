import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useCommercialAccess } from '@/hooks/useCommercialAccess'
import { useViewerAccess } from '@/hooks/useViewerAccess'
import { getAuthToken } from '@/lib/auth'

// Tab types for lot detail page
type LotTab = 'itp' | 'tests' | 'ncrs' | 'photos' | 'documents'

const tabs: { id: LotTab; label: string }[] = [
  { id: 'itp', label: 'ITP Checklist' },
  { id: 'tests', label: 'Test Results' },
  { id: 'ncrs', label: 'NCRs' },
  { id: 'photos', label: 'Photos' },
  { id: 'documents', label: 'Documents' },
]

interface QualityAccess {
  role: string
  isQualityManager: boolean
  canConformLots: boolean
  canVerifyTestResults: boolean
  canCloseNCRs: boolean
  canManageITPTemplates: boolean
}

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
  createdAt: string
  updatedAt: string
}

interface TestResult {
  id: string
  testType: string
  testRequestNumber: string | null
  laboratoryName: string | null
  resultValue: number | null
  resultUnit: string | null
  passFail: string
  status: string
  createdAt: string
}

interface NCR {
  id: string
  ncrNumber: string
  description: string
  category: string
  severity: 'minor' | 'major'
  status: string
  raisedBy: { fullName: string; email: string }
  createdAt: string
}

interface ITPChecklistItem {
  id: string
  description: string
  category: string
  isHoldPoint: boolean
  order: number
}

interface ITPCompletion {
  id: string
  checklistItemId: string
  isCompleted: boolean
  notes: string | null
  completedAt: string | null
  completedBy: { id: string; fullName: string; email: string } | null
  isVerified: boolean
  verifiedAt: string | null
  verifiedBy: { id: string; fullName: string; email: string } | null
}

interface ITPInstance {
  id: string
  template: {
    id: string
    name: string
    checklistItems: ITPChecklistItem[]
  }
  completions: ITPCompletion[]
}

interface ITPTemplate {
  id: string
  name: string
  activityType: string
  checklistItems: ITPChecklistItem[]
}

interface ConformStatus {
  canConform: boolean
  blockingReasons: string[]
  prerequisites: {
    itpAssigned: boolean
    itpCompleted: boolean
    itpCompletedCount: number
    itpTotalCount: number
    hasPassingTest: boolean
    noOpenNcrs: boolean
    openNcrs: { id: string; ncrNumber: string; status: string }[]
  }
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  on_hold: 'bg-red-100 text-red-800',
}

const testPassFailColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  pass: 'bg-green-100 text-green-800',
  fail: 'bg-red-100 text-red-800',
}

const testStatusColors: Record<string, string> = {
  requested: 'bg-gray-100 text-gray-800',
  entered: 'bg-blue-100 text-blue-800',
  verified: 'bg-green-100 text-green-800',
}

const ncrStatusColors: Record<string, string> = {
  open: 'bg-red-100 text-red-800',
  investigating: 'bg-yellow-100 text-yellow-800',
  rectification: 'bg-orange-100 text-orange-800',
  verification: 'bg-blue-100 text-blue-800',
  closed: 'bg-green-100 text-green-800',
  closed_concession: 'bg-green-100 text-green-700',
}

const severityColors: Record<string, string> = {
  minor: 'bg-yellow-100 text-yellow-800',
  major: 'bg-red-500 text-white',
}

export function LotDetailPage() {
  const { projectId, lotId } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { canViewBudgets } = useCommercialAccess()
  const { canCreate: canEdit } = useViewerAccess()
  const [lot, setLot] = useState<Lot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<{ type: 'not_found' | 'forbidden' | 'error'; message: string } | null>(null)
  const [conforming, setConforming] = useState(false)
  const [qualityAccess, setQualityAccess] = useState<QualityAccess | null>(null)
  const [testResults, setTestResults] = useState<TestResult[]>([])
  const [loadingTests, setLoadingTests] = useState(false)
  const [ncrs, setNcrs] = useState<NCR[]>([])
  const [loadingNcrs, setLoadingNcrs] = useState(false)
  const [itpInstance, setItpInstance] = useState<ITPInstance | null>(null)
  const [loadingItp, setLoadingItp] = useState(false)
  const [templates, setTemplates] = useState<ITPTemplate[]>([])
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [assigningTemplate, setAssigningTemplate] = useState(false)
  const [updatingCompletion, setUpdatingCompletion] = useState<string | null>(null)
  const [conformStatus, setConformStatus] = useState<ConformStatus | null>(null)
  const [loadingConformStatus, setLoadingConformStatus] = useState(false)

  // Get current tab from URL or default to 'itp'
  const currentTab = (searchParams.get('tab') as LotTab) || 'itp'

  // Handle tab change
  const handleTabChange = (tabId: LotTab) => {
    setSearchParams({ tab: tabId })
  }

  // Fetch quality access permissions for this project
  useEffect(() => {
    async function fetchQualityAccess() {
      if (!projectId) return

      const token = getAuthToken()
      if (!token) return

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

      try {
        const response = await fetch(`${apiUrl}/api/lots/check-role/${projectId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (response.ok) {
          const data = await response.json()
          setQualityAccess(data)
        }
      } catch (err) {
        console.error('Failed to fetch quality access:', err)
      }
    }

    fetchQualityAccess()
  }, [projectId])

  useEffect(() => {
    async function fetchLot() {
      if (!lotId) return

      const token = getAuthToken()
      if (!token) {
        navigate('/login')
        return
      }

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

      try {
        const response = await fetch(`${apiUrl}/api/lots/${lotId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (response.status === 404) {
          setError({ type: 'not_found', message: 'Lot not found' })
          setLoading(false)
          return
        }

        if (response.status === 403) {
          setError({ type: 'forbidden', message: 'You do not have access to this lot' })
          setLoading(false)
          return
        }

        if (!response.ok) {
          throw new Error('Failed to fetch lot')
        }

        const data = await response.json()
        setLot(data.lot)
      } catch (err) {
        setError({ type: 'error', message: 'Failed to load lot' })
      } finally {
        setLoading(false)
      }
    }

    fetchLot()
  }, [lotId, navigate])

  // Fetch conformance status when lot is loaded and not yet conformed
  useEffect(() => {
    async function fetchConformStatus() {
      if (!lotId || !lot || lot.status === 'conformed' || lot.status === 'claimed') return

      const token = getAuthToken()
      if (!token) return

      setLoadingConformStatus(true)
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

      try {
        const response = await fetch(`${apiUrl}/api/lots/${lotId}/conform-status`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (response.ok) {
          const data = await response.json()
          setConformStatus(data)
        }
      } catch (err) {
        console.error('Failed to fetch conform status:', err)
      } finally {
        setLoadingConformStatus(false)
      }
    }

    fetchConformStatus()
  }, [lotId, lot])

  // Fetch test results when Tests tab is selected
  useEffect(() => {
    async function fetchTestResults() {
      if (!projectId || !lotId || currentTab !== 'tests') return

      const token = getAuthToken()
      if (!token) return

      setLoadingTests(true)
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

      try {
        const response = await fetch(`${apiUrl}/api/test-results?projectId=${projectId}&lotId=${lotId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (response.ok) {
          const data = await response.json()
          setTestResults(data.testResults || [])
        }
      } catch (err) {
        console.error('Failed to fetch test results:', err)
      } finally {
        setLoadingTests(false)
      }
    }

    fetchTestResults()
  }, [projectId, lotId, currentTab])

  // Fetch NCRs when NCRs tab is selected
  useEffect(() => {
    async function fetchNcrs() {
      if (!projectId || !lotId || currentTab !== 'ncrs') return

      const token = getAuthToken()
      if (!token) return

      setLoadingNcrs(true)
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

      try {
        const response = await fetch(`${apiUrl}/api/ncrs?projectId=${projectId}&lotId=${lotId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (response.ok) {
          const data = await response.json()
          setNcrs(data.ncrs || [])
        }
      } catch (err) {
        console.error('Failed to fetch NCRs:', err)
      } finally {
        setLoadingNcrs(false)
      }
    }

    fetchNcrs()
  }, [projectId, lotId, currentTab])

  // Fetch ITP instance when ITP tab is selected
  useEffect(() => {
    async function fetchItpInstance() {
      if (!projectId || !lotId || currentTab !== 'itp') return

      const token = getAuthToken()
      if (!token) return

      setLoadingItp(true)
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

      try {
        const response = await fetch(`${apiUrl}/api/itp/instances/lot/${lotId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (response.ok) {
          const data = await response.json()
          setItpInstance(data.instance)
        } else if (response.status === 404) {
          // No ITP assigned - fetch available templates
          const templatesResponse = await fetch(`${apiUrl}/api/itp/templates?projectId=${projectId}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (templatesResponse.ok) {
            const templatesData = await templatesResponse.json()
            setTemplates(templatesData.templates || [])
          }
        }
      } catch (err) {
        console.error('Failed to fetch ITP instance:', err)
      } finally {
        setLoadingItp(false)
      }
    }

    fetchItpInstance()
  }, [projectId, lotId, currentTab])

  // Extract quality access permissions
  const canConformLots = qualityAccess?.canConformLots || false
  const canVerifyTestResults = qualityAccess?.canVerifyTestResults || false

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
        <div className="text-6xl">{error.type === 'forbidden' ? '🚫' : '❓'}</div>
        <h1 className="text-2xl font-bold text-destructive">
          {error.type === 'forbidden' ? 'Access Denied' : error.type === 'not_found' ? 'Lot Not Found' : 'Error'}
        </h1>
        <p className="text-muted-foreground text-center max-w-md">{error.message}</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
        >
          Go Back
        </button>
      </div>
    )
  }

  if (!lot) {
    return null
  }

  // Check if lot can be edited
  const isEditable = lot.status !== 'conformed' && lot.status !== 'claimed'

  const handleAssignTemplate = async (templateId: string) => {
    if (!lotId) return

    const token = getAuthToken()
    if (!token) return

    setAssigningTemplate(true)
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

    try {
      const response = await fetch(`${apiUrl}/api/itp/instances`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ lotId, templateId }),
      })

      if (response.ok) {
        const data = await response.json()
        setItpInstance(data.instance)
        setShowAssignModal(false)
      }
    } catch (err) {
      console.error('Failed to assign template:', err)
    } finally {
      setAssigningTemplate(false)
    }
  }

  const handleToggleCompletion = async (checklistItemId: string, currentlyCompleted: boolean, existingNotes: string | null) => {
    if (!itpInstance) return

    const token = getAuthToken()
    if (!token) return

    setUpdatingCompletion(checklistItemId)
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

    try {
      const response = await fetch(`${apiUrl}/api/itp/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          itpInstanceId: itpInstance.id,
          checklistItemId,
          isCompleted: !currentlyCompleted,
          notes: existingNotes,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        // Update the completions in state
        setItpInstance(prev => {
          if (!prev) return prev
          const existingIndex = prev.completions.findIndex(c => c.checklistItemId === checklistItemId)
          const newCompletions = [...prev.completions]
          if (existingIndex >= 0) {
            newCompletions[existingIndex] = data.completion
          } else {
            newCompletions.push(data.completion)
          }
          return { ...prev, completions: newCompletions }
        })
      }
    } catch (err) {
      console.error('Failed to update completion:', err)
    } finally {
      setUpdatingCompletion(null)
    }
  }

  const handleUpdateNotes = async (checklistItemId: string, notes: string) => {
    if (!itpInstance) return

    const token = getAuthToken()
    if (!token) return

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
    const existingCompletion = itpInstance.completions.find(c => c.checklistItemId === checklistItemId)

    try {
      const response = await fetch(`${apiUrl}/api/itp/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          itpInstanceId: itpInstance.id,
          checklistItemId,
          isCompleted: existingCompletion?.isCompleted || false,
          notes,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setItpInstance(prev => {
          if (!prev) return prev
          const existingIndex = prev.completions.findIndex(c => c.checklistItemId === checklistItemId)
          const newCompletions = [...prev.completions]
          if (existingIndex >= 0) {
            newCompletions[existingIndex] = data.completion
          } else {
            newCompletions.push(data.completion)
          }
          return { ...prev, completions: newCompletions }
        })
      }
    } catch (err) {
      console.error('Failed to update notes:', err)
    }
  }

  const handleConformLot = async () => {
    if (!confirm('Are you sure you want to conform this lot? This action marks the lot as quality-approved.')) {
      return
    }
    setConforming(true)
    const token = getAuthToken()
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
    try {
      const response = await fetch(`${apiUrl}/api/lots/${lotId}/conform`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })
      if (response.ok) {
        setLot((prev) => prev ? { ...prev, status: 'conformed' } : null)
        alert('Lot conformed successfully!')
      } else {
        const data = await response.json()
        if (data.blockingReasons) {
          alert(`Cannot conform lot:\n\n${data.blockingReasons.join('\n')}`)
        } else {
          alert(data.message || data.error || 'Failed to conform lot')
        }
      }
    } catch (err) {
      alert('Failed to conform lot')
    } finally {
      setConforming(false)
    }
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{lot.lotNumber}</h1>
          <p className="text-sm text-muted-foreground">{lot.description || 'No description'}</p>
        </div>
        <div className="flex items-center gap-3">
          {canEdit && isEditable && (
            <button
              onClick={() => navigate(`/projects/${projectId}/lots/${lotId}/edit`)}
              className="rounded-lg border border-amber-500 px-4 py-2 text-sm text-amber-600 hover:bg-amber-50"
            >
              Edit Lot
            </button>
          )}
          <span className={`px-3 py-1 rounded text-sm font-medium ${statusColors[lot.status] || 'bg-gray-100'}`}>
            {lot.status.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Lot Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg border p-4">
          <span className="text-sm text-muted-foreground">Chainage</span>
          <p className="font-medium text-lg">
            {lot.chainageStart != null && lot.chainageEnd != null
              ? `${lot.chainageStart} - ${lot.chainageEnd}`
              : lot.chainageStart ?? lot.chainageEnd ?? '—'}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <span className="text-sm text-muted-foreground">Activity Type</span>
          <p className="font-medium text-lg capitalize">{lot.activityType || '—'}</p>
        </div>
        <div className="rounded-lg border p-4">
          <span className="text-sm text-muted-foreground">Layer</span>
          <p className="font-medium text-lg">{lot.layer || '—'}</p>
        </div>
        <div className="rounded-lg border p-4">
          <span className="text-sm text-muted-foreground">Area/Zone</span>
          <p className="font-medium text-lg">{lot.areaZone || '—'}</p>
        </div>
      </div>

      {/* Timestamps */}
      <div className="flex flex-wrap gap-6 text-sm text-muted-foreground border-t pt-4">
        <div className="flex items-center gap-2">
          <span className="font-medium">Created:</span>
          <time dateTime={lot.createdAt} title={new Date(lot.createdAt).toISOString()}>
            {new Date(lot.createdAt).toLocaleString('en-AU', {
              dateStyle: 'medium',
              timeStyle: 'medium',
            })}
          </time>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-medium">Last Updated:</span>
          <time dateTime={lot.updatedAt} title={new Date(lot.updatedAt).toISOString()}>
            {new Date(lot.updatedAt).toLocaleString('en-AU', {
              dateStyle: 'medium',
              timeStyle: 'medium',
            })}
          </time>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b">
        <nav className="flex gap-4" aria-label="Lot detail tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                currentTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300'
              }`}
              aria-selected={currentTab === tab.id}
              role="tab"
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-[300px]" role="tabpanel">
        {/* ITP Checklist Tab */}
        {currentTab === 'itp' && (
          <div className="space-y-4">
            {loadingItp ? (
              <div className="flex justify-center p-8">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : itpInstance ? (
              <>
                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">ITP Progress</h2>
                    <span className="text-sm text-muted-foreground">{itpInstance.template.name}</span>
                  </div>
                  {(() => {
                    const totalItems = itpInstance.template.checklistItems.length
                    const completedItems = itpInstance.completions.filter(c => c.isCompleted).length
                    const percentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0
                    return (
                      <>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                          <div className="bg-primary h-2.5 rounded-full transition-all" style={{ width: `${percentage}%` }}></div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">{completedItems} of {totalItems} checklist items completed ({percentage}%)</p>
                      </>
                    )
                  })()}
                </div>
                <div className="rounded-lg border">
                  <div className="divide-y">
                    {itpInstance.template.checklistItems.map((item) => {
                      const completion = itpInstance.completions.find(c => c.checklistItemId === item.id)
                      const isCompleted = completion?.isCompleted || false
                      const notes = completion?.notes || ''

                      return (
                        <div key={item.id} className="p-4">
                          <div className="flex items-start gap-3">
                            <button
                              onClick={() => handleToggleCompletion(item.id, isCompleted, notes)}
                              disabled={updatingCompletion === item.id}
                              className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                isCompleted
                                  ? 'bg-green-500 border-green-500 text-white'
                                  : 'border-gray-300 hover:border-primary'
                              } ${updatingCompletion === item.id ? 'opacity-50' : ''}`}
                            >
                              {isCompleted && <span className="text-xs">&#10003;</span>}
                            </button>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className={`font-medium ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>
                                  {item.description}
                                </span>
                                {item.isHoldPoint && (
                                  <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded">Hold Point</span>
                                )}
                                <span className="text-xs bg-muted px-2 py-0.5 rounded capitalize">{item.category}</span>
                              </div>
                              <div className="mt-2">
                                <input
                                  type="text"
                                  placeholder="Add notes..."
                                  value={notes}
                                  onChange={(e) => {
                                    // Optimistic update
                                    setItpInstance(prev => {
                                      if (!prev) return prev
                                      const existingIndex = prev.completions.findIndex(c => c.checklistItemId === item.id)
                                      const newCompletions = [...prev.completions]
                                      if (existingIndex >= 0) {
                                        newCompletions[existingIndex] = { ...newCompletions[existingIndex], notes: e.target.value }
                                      } else {
                                        newCompletions.push({
                                          id: '',
                                          checklistItemId: item.id,
                                          isCompleted: false,
                                          notes: e.target.value,
                                          completedAt: null,
                                          completedBy: null,
                                          isVerified: false,
                                          verifiedAt: null,
                                          verifiedBy: null
                                        })
                                      }
                                      return { ...prev, completions: newCompletions }
                                    })
                                  }}
                                  onBlur={(e) => handleUpdateNotes(item.id, e.target.value)}
                                  className="w-full px-2 py-1 text-sm border rounded bg-transparent"
                                />
                              </div>
                              {completion?.completedBy && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Completed by {completion.completedBy.fullName || completion.completedBy.email}
                                  {completion.completedAt && ` on ${new Date(completion.completedAt).toLocaleDateString()}`}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-lg border p-6 text-center">
                <div className="text-4xl mb-2">📋</div>
                <h3 className="text-lg font-semibold mb-2">ITP Checklist</h3>
                <p className="text-muted-foreground mb-4">
                  No ITP template assigned to this lot yet. Assign an ITP template to track quality checkpoints.
                </p>
                {templates.length > 0 ? (
                  <button
                    onClick={() => setShowAssignModal(true)}
                    className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
                  >
                    Assign ITP Template
                  </button>
                ) : (
                  <button
                    onClick={() => navigate(`/projects/${projectId}/itp`)}
                    className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
                  >
                    Create ITP Template First
                  </button>
                )}
              </div>
            )}

            {/* Assign Template Modal */}
            {showAssignModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-background rounded-lg p-6 w-full max-w-md">
                  <h2 className="text-xl font-semibold mb-4">Assign ITP Template</h2>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {templates.map((template) => (
                      <button
                        key={template.id}
                        onClick={() => handleAssignTemplate(template.id)}
                        disabled={assigningTemplate}
                        className="w-full text-left p-3 border rounded-lg hover:border-primary/50 transition-colors disabled:opacity-50"
                      >
                        <div className="font-medium">{template.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {template.activityType} - {template.checklistItems.length} items
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-end mt-4">
                    <button
                      onClick={() => setShowAssignModal(false)}
                      className="px-4 py-2 border rounded-lg hover:bg-muted"
                      disabled={assigningTemplate}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Test Results Tab */}
        {currentTab === 'tests' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Test Results</h2>
              <button
                onClick={() => navigate(`/projects/${projectId}/tests`)}
                className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
              >
                View All Tests
              </button>
            </div>
            {loadingTests ? (
              <div className="flex justify-center p-8">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : testResults.length === 0 ? (
              <div className="rounded-lg border p-6 text-center">
                <div className="text-4xl mb-2">🧪</div>
                <h3 className="text-lg font-semibold mb-2">No Test Results</h3>
                <p className="text-muted-foreground mb-4">
                  No test results have been linked to this lot yet. Link test results to verify quality compliance.
                </p>
                <button
                  onClick={() => navigate(`/projects/${projectId}/tests`)}
                  className="rounded-lg border border-primary px-4 py-2 text-sm text-primary hover:bg-primary/10"
                >
                  Go to Test Results
                </button>
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium">Test Type</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Request #</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Laboratory</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Result</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Pass/Fail</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {testResults.map((test) => (
                      <tr key={test.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 text-sm font-medium">{test.testType}</td>
                        <td className="px-4 py-3 text-sm">{test.testRequestNumber || '—'}</td>
                        <td className="px-4 py-3 text-sm">{test.laboratoryName || '—'}</td>
                        <td className="px-4 py-3 text-sm">
                          {test.resultValue != null
                            ? `${test.resultValue}${test.resultUnit ? ` ${test.resultUnit}` : ''}`
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${testPassFailColors[test.passFail] || 'bg-gray-100'}`}>
                            {test.passFail}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${testStatusColors[test.status] || 'bg-gray-100'}`}>
                            {test.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* NCRs Tab */}
        {currentTab === 'ncrs' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Non-Conformance Reports</h2>
              <button
                onClick={() => navigate(`/projects/${projectId}/ncr`)}
                className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
              >
                View All NCRs
              </button>
            </div>
            {loadingNcrs ? (
              <div className="flex justify-center p-8">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : ncrs.length === 0 ? (
              <div className="rounded-lg border p-6 text-center">
                <div className="text-4xl mb-2">✅</div>
                <h3 className="text-lg font-semibold mb-2">No NCRs</h3>
                <p className="text-muted-foreground mb-4">
                  No non-conformance reports have been raised for this lot.
                </p>
                <button
                  onClick={() => navigate(`/projects/${projectId}/ncr`)}
                  className="rounded-lg border border-primary px-4 py-2 text-sm text-primary hover:bg-primary/10"
                >
                  Go to NCR Register
                </button>
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium">NCR #</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Description</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Category</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Severity</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Raised By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {ncrs.map((ncr) => (
                      <tr key={ncr.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 text-sm font-mono">{ncr.ncrNumber}</td>
                        <td className="px-4 py-3 text-sm max-w-xs truncate">{ncr.description}</td>
                        <td className="px-4 py-3 text-sm capitalize">{ncr.category}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${severityColors[ncr.severity] || 'bg-gray-100'}`}>
                            {ncr.severity.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${ncrStatusColors[ncr.status] || 'bg-gray-100'}`}>
                            {ncr.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">{ncr.raisedBy?.fullName || ncr.raisedBy?.email || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Photos Tab */}
        {currentTab === 'photos' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Photos</h2>
              <button className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90">
                Upload Photo
              </button>
            </div>
            <div className="rounded-lg border p-6 text-center">
              <div className="text-4xl mb-2">📷</div>
              <h3 className="text-lg font-semibold mb-2">No Photos</h3>
              <p className="text-muted-foreground">
                No photos have been uploaded for this lot yet. Add photos to document work progress.
              </p>
            </div>
          </div>
        )}

        {/* Documents Tab */}
        {currentTab === 'documents' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Documents</h2>
              <button className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90">
                Upload Document
              </button>
            </div>
            <div className="rounded-lg border p-6 text-center">
              <div className="text-4xl mb-2">📄</div>
              <h3 className="text-lg font-semibold mb-2">No Documents</h3>
              <p className="text-muted-foreground">
                No documents have been attached to this lot yet. Upload drawings, specifications, or other documents.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Quality Management Actions */}
      {canConformLots && lot.status !== 'conformed' && lot.status !== 'claimed' && (
        <div className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4">
          <h2 className="text-lg font-semibold text-green-800 mb-2">Quality Management</h2>
          <p className="text-sm text-green-700 mb-4">
            As a quality manager, you can conform this lot once all requirements are met.
          </p>

          {/* Conformance Prerequisites Checklist */}
          {loadingConformStatus ? (
            <div className="flex items-center gap-2 mb-4">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
              <span className="text-sm text-green-700">Loading prerequisites...</span>
            </div>
          ) : conformStatus ? (
            <div className="mb-4 space-y-2">
              <h3 className="text-sm font-medium text-green-800 mb-2">Prerequisites:</h3>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className={conformStatus.prerequisites.itpAssigned ? 'text-green-600' : 'text-red-600'}>
                    {conformStatus.prerequisites.itpAssigned ? '✓' : '✗'}
                  </span>
                  <span className={conformStatus.prerequisites.itpAssigned ? 'text-green-700' : 'text-red-700'}>
                    ITP Assigned
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className={conformStatus.prerequisites.itpCompleted ? 'text-green-600' : 'text-red-600'}>
                    {conformStatus.prerequisites.itpCompleted ? '✓' : '✗'}
                  </span>
                  <span className={conformStatus.prerequisites.itpCompleted ? 'text-green-700' : 'text-red-700'}>
                    ITP Completed ({conformStatus.prerequisites.itpCompletedCount}/{conformStatus.prerequisites.itpTotalCount} items)
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className={conformStatus.prerequisites.hasPassingTest ? 'text-green-600' : 'text-red-600'}>
                    {conformStatus.prerequisites.hasPassingTest ? '✓' : '✗'}
                  </span>
                  <span className={conformStatus.prerequisites.hasPassingTest ? 'text-green-700' : 'text-red-700'}>
                    Passing Verified Test Result
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className={conformStatus.prerequisites.noOpenNcrs ? 'text-green-600' : 'text-red-600'}>
                    {conformStatus.prerequisites.noOpenNcrs ? '✓' : '✗'}
                  </span>
                  <span className={conformStatus.prerequisites.noOpenNcrs ? 'text-green-700' : 'text-red-700'}>
                    No Open NCRs
                    {!conformStatus.prerequisites.noOpenNcrs && conformStatus.prerequisites.openNcrs.length > 0 && (
                      <span className="text-red-600 ml-1">
                        ({conformStatus.prerequisites.openNcrs.map(n => n.ncrNumber).join(', ')})
                      </span>
                    )}
                  </span>
                </div>
              </div>
              {!conformStatus.canConform && conformStatus.blockingReasons.length > 0 && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm font-medium text-red-800 mb-1">Cannot conform lot:</p>
                  <ul className="list-disc list-inside text-sm text-red-700">
                    {conformStatus.blockingReasons.map((reason, i) => (
                      <li key={i}>{reason}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : null}

          <div className="flex gap-4">
            <button
              onClick={handleConformLot}
              disabled={conforming || (conformStatus !== null && !conformStatus.canConform)}
              className={`rounded-lg px-4 py-2 text-sm text-white disabled:opacity-50 ${
                conformStatus?.canConform
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-gray-400 cursor-not-allowed'
              }`}
            >
              {conforming ? 'Conforming...' : 'Conform Lot'}
            </button>
            {canVerifyTestResults && (
              <button className="rounded-lg border border-green-600 px-4 py-2 text-sm text-green-600 hover:bg-green-100">
                Verify Test Results
              </button>
            )}
          </div>
        </div>
      )}

      {/* Conformed Status Display */}
      {lot.status === 'conformed' && (
        <div className="mt-6 rounded-lg border border-green-400 bg-green-100 p-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">✅</span>
            <div>
              <h2 className="text-lg font-semibold text-green-800">Lot Conformed</h2>
              <p className="text-sm text-green-700">
                This lot has been quality-approved and is ready for claiming.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
