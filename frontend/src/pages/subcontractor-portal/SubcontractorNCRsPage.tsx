import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import { getAuthToken } from '@/lib/auth'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

interface NCR {
  id: string
  ncrNumber: string
  lotId?: string
  lotNumber?: string
  description: string
  status: 'open' | 'in_progress' | 'closed' | 'rejected'
  severity: 'minor' | 'major' | 'critical'
  raisedAt: string
  raisedBy?: { fullName: string }
  closedAt?: string
}

interface SubcontractorCompany {
  id: string
  companyName: string
  projectId: string
  projectName: string
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'closed':
      return (
        <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
          <CheckCircle2 className="h-3 w-3" />
          Closed
        </span>
      )
    case 'in_progress':
      return (
        <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
          <Clock className="h-3 w-3" />
          In Progress
        </span>
      )
    case 'rejected':
      return (
        <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
          <XCircle className="h-3 w-3" />
          Rejected
        </span>
      )
    default:
      return (
        <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100">
          <AlertTriangle className="h-3 w-3" />
          Open
        </span>
      )
  }
}

function getSeverityBadge(severity: string) {
  switch (severity) {
    case 'critical':
      return (
        <span className="px-2 py-0.5 text-xs font-medium rounded bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100">
          Critical
        </span>
      )
    case 'major':
      return (
        <span className="px-2 py-0.5 text-xs font-medium rounded bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100">
          Major
        </span>
      )
    default:
      return (
        <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
          Minor
        </span>
      )
  }
}

export function SubcontractorNCRsPage() {
  const [ncrs, setNCRs] = useState<NCR[]>([])
  const [company, setCompany] = useState<SubcontractorCompany | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
        setCompany(companyData.company)

        // Fetch NCRs for assigned lots
        const ncrsRes = await fetch(
          `${API_URL}/api/ncrs?projectId=${companyData.company.projectId}&subcontractorView=true`,
          { headers }
        )
        if (ncrsRes.ok) {
          const ncrsData = await ncrsRes.json()
          setNCRs(ncrsData.ncrs || [])
        }
      } catch (err) {
        console.error('Error fetching data:', err)
        setError('Failed to load NCRs')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const open = ncrs.filter(n => n.status === 'open')
  const inProgress = ncrs.filter(n => n.status === 'in_progress')
  const closed = ncrs.filter(n => n.status === 'closed' || n.status === 'rejected')

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
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">NCRs</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{company?.projectName}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 p-3">
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">{open.length}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Open</p>
        </div>
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 p-3">
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{inProgress.length}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">In Progress</p>
        </div>
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 p-3">
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{closed.length}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Closed</p>
        </div>
      </div>

      {ncrs.length === 0 ? (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
          <div className="p-8 text-center">
            <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400 mb-2">No NCRs</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Non-conformance reports related to your work will appear here
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Open - show first as priority */}
          {open.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-red-500 dark:text-red-400 mb-2">
                Open ({open.length})
              </h2>
              <div className="space-y-2">
                {open.map((ncr) => (
                  <NCRCard key={ncr.id} ncr={ncr} />
                ))}
              </div>
            </div>
          )}

          {/* In Progress */}
          {inProgress.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                In Progress ({inProgress.length})
              </h2>
              <div className="space-y-2">
                {inProgress.map((ncr) => (
                  <NCRCard key={ncr.id} ncr={ncr} />
                ))}
              </div>
            </div>
          )}

          {/* Closed */}
          {closed.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                Closed ({closed.length})
              </h2>
              <div className="space-y-2">
                {closed.map((ncr) => (
                  <NCRCard key={ncr.id} ncr={ncr} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function NCRCard({ ncr }: { ncr: NCR }) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900">
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium text-gray-900 dark:text-white">{ncr.ncrNumber}</p>
                {getSeverityBadge(ncr.severity)}
              </div>
              {ncr.lotNumber && (
                <p className="text-sm text-gray-500 dark:text-gray-400">Lot: {ncr.lotNumber}</p>
              )}
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                {ncr.description}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Raised {new Date(ncr.raisedAt).toLocaleDateString()}
                {ncr.raisedBy && ` by ${ncr.raisedBy.fullName}`}
              </p>
            </div>
          </div>
          {getStatusBadge(ncr.status)}
        </div>
      </div>
    </div>
  )
}
