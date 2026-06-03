// Pure data + helpers for the drawing upload / revision (supersede) workflow.
// Extracted from DrawingsPage so the FormData construction, path builders,
// form normalization/validation, and response-error parsing can be unit-tested
// in isolation and shared between the page and its modal components.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Drawing {
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

export interface DrawingMutationResponse {
  drawing?: Drawing;
  message?: string;
}

export type DrawingMutationPayload = Drawing | DrawingMutationResponse;

export interface DrawingUploadForm {
  drawingNumber: string;
  title: string;
  revision: string;
  issueDate: string;
  status: string;
}

export interface DrawingRevisionForm {
  revision: string;
  title: string;
  issueDate: string;
  status: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const DRAWING_STATUSES = [
  { id: 'preliminary', label: 'Preliminary', color: 'bg-yellow-100 text-yellow-800' },
  { id: 'for_construction', label: 'For Construction', color: 'bg-primary/10 text-primary' },
  { id: 'as_built', label: 'As-Built', color: 'bg-green-100 text-green-800' },
];

export const DRAWING_FILE_ACCEPT = '.pdf,.dwg,.dxf,.jpg,.jpeg,.png,.tiff,.tif';

export const DEFAULT_UPLOAD_FORM: DrawingUploadForm = {
  drawingNumber: '',
  title: '',
  revision: '',
  issueDate: '',
  status: 'preliminary',
};

export const DEFAULT_REVISION_FORM: DrawingRevisionForm = {
  revision: '',
  title: '',
  issueDate: '',
  status: 'for_construction',
};

// ---------------------------------------------------------------------------
// Path builders
// ---------------------------------------------------------------------------

export function buildDrawingUploadPath(): string {
  return '/api/drawings';
}

export function buildDrawingSupersedePath(drawingId: string): string {
  return `/api/drawings/${encodeURIComponent(drawingId)}/supersede`;
}

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

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

export function getMutationDrawing(data: DrawingMutationPayload): Drawing | undefined {
  return 'drawingNumber' in data ? data : data.drawing;
}

// ---------------------------------------------------------------------------
// Form normalization + validation
// ---------------------------------------------------------------------------

export function normalizeUploadForm(form: DrawingUploadForm): DrawingUploadForm {
  return {
    ...form,
    drawingNumber: form.drawingNumber.trim(),
    title: form.title.trim(),
    revision: form.revision.trim(),
  };
}

export function normalizeRevisionForm(form: DrawingRevisionForm): DrawingRevisionForm {
  return {
    ...form,
    revision: form.revision.trim(),
    title: form.title.trim(),
  };
}

/** Upload is ready once a file is selected and a drawing number is present. */
export function isDrawingUploadReady(file: File | null, form: DrawingUploadForm): boolean {
  return Boolean(file && form.drawingNumber.trim());
}

/** Revision is ready once a file is selected and a new revision is entered. */
export function isDrawingRevisionReady(file: File | null, form: DrawingRevisionForm): boolean {
  return Boolean(file && form.revision.trim());
}

// ---------------------------------------------------------------------------
// FormData builders — mirror the backend multipart contract exactly.
// ---------------------------------------------------------------------------

export function buildDrawingUploadFormData(
  projectId: string,
  file: File,
  form: DrawingUploadForm,
): FormData {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('projectId', projectId);
  formData.append('drawingNumber', form.drawingNumber);
  if (form.title.trim()) formData.append('title', form.title.trim());
  if (form.revision.trim()) formData.append('revision', form.revision.trim());
  if (form.issueDate) formData.append('issueDate', form.issueDate);
  formData.append('status', form.status);
  return formData;
}

export function buildDrawingRevisionFormData(file: File, form: DrawingRevisionForm): FormData {
  const formData = new FormData();
  formData.append('file', file);
  if (form.title.trim()) formData.append('title', form.title.trim());
  formData.append('revision', form.revision);
  if (form.issueDate) formData.append('issueDate', form.issueDate);
  formData.append('status', form.status);
  return formData;
}

// ---------------------------------------------------------------------------
// File size formatting (shared by the modals + the register table).
// ---------------------------------------------------------------------------

export function formatFileSize(bytes: number | null): string {
  if (!bytes) return 'Unknown';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
