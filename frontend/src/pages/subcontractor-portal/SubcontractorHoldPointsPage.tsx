import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Hand,
  AlertCircle,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import { apiFetch } from '@/lib/api'

interface HoldPoint {
  id: string
  lotId: string
  lotNumber: string
  description: string
  status: 'pending' | 'released' | 'rejected'
  requestedAt: string
  releasedAt?: string
  releasedBy?: { fullName: string }
  checklistItemDescription?: string
}

interface SubcontractorCompany {
  id: string
  companyName: string
  projectId: string
  projectName: string
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'released':
      return (
        <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
          <CheckCircle2 className="h-3 w-3" />
          Released
        </span>
      )
    case 'rejected':
      return (
        <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100">
          <AlertTriangle className="h-3 w-3" />
          Rejected
        </span>
      )
    default:
      return (
        <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100">
          <Clock className="h-3 w-3" />
          Pending
        </span>
      )
  }
}

export function SubcontractorHoldPointsPage() {
  const [holdPoints, setHoldPoints] = useState<HoldPoint[]>([])
  const [company, setCompany] = useState<SubcontractorCompany | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        // Get company info
        const companyData = await apiFetch<{ company: SubcontractorCompany }>(`/api/subcontractors/my-company`)
        setCompany(companyData.company)

        // Fetch hold points for assigned lots
        const hpData = await apiFetch<{ holdPoints: HoldPoint[] }>(
          `/api/holdpoints?projectId=${companyData.company.projectId}&subcontractorView=true`
        )
        setHoldPoints(hpData.holdPoints || [])
      } catch (err) {
        console.error('Error fetching data:', err)
        setError('Failed to load hold points')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const pending = holdPoints.filter(hp => hp.status === 'pending')
  const released = holdPoints.filter(hp => hp.status === 'released')
  const rejected = holdPoints.filter(hp => hp.status === 'rejected')

  if (loading) {
    return (
      <div className="container max-w-2xl mx-auto p-4 pb-20 md:pb-4 space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <Skeleton className="h-6 w-32" />
        </div>
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
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Hold Points</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{company?.projectName}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 p-3">
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{pending.length}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Pending</p>
        </div>
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 p-3">
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{released.length}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Released</p>
        </div>
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 p-3">
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">{rejected.length}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Rejected</p>
        </div>
      </div>

      {holdPoints.length === 0 ? (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
          <div className="p-8 text-center">
            <Hand className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400 mb-2">No hold points</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Hold points from your assigned lots will appear here
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Pending */}
          {pending.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                Pending Release ({pending.length})
              </h2>
              <div className="space-y-2">
                {pending.map((hp) => (
                  <HoldPointCard key={hp.id} holdPoint={hp} />
                ))}
              </div>
            </div>
          )}

          {/* Released */}
          {released.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                Released ({released.length})
              </h2>
              <div className="space-y-2">
                {released.map((hp) => (
                  <HoldPointCard key={hp.id} holdPoint={hp} />
                ))}
              </div>
            </div>
          )}

          {/* Rejected */}
          {rejected.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                Rejected ({rejected.length})
              </h2>
              <div className="space-y-2">
                {rejected.map((hp) => (
                  <HoldPointCard key={hp.id} holdPoint={hp} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function HoldPointCard({ holdPoint }: { holdPoint: HoldPoint }) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900">
              <Hand className="h-4 w-4 text-amber-600 dark:text-amber-300" />
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">{holdPoint.lotNumber}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {holdPoint.checklistItemDescription || holdPoint.description}
              </p>
              {holdPoint.releasedAt && holdPoint.releasedBy && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Released by {holdPoint.releasedBy.fullName} on{' '}
                  {new Date(holdPoint.releasedAt).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
          {getStatusBadge(holdPoint.status)}
        </div>
      </div>
    </div>
  )
}
