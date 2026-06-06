import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { downloadCsv } from '@/lib/csv';
import { formatDateKey } from '@/lib/localDate';
import { type AuditLog, formatAuditAction, formatChanges, formatDateTime } from './auditLogDisplay';
import { AuditLogDetailsModal } from './components/AuditLogDetailsModal';
import { AuditLogTable } from './components/AuditLogTable';
import {
  AuditLogDismissibleErrorAlert,
  AuditLogEmptyState,
  AuditLogFilterOptionsAlert,
  AuditLogFilters,
  AuditLogHeader,
  AuditLogLoadErrorAlert,
  AuditLogLoadingState,
  AuditLogPaginationControls,
  AuditLogResultsSummary,
  type AuditLogFilterState,
} from './components/AuditLogControls';

interface AuditLogResponse {
  logs: AuditLog[];
  pagination?: {
    page?: number;
    limit?: number;
    totalPages: number;
    total: number;
  };
}

export function AuditLogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const exportInFlightRef = useRef(false);

  // Pagination
  const [page, setPage] = useState(1);
  const limit = 50;
  const exportLimit = 100;

  // Filter state
  const [filters, setFilters] = useState<AuditLogFilterState>({
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

  const handleFilterChange = (key: keyof AuditLogFilterState, value: string) => {
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
      formatAuditAction(log.action),
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

      downloadCsv(`audit-logs-${formatDateKey()}.csv`, buildCsvRows(exportedLogs));
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

  const paginationControls = (
    <AuditLogPaginationControls
      page={page}
      totalPages={totalPages}
      onPreviousPage={() => setPage((p) => Math.max(1, p - 1))}
      onNextPage={() => setPage((p) => Math.min(totalPages, p + 1))}
    />
  );

  return (
    <div className="space-y-6">
      <AuditLogHeader
        loading={loading}
        exporting={exporting}
        hasError={Boolean(error)}
        total={total}
        onExport={() => void exportToCSV()}
      />

      <AuditLogFilters
        filters={filters}
        actions={actions}
        entityTypes={entityTypes}
        users={users}
        showFilters={showFilters}
        hasActiveFilters={hasActiveFilters}
        actionsError={actionsError}
        entityTypesError={entityTypesError}
        usersError={usersError}
        onToggleFilters={() => setShowFilters(!showFilters)}
        onFilterChange={handleFilterChange}
        onClearFilters={clearFilters}
      />

      {hasFilterOptionsError && <AuditLogFilterOptionsAlert onRetry={retryFilterOptions} />}

      {exportError && (
        <AuditLogDismissibleErrorAlert error={exportError} onDismiss={() => setExportError(null)} />
      )}

      <AuditLogResultsSummary visibleCount={logs.length} total={total}>
        {paginationControls}
      </AuditLogResultsSummary>

      {error && (
        <AuditLogLoadErrorAlert
          error={error}
          canRetry={Boolean(logsError)}
          onRetry={() => void refetchLogs()}
        />
      )}

      {loading ? (
        <AuditLogLoadingState />
      ) : error ? null : logs.length === 0 ? (
        <AuditLogEmptyState hasActiveFilters={hasActiveFilters} />
      ) : (
        <>
          <AuditLogTable logs={logs} onViewDetails={(log) => setSelectedLog(log)} />
          {paginationControls}
        </>
      )}

      {/* Detail Modal */}
      {selectedLog && (
        <AuditLogDetailsModal log={selectedLog} onClose={() => setSelectedLog(null)} />
      )}
    </div>
  );
}
