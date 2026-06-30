import type { ReactNode } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  Filter,
  Search,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { formatAuditAction } from '../auditLogDisplay';

export interface AuditLogFilterState {
  projectId: string;
  entityType: string;
  action: string;
  userId: string;
  search: string;
  startDate: string;
  endDate: string;
}

export interface AuditLogUserOption {
  id: string;
  email: string;
  fullName: string | null;
}

export function AuditLogHeader({
  loading,
  exporting,
  hasError,
  total,
  onExport,
}: {
  loading: boolean;
  exporting: boolean;
  hasError: boolean;
  total: number;
  onExport: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <ClipboardList className="h-8 w-8" />
          Audit Log
        </h1>
        <p className="text-muted-foreground">View system activity and changes you have access to</p>
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={onExport}
        disabled={loading || exporting || hasError || total === 0}
      >
        <Download className="h-4 w-4" />
        {exporting ? 'Exporting...' : 'Export CSV'}
      </Button>
    </div>
  );
}

export function AuditLogFilters({
  filters,
  actions,
  entityTypes,
  users,
  showFilters,
  hasActiveFilters,
  actionsError,
  entityTypesError,
  usersError,
  onToggleFilters,
  onFilterChange,
  onClearFilters,
}: {
  filters: AuditLogFilterState;
  actions: string[];
  entityTypes: string[];
  users: AuditLogUserOption[];
  showFilters: boolean;
  hasActiveFilters: boolean;
  actionsError: unknown;
  entityTypesError: unknown;
  usersError: unknown;
  onToggleFilters: () => void;
  onFilterChange: (key: keyof AuditLogFilterState, value: string) => void;
  onClearFilters: () => void;
}) {
  const activeFilterCount = Object.values(filters).filter((value) => value !== '').length;

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Label htmlFor="audit-log-search" className="sr-only">
            Search audit logs
          </Label>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="audit-log-search"
            type="text"
            value={filters.search}
            onChange={(event) => onFilterChange('search', event.target.value)}
            placeholder="Search actions, entities, users, projects..."
            className="pl-10"
          />
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={onToggleFilters}
          className={hasActiveFilters ? 'border-primary text-primary bg-primary/5' : ''}
        >
          <Filter className="h-4 w-4" />
          Filters
          {hasActiveFilters && (
            <span className="px-1.5 py-0.5 text-xs rounded-full bg-primary text-primary-foreground">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </div>

      {showFilters && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t">
          <div>
            <Label htmlFor="audit-log-entity-type" className="mb-1">
              Entity Type
            </Label>
            <NativeSelect
              id="audit-log-entity-type"
              value={filters.entityType}
              disabled={Boolean(entityTypesError)}
              onChange={(event) => onFilterChange('entityType', event.target.value)}
            >
              <option value="">All Types</option>
              {entityTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div>
            <Label htmlFor="audit-log-action" className="mb-1">
              Action
            </Label>
            <NativeSelect
              id="audit-log-action"
              value={filters.action}
              disabled={Boolean(actionsError)}
              onChange={(event) => onFilterChange('action', event.target.value)}
            >
              <option value="">All Actions</option>
              {actions.map((action) => (
                <option key={action} value={action}>
                  {formatAuditAction(action)}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div>
            <Label htmlFor="audit-log-user" className="mb-1">
              User
            </Label>
            <NativeSelect
              id="audit-log-user"
              value={filters.userId}
              disabled={Boolean(usersError)}
              onChange={(event) => onFilterChange('userId', event.target.value)}
            >
              <option value="">All Users</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.fullName || user.email}
                </option>
              ))}
            </NativeSelect>
          </div>

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
                onChange={(event) => onFilterChange('startDate', event.target.value)}
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
                onChange={(event) => onFilterChange('endDate', event.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {hasActiveFilters && (
            <div className="sm:col-span-2 lg:col-span-4">
              <Button type="button" variant="ghost" size="sm" onClick={onClearFilters}>
                <X className="h-3 w-3" />
                Clear all filters
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function AuditLogFilterOptionsAlert({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-3 p-4 bg-warning/10 border border-warning/30 text-warning rounded-lg"
    >
      <span>
        Some audit log filter options could not be loaded. Existing filters and search still work.
      </span>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        Retry filters
      </Button>
    </div>
  );
}

export function AuditLogDismissibleErrorAlert({
  error,
  onDismiss,
}: {
  error: string;
  onDismiss: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-3 p-4 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg"
    >
      <span>{error}</span>
      <Button type="button" variant="outline" size="sm" onClick={onDismiss}>
        Dismiss
      </Button>
    </div>
  );
}

export function AuditLogLoadErrorAlert({
  error,
  canRetry,
  onRetry,
}: {
  error: string;
  canRetry: boolean;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-3 p-4 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg"
    >
      <span>{error}</span>
      {canRetry && (
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

export function AuditLogPaginationControls({
  page,
  totalPages,
  onPreviousPage,
  onNextPage,
}: {
  page: number;
  totalPages: number;
  onPreviousPage: () => void;
  onNextPage: () => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="text-sm text-muted-foreground">
        Page {page} of {totalPages}
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onPreviousPage}
          disabled={page === 1}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onNextPage}
          disabled={page === totalPages}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function AuditLogResultsSummary({
  visibleCount,
  total,
  children,
}: {
  visibleCount: number;
  total: number;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm text-muted-foreground">
        Showing {visibleCount} of {total} audit log entries
      </div>
      {children}
    </div>
  );
}

export function AuditLogLoadingState() {
  return (
    <div className="text-center py-12">
      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
      <p className="text-muted-foreground">Loading audit logs...</p>
    </div>
  );
}

export function AuditLogEmptyState({ hasActiveFilters }: { hasActiveFilters: boolean }) {
  return (
    <div className="text-center py-12 bg-muted/50 rounded-lg border border-dashed">
      <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
      <h3 className="text-lg font-medium mb-2">No Audit Logs Found</h3>
      <p className="text-muted-foreground">
        {hasActiveFilters
          ? 'No logs match your current filters. Try adjusting your search criteria.'
          : 'There are no audit logs recorded yet.'}
      </p>
    </div>
  );
}
