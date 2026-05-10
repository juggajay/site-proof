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
import {
  Modal,
  ModalHeader,
  ModalDescription,
  ModalBody,
  ModalFooter,
} from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { logError } from '@/lib/logger';
import { sanitizeDownloadFilename } from '@/lib/downloads';

interface Drawing {
  id: string;
  drawingNumber: string;
  title: string | null;
  revision: string | null;
  issueDate: string | null;
  status: string;
  createdAt: string;
  document: {
    id: string;
    filename: string;
    fileUrl: string;
    fileSize: number | null;
    mimeType: string | null;
    uploadedAt: string;
    uploadedBy: { id: string; fullName: string; email: string } | null;
  };
  supersededBy: { id: string; drawingNumber: string; revision: string } | null;
  supersedes: { id: string; drawingNumber: string; revision: string }[];
}

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

interface DrawingMutationResponse {
  drawing?: Drawing;
  message?: string;
}

type DrawingMutationPayload = Drawing | DrawingMutationResponse;

interface CurrentSetResponse {
  drawings: Array<{
    documentId: string;
    drawingNumber: string;
    revision: string | null;
    filename: string;
    fileUrl: string;
  }>;
}

const DRAWING_STATUSES = [
  { id: 'preliminary', label: 'Preliminary', color: 'bg-yellow-100 text-yellow-800' },
  { id: 'for_construction', label: 'For Construction', color: 'bg-primary/10 text-primary' },
  { id: 'as_built', label: 'As-Built', color: 'bg-green-100 text-green-800' },
];

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

async function getResponseErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string | { message?: string }; message?: string };
    if (typeof data.error === 'string') return data.error;
    if (typeof data.error === 'object' && data.error?.message) return data.error.message;
    return data.message || fallback;
  } catch {
    return fallback;
  }
}

function getMutationDrawing(data: DrawingMutationPayload): Drawing | undefined {
  return 'drawingNumber' in data ? data : data.drawing;
}

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
  const [uploadForm, setUploadForm] = useState({
    drawingNumber: '',
    title: '',
    revision: '',
    issueDate: '',
    status: 'preliminary',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Revision modal state
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [revisionDrawing, setRevisionDrawing] = useState<Drawing | null>(null);
  const [revisionForm, setRevisionForm] = useState({
    revision: '',
    title: '',
    issueDate: '',
    status: 'for_construction',
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
    setUploadForm({
      drawingNumber: '',
      title: '',
      revision: '',
      issueDate: '',
      status: 'preliminary',
    });
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
    mutationFn: async ({ file, form }: { file: File; form: typeof uploadForm }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('projectId', projectId || '');
      formData.append('drawingNumber', form.drawingNumber);
      if (form.title.trim()) formData.append('title', form.title.trim());
      if (form.revision.trim()) formData.append('revision', form.revision.trim());
      if (form.issueDate) formData.append('issueDate', form.issueDate);
      formData.append('status', form.status);

      const res = await authFetch('/api/drawings', {
        method: 'POST',
        body: formData,
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
    const normalizedForm = {
      ...uploadForm,
      drawingNumber: uploadForm.drawingNumber.trim(),
      title: uploadForm.title.trim(),
      revision: uploadForm.revision.trim(),
    };
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
      form: typeof revisionForm;
    }) => {
      const formData = new FormData();
      formData.append('file', file);
      if (form.title.trim()) formData.append('title', form.title.trim());
      formData.append('revision', form.revision);
      if (form.issueDate) formData.append('issueDate', form.issueDate);
      formData.append('status', form.status);

      const res = await authFetch(`/api/drawings/${encodeURIComponent(drawingId)}/supersede`, {
        method: 'POST',
        body: formData,
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
    const normalizedForm = {
      ...revisionForm,
      revision: revisionForm.revision.trim(),
      title: revisionForm.title.trim(),
    };
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

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getStatusInfo = (status: string) => {
    return (
      DRAWING_STATUSES.find((s) => s.id === status) || {
        id: status,
        label: status,
        color: 'bg-muted text-foreground',
      }
    );
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
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Loading drawings...</div>
        ) : error ? null : drawings.length === 0 ? (
          <div className="p-12 text-center">
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
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="mt-4 text-lg font-medium">No drawings found</h3>
            <p className="mt-2 text-muted-foreground">
              {hasActiveFilters
                ? 'No drawings match the current filters.'
                : 'Upload your first drawing to get started.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium">Drawing No.</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Title</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Revision</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Issue Date</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">File</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {drawings.map((drawing) => {
                  const statusInfo = getStatusInfo(drawing.status);
                  return (
                    <tr
                      key={drawing.id}
                      className={`hover:bg-muted/30 ${drawing.supersededBy ? 'opacity-60' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <span className="font-medium">{drawing.drawingNumber}</span>
                        {drawing.supersededBy && (
                          <span className="ml-2 text-xs text-orange-600">(Superseded)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">{drawing.title || '-'}</td>
                      <td className="px-4 py-3 text-sm">{drawing.revision || '-'}</td>
                      <td className="px-4 py-3 text-sm">{formatDate(drawing.issueDate)}</td>
                      <td className="px-4 py-3">
                        {canManageDrawings ? (
                          <NativeSelect
                            aria-label={`Status for ${drawing.drawingNumber}`}
                            value={drawing.status}
                            disabled={statusChangeMutation.isPending}
                            onChange={(e) => handleStatusChange(drawing.id, e.target.value)}
                            className={`rounded-full px-3 py-1 text-xs font-medium h-auto ${statusInfo.color}`}
                          >
                            {DRAWING_STATUSES.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.label}
                              </option>
                            ))}
                          </NativeSelect>
                        ) : (
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${statusInfo.color}`}
                          >
                            {statusInfo.label}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          <span
                            className="truncate max-w-[150px]"
                            title={drawing.document.filename}
                          >
                            {drawing.document.filename}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ({formatFileSize(drawing.document.fileSize)})
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => void handleOpenDrawing(drawing)}
                            className="rounded-md p-2 hover:bg-muted"
                            aria-label={`Download ${drawing.drawingNumber}`}
                            title="Download"
                          >
                            <svg
                              className="h-4 w-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                              />
                            </svg>
                          </button>
                          {canManageDrawings && !drawing.supersededBy && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openRevisionModal(drawing)}
                              className="text-primary hover:bg-primary/10 h-8 w-8"
                              aria-label={`Upload new revision for ${drawing.drawingNumber}`}
                              title="Upload New Revision"
                            >
                              <svg
                                className="h-4 w-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                />
                              </svg>
                            </Button>
                          )}
                          {canManageDrawings && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDrawingPendingDelete(drawing)}
                              className="text-red-600 hover:bg-red-100 h-8 w-8"
                              aria-label={`Delete ${drawing.drawingNumber}`}
                              title="Delete"
                            >
                              <svg
                                className="h-4 w-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
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
        <Modal
          onClose={() => {
            if (!uploading) resetUploadForm();
          }}
          className="max-w-lg"
        >
          <ModalHeader>Add Drawing</ModalHeader>
          <ModalDescription>
            Upload a drawing file with its register number, revision, issue date, and status.
          </ModalDescription>
          <ModalBody>
            <div className="space-y-4">
              {/* File Input */}
              <div>
                <Label htmlFor="drawing-upload-file" className="mb-2">
                  Select File *
                </Label>
                <Input
                  id="drawing-upload-file"
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  accept=".pdf,.dwg,.dxf,.jpg,.jpeg,.png,.tiff,.tif"
                />
                {selectedFile && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                  </p>
                )}
              </div>

              {/* Drawing Number */}
              <div>
                <Label htmlFor="drawing-upload-number" className="mb-2">
                  Drawing Number *
                </Label>
                <Input
                  id="drawing-upload-number"
                  type="text"
                  value={uploadForm.drawingNumber}
                  onChange={(e) =>
                    setUploadForm((prev) => ({ ...prev, drawingNumber: e.target.value }))
                  }
                  placeholder="e.g., DWG-001"
                />
              </div>

              {/* Title */}
              <div>
                <Label htmlFor="drawing-upload-title" className="mb-2">
                  Title
                </Label>
                <Input
                  id="drawing-upload-title"
                  type="text"
                  value={uploadForm.title}
                  onChange={(e) => setUploadForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., Site Plan"
                />
              </div>

              {/* Revision */}
              <div>
                <Label htmlFor="drawing-upload-revision" className="mb-2">
                  Revision
                </Label>
                <Input
                  id="drawing-upload-revision"
                  type="text"
                  value={uploadForm.revision}
                  onChange={(e) => setUploadForm((prev) => ({ ...prev, revision: e.target.value }))}
                  placeholder="e.g., A, B, 01"
                />
              </div>

              {/* Issue Date */}
              <div>
                <Label htmlFor="drawing-upload-issue-date" className="mb-2">
                  Issue Date
                </Label>
                <Input
                  id="drawing-upload-issue-date"
                  type="date"
                  value={uploadForm.issueDate}
                  onChange={(e) =>
                    setUploadForm((prev) => ({ ...prev, issueDate: e.target.value }))
                  }
                />
              </div>

              {/* Status */}
              <div>
                <Label htmlFor="drawing-upload-status" className="mb-2">
                  Status
                </Label>
                <NativeSelect
                  id="drawing-upload-status"
                  value={uploadForm.status}
                  onChange={(e) => setUploadForm((prev) => ({ ...prev, status: e.target.value }))}
                >
                  {DRAWING_STATUSES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="outline"
              onClick={() => {
                resetUploadForm();
              }}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || !uploadForm.drawingNumber.trim() || uploading}
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </Button>
          </ModalFooter>
        </Modal>
      )}

      {/* Revision Modal */}
      {showRevisionModal && revisionDrawing && (
        <Modal
          onClose={() => {
            if (!uploading) resetRevisionForm();
          }}
          className="max-w-lg"
        >
          <ModalHeader>Upload New Revision</ModalHeader>
          <ModalDescription>
            Upload a new file and revision details. The existing drawing will be marked as
            superseded.
          </ModalDescription>
          <ModalBody>
            <p className="text-sm text-muted-foreground mb-4">
              Creating new revision for: <strong>{revisionDrawing.drawingNumber}</strong>
              {revisionDrawing.revision && ` (Current: Rev ${revisionDrawing.revision})`}
            </p>

            <div className="space-y-4">
              {/* File Input */}
              <div>
                <Label htmlFor="drawing-revision-file" className="mb-2">
                  Select File *
                </Label>
                <Input
                  id="drawing-revision-file"
                  ref={revisionFileInputRef}
                  type="file"
                  onChange={(e) => setRevisionFile(e.target.files?.[0] || null)}
                  accept=".pdf,.dwg,.dxf,.jpg,.jpeg,.png,.tiff,.tif"
                />
                {revisionFile && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Selected: {revisionFile.name} ({formatFileSize(revisionFile.size)})
                  </p>
                )}
              </div>

              {/* New Revision */}
              <div>
                <Label htmlFor="drawing-revision-number" className="mb-2">
                  New Revision *
                </Label>
                <Input
                  id="drawing-revision-number"
                  type="text"
                  value={revisionForm.revision}
                  onChange={(e) =>
                    setRevisionForm((prev) => ({ ...prev, revision: e.target.value }))
                  }
                  placeholder="e.g., B, C, 02"
                />
              </div>

              {/* Title */}
              <div>
                <Label htmlFor="drawing-revision-title" className="mb-2">
                  Title
                </Label>
                <Input
                  id="drawing-revision-title"
                  type="text"
                  value={revisionForm.title}
                  onChange={(e) => setRevisionForm((prev) => ({ ...prev, title: e.target.value }))}
                />
              </div>

              {/* Issue Date */}
              <div>
                <Label htmlFor="drawing-revision-issue-date" className="mb-2">
                  Issue Date
                </Label>
                <Input
                  id="drawing-revision-issue-date"
                  type="date"
                  value={revisionForm.issueDate}
                  onChange={(e) =>
                    setRevisionForm((prev) => ({ ...prev, issueDate: e.target.value }))
                  }
                />
              </div>

              {/* Status */}
              <div>
                <Label htmlFor="drawing-revision-status" className="mb-2">
                  Status
                </Label>
                <NativeSelect
                  id="drawing-revision-status"
                  value={revisionForm.status}
                  onChange={(e) => setRevisionForm((prev) => ({ ...prev, status: e.target.value }))}
                >
                  {DRAWING_STATUSES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>

              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                <strong>Note:</strong> The previous revision (
                {revisionDrawing.revision || 'original'}) will be marked as superseded.
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="outline"
              onClick={() => {
                resetRevisionForm();
              }}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRevisionUpload}
              disabled={!revisionFile || !revisionForm.revision.trim() || uploading}
            >
              {uploading ? 'Uploading...' : 'Upload Revision'}
            </Button>
          </ModalFooter>
        </Modal>
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
