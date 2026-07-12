/**
 * Data contract + pure helpers + network orchestration for the Documents page
 * upload workflow. This module owns everything that is testable without React:
 * the document type/category option lists, the upload form shape, the per-file
 * FormData construction, the failure/summary message formatting, and the
 * multi-file upload loop (with progress reporting).
 *
 * Behaviour here is extracted verbatim from the previous inline implementation
 * in DocumentsPage.tsx so the API path, FormData fields, caption trimming,
 * single-file caption rule, and failure messaging are all preserved exactly.
 */

import { authFetch } from '@/lib/api';
import { compressImageForUpload } from '@/lib/offlinePhotoCompression';
import { extractErrorMessage } from '@/lib/errorHandling';
import { logError } from '@/lib/logger';

export interface DocumentOption {
  id: string;
  label: string;
}

export const DOCUMENT_TYPES: DocumentOption[] = [
  { id: 'specification', label: 'Specification' },
  { id: 'drawing', label: 'Drawing' },
  { id: 'photo', label: 'Photo' },
  { id: 'certificate', label: 'Certificate' },
  { id: 'report', label: 'Report' },
  { id: 'correspondence', label: 'Correspondence' },
  { id: 'contract', label: 'Contract' },
  { id: 'other', label: 'Other' },
];

export const CATEGORIES: DocumentOption[] = [
  { id: 'design', label: 'Design' },
  { id: 'construction', label: 'Construction' },
  { id: 'quality', label: 'Quality' },
  { id: 'safety', label: 'Safety' },
  { id: 'environmental', label: 'Environmental' },
  { id: 'commercial', label: 'Commercial' },
  { id: 'general', label: 'General' },
];

export const MIN_IMAGE_WIDTH = 100;
export const MIN_IMAGE_HEIGHT = 100;

export const DOCUMENTS_UPLOAD_PATH = '/api/documents/upload';

export interface UploadDocumentForm {
  documentType: string;
  category: string;
  caption: string;
  lotId: string;
}

export const EMPTY_UPLOAD_FORM: UploadDocumentForm = {
  documentType: '',
  category: '',
  caption: '',
  lotId: '',
};

export interface ImageDimensions {
  width: number;
  height: number;
}

/** The shape returned by the upload endpoint; only the count is consumed here. */
export type UploadedDocument = Record<string, unknown>;

export interface UploadDocumentsParams {
  files: File[];
  projectId: string | undefined;
  form: UploadDocumentForm;
  onProgress: (uploadedCount: number, progressPercent: number) => void;
}

export interface UploadDocumentsResult {
  uploadedDocs: UploadedDocument[];
  failedUploads: string[];
}

/**
 * Auto-detect the document type from the first selected file. Images become
 * `photo`, PDFs become `drawing`, and anything else returns null so the caller
 * leaves the currently selected document type untouched.
 */
export function detectDocumentTypeFromFile(file: File): 'photo' | 'drawing' | null {
  if (file.type.startsWith('image/')) return 'photo';
  if (file.type === 'application/pdf') return 'drawing';
  return null;
}

/** Returns a warning string when an image is below the recommended minimum. */
export function evaluateImageDimensions(width: number, height: number): string | null {
  if (width < MIN_IMAGE_WIDTH || height < MIN_IMAGE_HEIGHT) {
    return `Warning: Image dimensions (${width}x${height}) are below recommended minimum (${MIN_IMAGE_WIDTH}x${MIN_IMAGE_HEIGHT}). Photo may lack detail for documentation.`;
  }

  return null;
}

/**
 * Format a single failed upload for the partial-failure summary. A blank or
 * generic reason collapses to just the filename; a reason that already names the
 * file is used verbatim; otherwise the filename is prefixed.
 */
export function formatFailedUpload(filename: string, reason: string): string {
  const trimmedReason = reason.trim();
  if (!trimmedReason || trimmedReason === 'Upload failed') {
    return filename;
  }

  return trimmedReason.toLowerCase().includes(filename.toLowerCase())
    ? trimmedReason
    : `${filename}: ${trimmedReason}`;
}

/** Best-effort extraction of an error message from a non-ok upload response. */
export async function getResponseErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string | { message?: string }; message?: string };
    if (typeof data.error === 'string') return data.error;
    if (typeof data.error === 'object' && data.error?.message) return data.error.message;
    return data.message || fallback;
  } catch {
    return fallback;
  }
}

/**
 * Build the multipart body for a single upload. The caption is trimmed and only
 * sent for single-file uploads; category and lotId are only sent when set.
 */
export function buildDocumentUploadFormData({
  file,
  projectId,
  form,
  totalFiles,
}: {
  file: File;
  projectId: string | undefined;
  form: UploadDocumentForm;
  totalFiles: number;
}): FormData {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('projectId', projectId || '');
  formData.append('documentType', form.documentType);
  if (form.category) formData.append('category', form.category);
  const caption = form.caption.trim();
  if (caption && totalFiles === 1) {
    formData.append('caption', caption);
  }
  if (form.lotId) formData.append('lotId', form.lotId);
  return formData;
}

/** "Uploaded X of Y. Failed: a; b" summary shown when some files fail. */
export function buildPartialFailureMessage(
  uploadedCount: number,
  totalCount: number,
  failedUploads: string[],
): string {
  return `Uploaded ${uploadedCount} of ${totalCount}. Failed: ${failedUploads.join('; ')}`;
}

/** "N file(s) uploaded successfully." success toast description. */
export function buildUploadSuccessMessage(uploadedCount: number): string {
  return `${uploadedCount} file${uploadedCount === 1 ? '' : 's'} uploaded successfully.`;
}

/**
 * Upload each file sequentially, reporting progress after every file. Successful
 * uploads are accumulated; per-file failures (non-ok responses or thrown errors)
 * are formatted and collected without aborting the remaining uploads.
 */
export async function uploadDocuments({
  files,
  projectId,
  form,
  onProgress,
}: UploadDocumentsParams): Promise<UploadDocumentsResult> {
  const uploadedDocs: UploadedDocument[] = [];
  const failedUploads: string[] = [];

  for (let i = 0; i < files.length; i++) {
    // Compress raster images before upload; PDFs/other docs pass through.
    const file = await compressImageForUpload(files[i]);
    try {
      const formData = buildDocumentUploadFormData({
        file,
        projectId,
        form,
        totalFiles: files.length,
      });

      const res = await authFetch(DOCUMENTS_UPLOAD_PATH, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const newDoc = (await res.json()) as UploadedDocument;
        uploadedDocs.push(newDoc);
      } else {
        const reason = await getResponseErrorMessage(res, 'Upload failed');
        logError('Document upload failed', reason);
        failedUploads.push(formatFailedUpload(file.name, reason));
      }
    } catch (err) {
      logError('Document upload failed', err);
      failedUploads.push(formatFailedUpload(file.name, extractErrorMessage(err, 'Upload failed')));
    }

    onProgress(i + 1, Math.round(((i + 1) / files.length) * 100));
  }

  return { uploadedDocs, failedUploads };
}
