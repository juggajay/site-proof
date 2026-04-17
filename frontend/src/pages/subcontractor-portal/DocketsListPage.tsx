import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  MessageSquare,
  ChevronRight,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { Skeleton } from '@/components/ui/Skeleton'
import { apiFetch } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/useMediaQuery'

interface Docket {
  id: string
  docketNumber: string
  date: string
  status: string
  totalLabourSubmitted: number
  totalPlantSubmitted: number
  foremanNotes?: string
}

function formatDate(dateString: string) {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
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

function getDocketStatusIcon(status: string) {
  switch (status) {
    case 'draft':
      return <Clock className="h-5 w-5 text-muted-foreground" />
    case 'pending_approval':
      return <Clock className="h-5 w-5 text-amber-500" />
    case 'approved':
      return <CheckCircle className="h-5 w-5 text-green-500" />
    case 'rejected':
      return <XCircle className="h-5 w-5 text-red-500" />
    case 'queried':
      return <MessageSquare className="h-5 w-5 text-amber-500" />
    default:
      return <Clock className="h-5 w-5 text-muted-foreground" />
  }
}

function getDocketStatusBadge(status: string) {
  const variants: Record<string, string> = {
    draft: 'bg-muted text-foreground',
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

export function DocketsListPage() {
  const isMobile = useIsMobile()
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const { data: company } = useQuery({
    queryKey: queryKeys.portalCompanies,
    queryFn: async () => {
      const res = await apiFetch<{ company: { projectId: string } }>('/api/subcontractors/my-company')
      return res.company
    },
  })

  const { data: dockets = [], isLoading: loading } = useQuery({
    queryKey: queryKeys.portalDockets,
    queryFn: async () => {
      const res = await apiFetch<{ dockets: Docket[] }>(
        `/api/dockets?projectId=${company!.projectId}`
      )
      return res.dockets || []
    },
    enabled: !!company?.projectId,
  })

  // Filter dockets
  const filteredDockets = statusFilter === 'all'
    ? dockets
    : dockets.filter(d => d.status === statusFilter)

  // Group by month
  const groupedByMonth = filteredDockets.reduce((groups, docket) => {
    const date = new Date(docket.date)
    const monthKey = `${date.getFullYear()}-${date.getMonth()}`
    const monthLabel = date.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })

    if (!groups[monthKey]) {
      groups[monthKey] = { label: monthLabel, dockets: [] }
    }
    groups[monthKey].dockets.push(docket)
    return groups
  }, {} as Record<string, { label: string; dockets: Docket[] }>)

  const monthGroups = Object.values(groupedByMonth)

  // Calculate stats
  const stats = {
    total: dockets.length,
    pending: dockets.filter(d => d.status === 'pending_approval').length,
    approved: dockets.filter(d => d.status === 'approved').length,
    queried: dockets.filter(d => d.status === 'queried').length,
  }

  if (loading) {
    return (
      <div className="container max-w-2xl mx-auto p-4 pb-20 md:pb-4 space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <Skeleton className="h-6 w-32" />
        </div>
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
    )
  }

  return (
    <div className="container max-w-2xl mx-auto p-4 pb-20 md:pb-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to="/subcontractor-portal"
          className="p-2 rounded-lg hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-muted-foreground" />
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-foreground">Docket History</h1>
          <p className="text-sm text-muted-foreground dark:text-muted-foreground">{stats.total} dockets</p>
        </div>
      </div>

      {/* Filter tabs - wraps on mobile */}
      <div className={cn(
        "p-1 bg-muted rounded-lg",
        isMobile ? "grid grid-cols-2 gap-1" : "flex gap-1 overflow-x-auto"
      )}>
        <button
          onClick={() => setStatusFilter('all')}
          className={cn(
            'flex items-center justify-center gap-1 px-3 py-2.5 text-sm font-medium rounded-md transition-colors touch-manipulation',
            statusFilter === 'all'
              ? 'bg-card text-foreground shadow'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          All
          <span className="px-1.5 py-0.5 text-xs bg-muted rounded">{stats.total}</span>
        </button>
        <button
          onClick={() => setStatusFilter('pending_approval')}
          className={cn(
            'flex items-center justify-center gap-1 px-3 py-2.5 text-sm font-medium rounded-md transition-colors touch-manipulation',
            statusFilter === 'pending_approval'
              ? 'bg-card text-foreground shadow'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Pending
          {stats.pending > 0 && <span className="px-1.5 py-0.5 text-xs bg-muted rounded">{stats.pending}</span>}
        </button>
        <button
          onClick={() => setStatusFilter('approved')}
          className={cn(
            'flex items-center justify-center gap-1 px-3 py-2.5 text-sm font-medium rounded-md transition-colors touch-manipulation',
            statusFilter === 'approved'
              ? 'bg-card text-foreground shadow'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Approved
          {stats.approved > 0 && <span className="px-1.5 py-0.5 text-xs bg-muted rounded">{stats.approved}</span>}
        </button>
        <button
          onClick={() => setStatusFilter('queried')}
          className={cn(
            'flex items-center justify-center gap-1 px-3 py-2.5 text-sm font-medium rounded-md transition-colors touch-manipulation',
            statusFilter === 'queried'
              ? 'bg-card text-foreground shadow'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Queried
          {stats.queried > 0 && <span className="px-1.5 py-0.5 text-xs bg-muted rounded">{stats.queried}</span>}
        </button>
      </div>

      {/* Docket list */}
      {filteredDockets.length === 0 ? (
        <div className="border border-border rounded-lg bg-card">
          <div className="p-8 text-center">
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground dark:text-muted-foreground">
              {statusFilter === 'all' ? 'No dockets yet' : `No ${statusFilter.replace('_', ' ')} dockets`}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {monthGroups.map((group) => (
            <div key={group.label}>
              <h3 className="text-sm font-medium text-muted-foreground dark:text-muted-foreground mb-2">{group.label}</h3>
              <div className="space-y-2">
                {group.dockets.map((docket) => (
                  <Link key={docket.id} to={`/subcontractor-portal/docket/${docket.id}`}>
                    <div className="border border-border rounded-lg bg-card hover:border-primary transition-colors">
                      <div className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {getDocketStatusIcon(docket.status)}
                            <div>
                              <p className="font-medium text-foreground">{formatDate(docket.date)}</p>
                              <p className="text-sm text-muted-foreground dark:text-muted-foreground">
                                {formatCurrency(docket.totalLabourSubmitted + docket.totalPlantSubmitted)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {getDocketStatusBadge(docket.status)}
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                        {(docket.status === 'queried' || docket.status === 'rejected') && docket.foremanNotes && (
                          <p className="text-sm text-muted-foreground dark:text-muted-foreground mt-2 pl-8 truncate">
                            {docket.foremanNotes}
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
