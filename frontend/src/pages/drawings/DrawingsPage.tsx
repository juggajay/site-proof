// Feature #250: Drawing Register management page
import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth';
import { apiFetch, authFetch } from '@/lib/api';
import { getDocumentAccessUrl, openDocumentAccessUrl } from '@/lib/documentAccess';
import { queryKeys } from '@/lib/queryKeys';
import { createMutationErrorHandler, extractErrorMessage } from '@/lib/errorHandling';
import { toast } from '@/components/ui/toaster';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { logError } from '@/lib/logger';
import { sanitizeDownloadFilename } from '@/lib/downloads';
import { DrawingUploadModal } from './components/DrawingUploadModal';
import { DrawingRevisionModal } from './components/DrawingRevisionModal';
import { DrawingRegisterTable } from './components/DrawingRegisterTable';
import {
  DEFAULT_REVISION_FORM,
  DEFAULT_UPLOAD_FORM,
  DRAWING_STATUSES,
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
    fileUrl: string;
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

export function DrawingsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userRole = user?.role || user?.roleInCompany || '';
  const canManageDrawings = DRAWING_WRITE_ROLES.includes(userRole);
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
  const error = drawingsError ? 'Failed to load drawings. Please try again.' : null;
  const hasActiveFilters = Boolean(filterStatus || committedSearch);
  const showingFrom =
    pagination && pagination.total > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0;
  const showingTo = pagination
    ? Math.min(pagination.page * pagination.limit, pagination.total)
    : drawings.length;

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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Drawing Register</h1>
          <p className="text-muted-foreground">Manage project drawings and revisions</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={downloadCurrentSet}
            disabled={downloadingCurrentSet || loading || Boolean(drawingsError) || !projectId}
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
            <Button
              onClick={() => setShowUploadModal(true)}
              disabled={loading || Boolean(drawingsError)}
            >
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

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <div className="rounded-lg border bg-card p-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-muted-foreground">Total Drawings</div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="text-2xl font-bold text-yellow-600">{stats.preliminary}</div>
            <div className="text-sm text-muted-foreground">Preliminary</div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="text-2xl font-bold text-primary">{stats.forConstruction}</div>
            <div className="text-sm text-muted-foreground">For Construction</div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="text-2xl font-bold text-green-600">{stats.asBuilt}</div>
            <div className="text-sm text-muted-foreground">As-Built</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <Label htmlFor="drawing-status-filter" className="mb-1">
              Status
            </Label>
            <NativeSelect
              id="drawing-status-filter"
              value={filterStatus}
              onChange={(e) => handleStatusFilterChange(e.target.value)}
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
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && triggerSearch()}
              placeholder="Search by drawing number or title..."
            />
          </div>
          <Button type="button" variant="secondary" onClick={triggerSearch}>
            Search
          </Button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700"
        >
          <span>{error}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => void refetchDrawings()}>
            Retry
          </Button>
        </div>
      )}

      {/* Drawings Table */}
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
        />
        {!loading && !error && drawings.length > 0 && pagination && pagination.totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm">
            <span className="text-muted-foreground">
              Showing {showingFrom}-{showingTo} of {pagination.total}
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!pagination.hasPrevPage}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              >
                Previous
              </Button>
              <span className="text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!pagination.hasNextPage}
                onClick={() => setCurrentPage((page) => page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
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

      <ConfirmDialog
        open={Boolean(drawingPendingDelete)}
        title="Delete Drawing"
        description={
          <>
            <p>
              Delete drawing {drawingPendingDelete?.drawingNumber}
              {drawingPendingDelete?.revision ? ` Rev ${drawingPendingDelete.revision}` : ''}?
            </p>
            <p>This removes the drawing from the register.</p>
          </>
        }
        confirmLabel="Delete"
        variant="destructive"
        onCancel={() => setDrawingPendingDelete(null)}
        onConfirm={() => {
          if (drawingPendingDelete) {
            handleDelete(drawingPendingDelete.id);
            setDrawingPendingDelete(null);
          }
        }}
      />
    </div>
  );
}
