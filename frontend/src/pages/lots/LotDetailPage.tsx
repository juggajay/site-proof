import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useCommercialAccess } from '@/hooks/useCommercialAccess'
import { getAuthToken } from '@/lib/auth'

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

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  on_hold: 'bg-red-100 text-red-800',
}

export function LotDetailPage() {
  const { projectId, lotId } = useParams()
  const navigate = useNavigate()
  const { canViewBudgets } = useCommercialAccess()
  const [lot, setLot] = useState<Lot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<{ type: 'not_found' | 'forbidden' | 'error'; message: string } | null>(null)
  const [conforming, setConforming] = useState(false)
  const [qualityAccess, setQualityAccess] = useState<QualityAccess | null>(null)

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

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{lot.lotNumber}</h1>
          <p className="text-sm text-muted-foreground">{lot.description || 'No description'}</p>
        </div>
        <span className={`px-3 py-1 rounded text-sm font-medium ${statusColors[lot.status] || 'bg-gray-100'}`}>
          {lot.status.replace('_', ' ')}
        </span>
      </div>

      {/* Lot Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Location Info */}
        <div className="rounded-lg border p-4">
          <h2 className="text-lg font-semibold mb-4">Location</h2>
          <div className="space-y-3">
            <div>
              <span className="text-sm text-muted-foreground">Chainage</span>
              <p className="font-medium">
                {lot.chainageStart != null && lot.chainageEnd != null
                  ? `${lot.chainageStart} - ${lot.chainageEnd}`
                  : lot.chainageStart ?? lot.chainageEnd ?? '—'}
              </p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Offset</span>
              <p className="font-medium">{lot.offset || '—'}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Layer</span>
              <p className="font-medium">{lot.layer || '—'}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Area/Zone</span>
              <p className="font-medium">{lot.areaZone || '—'}</p>
            </div>
          </div>
        </div>

        {/* Activity Info */}
        <div className="rounded-lg border p-4">
          <h2 className="text-lg font-semibold mb-4">Activity</h2>
          <div className="space-y-3">
            <div>
              <span className="text-sm text-muted-foreground">Activity Type</span>
              <p className="font-medium capitalize">{lot.activityType || '—'}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">ITP Template</span>
              <p className="font-medium">—</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Assigned Subcontractor</span>
              <p className="font-medium">—</p>
            </div>
          </div>
        </div>

        {/* Commercial Info - Only visible to users with commercial access */}
        {canViewBudgets && (
          <div className="rounded-lg border p-4">
            <h2 className="text-lg font-semibold mb-4">Commercial</h2>
            <div className="space-y-3">
              <div>
                <span className="text-sm text-muted-foreground">Budget Amount</span>
                <p className="font-medium text-lg">—</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Cost to Date</span>
                <p className="font-medium">—</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Variance</span>
                <p className="font-medium">—</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ITP Progress */}
      <div className="rounded-lg border p-4">
        <h2 className="text-lg font-semibold mb-4">ITP Progress</h2>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div className="bg-primary h-2.5 rounded-full" style={{ width: '0%' }}></div>
        </div>
        <p className="text-sm text-muted-foreground mt-2">0 of 0 checklist items completed</p>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-4">
        <button className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90">
          Complete ITP Item
        </button>
        <button className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">
          Add Photo
        </button>
        <button className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">
          Link Test Result
        </button>
        <button className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">
          View Documents
        </button>
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
