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
            <div className="rounded-lg border p-4">
              <h2 className="text-lg font-semibold mb-4">ITP Progress</h2>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div className="bg-primary h-2.5 rounded-full" style={{ width: '0%' }}></div>
              </div>
              <p className="text-sm text-muted-foreground mt-2">0 of 0 checklist items completed</p>
            </div>
            <div className="rounded-lg border p-6 text-center">
              <div className="text-4xl mb-2">📋</div>
              <h3 className="text-lg font-semibold mb-2">ITP Checklist</h3>
              <p className="text-muted-foreground mb-4">
                No ITP template assigned to this lot yet. Assign an ITP template to track quality checkpoints.
              </p>
              <button className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90">
                Assign ITP Template
              </button>
            </div>
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
          <div className="flex gap-4">
            <button
              onClick={async () => {
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
                    alert(data.error || 'Failed to conform lot')
                  }
                } catch (err) {
                  alert('Failed to conform lot')
                } finally {
                  setConforming(false)
                }
              }}
              disabled={conforming}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50"
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
