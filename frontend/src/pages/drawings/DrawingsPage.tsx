// Feature #250: Drawing Register management page
import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, authFetch } from '@/lib/api';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { useCurrentProjectRole } from '@/hooks/useCurrentProjectRole';
import { getDocumentAccessUrl, openDocumentAccessUrl } from '@/lib/documentAccess';
import { queryKeys } from '@/lib/queryKeys';
import { createMutationErrorHandler, extractErrorMessage } from '@/lib/errorHandling';
import { toast } from '@/components/ui/toaster';
import { logError } from '@/lib/logger';
import { sanitizeDownloadFilename } from '@/lib/downloads';
import {
  DrawingDeleteConfirmDialog,
  DrawingFilters,
  DrawingLoadErrorAlert,
  DrawingPagination,
  DrawingRegisterHeader,
  DrawingStatsCards,
} from './components/DrawingPageSections';
import { DrawingUploadModal } from './components/DrawingUploadModal';
import { DrawingRevisionModal } from './components/DrawingRevisionModal';
import { DrawingRegisterTable } from './components/DrawingRegisterTable';
import {
  DEFAULT_REVISION_FORM,
  DEFAULT_UPLOAD_FORM,
  buildDrawingRevisionFormData,
  buildDrawingSupersedePath,
  buildDrawingUploadFormData,
  buildDrawingUploadPath,
  getMutationDrawing,
  getResponseErrorMessage,
  normalizeRevisionForm,
  normalizeUploadForm,
  type Drawing,
  type DrawingMutationPayload,
  type DrawingRevisionForm,
  type DrawingUploadForm,
} from './drawingsUploadData';

interface Stats {
  total: number;
  preliminary: number;
  forConstruction: number;
  asBuilt: number;
}

interface DrawingsResponse {
  drawings?: Drawing[];
  stats?: Stats | null;
  pagination?: PaginationMeta | null;
}

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface CurrentSetResponse {
  drawings: Array<{
    documentId: string;
    drawingNumber: string;
    revision: string | null;
    filename: string;
    fileUrl?: string | null;
  }>;
}

const DRAWING_WRITE_ROLES = [
  'owner',
  'admin',
  'project_manager',
  'quality_manager',
  'site_manager',
  'site_engineer',
  'foreman',
];
const DRAWINGS_PAGE_LIMIT = 50;

function getDrawingLoadError(drawingsError: unknown): string | null {
  return drawingsError ? 'Failed to load drawings. Please try again.' : null;
}

function getDrawingShowingRange(
  pagination: PaginationMeta | null,
  drawingCount: number,
): { showingFrom: number; showingTo: number } {
  if (!pagination) {
    return { showingFrom: 0, showingTo: drawingCount };
  }

  return {
    showingFrom: pagination.total > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0,
    showingTo: Math.min(pagination.page * pagination.limit, pagination.total),
  };
}

export function DrawingsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const encodedProjectId = projectId ? encodeURIComponent(projectId) : '';
  const downloadCurrentSetInFlightRef = useRef(false);

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadForm, setUploadForm] = useState<DrawingUploadForm>({ ...DEFAULT_UPLOAD_FORM });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Revision modal state
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [revisionDrawing, setRevisionDrawing] = useState<Drawing | null>(null);
  const [revisionForm, setRevisionForm] = useState<DrawingRevisionForm>({
    ...DEFAULT_REVISION_FORM,
  });
  const revisionFileInputRef = useRef<HTMLInputElement>(null);
  const [revisionFile, setRevisionFile] = useState<File | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [committedSearch, setCommittedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [drawingPendingDelete, setDrawingPendingDelete] = useState<Drawing | null>(null);

  // Download current set state
  const [downloadingCurrentSet, setDownloadingCurrentSet] = useState(false);

  const currentProjectRole = useCurrentProjectRole(projectId);
  const canManageDrawings = DRAWING_WRITE_ROLES.includes(currentProjectRole || '');

  const triggerSearch = () => {
    setCurrentPage(1);
    setCommittedSearch(searchQuery.trim());
  };
  const handleStatusFilterChange = (value: string) => {
    setCurrentPage(1);
    setFilterStatus(value);
  };
  const resetUploadForm = () => {
    setShowUploadModal(false);
    setSelectedFile(null);
    setUploadForm({ ...DEFAULT_UPLOAD_FORM });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  const resetRevisionForm = () => {
    setShowRevisionModal(false);
    setRevisionFile(null);
    setRevisionDrawing(null);
    if (revisionFileInputRef.current) revisionFileInputRef.current.value = '';
  };

  // Build query path
  const drawingsQueryPath = (() => {
    let path = `/api/drawings/${encodedProjectId}`;
    const params = new URLSearchParams();
    if (filterStatus) params.append('status', filterStatus);
    if (committedSearch) params.append('search', committedSearch);
    params.append('page', String(currentPage));
    params.append('limit', String(DRAWINGS_PAGE_LIMIT));
    if (params.toString()) path += `?${params.toString()}`;
    return path;
  })();

  const {
    data: drawingsData,
    isLoading: loading,
    error: drawingsError,
    refetch: refetchDrawings,
  } = useQuery({
    queryKey: [
      ...queryKeys.drawings(projectId!),
      filterStatus,
      committedSearch,
      currentPage,
    ] as const,
    queryFn: () => apiFetch<DrawingsResponse>(drawingsQueryPath),
    enabled: !!projectId,
  });

  const drawings: Drawing[] = drawingsData?.drawings || [];
  const stats: Stats | null = drawingsData?.stats || null;
  const pagination: PaginationMeta | null = drawingsData?.pagination || null;
  const error = getDrawingLoadError(drawingsError);
  const hasActiveFilters = Boolean(filterStatus || committedSearch);
  const { showingFrom, showingTo } = getDrawingShowingRange(pagination, drawings.length);

  useEffect(() => {
    if (pagination && pagination.totalPages > 0 && pagination.page > pagination.totalPages) {
      setCurrentPage(pagination.totalPages);
    }
  }, [pagination]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  // Upload drawing mutation (FormData)
  const uploadDrawingMutation = useMutation({
    mutationFn: async ({ file, form }: { file: File; form: DrawingUploadForm }) => {
      const res = await authFetch(buildDrawingUploadPath(), {
        method: 'POST',
        body: buildDrawingUploadFormData(projectId || '', file, form),
      });

      if (!res.ok) {
        throw new Error(await getResponseErrorMessage(res, 'Failed to upload drawing'));
      }
      return res.json() as Promise<DrawingMutationPayload>;
    },
    onSuccess: (data) => {
      const drawing = getMutationDrawing(data);
      queryClient.invalidateQueries({ queryKey: queryKeys.drawings(projectId!) });
      resetUploadForm();
      toast({
        title: 'Drawing uploaded',
        description: `${drawing?.drawingNumber || 'Drawing'} was added to the register.`,
        variant: 'success',
      });
    },
    onError: createMutationErrorHandler('Failed to upload drawing'),
  });

  const handleUpload = () => {
    if (!canManageDrawings || uploadDrawingMutation.isPending) return;
    const normalizedForm = normalizeUploadForm(uploadForm);
    if (!selectedFile || !normalizedForm.drawingNumber) {
      toast({
        title: 'Drawing details required',
        description: 'Select a file and enter a drawing number before uploading.',
        variant: 'error',
      });
      return;
    }
    uploadDrawingMutation.mutate({ file: selectedFile, form: normalizedForm });
  };

  // Delete drawing mutation
  const deleteDrawingMutation = useMutation({
    mutationFn: (drawingId: string) =>
      apiFetch(`/api/drawings/${encodeURIComponent(drawingId)}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.drawings(projectId!) });
      toast({
        title: 'Drawing deleted',
        description: 'The drawing was removed from the register.',
        variant: 'success',
      });
    },
    onError: createMutationErrorHandler('Failed to delete drawing'),
  });

  const handleDelete = (drawingId: string) => {
    if (!canManageDrawings || deleteDrawingMutation.isPending) return;
    deleteDrawingMutation.mutate(drawingId);
  };

  const openRevisionModal = (drawing: Drawing) => {
    if (!canManageDrawings) return;
    setRevisionDrawing(drawing);
    setRevisionForm({
      revision: '',
      title: drawing.title || '',
      issueDate: '',
      status: 'for_construction',
    });
    setRevisionFile(null);
    setShowRevisionModal(true);
  };

  // Revision upload mutation (FormData)
  const revisionUploadMutation = useMutation({
    mutationFn: async ({
      drawingId,
      file,
      form,
    }: {
      drawingId: string;
      file: File;
      form: DrawingRevisionForm;
    }) => {
      const res = await authFetch(buildDrawingSupersedePath(drawingId), {
        method: 'POST',
        body: buildDrawingRevisionFormData(file, form),
      });

      if (!res.ok) {
        throw new Error(await getResponseErrorMessage(res, 'Failed to upload new revision'));
      }
      return res.json() as Promise<DrawingMutationPayload>;
    },
    onSuccess: (data) => {
      const drawing = getMutationDrawing(data);
      queryClient.invalidateQueries({ queryKey: queryKeys.drawings(projectId!) });
      resetRevisionForm();
      toast({
        title: 'Revision uploaded',
        description: `${drawing?.drawingNumber || 'Drawing'} Rev ${drawing?.revision || revisionForm.revision} is now in the register.`,
        variant: 'success',
      });
    },
    onError: createMutationErrorHandler('Failed to upload revision'),
  });

  const handleRevisionUpload = () => {
    if (!canManageDrawings || revisionUploadMutation.isPending) return;
    const normalizedForm = normalizeRevisionForm(revisionForm);
    if (!revisionFile || !normalizedForm.revision || !revisionDrawing) {
      toast({
        title: 'Revision details required',
        description: 'Select a file and enter the new revision before uploading.',
        variant: 'error',
      });
      return;
    }
    revisionUploadMutation.mutate({
      drawingId: revisionDrawing.id,
      file: revisionFile,
      form: normalizedForm,
    });
  };

  // Status change mutation
  const statusChangeMutation = useMutation({
    mutationFn: ({ drawingId, newStatus }: { drawingId: string; newStatus: string }) =>
      apiFetch<DrawingMutationPayload>(`/api/drawings/${encodeURIComponent(drawingId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.drawings(projectId!) });
    },
    onError: createMutationErrorHandler('Failed to update status'),
  });

  const handleStatusChange = (drawingId: string, newStatus: string) => {
    if (!canManageDrawings || statusChangeMutation.isPending) return;
    if (drawings.find((drawing) => drawing.id === drawingId)?.status === newStatus) return;
    statusChangeMutation.mutate({ drawingId, newStatus });
  };

  const uploading = uploadDrawingMutation.isPending || revisionUploadMutation.isPending;

  const handleOpenDrawing = async (drawing: Drawing) => {
    try {
      await openDocumentAccessUrl(drawing.document.id, drawing.document.fileUrl);
    } catch (err) {
      logError('Error opening drawing:', err);
      toast({
        title: 'Could not open drawing',
        description: extractErrorMessage(err, 'Failed to open drawing. Please try again.'),
        variant: 'error',
      });
    }
  };

  // Download current set - downloads all current (non-superseded) drawings
  const downloadCurrentSet = async () => {
    if (downloadCurrentSetInFlightRef.current || !projectId || drawingsError) return;
    downloadCurrentSetInFlightRef.current = true;
    setDownloadingCurrentSet(true);
    try {
      const data = await apiFetch<CurrentSetResponse>(
        `/api/drawings/${encodedProjectId}/current-set`,
      );
      if (data.drawings.length === 0) {
        toast({
          title: 'No current drawings',
          description: 'There are no current drawings available to download.',
          variant: 'warning',
        });
        return;
      }

      for (const drawing of data.drawings) {
        const signedUrl = await getDocumentAccessUrl(drawing.documentId, drawing.fileUrl);
        const link = document.createElement('a');
        link.href = signedUrl;
        link.download = sanitizeDownloadFilename(
          `${drawing.drawingNumber}_Rev${drawing.revision || '0'}_${drawing.filename}`,
          'drawing',
        );
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      toast({
        title: 'Current drawings downloaded',
        description: `${data.drawings.length} current drawing(s) were opened for download.`,
        variant: 'success',
      });
    } catch (err) {
      logError('Error downloading current set:', err);
      toast({
        title: 'Download failed',
        description: extractErrorMessage(
          err,
          'Failed to download current drawings. Please try again.',
        ),
        variant: 'error',
      });
    } finally {
      downloadCurrentSetInFlightRef.current = false;
      setDownloadingCurrentSet(false);
    }
  };

  return (
    <div className="space-y-6">
      <DrawingRegisterHeader
        canManageDrawings={canManageDrawings}
        downloadingCurrentSet={downloadingCurrentSet}
        loading={loading}
        hasDrawingError={Boolean(drawingsError)}
        hasProjectId={Boolean(projectId)}
        onDownloadCurrentSet={downloadCurrentSet}
        onAddDrawing={() => setShowUploadModal(true)}
      />

      {stats && <DrawingStatsCards stats={stats} />}

      <DrawingFilters
        filterStatus={filterStatus}
        searchQuery={searchQuery}
        onStatusFilterChange={handleStatusFilterChange}
        onSearchQueryChange={setSearchQuery}
        onSearch={triggerSearch}
      />

      {error && <DrawingLoadErrorAlert error={error} onRetry={() => void refetchDrawings()} />}

      <div className="rounded-lg border bg-card">
        <DrawingRegisterTable
          loading={loading}
          error={error}
          drawings={drawings}
          hasActiveFilters={hasActiveFilters}
          canManageDrawings={canManageDrawings}
          statusChangePending={statusChangeMutation.isPending}
          handleStatusChange={handleStatusChange}
          handleOpenDrawing={handleOpenDrawing}
          openRevisionModal={openRevisionModal}
          setDrawingPendingDelete={setDrawingPendingDelete}
          isMobile={isMobile}
        />
        {!loading && !error && drawings.length > 0 && pagination && pagination.totalPages > 1 && (
          <DrawingPagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            hasPrevPage={pagination.hasPrevPage}
            hasNextPage={pagination.hasNextPage}
            showingFrom={showingFrom}
            showingTo={showingTo}
            onPreviousPage={() => setCurrentPage((page) => Math.max(1, page - 1))}
            onNextPage={() => setCurrentPage((page) => page + 1)}
          />
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <DrawingUploadModal
          form={uploadForm}
          setForm={setUploadForm}
          selectedFile={selectedFile}
          onFileSelect={handleFileSelect}
          fileInputRef={fileInputRef}
          uploading={uploading}
          onClose={resetUploadForm}
          onUpload={handleUpload}
        />
      )}

      {/* Revision Modal */}
      {showRevisionModal && revisionDrawing && (
        <DrawingRevisionModal
          drawing={revisionDrawing}
          form={revisionForm}
          setForm={setRevisionForm}
          selectedFile={revisionFile}
          onFileSelect={(e) => setRevisionFile(e.target.files?.[0] || null)}
          fileInputRef={revisionFileInputRef}
          uploading={uploading}
          onClose={resetRevisionForm}
          onUpload={handleRevisionUpload}
        />
      )}

      <DrawingDeleteConfirmDialog
        drawing={drawingPendingDelete}
        onCancel={() => setDrawingPendingDelete(null)}
        onConfirm={(drawingId) => {
          handleDelete(drawingId);
          setDrawingPendingDelete(null);
        }}
      />
    </div>
  );
}
