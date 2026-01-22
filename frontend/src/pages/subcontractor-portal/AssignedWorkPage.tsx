import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  MapPin,
  AlertCircle,
  Clock,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import { getAuthToken } from '@/lib/auth'
import { cn } from '@/lib/utils'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002'

interface Lot {
  id: string
  lotNumber: string
  activity?: string
  status: string
  area?: number
}

function getStatusBadge(status: string) {
  const variants: Record<string, string> = {
    not_started: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
    in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
    completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
    on_hold: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100',
  }
  const labels: Record<string, string> = {
    not_started: 'Not Started',
    in_progress: 'In Progress',
    completed: 'Completed',
    on_hold: 'On Hold',
  }
  return (
    <span className={cn('px-2 py-1 text-xs font-medium rounded-full', variants[status] || variants.not_started)}>
      {labels[status] || status}
    </span>
  )
}

export function AssignedWorkPage() {
  const [lots, setLots] = useState<Lot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [projectName, setProjectName] = useState('')

  useEffect(() => {
    async function fetchData() {
      try {
        const token = getAuthToken()
        const headers = { Authorization: `Bearer ${token}` }

        // Get company info
        const companyRes = await fetch(`${API_URL}/api/subcontractors/my-company`, { headers })
        if (!companyRes.ok) {
          setError('Failed to load company data')
          setLoading(false)
          return
        }
        const companyData = await companyRes.json()
        setProjectName(companyData.company.projectName)

        // Fetch assigned lots
        const lotsRes = await fetch(
          `${API_URL}/api/lots?projectId=${companyData.company.projectId}`,
          { headers }
        )
        if (lotsRes.ok) {
          const lotsData = await lotsRes.json()
          setLots(lotsData.lots || [])
        }
      } catch (err) {
        console.error('Error fetching data:', err)
        setError('Failed to load assigned work')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // Group lots by status
  const inProgress = lots.filter(l => l.status === 'in_progress')
  const notStarted = lots.filter(l => l.status === 'not_started' || !l.status)
  const completed = lots.filter(l => l.status === 'completed')
  const onHold = lots.filter(l => l.status === 'on_hold')

  if (loading) {
    return (
      <div className="container max-w-2xl mx-auto p-4 pb-20 md:pb-4 space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <Skeleton className="h-6 w-32" />
        </div>
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="container max-w-2xl mx-auto p-4">
        <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
        <Link
          to="/subcontractor-portal"
          className="inline-flex items-center gap-2 mt-4 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Portal
        </Link>
      </div>
    )
  }

  return (
    <div className="container max-w-2xl mx-auto p-4 pb-20 md:pb-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to="/subcontractor-portal"
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-300" />
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Assigned Work</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{projectName}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
          <div className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
              <MapPin className="h-5 w-5 text-blue-600 dark:text-blue-300" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{lots.length}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Assigned Lots</p>
            </div>
          </div>
        </div>
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
          <div className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900">
              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-300" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{inProgress.length}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">In Progress</p>
            </div>
          </div>
        </div>
      </div>

      {lots.length === 0 ? (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
          <div className="p-8 text-center">
            <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400 mb-2">No lots assigned yet</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Contact your project manager to get lot assignments
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* In Progress */}
          {inProgress.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                In Progress ({inProgress.length})
              </h2>
              <div className="space-y-2">
                {inProgress.map((lot) => (
                  <LotCard key={lot.id} lot={lot} />
                ))}
              </div>
            </div>
          )}

          {/* Not Started */}
          {notStarted.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                Not Started ({notStarted.length})
              </h2>
              <div className="space-y-2">
                {notStarted.map((lot) => (
                  <LotCard key={lot.id} lot={lot} />
                ))}
              </div>
            </div>
          )}

          {/* On Hold */}
          {onHold.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                On Hold ({onHold.length})
              </h2>
              <div className="space-y-2">
                {onHold.map((lot) => (
                  <LotCard key={lot.id} lot={lot} />
                ))}
              </div>
            </div>
          )}

          {/* Completed */}
          {completed.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                Completed ({completed.length})
              </h2>
              <div className="space-y-2">
                {completed.map((lot) => (
                  <LotCard key={lot.id} lot={lot} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function LotCard({ lot }: { lot: Lot }) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700">
              <MapPin className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">{lot.lotNumber}</p>
              {lot.activity && (
                <p className="text-sm text-gray-500 dark:text-gray-400">{lot.activity}</p>
              )}
              {lot.area && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Area: {lot.area.toLocaleString()} m²
                </p>
              )}
            </div>
          </div>
          {getStatusBadge(lot.status)}
        </div>
      </div>
    </div>
  )
}
