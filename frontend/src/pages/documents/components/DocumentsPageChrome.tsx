import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

interface DeleteDocument {
  id: string;
  filename: string;
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

export function DocumentsPageHeader({ onUpload }: { onUpload: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold">Documents & Photos</h1>
        <p className="text-muted-foreground">Upload and manage project documents and photos</p>
      </div>
      <Button onClick={onUpload}>
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

export function DocumentCategorySummary({
  categories,
  onSelectCategory,
}: {
  categories: Record<string, number>;
  onSelectCategory: (category: string) => void;
}) {
  if (Object.keys(categories).length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(categories).map(([category, count]) => (
        <span
          key={category}
          onClick={() => onSelectCategory(category.toLowerCase())}
          className="cursor-pointer rounded-full bg-muted px-3 py-1 text-sm hover:bg-primary hover:text-primary-foreground"
        >
          {category}: {count}
        </span>
      ))}
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
