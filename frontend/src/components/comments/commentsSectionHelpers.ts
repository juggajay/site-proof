import type { PendingAttachment } from './commentAttachmentDrafts';

interface BuildCommentFormDataOptions {
  entityType: string;
  entityId: string;
  content: string;
  files: PendingAttachment[];
  parentId?: string;
}

export function buildCommentFormData({
  entityType,
  entityId,
  content,
  files,
  parentId,
}: BuildCommentFormDataOptions): FormData {
  const formData = new FormData();
  formData.append('entityType', entityType);
  formData.append('entityId', entityId);
  formData.append('content', content);
  if (parentId) {
    formData.append('parentId', parentId);
  }

  for (const { file } of files) {
    formData.append('files', file);
  }

  return formData;
}

export function isSupabaseCommentAttachmentUrl(
  fileUrl: string,
  supabaseUrl: string | undefined,
): boolean {
  if (!/^https?:\/\//i.test(fileUrl)) return false;
  if (!supabaseUrl) return false;

  try {
    const url = new URL(fileUrl);
    const expectedOrigin = new URL(supabaseUrl).origin;
    if (url.origin !== expectedOrigin) return false;

    const pathname = decodeURIComponent(url.pathname);
    return pathname.includes('/storage/v1/object/public/') && pathname.includes('/comments/');
  } catch {
    return false;
  }
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
