import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Eye, History, UploadCloud } from 'lucide-react';
import { ApiError, apiFetch, authFetch } from '@/lib/api';
import { extractErrorMessage } from '@/lib/errorHandling';
import { queryKeys } from '@/lib/queryKeys';
import { invalidateDocumentAccessUrl, openDocumentAccessUrl } from '@/lib/documentAccess';
import { logError } from '@/lib/logger';
import { toast } from '@/components/ui/toaster';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Modal,
  ModalBody,
  ModalDescription,
  ModalFooter,
  ModalHeader,
} from '@/components/ui/Modal';
import {
  canPreviewDocument as canPreview,
  formatDocumentDate as formatDate,
  formatDocumentFileSize as formatFileSize,
} from '../documentsDisplayData';

const DOCUMENT_VERSION_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp,.eml,.msg';

export interface DocumentVersionSource {
  id: string;
  filename: string;
  version?: number | null;
}

interface DocumentVersionRecord {
  id: string;
  filename: string;
  fileSize: number | null;
  mimeType: string | null;
  uploadedAt: string;
  uploadedBy: { id?: string; fullName?: string | null; email?: string | null } | null;
  version?: number | null;
  isLatestVersion?: boolean | null;
}

interface DocumentVersionsResponse {
  documentId: string;
  totalVersions: number;
  versions: DocumentVersionRecord[];
}

interface DocumentVersionsModalProps {
  projectId: string;
  document: DocumentVersionSource;
  canManageDocuments: boolean;
  onClose: () => void;
}

async function uploadDocumentVersion(documentId: string, file: File) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await authFetch(`/api/documents/${encodeURIComponent(documentId)}/version`, {
    method: 'POST',
    body: formData,
  });

  const body = await response.text();
  if (!response.ok) {
    throw new ApiError(response.status, body);
  }

  return body ? (JSON.parse(body) as DocumentVersionRecord) : null;
}

export function DocumentVersionsModal({
  projectId,
  document,
  canManageDocuments,
  onClose,
}: DocumentVersionsModalProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const versionsQueryKey = [...queryKeys.documents(projectId), 'versions', document.id] as const;
  const versionsQuery = useQuery({
    queryKey: versionsQueryKey,
    queryFn: () =>
      apiFetch<DocumentVersionsResponse>(
        `/api/documents/${encodeURIComponent(document.id)}/versions`,
      ),
  });

  const uploadVersionMutation = useMutation({
    mutationFn: (file: File) => uploadDocumentVersion(document.id, file),
    onSuccess: (newDocument) => {
      invalidateDocumentAccessUrl(document.id);
      if (newDocument?.id) {
        invalidateDocumentAccessUrl(newDocument.id);
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.documents(projectId) });
      queryClient.invalidateQueries({ queryKey: versionsQueryKey });
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      toast({
        title: 'Version uploaded',
        description: 'The document register now shows the latest version.',
        variant: 'success',
      });
    },
    onError: (error) => {
      toast({
        title: 'Version upload failed',
        description: extractErrorMessage(error, 'Failed to upload the new version.'),
        variant: 'error',
      });
    },
  });

  const handleDownload = async (version: DocumentVersionRecord) => {
    try {
      await openDocumentAccessUrl(version.id, null);
    } catch (error) {
      logError('Failed to open document version:', error);
      toast({
        title: 'Could not open version',
        description: extractErrorMessage(error, 'Failed to open this document version.'),
        variant: 'error',
      });
    }
  };

  const handleOpen = async (version: DocumentVersionRecord) => {
    try {
      await openDocumentAccessUrl(version.id, null, { disposition: 'inline' });
    } catch (error) {
      logError('Failed to open document version preview:', error);
      toast({
        title: 'Could not open version',
        description: extractErrorMessage(error, 'Failed to open this document version.'),
        variant: 'error',
      });
    }
  };

  const handleUpload = () => {
    if (!selectedFile || uploadVersionMutation.isLoading) return;
    uploadVersionMutation.mutate(selectedFile);
  };

  return (
    <Modal onClose={onClose} className="max-w-2xl">
      <ModalHeader>Version history</ModalHeader>
      <ModalDescription>{document.filename}</ModalDescription>
      <ModalBody>
        <div className="space-y-5">
          <div className="rounded-md border">
            {versionsQuery.isLoading ? (
              <div className="p-4 text-sm text-muted-foreground" role="status">
                Loading versions...
              </div>
            ) : versionsQuery.error ? (
              <div className="p-4 text-sm text-destructive" role="alert">
                {extractErrorMessage(versionsQuery.error, 'Failed to load version history.')}
              </div>
            ) : versionsQuery.data?.versions.length ? (
              <div className="divide-y">
                {versionsQuery.data.versions.map((version) => (
                  <div key={version.id} className="flex items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">v{version.version ?? 1}</span>
                        {version.isLatestVersion && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs">Current</span>
                        )}
                        <span className="truncate text-sm">{version.filename}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span>{formatFileSize(version.fileSize)}</span>
                        <span>{formatDate(version.uploadedAt)}</span>
                        {version.uploadedBy && (
                          <span>by {version.uploadedBy.fullName || version.uploadedBy.email}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {canPreview(version.mimeType) && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void handleOpen(version)}
                          aria-label={`View ${version.filename} version ${version.version ?? 1}`}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          View
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void handleDownload(version)}
                        aria-label={`Download ${version.filename} version ${version.version ?? 1}`}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-sm text-muted-foreground">No versions found.</div>
            )}
          </div>

          {canManageDocuments && (
            <div className="rounded-md border p-4">
              <div className="flex items-center gap-2 font-medium">
                <History className="h-4 w-4" />
                Upload new version
              </div>
              <div className="mt-4 space-y-3">
                <div>
                  <Label htmlFor="document-version-file" className="mb-2">
                    New version file
                  </Label>
                  <input
                    ref={fileInputRef}
                    id="document-version-file"
                    type="file"
                    accept={DOCUMENT_VERSION_ACCEPT}
                    disabled={uploadVersionMutation.isLoading}
                    onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                    className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                {selectedFile && (
                  <p className="text-sm text-muted-foreground">
                    {selectedFile.name} - {formatFileSize(selectedFile.size)}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Close
        </Button>
        {canManageDocuments && (
          <Button
            type="button"
            onClick={handleUpload}
            disabled={!selectedFile || uploadVersionMutation.isLoading}
          >
            <UploadCloud className="mr-2 h-4 w-4" />
            {uploadVersionMutation.isLoading ? 'Uploading...' : 'Upload version'}
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
}
