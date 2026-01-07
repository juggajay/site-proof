import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useCommercialAccess } from '@/hooks/useCommercialAccess'
import { useSubcontractorAccess } from '@/hooks/useSubcontractorAccess'
import { useViewerAccess } from '@/hooks/useViewerAccess'
import { getAuthToken } from '@/lib/auth'

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
  const { canViewBudgets } = useCommercialAccess()
  const { isSubcontractor } = useSubcontractorAccess()
  const { canCreate } = useViewerAccess()
  const [lots, setLots] = useState<Lot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Lot Register</h1>
        {!isSubcontractor && canCreate && (
          <button className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90">
            Create Lot
          </button>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        {isSubcontractor
          ? `Viewing lots assigned to your company for project ${projectId}.`
          : `Manage lots for project ${projectId}. The lot is the atomic unit of the system.`}
      </p>

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
              {lots.length === 0 ? (
                <tr>
                  <td colSpan={isSubcontractor ? 6 : 8} className="p-6 text-center text-muted-foreground">
                    {isSubcontractor ? 'No lots assigned to your company yet.' : 'No lots created yet.'}
                  </td>
                </tr>
              ) : (
                lots.map((lot) => (
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
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
