import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  MapPin,
  Bell,
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  MessageSquare,
  ChevronRight,
  Plus,
  RefreshCw,
  Building2,
  Calendar,
  ClipboardList,
  FlaskConical,
  FolderOpen,
  Hand,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAuth } from '@/lib/auth'
import { apiFetch } from '@/lib/api'
import { cn } from '@/lib/utils'

interface PortalAccess {
  lots: boolean
  itps: boolean
  holdPoints: boolean
  testResults: boolean
  ncrs: boolean
  documents: boolean
}

interface Company {
  id: string
  companyName: string
  projectId: string
  projectName: string
  employees: Array<{
    id: string
    name: string
    status: string
  }>
  plant: Array<{
    id: string
    type: string
    status: string
  }>
  portalAccess?: PortalAccess
}

interface Docket {
  id: string
  docketNumber: string
  date: string
  status: string
  totalLabourSubmitted: number
  totalPlantSubmitted: number
  foremanNotes?: string
}

interface Lot {
  id: string
  lotNumber: string
  activity?: string
  status: string
}

interface Notification {
  id: string
  type: string
  title: string
  message: string
  read: boolean
  createdAt: string
  linkUrl?: string
}

function formatDate(dateString: string) {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function getToday() {
  return new Date().toISOString().split('T')[0]
}

function getDocketStatusIcon(status: string) {
  switch (status) {
    case 'draft':
      return <Clock className="h-5 w-5 text-gray-400" />
    case 'pending_approval':
      return <Clock className="h-5 w-5 text-amber-500" />
    case 'approved':
      return <CheckCircle className="h-5 w-5 text-green-500" />
    case 'rejected':
      return <XCircle className="h-5 w-5 text-red-500" />
    case 'queried':
      return <MessageSquare className="h-5 w-5 text-amber-500" />
    default:
      return <Clock className="h-5 w-5 text-gray-400" />
  }
}

function getDocketStatusBadge(status: string) {
  const variants: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
    pending_approval: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100',
    approved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
    rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
    queried: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100',
  }
  const labels: Record<string, string> = {
    draft: 'Draft',
    pending_approval: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
    queried: 'Queried',
  }
  return (
    <span className={cn('px-2 py-1 text-xs font-medium rounded-full', variants[status] || variants.draft)}>
      {labels[status] || status}
    </span>
  )
}

export function SubcontractorDashboard() {
  const { user } = useAuth()
  const [company, setCompany] = useState<Company | null>(null)
  const [todaysDocket, setTodaysDocket] = useState<Docket | null>(null)
  const [recentDockets, setRecentDockets] = useState<Docket[]>([])
  const [assignedLots, setAssignedLots] = useState<Lot[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)

    try {
      // Fetch company info
      const companyData = await apiFetch<{ company: Company }>(`/api/subcontractors/my-company`)
      setCompany(companyData.company)

      // Fetch dockets for this project
      try {
        const docketsData = await apiFetch<{ dockets: Docket[] }>(
          `/api/dockets?projectId=${companyData.company.projectId}`
        )
        const today = getToday()

        // Find today's docket
        const todayDocket = docketsData.dockets.find((d: Docket) => d.date === today)
        setTodaysDocket(todayDocket || null)

        // Get recent dockets (excluding today)
        const recent = docketsData.dockets
          .filter((d: Docket) => d.date !== today)
          .slice(0, 5)
        setRecentDockets(recent)
      } catch {
        // Dockets fetch failed, continue
      }

      // Fetch assigned lots
      try {
        const lotsData = await apiFetch<{ lots: Lot[] }>(
          `/api/lots?projectId=${companyData.company.projectId}`
        )
        setAssignedLots(lotsData.lots.slice(0, 5))
      } catch {
        // Lots fetch failed, continue
      }

      // Fetch notifications
      try {
        const notifData = await apiFetch<{ notifications: Notification[]; unreadCount: number }>(`/api/notifications?limit=10`)
        setNotifications(notifData.notifications || [])
        setUnreadCount(notifData.unreadCount || 0)
      } catch {
        // Notifications fetch failed, continue
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Get items needing attention
  const needsAttention = [
    // Queried dockets
    ...recentDockets
      .filter(d => d.status === 'queried')
      .map(d => ({
        id: d.id,
        type: 'docket_queried',
        title: 'Docket Queried',
        message: d.foremanNotes || 'Please review and respond',
        date: d.date,
        link: `/subcontractor-portal/docket/${d.id}`,
      })),
    // Rejected dockets
    ...recentDockets
      .filter(d => d.status === 'rejected')
      .map(d => ({
        id: d.id,
        type: 'docket_rejected',
        title: 'Docket Rejected',
        message: d.foremanNotes || 'Please review and resubmit',
        date: d.date,
        link: `/subcontractor-portal/docket/${d.id}`,
      })),
    // Rate counter-proposals from notifications
    ...notifications
      .filter(n => n.type === 'rate_counter' && !n.read)
      .map(n => ({
        id: n.id,
        type: 'rate_counter',
        title: n.title,
        message: n.message,
        date: n.createdAt,
        link: '/my-company',
      })),
  ]

  if (loading) {
    return (
      <div className="container max-w-2xl mx-auto p-4 pb-20 md:pb-4 space-y-6">
        {/* Header skeleton */}
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        {/* Today's docket skeleton */}
        <Skeleton className="h-48 w-full rounded-lg" />
        {/* Needs attention skeleton */}
        <Skeleton className="h-32 w-full rounded-lg" />
        {/* Lots skeleton */}
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    )
  }

  return (
    <div className="container max-w-2xl mx-auto p-4 pb-20 md:pb-4 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            {getGreeting()}, {user?.fullName?.split(' ')[0] || 'there'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1.5 mt-1">
            <Building2 className="h-4 w-4" />
            {company?.companyName || 'Your Company'}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {company?.projectName || 'Project'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-5 w-5 text-gray-500', refreshing && 'animate-spin')} />
          </button>
          <Link to="/settings" className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <Bell className="h-5 w-5 text-gray-500" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* Today's Docket Card */}
      <div className="border-2 border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
        <div className="p-4 pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Today's Docket</h2>
            </div>
            {todaysDocket && getDocketStatusBadge(todaysDocket.status)}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{formatDate(getToday())}</p>
        </div>
        <div className="p-4 pt-2">
          {todaysDocket ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Labour</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(todaysDocket.totalLabourSubmitted)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Plant</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(todaysDocket.totalPlantSubmitted)}
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(todaysDocket.totalLabourSubmitted + todaysDocket.totalPlantSubmitted)}
                </p>
              </div>
              <Link
                to={`/subcontractor-portal/docket/${todaysDocket.id}`}
                className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                {todaysDocket.status === 'draft' ? 'Continue Docket' : 'View Docket'}
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-gray-500 dark:text-gray-400 mb-4">No docket started for today</p>
              <Link
                to="/subcontractor-portal/docket/new"
                className="inline-flex items-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                <Plus className="h-4 w-4" />
                Start Today's Docket
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Needs Attention */}
      {needsAttention.length > 0 && (
        <div className="border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 rounded-lg">
          <div className="p-4 pb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Needs Attention ({needsAttention.length})</h2>
            </div>
          </div>
          <div className="p-4 pt-2 space-y-3">
            {needsAttention.slice(0, 3).map((item) => (
              <Link
                key={item.id}
                to={item.link}
                className="block p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 dark:text-white">{item.title}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{item.message}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400 shrink-0 ml-2" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Assigned Lots - Only show if portal access allows */}
      {company?.portalAccess?.lots !== false && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
          <div className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-gray-400" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Assigned Lots</h2>
              </div>
              <span className="px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full">
                {assignedLots.length}
              </span>
            </div>
          </div>
          <div className="p-4 pt-2">
            {assignedLots.length > 0 ? (
              <div className="space-y-2">
                {assignedLots.map((lot) => (
                  <div
                    key={lot.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50"
                  >
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      <span className="font-medium text-gray-900 dark:text-white">{lot.lotNumber}</span>
                      {lot.activity && (
                        <span className="text-sm text-gray-500 dark:text-gray-400">- {lot.activity}</span>
                      )}
                    </div>
                  </div>
                ))}
                <Link
                  to="/subcontractor-portal/work"
                  className="flex items-center justify-center gap-2 w-full py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors mt-2"
                >
                  View All Work
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            ) : (
              <p className="text-center text-gray-500 dark:text-gray-400 py-4">
                No lots assigned yet. Contact your project manager.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Recent Dockets */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
        <div className="p-4 pb-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Dockets</h2>
            <Link
              to="/subcontractor-portal/dockets"
              className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              View All
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
        <div className="p-4 pt-2">
          {recentDockets.length > 0 ? (
            <div className="space-y-2">
              {recentDockets.slice(0, 3).map((docket) => (
                <Link
                  key={docket.id}
                  to={`/subcontractor-portal/docket/${docket.id}`}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {getDocketStatusIcon(docket.status)}
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{formatDate(docket.date)}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {formatCurrency(docket.totalLabourSubmitted + docket.totalPlantSubmitted)}
                      </p>
                    </div>
                  </div>
                  {getDocketStatusBadge(docket.status)}
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 dark:text-gray-400 py-4">
              No previous dockets
            </p>
          )}
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          to="/my-company"
          className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 hover:border-blue-500 transition-colors cursor-pointer"
        >
          <div className="p-4 flex items-center gap-3">
            <Building2 className="h-5 w-5 text-gray-400" />
            <div>
              <p className="font-medium text-gray-900 dark:text-white">My Company</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Manage roster & plant</p>
            </div>
          </div>
        </Link>
        <Link
          to="/subcontractor-portal/dockets"
          className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 hover:border-blue-500 transition-colors cursor-pointer"
        >
          <div className="p-4 flex items-center gap-3">
            <Calendar className="h-5 w-5 text-gray-400" />
            <div>
              <p className="font-medium text-gray-900 dark:text-white">All Dockets</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">View history</p>
            </div>
          </div>
        </Link>
        {/* Portal Access - ITPs */}
        {company?.portalAccess?.itps && (
          <Link
            to="/subcontractor-portal/itps"
            className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 hover:border-blue-500 transition-colors cursor-pointer"
          >
            <div className="p-4 flex items-center gap-3">
              <ClipboardList className="h-5 w-5 text-green-500" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">ITPs</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Inspection & Test Plans</p>
              </div>
            </div>
          </Link>
        )}
        {/* Portal Access - Hold Points */}
        {company?.portalAccess?.holdPoints && (
          <Link
            to="/subcontractor-portal/holdpoints"
            className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 hover:border-blue-500 transition-colors cursor-pointer"
          >
            <div className="p-4 flex items-center gap-3">
              <Hand className="h-5 w-5 text-amber-500" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Hold Points</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">View hold points</p>
              </div>
            </div>
          </Link>
        )}
        {/* Portal Access - Test Results */}
        {company?.portalAccess?.testResults && (
          <Link
            to="/subcontractor-portal/tests"
            className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 hover:border-blue-500 transition-colors cursor-pointer"
          >
            <div className="p-4 flex items-center gap-3">
              <FlaskConical className="h-5 w-5 text-blue-500" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Test Results</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">View test results</p>
              </div>
            </div>
          </Link>
        )}
        {/* Portal Access - NCRs */}
        {company?.portalAccess?.ncrs && (
          <Link
            to="/subcontractor-portal/ncrs"
            className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 hover:border-blue-500 transition-colors cursor-pointer"
          >
            <div className="p-4 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">NCRs</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Non-conformance reports</p>
              </div>
            </div>
          </Link>
        )}
        {/* Portal Access - Documents */}
        {company?.portalAccess?.documents && (
          <Link
            to="/subcontractor-portal/documents"
            className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 hover:border-blue-500 transition-colors cursor-pointer"
          >
            <div className="p-4 flex items-center gap-3">
              <FolderOpen className="h-5 w-5 text-purple-500" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Documents</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Project documents</p>
              </div>
            </div>
          </Link>
        )}
      </div>
    </div>
  )
}
