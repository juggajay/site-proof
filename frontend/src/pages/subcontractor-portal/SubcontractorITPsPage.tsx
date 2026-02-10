import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  ClipboardList,
  AlertCircle,
  CheckCircle2,
  Clock,
  ChevronRight,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import { apiFetch } from '@/lib/api'

interface LotAssignment {
  id: string
  canCompleteITP: boolean
  itpRequiresVerification: boolean
}

interface ITPInstance {
  id: string
  status: string
  template: {
    id: string
    name: string
    activityType: string
  }
  completionPercentage?: number
}

interface Lot {
  id: string
  lotNumber: string
  description?: string
  status: string
  activityType?: string
  itpInstances?: ITPInstance[]
  subcontractorAssignments?: LotAssignment[]
}

interface SubcontractorCompany {
  id: string
  companyName: string
  projectId: string
  projectName: string
}

function getITPStatusBadge(status: string, percentage?: number) {
  if (status === 'completed') {
    return (
      <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
        <CheckCircle2 className="h-3 w-3" />
        Complete
      </span>
    )
  }
  if (status === 'in_progress' || (percentage && percentage > 0)) {
    return (
      <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
        <Clock className="h-3 w-3" />
        {percentage ? `${percentage}%` : 'In Progress'}
      </span>
    )
  }
  return (
    <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
      Not Started
    </span>
  )
}

export function SubcontractorITPsPage() {
  const [lots, setLots] = useState<Lot[]>([])
  const [company, setCompany] = useState<SubcontractorCompany | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        // Get company info
        const companyData = await apiFetch<{ company: SubcontractorCompany }>(`/api/subcontractors/my-company`)
        setCompany(companyData.company)

        // Fetch lots with ITP data - the backend filters to assigned lots
        const lotsData = await apiFetch<{ lots: Lot[] }>(
          `/api/lots?projectId=${companyData.company.projectId}&includeITP=true`
        )
        // Show all assigned lots with ITPs (backend already filters to assigned lots)
        const assignedLots = (lotsData.lots || []).filter((lot: Lot) => {
          return lot.itpInstances && lot.itpInstances.length > 0
        })
        setLots(assignedLots)
      } catch (err) {
        console.error('Error fetching data:', err)
        setError('Failed to load ITPs')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // Group by ITP status
  const inProgress = lots.filter(l =>
    l.itpInstances?.some(itp => itp.status === 'in_progress')
  )
  const notStarted = lots.filter(l =>
    l.itpInstances?.every(itp => itp.status === 'not_started')
  )
  const completed = lots.filter(l =>
    l.itpInstances?.every(itp => itp.status === 'completed')
  )

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
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">ITPs</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{company?.projectName}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 p-3">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{lots.length}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Total ITPs</p>
        </div>
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 p-3">
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{inProgress.length}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">In Progress</p>
        </div>
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 p-3">
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{completed.length}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Completed</p>
        </div>
      </div>

      {lots.length === 0 ? (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
          <div className="p-8 text-center">
            <ClipboardList className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400 mb-2">No ITPs assigned yet</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              ITPs will appear here when you're assigned to lots with ITP completion permission
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
                  <ITPLotCard key={lot.id} lot={lot} />
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
                  <ITPLotCard key={lot.id} lot={lot} />
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
                  <ITPLotCard key={lot.id} lot={lot} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ITPLotCard({ lot }: { lot: Lot }) {
  const itp = lot.itpInstances?.[0]
  const canComplete = lot.subcontractorAssignments?.some(a => a.canCompleteITP) ?? false

  return (
    <Link
      to={`/subcontractor-portal/lots/${lot.id}/itp`}
      className="block border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 hover:border-blue-500 transition-colors"
    >
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${canComplete ? 'bg-green-100 dark:bg-green-900' : 'bg-gray-100 dark:bg-gray-700'}`}>
              <ClipboardList className={`h-4 w-4 ${canComplete ? 'text-green-600 dark:text-green-300' : 'text-gray-500 dark:text-gray-400'}`} />
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">{lot.lotNumber}</p>
              {itp && (
                <p className="text-sm text-gray-500 dark:text-gray-400">{itp.template.name}</p>
              )}
              {!canComplete && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">View only - contact PM for completion access</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {itp && getITPStatusBadge(itp.status, itp.completionPercentage)}
            <ChevronRight className="h-5 w-5 text-gray-400" />
          </div>
        </div>
      </div>
    </Link>
  )
}
