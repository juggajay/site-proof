import { compressImageForUpload } from '@/lib/offlinePhotoCompression';
import type { PendingAttachment } from './commentAttachmentDrafts';

interface BuildCommentFormDataOptions {
  entityType: string;
  entityId: string;
  content: string;
  files: PendingAttachment[];
  parentId?: string;
}

export async function buildCommentFormData({
  entityType,
  entityId,
  content,
  files,
  parentId,
}: BuildCommentFormDataOptions): Promise<FormData> {
  const formData = new FormData();
  formData.append('entityType', entityType);
  formData.append('entityId', entityId);
  formData.append('content', content);
  if (parentId) {
    formData.append('parentId', parentId);
  }

  // Compress image attachments before upload; non-images and any failure fall
  // back to the original file (compressImageForUpload never throws).
  for (const { file } of files) {
    formData.append('files', await compressImageForUpload(file));
  }

  return formData;
}

export function formatCommentDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown date';
  }

  return date.toLocaleString('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
