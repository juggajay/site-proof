// Feature #248: Documents & Photos management page
import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useCurrentProjectRole } from '@/hooks/useCurrentProjectRole';
import { createMutationErrorHandler, extractErrorMessage } from '@/lib/errorHandling';
import { toast } from '@/components/ui/toaster';
import {
  getDocumentAccess,
  getDocumentAccessUrl,
  invalidateDocumentAccessUrl,
  openDocumentAccessUrl,
  type DocumentAccessUrl,
} from '@/lib/documentAccess';
import { logError } from '@/lib/logger';
import { DocumentFiltersPanel } from './components/DocumentFiltersPanel';
import { DocumentGrid } from './components/DocumentGrid';
import { DocumentUploadModal } from './components/DocumentUploadModal';
import { DocumentViewerModal } from './components/DocumentViewerModal';
import {
  DeleteDocumentDialog,
  DocumentCategorySummary,
  DocumentDragOverlay,
  DocumentsPagination,
  DocumentsLoadErrorAlert,
  DocumentsPageHeader,
} from './components/DocumentsPageChrome';
import { useDocumentUpload } from './useDocumentUpload';
import {
  formatDocumentFileSize as formatFileSize,
  isImageDocument as isImage,
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
  pagination?: PaginationMeta | null;
}

interface LotsResponse {
  lots?: Lot[];
}

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

const DOCUMENT_WRITE_ROLES = [
  'owner',
  'admin',
  'project_manager',
  'quality_manager',
  'site_manager',
  'site_engineer',
  'foreman',
  'subcontractor_admin',
  'subcontractor',
];
const DOCUMENTS_PAGE_LIMIT = 100;

export function DocumentsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const deletingDocumentRef = useRef<string | null>(null);
  const favouriteDocumentRef = useRef<string | null>(null);
  const queryLotId = searchParams.get('lotId') || '';
  const shouldOpenUploadFromQuery = searchParams.get('upload') === '1';

  const currentProjectRole = useCurrentProjectRole(projectId);
  const canManageDocuments = DOCUMENT_WRITE_ROLES.includes(currentProjectRole || '');

  // Upload workflow (modal state, drag/drop, multi-file progress, upload mutation)
  const upload = useDocumentUpload(projectId, canManageDocuments);

  // Filters
  const [filterType, setFilterType] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterLot, setFilterLot] = useState(() => queryLotId);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [committedSearch, setCommittedSearch] = useState('');
  const [showFavouritesOnly, setShowFavouritesOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

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
  const appliedUploadQueryRef = useRef<string | null>(null);

  const triggerSearch = () => {
    setCurrentPage(1);
    setCommittedSearch(searchQuery.trim());
  };
  const uploadQueryKey = `${queryLotId}:${shouldOpenUploadFromQuery ? 'open' : 'closed'}`;

  const openUploadForCurrentLot = () => {
    if (filterLot) {
      upload.updateUploadForm({ lotId: filterLot });
    }
    upload.openUploadModal();
  };

  useEffect(() => {
    setFilterLot(queryLotId);
    setCurrentPage(1);
  }, [queryLotId]);

  useEffect(() => {
    if (!shouldOpenUploadFromQuery || appliedUploadQueryRef.current === uploadQueryKey) return;
    if (!canManageDocuments) return;

    appliedUploadQueryRef.current = uploadQueryKey;
    if (queryLotId) {
      upload.updateUploadForm({ lotId: queryLotId });
    }
    upload.openUploadModal();
  }, [canManageDocuments, queryLotId, shouldOpenUploadFromQuery, upload, uploadQueryKey]);

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
    params.append('page', String(currentPage));
    params.append('limit', String(DOCUMENTS_PAGE_LIMIT));
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
      currentPage,
    ] as const,
    queryFn: () => apiFetch<DocumentsResponse>(docsQueryPath),
    enabled: !!projectId,
  });

  const documents: Document[] = useMemo(() => docsData?.documents || [], [docsData?.documents]);
  const categories: Record<string, number> = useMemo(
    () => docsData?.categories || {},
    [docsData?.categories],
  );
  const pagination = docsData?.pagination ?? null;
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

  useEffect(() => {
    if (pagination && pagination.totalPages > 0 && pagination.page > pagination.totalPages) {
      setCurrentPage(pagination.totalPages);
    }
  }, [pagination]);

  const updateFilterType = (value: string) => {
    setCurrentPage(1);
    setFilterType(value);
  };
  const updateFilterCategory = (value: string) => {
    setCurrentPage(1);
    setFilterCategory(value);
  };
  const updateFilterLot = (value: string) => {
    setCurrentPage(1);
    setFilterLot(value);
  };
  const updateDateFrom = (value: string) => {
    setCurrentPage(1);
    setDateFrom(value);
  };
  const updateDateTo = (value: string) => {
    setCurrentPage(1);
    setDateTo(value);
  };

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
      <DocumentDragOverlay isDragging={upload.isDragging} />
      <DocumentsPageHeader
        canUploadDocuments={canManageDocuments}
        onUpload={openUploadForCurrentLot}
      />

      {/* Filters */}
      <DocumentFiltersPanel
        filterType={filterType}
        filterCategory={filterCategory}
        filterLot={filterLot}
        dateFrom={dateFrom}
        dateTo={dateTo}
        searchQuery={searchQuery}
        showFavouritesOnly={showFavouritesOnly}
        lots={lots}
        onFilterTypeChange={updateFilterType}
        onFilterCategoryChange={updateFilterCategory}
        onFilterLotChange={updateFilterLot}
        onDateFromChange={updateDateFrom}
        onDateToChange={updateDateTo}
        onSearchQueryChange={setSearchQuery}
        onShowFavouritesOnlyChange={setShowFavouritesOnly}
        onTriggerSearch={triggerSearch}
        onClearAll={() => {
          setFilterType('');
          setFilterCategory('');
          setFilterLot('');
          setDateFrom('');
          setDateTo('');
          setSearchQuery('');
          setCommittedSearch('');
          setShowFavouritesOnly(false);
          setCurrentPage(1);
        }}
      />

      <DocumentsLoadErrorAlert error={error} onRetry={() => void refetchDocuments()} />

      <DocumentCategorySummary categories={categories} onSelectCategory={setFilterCategory} />

      {/* Documents Grid */}
      <DocumentGrid
        loading={loading}
        error={error}
        documents={documents}
        visibleDocuments={visibleDocuments}
        showFavouritesOnly={showFavouritesOnly}
        canManageDocuments={canManageDocuments}
        documentUrls={documentUrls}
        onToggleFavourite={toggleFavourite}
        onOpenViewer={(doc) => void openViewer(doc)}
        onDownload={(doc) => void handleDownload(doc)}
        onMarkPendingDelete={(doc) => setDocumentPendingDelete(doc)}
      />

      <DocumentsPagination
        pagination={pagination}
        visibleCount={visibleDocuments.length}
        onPreviousPage={() => setCurrentPage((page) => Math.max(1, page - 1))}
        onNextPage={() => setCurrentPage((page) => page + 1)}
      />

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
        <DocumentViewerModal
          doc={viewerDoc}
          url={viewerUrl}
          urlLoading={viewerUrlLoading}
          error={viewerError}
          zoom={viewerZoom}
          isFullscreen={isFullscreen}
          viewerRef={viewerRef}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onToggleFullscreen={toggleFullscreen}
          onDownload={() => void handleDownload(viewerDoc)}
          onClose={closeViewer}
          onRetry={() => void openViewer(viewerDoc)}
        />
      )}

      <DeleteDocumentDialog
        documentPendingDelete={documentPendingDelete}
        onCancel={() => setDocumentPendingDelete(null)}
        onConfirmDelete={(documentId) => {
          handleDelete(documentId);
          setDocumentPendingDelete(null);
        }}
      />
    </div>
  );
}
