import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ContextHelp, HELP_CONTENT } from '@/components/ContextHelp';
import { cn } from '@/lib/utils';
import { getDocumentCategoryLabel } from '../documentsDisplayData';

interface DeleteDocument {
  id: string;
  filename: string;
}

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export function DocumentDragOverlay({ isDragging }: { isDragging: boolean }) {
  if (!isDragging) return null;

  return (
    <div className="fixed inset-0 z-50 bg-primary/20 backdrop-blur-sm flex items-center justify-center pointer-events-none">
      <div className="rounded-xl border-4 border-dashed border-primary bg-card/90 p-12 text-center shadow-2xl">
        <svg
          className="mx-auto h-16 w-16 text-primary"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
        <h3 className="mt-4 text-xl font-bold text-primary">Drop file here to upload</h3>
        <p className="mt-2 text-primary/80">Release to start uploading your document</p>
      </div>
    </div>
  );
}

export function DocumentsPageHeader({
  canUploadDocuments,
  onUpload,
}: {
  canUploadDocuments: boolean;
  onUpload: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">Documents & Photos</h1>
          <ContextHelp
            title={HELP_CONTENT.documents.title}
            content={HELP_CONTENT.documents.content}
          />
        </div>
        <p className="text-muted-foreground">Upload and manage project documents and photos</p>
      </div>
      {canUploadDocuments && (
        <Button onClick={onUpload} className="h-11 w-full md:h-9 md:w-auto">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
            />
          </svg>
          Upload Document
        </Button>
      )}
    </div>
  );
}

export function DocumentsLoadErrorAlert({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  if (!error) return null;

  return (
    <div
      className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive"
      role="alert"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span>{error}</span>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </div>
  );
}

/**
 * Quick category filters. Lives inside the filter card so the register has ONE
 * filter mechanism rather than a chip row stacked under a control row saying
 * the same thing — `activeCategory` is what makes the chip and the Category
 * select read as the same control.
 */
export function DocumentCategorySummary({
  categories,
  activeCategory,
  onSelectCategory,
}: {
  categories: Record<string, number>;
  /** Currently applied category filter value, so the matching chip reads as on. */
  activeCategory?: string;
  onSelectCategory: (category: string) => void;
}) {
  if (Object.keys(categories).length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {/* The counts come back scoped to the applied filter, so once a chip is on
          it is the only chip left. This is the way back to the whole register. */}
      {activeCategory && (
        <button
          type="button"
          onClick={() => onSelectCategory('')}
          className="cursor-pointer rounded-full bg-muted px-3 py-1 text-sm hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          All categories
        </button>
      )}
      {Object.entries(categories).map(([category, count]) => {
        const filterValue = category === 'Uncategorized' ? 'uncategorized' : category;
        const isActive = activeCategory === filterValue;

        return (
          <button
            type="button"
            key={category}
            aria-pressed={isActive}
            // Clicking the active chip clears it — otherwise the only way back
            // to "all categories" is the select the chips are meant to replace.
            onClick={() => onSelectCategory(isActive ? '' : filterValue)}
            className={cn(
              'cursor-pointer rounded-full px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-primary hover:text-primary-foreground',
            )}
          >
            {getDocumentCategoryLabel(category)}: {count}
          </button>
        );
      })}
    </div>
  );
}

export function DeleteDocumentDialog({
  documentPendingDelete,
  onCancel,
  onConfirmDelete,
}: {
  documentPendingDelete: DeleteDocument | null;
  onCancel: () => void;
  onConfirmDelete: (documentId: string) => void;
}) {
  return (
    <ConfirmDialog
      open={Boolean(documentPendingDelete)}
      title="Delete Document"
      description={
        <>
          <p>
            Delete{' '}
            {documentPendingDelete?.filename
              ? `"${documentPendingDelete.filename}"`
              : 'this document'}
            ?
          </p>
          <p>This removes it from the project document register.</p>
        </>
      }
      confirmLabel="Delete"
      variant="destructive"
      onCancel={onCancel}
      onConfirm={() => {
        if (documentPendingDelete) {
          onConfirmDelete(documentPendingDelete.id);
        }
      }}
    />
  );
}

export function DocumentsPagination({
  pagination,
  visibleCount,
  onPreviousPage,
  onNextPage,
}: {
  pagination: PaginationMeta | null | undefined;
  visibleCount: number;
  onPreviousPage: () => void;
  onNextPage: () => void;
}) {
  if (!pagination || pagination.total <= pagination.limit) return null;

  const showingFrom = pagination.total > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0;
  const showingTo = Math.min(showingFrom + Math.max(visibleCount - 1, 0), pagination.total);

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <span>
        Showing {showingFrom}-{showingTo} of {pagination.total} documents
      </span>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!pagination.hasPrevPage}
          onClick={onPreviousPage}
        >
          Previous
        </Button>
        <span className="px-2">
          Page {pagination.page} of {pagination.totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!pagination.hasNextPage}
          onClick={onNextPage}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
