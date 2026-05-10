import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ClipboardList,
  Search,
  Filter,
  Calendar,
  User,
  ChevronLeft,
  ChevronRight,
  X,
  Download,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Modal,
  ModalHeader,
  ModalDescription,
  ModalBody,
  ModalFooter,
} from '@/components/ui/Modal';
import { downloadCsv } from '@/lib/csv';

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  changes: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  user: {
    id: string;
    email: string;
    fullName: string | null;
  } | null;
  project: {
    id: string;
    name: string;
    projectNumber: string;
  } | null;
}

interface AuditLogResponse {
  logs: AuditLog[];
  pagination?: {
    page?: number;
    limit?: number;
    totalPages: number;
    total: number;
  };
}

interface FilterState {
  projectId: string;
  entityType: string;
  action: string;
  userId: string;
  search: string;
  startDate: string;
  endDate: string;
}

export function AuditLogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const exportInFlightRef = useRef(false);

  // Pagination
  const [page, setPage] = useState(1);
  const limit = 50;
  const exportLimit = 100;

  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    projectId: searchParams.get('projectId') || '',
    entityType: searchParams.get('entityType') || '',
    action: searchParams.get('action') || '',
    userId: searchParams.get('userId') || '',
    search: searchParams.get('search') || '',
    startDate: searchParams.get('startDate') || '',
    endDate: searchParams.get('endDate') || '',
  });

  const [showFilters, setShowFilters] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Selected log for detail view
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Filter options from API
  const {
    data: actionsData,
    error: actionsError,
    refetch: refetchActions,
  } = useQuery({
    queryKey: ['audit-logs', 'actions'] as const,
    queryFn: () => apiFetch<{ actions: string[] }>('/api/audit-logs/actions'),
  });

  const {
    data: entityTypesData,
    error: entityTypesError,
    refetch: refetchEntityTypes,
  } = useQuery({
    queryKey: ['audit-logs', 'entity-types'] as const,
    queryFn: () => apiFetch<{ entityTypes: string[] }>('/api/audit-logs/entity-types'),
  });

  const {
    data: usersData,
    error: usersError,
    refetch: refetchUsers,
  } = useQuery({
    queryKey: ['audit-logs', 'users'] as const,
    queryFn: () =>
      apiFetch<{ users: { id: string; email: string; fullName: string | null }[] }>(
        '/api/audit-logs/users',
      ),
  });

  const actions = actionsData?.actions || [];
  const entityTypes = entityTypesData?.entityTypes || [];
  const users = usersData?.users || [];
  const hasFilterOptionsError = Boolean(actionsError || entityTypesError || usersError);

  // Build query params for logs
  const buildLogsParams = (pageNumber = page, pageLimit = limit) => {
    const params = new URLSearchParams();
    params.append('page', pageNumber.toString());
    params.append('limit', pageLimit.toString());
    if (filters.projectId.trim()) params.append('projectId', filters.projectId.trim());
    if (filters.entityType.trim()) params.append('entityType', filters.entityType.trim());
    if (filters.action.trim()) params.append('action', filters.action.trim());
    if (filters.userId.trim()) params.append('userId', filters.userId.trim());
    if (filters.search.trim()) params.append('search', filters.search.trim());
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    return params.toString();
  };

  const logsParams = buildLogsParams();
  const dateRangeError =
    filters.startDate && filters.endDate && filters.startDate > filters.endDate
      ? 'From date must be on or before to date.'
      : null;

  const {
    data: logsData,
    isLoading: loading,
    error: logsError,
    refetch: refetchLogs,
  } = useQuery({
    queryKey: queryKeys.auditLogs(JSON.stringify({ page, ...filters })),
    queryFn: () => apiFetch<AuditLogResponse>(`/api/audit-logs?${logsParams}`),
    enabled: !dateRangeError,
  });

  const logs = dateRangeError ? [] : logsData?.logs || [];
  const totalPages = dateRangeError ? 1 : logsData?.pagination?.totalPages || 1;
  const total = dateRangeError ? 0 : logsData?.pagination?.total || 0;
  const error =
    dateRangeError || (logsError ? 'Failed to load audit logs. Please try again.' : null);

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1); // Reset to page 1 when filters change

    // Update URL params
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    setSearchParams(newParams);
  };

  const clearFilters = () => {
    setFilters({
      projectId: '',
      entityType: '',
      action: '',
      userId: '',
      search: '',
      startDate: '',
      endDate: '',
    });
    setSearchParams({});
    setPage(1);
  };

  const hasActiveFilters = Object.values(filters).some((v) => v !== '');

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-AU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatChanges = (changes: unknown) => {
    if (changes == null) return '';
    const formatted = JSON.stringify(changes, null, 2);
    return formatted ?? String(changes);
  };

  const getActionColor = (action: string) => {
    if (action.includes('create') || action.includes('add')) return 'text-green-600 bg-green-50';
    if (action.includes('delete') || action.includes('remove')) return 'text-red-600 bg-red-50';
    if (action.includes('update') || action.includes('edit')) return 'text-primary bg-primary/5';
    return 'text-muted-foreground bg-muted/50';
  };

  const fetchAllLogsForExport = async () => {
    const exportedLogs: AuditLog[] = [];
    let exportPage = 1;
    let exportTotalPages = 1;

    do {
      const params = buildLogsParams(exportPage, exportLimit);
      const data = await apiFetch<AuditLogResponse>(`/api/audit-logs?${params}`);
      exportedLogs.push(...data.logs);
      exportTotalPages = Math.max(1, data.pagination?.totalPages ?? exportPage);
      exportPage += 1;
    } while (exportPage <= exportTotalPages);

    return exportedLogs;
  };

  const buildCsvRows = (auditLogs: AuditLog[]) => {
    const headers = [
      'Date',
      'Action',
      'Entity Type',
      'Entity ID',
      'User',
      'Project',
      'IP Address',
      'User Agent',
      'Changes',
    ];
    const rows = auditLogs.map((log) => [
      formatDateTime(log.createdAt),
      log.action,
      log.entityType,
      log.entityId,
      log.user?.email || 'System',
      log.project?.name || '-',
      log.ipAddress || '-',
      log.userAgent || '-',
      formatChanges(log.changes),
    ]);

    return [headers, ...rows];
  };

  const exportToCSV = async () => {
    if (exportInFlightRef.current) return;
    if (dateRangeError) {
      setExportError('Fix the date range before exporting audit logs.');
      return;
    }

    exportInFlightRef.current = true;
    setExporting(true);
    setExportError(null);

    try {
      const exportedLogs = await fetchAllLogsForExport();
      if (exportedLogs.length === 0) {
        setExportError('There are no audit logs available to export.');
        return;
      }

      downloadCsv(
        `audit-logs-${new Date().toISOString().split('T')[0]}.csv`,
        buildCsvRows(exportedLogs),
      );
    } catch {
      setExportError('Failed to export audit logs. Please try again.');
    } finally {
      exportInFlightRef.current = false;
      setExporting(false);
    }
  };

  const retryFilterOptions = () => {
    void refetchActions();
    void refetchEntityTypes();
    void refetchUsers();
  };

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
        <Button
          type="button"
          variant="outline"
          onClick={() => void exportToCSV()}
          disabled={loading || exporting || Boolean(error) || total === 0}
        >
          <Download className="h-4 w-4" />
          {exporting ? 'Exporting...' : 'Export CSV'}
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="rounded-lg border bg-card p-4 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Label htmlFor="audit-log-search" className="sr-only">
              Search audit logs
            </Label>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="audit-log-search"
              type="text"
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              placeholder="Search actions, entities..."
              className="pl-10"
            />
          </div>

          {/* Filter Toggle */}
          <Button
            type="button"
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
              <Label htmlFor="audit-log-entity-type" className="mb-1">
                Entity Type
              </Label>
              <NativeSelect
                id="audit-log-entity-type"
                value={filters.entityType}
                disabled={Boolean(entityTypesError)}
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
              <Label htmlFor="audit-log-action" className="mb-1">
                Action
              </Label>
              <NativeSelect
                id="audit-log-action"
                value={filters.action}
                disabled={Boolean(actionsError)}
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
              <Label htmlFor="audit-log-user" className="mb-1">
                User
              </Label>
              <NativeSelect
                id="audit-log-user"
                value={filters.userId}
                disabled={Boolean(usersError)}
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
              <Label htmlFor="audit-log-start-date" className="mb-1">
                From Date
              </Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="audit-log-start-date"
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="audit-log-end-date" className="mb-1">
                To Date
              </Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="audit-log-end-date"
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
                <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-3 w-3" />
                  Clear all filters
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {hasFilterOptionsError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg"
        >
          <span>
            Some audit log filter options could not be loaded. Existing filters and search still
            work.
          </span>
          <Button type="button" variant="outline" size="sm" onClick={retryFilterOptions}>
            Retry filters
          </Button>
        </div>
      )}

      {exportError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg"
        >
          <span>{exportError}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => setExportError(null)}>
            Dismiss
          </Button>
        </div>
      )}

      {/* Results Count */}
      <div className="text-sm text-muted-foreground">
        Showing {logs.length} of {total} audit log entries
      </div>

      {/* Error State */}
      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg"
        >
          <span>{error}</span>
          {Boolean(logsError) && (
            <Button type="button" variant="outline" size="sm" onClick={() => void refetchLogs()}>
              Retry
            </Button>
          )}
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Loading audit logs...</p>
        </div>
      ) : error ? null : logs.length === 0 ? (
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
                          log.action,
                        )}`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="font-medium">{log.entityType}</span>
                      <span className="text-muted-foreground ml-1 text-xs">
                        #{log.entityId.slice(0, 8)}
                      </span>
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
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        onClick={() => setSelectedLog(log)}
                        className="text-xs p-0 h-auto"
                        aria-label={`View details for ${log.action} ${log.entityType} ${log.entityId.slice(0, 8)}`}
                      >
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
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  type="button"
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
          <ModalDescription>
            Review the selected activity record and captured change payload.
          </ModalDescription>
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
                      selectedLog.action,
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

              {selectedLog.changes != null && (
                <div>
                  <Label className="text-muted-foreground mb-2">Changes</Label>
                  <pre className="p-4 bg-muted rounded-lg text-sm overflow-auto max-h-64">
                    {formatChanges(selectedLog.changes)}
                  </pre>
                </div>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button type="button" variant="outline" onClick={() => setSelectedLog(null)}>
              Close
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}
