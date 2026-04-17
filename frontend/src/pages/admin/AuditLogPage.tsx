import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ClipboardList, Search, Filter, Calendar, User, ChevronLeft, ChevronRight, X, Download } from 'lucide-react'
import { useDateFormat } from '@/lib/dateFormat'
import { apiFetch } from '@/lib/api'
import { queryKeys } from '@/lib/queryKeys'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'

interface AuditLog {
  id: string
  action: string
  entityType: string
  entityId: string
  changes: any
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
  user: {
    id: string
    email: string
    fullName: string | null
  } | null
  project: {
    id: string
    name: string
    projectNumber: string
  } | null
}

interface FilterState {
  projectId: string
  entityType: string
  action: string
  userId: string
  search: string
  startDate: string
  endDate: string
}

export function AuditLogPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { formatDate: _formatDate } = useDateFormat()

  // Pagination
  const [page, setPage] = useState(1)
  const limit = 50

  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    projectId: searchParams.get('projectId') || '',
    entityType: searchParams.get('entityType') || '',
    action: searchParams.get('action') || '',
    userId: searchParams.get('userId') || '',
    search: searchParams.get('search') || '',
    startDate: searchParams.get('startDate') || '',
    endDate: searchParams.get('endDate') || '',
  })

  const [showFilters, setShowFilters] = useState(false)

  // Selected log for detail view
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)

  // Filter options from API
  const { data: actionsData } = useQuery({
    queryKey: ['audit-logs', 'actions'] as const,
    queryFn: () => apiFetch<{ actions: string[] }>('/api/audit-logs/actions'),
  })

  const { data: entityTypesData } = useQuery({
    queryKey: ['audit-logs', 'entity-types'] as const,
    queryFn: () => apiFetch<{ entityTypes: string[] }>('/api/audit-logs/entity-types'),
  })

  const { data: usersData } = useQuery({
    queryKey: ['audit-logs', 'users'] as const,
    queryFn: () => apiFetch<{ users: { id: string; email: string; fullName: string | null }[] }>('/api/audit-logs/users'),
  })

  const actions = actionsData?.actions || []
  const entityTypes = entityTypesData?.entityTypes || []
  const users = usersData?.users || []

  // Build query params for logs
  const logsParams = (() => {
    const params = new URLSearchParams()
    params.append('page', page.toString())
    params.append('limit', limit.toString())
    if (filters.projectId) params.append('projectId', filters.projectId)
    if (filters.entityType) params.append('entityType', filters.entityType)
    if (filters.action) params.append('action', filters.action)
    if (filters.userId) params.append('userId', filters.userId)
    if (filters.search) params.append('search', filters.search)
    if (filters.startDate) params.append('startDate', filters.startDate)
    if (filters.endDate) params.append('endDate', filters.endDate)
    return params.toString()
  })()

  const { data: logsData, isLoading: loading, error: logsError } = useQuery({
    queryKey: queryKeys.auditLogs(JSON.stringify({ page, ...filters })),
    queryFn: () => apiFetch<{ logs: AuditLog[]; pagination?: { totalPages: number; total: number } }>(`/api/audit-logs?${logsParams}`),
  })

  const logs = logsData?.logs || []
  const totalPages = logsData?.pagination?.totalPages || 1
  const total = logsData?.pagination?.total || 0
  const error = logsError ? 'Failed to load audit logs' : null

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPage(1) // Reset to page 1 when filters change

    // Update URL params
    const newParams = new URLSearchParams(searchParams)
    if (value) {
      newParams.set(key, value)
    } else {
      newParams.delete(key)
    }
    setSearchParams(newParams)
  }

  const clearFilters = () => {
    setFilters({
      projectId: '',
      entityType: '',
      action: '',
      userId: '',
      search: '',
      startDate: '',
      endDate: '',
    })
    setSearchParams({})
    setPage(1)
  }

  const hasActiveFilters = Object.values(filters).some((v) => v !== '')

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString('en-AU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getActionColor = (action: string) => {
    if (action.includes('create') || action.includes('add')) return 'text-green-600 bg-green-50'
    if (action.includes('delete') || action.includes('remove')) return 'text-red-600 bg-red-50'
    if (action.includes('update') || action.includes('edit')) return 'text-primary bg-primary/5'
    return 'text-muted-foreground bg-muted/50'
  }

  const exportToCSV = () => {
    const headers = ['Date', 'Action', 'Entity Type', 'Entity ID', 'User', 'Project']
    const rows = logs.map((log) => [
      formatDateTime(log.createdAt),
      log.action,
      log.entityType,
      log.entityId,
      log.user?.email || 'System',
      log.project?.name || '-',
    ])

    const csvContent = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `audit-logs-${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <ClipboardList className="h-8 w-8" />
            Audit Log
          </h1>
          <p className="text-muted-foreground">
            View system activity and changes across all projects
          </p>
        </div>
        <Button variant="outline" onClick={exportToCSV}>
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="rounded-lg border bg-card p-4 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              placeholder="Search actions, entities..."
              className="pl-10"
            />
          </div>

          {/* Filter Toggle */}
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className={hasActiveFilters ? 'border-primary text-primary bg-primary/5' : ''}
          >
            <Filter className="h-4 w-4" />
            Filters
            {hasActiveFilters && (
              <span className="px-1.5 py-0.5 text-xs rounded-full bg-primary text-primary-foreground">
                {Object.values(filters).filter((v) => v !== '').length}
              </span>
            )}
          </Button>
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t">
            {/* Entity Type */}
            <div>
              <Label className="mb-1">Entity Type</Label>
              <NativeSelect
                value={filters.entityType}
                onChange={(e) => handleFilterChange('entityType', e.target.value)}
              >
                <option value="">All Types</option>
                {entityTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </NativeSelect>
            </div>

            {/* Action */}
            <div>
              <Label className="mb-1">Action</Label>
              <NativeSelect
                value={filters.action}
                onChange={(e) => handleFilterChange('action', e.target.value)}
              >
                <option value="">All Actions</option>
                {actions.map((action) => (
                  <option key={action} value={action}>
                    {action}
                  </option>
                ))}
              </NativeSelect>
            </div>

            {/* User Filter */}
            <div>
              <Label className="mb-1">User</Label>
              <NativeSelect
                value={filters.userId}
                onChange={(e) => handleFilterChange('userId', e.target.value)}
              >
                <option value="">All Users</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.fullName || user.email}
                  </option>
                ))}
              </NativeSelect>
            </div>

            {/* Date Range */}
            <div>
              <Label className="mb-1">From Date</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <Label className="mb-1">To Date</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <div className="sm:col-span-2 lg:col-span-4">
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-3 w-3" />
                  Clear all filters
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Results Count */}
      <div className="text-sm text-muted-foreground">
        Showing {logs.length} of {total} audit log entries
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Loading audit logs...</p>
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 bg-muted/50 rounded-lg border border-dashed">
          <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No Audit Logs Found</h3>
          <p className="text-muted-foreground">
            {hasActiveFilters
              ? 'No logs match your current filters. Try adjusting your search criteria.'
              : 'There are no audit logs recorded yet.'}
          </p>
        </div>
      ) : (
        <>
          {/* Logs Table */}
          <div className="rounded-lg border bg-card overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium">Date/Time</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Action</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Entity</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">User</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Project</th>
                  <th className="px-4 py-3 text-left text-sm font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 text-sm">
                      <span className="text-muted-foreground">{formatDateTime(log.createdAt)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getActionColor(
                          log.action
                        )}`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="font-medium">{log.entityType}</span>
                      <span className="text-muted-foreground ml-1 text-xs">#{log.entityId.slice(0, 8)}</span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {log.user ? (
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span>{log.user.fullName || log.user.email}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">System</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {log.project ? (
                        <span className="text-muted-foreground">{log.project.name}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Button variant="link" size="sm" onClick={() => setSelectedLog(log)} className="text-xs p-0 h-auto">
                        Details
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Detail Modal */}
      {selectedLog && (
        <Modal onClose={() => setSelectedLog(null)} className="max-w-2xl">
          <ModalHeader>Audit Log Details</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Date/Time</Label>
                  <p>{formatDateTime(selectedLog.createdAt)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Action</Label>
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getActionColor(
                      selectedLog.action
                    )}`}
                  >
                    {selectedLog.action}
                  </span>
                </div>
                <div>
                  <Label className="text-muted-foreground">Entity Type</Label>
                  <p>{selectedLog.entityType}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Entity ID</Label>
                  <p className="font-mono text-sm">{selectedLog.entityId}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">User</Label>
                  <p>{selectedLog.user?.fullName || selectedLog.user?.email || 'System'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Project</Label>
                  <p>{selectedLog.project?.name || '-'}</p>
                </div>
              </div>

              {selectedLog.ipAddress && (
                <div>
                  <Label className="text-muted-foreground">IP Address</Label>
                  <p className="font-mono text-sm">{selectedLog.ipAddress}</p>
                </div>
              )}

              {selectedLog.changes && (
                <div>
                  <Label className="text-muted-foreground mb-2">Changes</Label>
                  <pre className="p-4 bg-muted rounded-lg text-sm overflow-auto max-h-64">
                    {JSON.stringify(selectedLog.changes, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" onClick={() => setSelectedLog(null)}>
              Close
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  )
}
