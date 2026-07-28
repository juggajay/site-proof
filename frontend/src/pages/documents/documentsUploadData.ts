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

/**
 * Wave D `D1d` (spec §4.8 items 3-4). These two strings are read by
 * `backend/src/lib/handover/loganPsp5Profile.ts` (`CCTV_DOCUMENT_TYPE`,
 * `CONCEALED_WORKS_DOCUMENT_TYPE`) — the profile named them first so this
 * surface would write the same values instead of picking new ones and leaving
 * the item (e) and (f) resolvers blind. Changing either string here silently
 * blinds a folio resolver.
 */
export const CCTV_DOCUMENT_TYPE = 'cctv_stormwater';
export const CONCEALED_WORKS_DOCUMENT_TYPE = 'concealed_works_photo';

export const DOCUMENT_TYPES: DocumentOption[] = [
  { id: 'specification', label: 'Specification' },
  { id: 'drawing', label: 'Drawing' },
  { id: 'photo', label: 'Photo' },
  { id: CONCEALED_WORKS_DOCUMENT_TYPE, label: 'Concealed works photo' },
  { id: CCTV_DOCUMENT_TYPE, label: 'CCTV video (stormwater)' },
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

/**
 * D1d, spec §4.8 item 4 — the manifest category each new type files under. Both
 * are quality evidence, so they reuse the shipped `quality` category rather than
 * inventing one; the handover manifest reads `category` the same way every other
 * document surface does.
 */
export const DEFAULT_CATEGORY_BY_DOCUMENT_TYPE: Record<string, string> = {
  [CCTV_DOCUMENT_TYPE]: 'quality',
  [CONCEALED_WORKS_DOCUMENT_TYPE]: 'quality',
};

/**
 * D1d, spec §4.8 item 4 — both types are lot-scoped evidence. The Logan PSP5
 * resolvers run per lot, so an unassociated CCTV run or concealed-works photo
 * never reaches a folio. The backend enforces this too; this list is what lets
 * the form say so before the request is sent.
 */
export const LOT_REQUIRED_DOCUMENT_TYPES: readonly string[] = [
  CCTV_DOCUMENT_TYPE,
  CONCEALED_WORKS_DOCUMENT_TYPE,
];

export function requiresLotAssociation(documentType: string): boolean {
  return LOT_REQUIRED_DOCUMENT_TYPES.includes(documentType);
}

/**
 * Logan PSP5 §5.6.5(1)(e)'s run-endpoint requirement, carried as guidance text
 * on the upload surface rather than as a data model (spec §4.8: "stays guidance
 * text on the upload surface, not a data model").
 */
export const CCTV_UPLOAD_GUIDANCE =
  'One file per pipe run — first drainage maintenance hole upstream to the maintenance ' +
  'hole downstream. Name the file with those endpoints. MP4, MPEG, .mov or .avi, up to ' +
  '256 MB per run; a combined reel will be refused.';

export const CONCEALED_WORKS_UPLOAD_GUIDANCE =
  'Use for work that will be below ground or not visible once complete, photographed ' +
  'BEFORE backfilling (Logan PSP5 §5.6.5(1)(f)(i)-(ii)). Include the chainage or exact ' +
  'location in the file name, and keep the camera date stamp on.';

export function getUploadGuidance(documentType: string): string | null {
  if (documentType === CCTV_DOCUMENT_TYPE) return CCTV_UPLOAD_GUIDANCE;
  if (documentType === CONCEALED_WORKS_DOCUMENT_TYPE) return CONCEALED_WORKS_UPLOAD_GUIDANCE;
  return null;
}

export const MIN_IMAGE_WIDTH = 100;
export const MIN_IMAGE_HEIGHT = 100;

export const DOCUMENTS_UPLOAD_PATH = '/api/documents/upload';
/** D1d — the video-capable surface (separate allow-set, 256 MiB ceiling). */
export const CCTV_UPLOAD_PATH = '/api/documents/upload/cctv';

export function resolveUploadPath(documentType: string): string {
  return documentType === CCTV_DOCUMENT_TYPE ? CCTV_UPLOAD_PATH : DOCUMENTS_UPLOAD_PATH;
}

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
  // D1d: the two handover types always carry a manifest category, so an operator
  // who leaves the field blank still files them where the manifest looks.
  const category = form.category || DEFAULT_CATEGORY_BY_DOCUMENT_TYPE[form.documentType] || '';
  if (category) formData.append('category', category);
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

      const res = await authFetch(resolveUploadPath(form.documentType), {
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
