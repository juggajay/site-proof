import { useState } from 'react';
import { History, MoreHorizontal, Star, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { DocumentAccessUrl } from '@/lib/documentAccess';
import {
  canPreviewDocument as canPreview,
  formatDocumentDate as formatDate,
  formatDocumentFileSize as formatFileSize,
  getDocumentCategoryLabel as getCategoryLabel,
  getDocumentTypeLabel as getTypeLabel,
  isRedundantDocumentCategory,
  isExcelDocument as isExcel,
  isImageDocument as isImage,
  isPdfDocument as isPdf,
  isWordDocument as isWord,
} from '../documentsDisplayData';

// Minimal structural shape the grid needs. The page's full `Document` is
// assignable to this, so the page can pass its documents directly.
export interface DocumentGridDoc {
  id: string;
  documentType: string;
  category: string | null;
  filename: string;
  fileSize: number | null;
  mimeType: string | null;
  uploadedAt: string;
  uploadedBy: { fullName: string } | null;
  caption: string | null;
  lot: { lotNumber: string } | null;
  isFavourite: boolean;
  version?: number | null;
}

interface DocumentGridProps<TDoc extends DocumentGridDoc> {
  loading: boolean;
  error: string | null;
  visibleDocuments: TDoc[];
  showFavouritesOnly: boolean;
  canManageDocuments: boolean;
  documentUrls: Record<string, DocumentAccessUrl>;
  onToggleFavourite: (doc: TDoc) => void;
  onOpenViewer: (doc: TDoc) => void;
  onDownload: (doc: TDoc) => void;
  onViewVersions: (doc: TDoc) => void;
  onMarkPendingDelete: (doc: TDoc) => void;
  // Open the upload flow from the empty state; only offered to users who can
  // manage documents (same gate as the page header's upload button).
  onUpload?: () => void;
}

function ImageDocumentIcon() {
  return (
    <svg
      className="h-6 w-6 text-muted-foreground"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      data-testid="image-icon"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

function ImageDocumentThumbnail({ src, alt }: { src: string | undefined; alt: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  if (src && failedUrl !== src) {
    return (
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="h-full w-full object-cover"
        onError={() => setFailedUrl(src)}
      />
    );
  }

  return <ImageDocumentIcon />;
}

export function DocumentGrid<TDoc extends DocumentGridDoc>({
  loading,
  error,
  visibleDocuments,
  showFavouritesOnly,
  canManageDocuments,
  documentUrls,
  onToggleFavourite,
  onOpenViewer,
  onDownload,
  onViewVersions,
  onMarkPendingDelete,
  onUpload,
}: DocumentGridProps<TDoc>) {
  return (
    <div className="rounded-lg border bg-card">
      {loading ? (
        <div className="p-8 text-center text-muted-foreground">Loading documents...</div>
      ) : error ? null : visibleDocuments.length === 0 ? (
        <div className="p-12 text-center border-2 border-dashed border-border rounded-lg hover:border-primary transition-colors">
          <svg
            className="mx-auto h-12 w-12 text-muted-foreground"
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
          <h3 className="mt-4 text-lg font-medium">
            {showFavouritesOnly ? 'No favourite documents found' : 'No documents found'}
          </h3>
          <p className="mt-2 text-muted-foreground">
            {showFavouritesOnly
              ? 'Clear the favourites filter to view all documents.'
              : 'Drag and drop files here or click "Upload Document" to get started'}
          </p>
          {/* Upload affordance in the empty state, gated the same way the page
              header's upload button is (only when the user can manage docs). */}
          {!showFavouritesOnly && canManageDocuments && onUpload && (
            <Button className="mt-4" onClick={onUpload}>
              <Upload className="h-4 w-4" />
              Upload Document
            </Button>
          )}
        </div>
      ) : (
        <div className="divide-y">
          {visibleDocuments.map((doc) => (
            // Wraps below md so the actions take their own line: on one line at
            // 390px the `truncate` filename collapsed to zero width, and the one
            // thing identifying the document was invisible on the device it is
            // filed from.
            <div
              key={doc.id}
              data-testid="document-row"
              className="flex flex-wrap items-center gap-3 p-4 hover:bg-muted/30 md:flex-nowrap md:gap-4"
            >
              {/* Icon or Thumbnail */}
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted overflow-hidden"
                data-testid={`file-icon-${doc.id}`}
              >
                {isImage(doc.mimeType) ? (
                  <ImageDocumentThumbnail src={documentUrls[doc.id]?.url} alt={doc.filename} />
                ) : isPdf(doc.mimeType) ? (
                  <svg
                    className="h-6 w-6 text-muted-foreground"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    data-testid="pdf-icon"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                    <text x="9" y="16" fontSize="6" fill="currentColor" fontWeight="bold">
                      PDF
                    </text>
                  </svg>
                ) : isExcel(doc.mimeType) ? (
                  <svg
                    className="h-6 w-6 text-muted-foreground"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    data-testid="excel-icon"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
                    />
                  </svg>
                ) : isWord(doc.mimeType) ? (
                  <svg
                    className="h-6 w-6 text-muted-foreground"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    data-testid="word-icon"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                    <text x="8" y="11" fontSize="5" fill="currentColor" fontWeight="bold">
                      W
                    </text>
                  </svg>
                ) : (
                  <svg
                    className="h-6 w-6 text-muted-foreground"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    data-testid="generic-icon"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                )}
              </div>

              {/* Document Info */}
              <div className="min-w-0 flex-1 basis-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium truncate">{doc.filename}</span>
                  {doc.version && doc.version > 1 && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                      v{doc.version}
                    </span>
                  )}
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                    {getTypeLabel(doc.documentType)}
                  </span>
                  {doc.category && !isRedundantDocumentCategory(doc.documentType, doc.category) && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {getCategoryLabel(doc.category)}
                    </span>
                  )}
                </div>
                {/* Middots, not four-column gaps: the metadata reads as one
                    sentence instead of a row of unlabelled values. */}
                <div className="mt-1 truncate text-sm text-muted-foreground">
                  {[
                    formatFileSize(doc.fileSize),
                    formatDate(doc.uploadedAt),
                    doc.uploadedBy ? `by ${doc.uploadedBy.fullName}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  {doc.lot && (
                    <>
                      {' · '}
                      <span className="font-medium text-foreground">Lot {doc.lot.lotNumber}</span>
                    </>
                  )}
                </div>
                {/* Reserved whether or not there is a caption, so every row in
                    the register is the same height. */}
                <p className="mt-1 min-h-[1.25rem] truncate text-sm text-muted-foreground">
                  {doc.caption}
                </p>
              </div>

              {/* Actions — own full-width row below md (44px targets there).
                  Preview and download are the two everyday ones and stay
                  inline; the rest (including delete) live behind the overflow
                  so no row ends in a wall of equal-weight icons. */}
              <div className="flex w-full items-center justify-end gap-1 md:w-auto md:gap-2 [&_button]:h-11 [&_button]:w-11 md:[&_button]:h-9 md:[&_button]:w-9">
                {canPreview(doc.mimeType) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onOpenViewer(doc)}
                    className="text-muted-foreground hover:bg-muted"
                    title="View"
                    aria-label={`View ${doc.filename}`}
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  </Button>
                )}
                <button
                  type="button"
                  onClick={() => onDownload(doc)}
                  className="rounded-md p-2 hover:bg-muted"
                  title="Download"
                  aria-label={`Download ${doc.filename}`}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:bg-muted"
                      title="More actions"
                      aria-label={`More actions for ${doc.filename}`}
                    >
                      <MoreHorizontal className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[200px]">
                    {canManageDocuments && (
                      <DropdownMenuItem
                        className="cursor-pointer"
                        onSelect={() => onToggleFavourite(doc)}
                      >
                        <Star
                          className="h-4 w-4"
                          fill={doc.isFavourite ? 'currentColor' : 'none'}
                        />
                        {doc.isFavourite ? 'Remove from favourites' : 'Add to favourites'}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onSelect={() => onViewVersions(doc)}
                    >
                      <History className="h-4 w-4" />
                      Version history
                    </DropdownMenuItem>
                    {canManageDocuments && (
                      <DropdownMenuItem
                        className="cursor-pointer text-destructive focus:text-destructive"
                        onSelect={() => onMarkPendingDelete(doc)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
