import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { DRAWING_STATUSES, type Drawing } from '../drawingsUploadData';

interface DrawingRegisterHeaderProps {
  canManageDrawings: boolean;
  downloadingCurrentSet: boolean;
  loading: boolean;
  hasDrawingError: boolean;
  hasProjectId: boolean;
  onDownloadCurrentSet: () => void;
  onAddDrawing: () => void;
}

export function DrawingRegisterHeader({
  canManageDrawings,
  downloadingCurrentSet,
  loading,
  hasDrawingError,
  hasProjectId,
  onDownloadCurrentSet,
  onAddDrawing,
}: DrawingRegisterHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold">Drawing Register</h1>
        <p className="text-muted-foreground">Manage project drawings and revisions</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          onClick={onDownloadCurrentSet}
          disabled={downloadingCurrentSet || loading || hasDrawingError || !hasProjectId}
          title="Download all current (non-superseded) drawings"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          {downloadingCurrentSet ? 'Downloading...' : 'Download Current Set'}
        </Button>
        {canManageDrawings && (
          <Button onClick={onAddDrawing} disabled={loading || hasDrawingError}>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add Drawing
          </Button>
        )}
      </div>
    </div>
  );
}

interface DrawingStats {
  total: number;
  preliminary: number;
  forConstruction: number;
  asBuilt: number;
}

export function DrawingStatsCards({ stats }: { stats: DrawingStats }) {
  return (
    <div className="grid grid-cols-4 gap-4">
      <div className="rounded-lg border bg-card p-4">
        <div className="text-2xl font-bold">{stats.total}</div>
        <div className="text-sm text-muted-foreground">Total Drawings</div>
      </div>
      <div className="rounded-lg border bg-card p-4">
        <div className="text-2xl font-bold">{stats.preliminary}</div>
        <div className="text-sm text-muted-foreground">Preliminary</div>
      </div>
      <div className="rounded-lg border bg-card p-4">
        <div className="text-2xl font-bold">{stats.forConstruction}</div>
        <div className="text-sm text-muted-foreground">For Construction</div>
      </div>
      <div className="rounded-lg border bg-card p-4">
        <div className="text-2xl font-bold">{stats.asBuilt}</div>
        <div className="text-sm text-muted-foreground">As-Built</div>
      </div>
    </div>
  );
}

interface DrawingFiltersProps {
  filterStatus: string;
  searchQuery: string;
  onStatusFilterChange: (value: string) => void;
  onSearchQueryChange: (value: string) => void;
  onSearch: () => void;
}

export function DrawingFilters({
  filterStatus,
  searchQuery,
  onStatusFilterChange,
  onSearchQueryChange,
  onSearch,
}: DrawingFiltersProps) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <Label htmlFor="drawing-status-filter" className="mb-1">
            Status
          </Label>
          <NativeSelect
            id="drawing-status-filter"
            value={filterStatus}
            onChange={(e) => onStatusFilterChange(e.target.value)}
          >
            <option value="">All Statuses</option>
            {DRAWING_STATUSES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex-1">
          <Label htmlFor="drawing-search" className="mb-1">
            Search
          </Label>
          <Input
            id="drawing-search"
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSearch()}
            placeholder="Search by drawing number or title..."
          />
        </div>
        <Button type="button" variant="secondary" onClick={onSearch}>
          Search
        </Button>
      </div>
    </div>
  );
}

interface DrawingPaginationProps {
  page: number;
  totalPages: number;
  total: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
  showingFrom: number;
  showingTo: number;
  onPreviousPage: () => void;
  onNextPage: () => void;
}

export function DrawingPagination({
  page,
  totalPages,
  total,
  hasPrevPage,
  hasNextPage,
  showingFrom,
  showingTo,
  onPreviousPage,
  onNextPage,
}: DrawingPaginationProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm">
      <span className="text-muted-foreground">
        Showing {showingFrom}-{showingTo} of {total}
      </span>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!hasPrevPage}
          onClick={onPreviousPage}
        >
          Previous
        </Button>
        <span className="text-muted-foreground">
          Page {page} of {totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!hasNextPage}
          onClick={onNextPage}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

interface DrawingLoadErrorAlertProps {
  error: string;
  onRetry: () => void;
}

export function DrawingLoadErrorAlert({ error, onRetry }: DrawingLoadErrorAlertProps) {
  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive"
    >
      <span>{error}</span>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

interface DrawingDeleteConfirmDialogProps {
  drawing: Drawing | null;
  onCancel: () => void;
  onConfirm: (drawingId: string) => void;
}

export function DrawingDeleteConfirmDialog({
  drawing,
  onCancel,
  onConfirm,
}: DrawingDeleteConfirmDialogProps) {
  return (
    <ConfirmDialog
      open={Boolean(drawing)}
      title="Delete Drawing"
      description={
        <>
          <p>
            Delete drawing {drawing?.drawingNumber}
            {drawing?.revision ? ` Rev ${drawing.revision}` : ''}?
          </p>
          <p>This removes the drawing from the register.</p>
        </>
      }
      confirmLabel="Delete"
      variant="destructive"
      onCancel={onCancel}
      onConfirm={() => {
        if (drawing) {
          onConfirm(drawing.id);
        }
      }}
    />
  );
}
