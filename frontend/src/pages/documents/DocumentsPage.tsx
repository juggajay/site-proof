// Feature #248: Documents & Photos management page
import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LazyPDFViewer } from '../../components/ui/LazyPDFViewer'; // Feature #446: React-PDF viewer (lazy loaded)
import { apiFetch } from '../../lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { createMutationErrorHandler, extractErrorMessage } from '@/lib/errorHandling';
import { toast } from '@/components/ui/toaster';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import {
  getDocumentAccess,
  getDocumentAccessUrl,
  invalidateDocumentAccessUrl,
  openDocumentAccessUrl,
  type DocumentAccessUrl,
} from '@/lib/documentAccess';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { logError } from '@/lib/logger';
import { DocumentUploadModal } from './components/DocumentUploadModal';
import { useDocumentUpload } from './useDocumentUpload';
import { CATEGORIES, DOCUMENT_TYPES } from './documentsUploadData';
import {
  canPreviewDocument as canPreview,
  formatDocumentDate as formatDate,
  formatDocumentFileSize as formatFileSize,
  getDocumentTypeLabel as getTypeLabel,
  isExcelDocument as isExcel,
  isImageDocument as isImage,
  isPdfDocument as isPdf,
  isWordDocument as isWord,
} from './documentsDisplayData';

interface Document {
  id: string;
  documentType: string;
  category: string | null;
  filename: string;
  fileUrl: string;
  fileSize: number | null;
  mimeType: string | null;
  uploadedAt: string;
  uploadedBy: { id: string; fullName: string; email: string } | null;
  caption: string | null;
  lot: { id: string; lotNumber: string; description: string } | null;
  isFavourite: boolean;
}

interface Lot {
  id: string;
  lotNumber: string;
  description: string;
}

interface DocumentsResponse {
  documents?: Document[];
  categories?: Record<string, number>;
}

interface LotsResponse {
  lots?: Lot[];
}

export function DocumentsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();
  const deletingDocumentRef = useRef<string | null>(null);
  const favouriteDocumentRef = useRef<string | null>(null);

  // Upload workflow (modal state, drag/drop, multi-file progress, upload mutation)
  const upload = useDocumentUpload(projectId);

  // Filters
  const [filterType, setFilterType] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterLot, setFilterLot] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [committedSearch, setCommittedSearch] = useState('');
  const [showFavouritesOnly, setShowFavouritesOnly] = useState(false);

  // Viewer modal state
  const [viewerDoc, setViewerDoc] = useState<Document | null>(null);
  const [viewerUrl, setViewerUrl] = useState('');
  const [viewerUrlLoading, setViewerUrlLoading] = useState(false);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [documentUrls, setDocumentUrls] = useState<Record<string, DocumentAccessUrl>>({});
  const [viewerZoom, setViewerZoom] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [documentPendingDelete, setDocumentPendingDelete] = useState<Document | null>(null);
  const viewerRef = useRef<HTMLDivElement>(null);

  const triggerSearch = () => setCommittedSearch(searchQuery.trim());

  // Build documents query path
  const docsQueryPath = (() => {
    let path = `/api/documents/${encodeURIComponent(projectId || '')}`;
    const params = new URLSearchParams();
    if (filterType) params.append('documentType', filterType);
    if (filterCategory) params.append('category', filterCategory);
    if (filterLot) params.append('lotId', filterLot);
    if (dateFrom) params.append('dateFrom', dateFrom);
    if (dateTo) params.append('dateTo', dateTo);
    if (committedSearch) params.append('search', committedSearch);
    if (params.toString()) path += `?${params.toString()}`;
    return path;
  })();

  const {
    data: docsData,
    isLoading: loading,
    error: docsError,
    refetch: refetchDocuments,
  } = useQuery({
    queryKey: [
      ...queryKeys.documents(projectId!),
      filterType,
      filterCategory,
      filterLot,
      dateFrom,
      dateTo,
      committedSearch,
    ] as const,
    queryFn: () => apiFetch<DocumentsResponse>(docsQueryPath),
    enabled: !!projectId,
  });

  const documents: Document[] = useMemo(() => docsData?.documents || [], [docsData?.documents]);
  const categories: Record<string, number> = useMemo(
    () => docsData?.categories || {},
    [docsData?.categories],
  );
  const error = docsError ? extractErrorMessage(docsError, 'Failed to load documents') : null;
  const visibleDocuments = useMemo(
    () => documents.filter((doc) => !showFavouritesOnly || doc.isFavourite),
    [documents, showFavouritesOnly],
  );

  useEffect(() => {
    const imageDocs = documents.filter((doc) => {
      const accessUrl = documentUrls[doc.id];
      return isImage(doc.mimeType) && (!accessUrl || accessUrl.refreshAt <= Date.now());
    });
    if (imageDocs.length === 0) return;

    let cancelled = false;
    Promise.all(
      imageDocs.map(async (doc) => {
        try {
          const accessUrl = await getDocumentAccess(doc.id, doc.fileUrl, {
            disposition: 'inline',
          });
          return [doc.id, accessUrl] as const;
        } catch (err) {
          logError('Failed to load document preview URL:', err);
          return null;
        }
      }),
    ).then((entries) => {
      if (cancelled) return;
      const nextUrls = Object.fromEntries(
        entries.filter((entry): entry is readonly [string, DocumentAccessUrl] => Boolean(entry)),
      );
      if (Object.keys(nextUrls).length > 0) {
        setDocumentUrls((prev) => ({ ...prev, ...nextUrls }));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [documents, documentUrls]);

  useEffect(() => {
    const refreshTimes = Object.values(documentUrls)
      .map((accessUrl) => accessUrl.refreshAt)
      .filter(Number.isFinite);

    if (refreshTimes.length === 0) return;

    const nextRefreshAt = Math.min(...refreshTimes);
    const timeoutId = window.setTimeout(
      () => {
        setDocumentUrls((prev) => {
          const now = Date.now();
          let changed = false;
          const next: Record<string, DocumentAccessUrl> = {};

          for (const [documentId, accessUrl] of Object.entries(prev)) {
            if (accessUrl.refreshAt > now) {
              next[documentId] = accessUrl;
            } else {
              invalidateDocumentAccessUrl(documentId);
              changed = true;
            }
          }

          return changed ? next : prev;
        });
      },
      Math.max(1_000, nextRefreshAt - Date.now()),
    );

    return () => window.clearTimeout(timeoutId);
  }, [documentUrls]);

  const { data: lotsData } = useQuery({
    queryKey: queryKeys.lots(projectId!),
    queryFn: () =>
      apiFetch<LotsResponse>(`/api/lots?projectId=${encodeURIComponent(projectId || '')}`),
    enabled: !!projectId,
  });

  const lots: Lot[] = lotsData?.lots || [];

  // Delete mutation
  const deleteDocMutation = useMutation({
    mutationFn: (documentId: string) =>
      apiFetch(`/api/documents/${encodeURIComponent(documentId)}`, { method: 'DELETE' }),
    onSuccess: (_data, documentId) => {
      invalidateDocumentAccessUrl(documentId);
      setDocumentUrls((prev) => {
        if (!prev[documentId]) return prev;
        const next = { ...prev };
        delete next[documentId];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.documents(projectId!) });
    },
    onError: createMutationErrorHandler('Failed to delete document'),
    onSettled: (_data, _error, documentId) => {
      if (deletingDocumentRef.current === documentId) {
        deletingDocumentRef.current = null;
      }
    },
  });

  const handleDelete = (documentId: string) => {
    if (deletingDocumentRef.current === documentId) return;

    deletingDocumentRef.current = documentId;
    deleteDocMutation.mutate(documentId);
  };

  // Favourite toggle mutation
  const toggleFavouriteMutation = useMutation({
    mutationFn: (doc: Document) =>
      apiFetch<Document>(`/api/documents/${encodeURIComponent(doc.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ isFavourite: !doc.isFavourite }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents(projectId!) });
    },
    onError: createMutationErrorHandler('Failed to update favourite status'),
    onSettled: (_data, _error, doc) => {
      if (favouriteDocumentRef.current === doc.id) {
        favouriteDocumentRef.current = null;
      }
    },
  });

  const toggleFavourite = (doc: Document) => {
    if (favouriteDocumentRef.current === doc.id) return;

    favouriteDocumentRef.current = doc.id;
    toggleFavouriteMutation.mutate(doc);
  };

  const openViewer = async (doc: Document) => {
    setViewerDoc(doc);
    setViewerUrl('');
    setViewerUrlLoading(true);
    setViewerError(null);
    setViewerZoom(100);
    try {
      const url = await getDocumentAccessUrl(doc.id, doc.fileUrl, { disposition: 'inline' });
      setViewerUrl(url);
    } catch (err) {
      logError('Failed to load document URL:', err);
      setViewerError(extractErrorMessage(err, 'Failed to load document preview.'));
    } finally {
      setViewerUrlLoading(false);
    }
  };

  const closeViewer = () => {
    setViewerDoc(null);
    setViewerUrl('');
    setViewerUrlLoading(false);
    setViewerError(null);
    setViewerZoom(100);
  };

  const handleDownload = async (doc: Document) => {
    try {
      await openDocumentAccessUrl(doc.id, doc.fileUrl);
    } catch (err) {
      logError('Failed to open document:', err);
      toast({
        title: 'Could not open document',
        description: extractErrorMessage(err, 'Failed to open document. Please try again.'),
        variant: 'error',
      });
    }
  };

  const zoomIn = () => setViewerZoom((prev) => Math.min(prev + 25, 200));
  const zoomOut = () => setViewerZoom((prev) => Math.max(prev - 25, 50));

  // Fullscreen toggle
  const toggleFullscreen = async () => {
    if (!viewerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await viewerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      logError('Fullscreen error:', err);
    }
  };

  // Listen for fullscreen changes (e.g., when user presses Escape)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  return (
    <div ref={upload.dropZoneRef} className="space-y-6 relative" {...upload.containerDragHandlers}>
      {/* Drag overlay */}
      {upload.isDragging && (
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
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Documents & Photos</h1>
          <p className="text-muted-foreground">Upload and manage project documents and photos</p>
        </div>
        <Button onClick={upload.openUploadModal}>
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

      {/* Filters */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <Label htmlFor="document-type-filter" className="mb-1">
              Document Type
            </Label>
            <NativeSelect
              id="document-type-filter"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="">All Types</option>
              {DOCUMENT_TYPES.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.label}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div>
            <Label htmlFor="document-category-filter" className="mb-1">
              Category
            </Label>
            <NativeSelect
              id="document-category-filter"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="">All Categories</option>
              {CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div>
            <Label htmlFor="document-lot-filter" className="mb-1">
              Lot
            </Label>
            <NativeSelect
              id="document-lot-filter"
              value={filterLot}
              onChange={(e) => setFilterLot(e.target.value)}
            >
              <option value="">All Lots</option>
              {lots.map((lot) => (
                <option key={lot.id} value={lot.id}>
                  {lot.lotNumber}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div>
            <Label htmlFor="document-date-from-filter" className="mb-1">
              Date From
            </Label>
            <Input
              id="document-date-from-filter"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="document-date-to-filter" className="mb-1">
              Date To
            </Label>
            <Input
              id="document-date-to-filter"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <Label htmlFor="document-search" className="mb-1">
              Search
            </Label>
            <Input
              id="document-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && triggerSearch()}
              placeholder="Search by filename, caption..."
            />
          </div>
          <Button variant="secondary" onClick={triggerSearch}>
            Search
          </Button>
          <Button
            variant={showFavouritesOnly ? 'outline' : 'secondary'}
            onClick={() => setShowFavouritesOnly(!showFavouritesOnly)}
            className={showFavouritesOnly ? 'bg-yellow-100 text-yellow-700 border-yellow-300' : ''}
            title={showFavouritesOnly ? 'Show All' : 'Show Favourites Only'}
          >
            <svg
              className={`h-4 w-4 ${showFavouritesOnly ? 'fill-yellow-500' : ''}`}
              fill={showFavouritesOnly ? 'currentColor' : 'none'}
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
              />
            </svg>
            Favourites
          </Button>
          {(filterType ||
            filterCategory ||
            filterLot ||
            dateFrom ||
            dateTo ||
            searchQuery ||
            showFavouritesOnly) && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                setFilterType('');
                setFilterCategory('');
                setFilterLot('');
                setDateFrom('');
                setDateTo('');
                setSearchQuery('');
                setCommittedSearch('');
                setShowFavouritesOnly(false);
              }}
            >
              Clear All
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700" role="alert">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>{error}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void refetchDocuments()}
            >
              Try again
            </Button>
          </div>
        </div>
      )}

      {/* Category Summary */}
      {Object.keys(categories).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(categories).map(([cat, count]) => (
            <span
              key={cat}
              onClick={() => setFilterCategory(cat.toLowerCase())}
              className="cursor-pointer rounded-full bg-muted px-3 py-1 text-sm hover:bg-primary hover:text-primary-foreground"
            >
              {cat}: {count}
            </span>
          ))}
        </div>
      )}

      {/* Documents Grid */}
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
              {showFavouritesOnly && documents.length > 0
                ? 'No favourite documents found'
                : 'No documents found'}
            </h3>
            <p className="mt-2 text-muted-foreground">
              {showFavouritesOnly && documents.length > 0
                ? 'Clear the favourites filter to view all documents.'
                : 'Drag and drop files here or click "Upload Document" to get started'}
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {visibleDocuments.map((doc) => (
              <div key={doc.id} className="flex items-center gap-4 p-4 hover:bg-muted/30">
                {/* Icon or Thumbnail */}
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted overflow-hidden"
                  data-testid={`file-icon-${doc.id}`}
                >
                  {isImage(doc.mimeType) ? (
                    <img
                      src={documentUrls[doc.id]?.url || ''}
                      alt={doc.filename}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        // Fallback to image icon if thumbnail fails
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  {isImage(doc.mimeType) ? (
                    <svg
                      className="h-6 w-6 text-primary hidden"
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
                  ) : isPdf(doc.mimeType) ? (
                    <svg
                      className="h-6 w-6 text-red-500"
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
                      className="h-6 w-6 text-green-600"
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
                      className="h-6 w-6 text-blue-600"
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
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{doc.filename}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                      {getTypeLabel(doc.documentType)}
                    </span>
                    {doc.category && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                        {doc.category}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                    <span>{formatFileSize(doc.fileSize)}</span>
                    <span>{formatDate(doc.uploadedAt)}</span>
                    {doc.uploadedBy && <span>by {doc.uploadedBy.fullName}</span>}
                    {doc.lot && <span className="text-primary">Lot {doc.lot.lotNumber}</span>}
                  </div>
                  {doc.caption && (
                    <p className="text-sm text-muted-foreground mt-1 truncate">{doc.caption}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleFavourite(doc)}
                    className={
                      doc.isFavourite
                        ? 'text-yellow-500 hover:bg-yellow-100'
                        : 'text-muted-foreground hover:bg-yellow-100'
                    }
                    title={doc.isFavourite ? 'Remove from Favourites' : 'Add to Favourites'}
                    aria-label={
                      doc.isFavourite
                        ? `Remove ${doc.filename} from favourites`
                        : `Add ${doc.filename} to favourites`
                    }
                  >
                    <svg
                      className="h-5 w-5"
                      fill={doc.isFavourite ? 'currentColor' : 'none'}
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                      />
                    </svg>
                  </Button>
                  {canPreview(doc.mimeType) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => void openViewer(doc)}
                      className="text-primary hover:bg-primary/10"
                      title="View"
                      aria-label={`View ${doc.filename}`}
                    >
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
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
                    onClick={() => void handleDownload(doc)}
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
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDocumentPendingDelete(doc)}
                    className="text-red-600 hover:bg-red-100"
                    title="Delete"
                    aria-label={`Delete ${doc.filename}`}
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {upload.showUploadModal && (
        <DocumentUploadModal
          selectedFiles={upload.selectedFiles}
          uploadForm={upload.uploadForm}
          uploading={upload.uploading}
          uploadProgress={upload.uploadProgress}
          uploadedCount={upload.uploadedCount}
          imageDimensions={upload.imageDimensions}
          dimensionWarning={upload.dimensionWarning}
          fileInputRef={upload.fileInputRef}
          lots={lots}
          formatFileSize={formatFileSize}
          onClose={upload.closeUploadModal}
          onFileSelect={upload.handleFileSelect}
          onModalDrop={upload.handleModalDrop}
          onFormChange={upload.updateUploadForm}
          onUpload={upload.handleUpload}
        />
      )}

      {/* Document Viewer Modal */}
      {viewerDoc && (
        <div
          ref={viewerRef}
          className="fixed inset-0 z-50 flex flex-col bg-black/90"
          data-testid="document-viewer-modal"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-black/50 text-white">
            <div className="flex items-center gap-4">
              <h3 className="font-medium truncate max-w-md">{viewerDoc.filename}</h3>
              <span className="text-sm text-muted-foreground">
                {formatFileSize(viewerDoc.fileSize)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* Zoom Controls */}
              <Button
                variant="ghost"
                size="icon"
                onClick={zoomOut}
                disabled={viewerZoom <= 50}
                className="hover:bg-white/20 text-white"
                title="Zoom Out"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7"
                  />
                </svg>
              </Button>
              <span className="text-sm w-12 text-center">{viewerZoom}%</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={zoomIn}
                disabled={viewerZoom >= 200}
                className="hover:bg-white/20 text-white"
                title="Zoom In"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
                  />
                </svg>
              </Button>
              {/* Fullscreen Toggle */}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleFullscreen}
                className="hover:bg-white/20 text-white"
                title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                data-testid="fullscreen-toggle"
              >
                {isFullscreen ? (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25"
                    />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"
                    />
                  </svg>
                )}
              </Button>
              {/* Download */}
              <button
                type="button"
                onClick={() => void handleDownload(viewerDoc)}
                className="rounded-md p-2 hover:bg-white/20"
                title="Download"
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
              {/* Close */}
              <Button
                variant="ghost"
                size="icon"
                onClick={closeViewer}
                className="hover:bg-white/20 text-white ml-2"
                title="Close"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </Button>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-auto flex items-center justify-center p-4">
            {viewerUrlLoading ? (
              <div className="text-white" role="status">
                Loading secure preview...
              </div>
            ) : viewerError ? (
              <div className="text-center text-white" role="alert">
                <p>{viewerError}</p>
                <Button type="button" className="mt-4" onClick={() => void openViewer(viewerDoc)}>
                  Try again
                </Button>
              </div>
            ) : isPdf(viewerDoc.mimeType) && viewerUrl ? (
              /* Feature #446: Use React-PDF viewer for better PDF rendering (lazy loaded) */
              <LazyPDFViewer
                url={viewerUrl}
                filename={viewerDoc.filename}
                className="w-full h-full max-w-5xl"
              />
            ) : isImage(viewerDoc.mimeType) && viewerUrl ? (
              <div className="overflow-auto max-h-[90vh]" style={{ cursor: 'grab' }}>
                <img
                  src={viewerUrl}
                  alt={viewerDoc.filename}
                  className="rounded shadow-lg transition-transform"
                  style={{
                    transform: `scale(${viewerZoom / 100})`,
                    transformOrigin: 'center',
                    maxWidth: viewerZoom <= 100 ? '100%' : 'none',
                  }}
                  draggable={false}
                />
              </div>
            ) : (
              <div className="text-white text-center">
                <p>Preview not available for this file type</p>
                <button
                  type="button"
                  onClick={() => void handleDownload(viewerDoc)}
                  className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm"
                >
                  Download File
                </button>
              </div>
            )}
          </div>

          {/* Document Info Footer */}
          <div className="px-4 py-2 bg-black/50 text-white text-sm">
            <div className="flex items-center gap-4">
              {viewerDoc.caption && <span>{viewerDoc.caption}</span>}
              {viewerDoc.uploadedBy && <span>Uploaded by {viewerDoc.uploadedBy.fullName}</span>}
              <span>{formatDate(viewerDoc.uploadedAt)}</span>
              {viewerDoc.lot && <span>Lot {viewerDoc.lot.lotNumber}</span>}
            </div>
          </div>
        </div>
      )}

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
        onCancel={() => setDocumentPendingDelete(null)}
        onConfirm={() => {
          if (documentPendingDelete) {
            handleDelete(documentPendingDelete.id);
            setDocumentPendingDelete(null);
          }
        }}
      />
    </div>
  );
}
