// Draft (not yet uploaded) comment attachment helpers: validation constants,
// file-selection collection, and preview object-URL lifecycle.

// Pending attachment interface (before upload)
export interface PendingAttachment {
  file: File;
  preview?: string;
}

export const MAX_ATTACHMENT_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const ALLOWED_ATTACHMENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
];

export function validateAttachmentFile(file: File): string | null {
  if (file.size > MAX_ATTACHMENT_FILE_SIZE) {
    return `File "${file.name}" exceeds the 10MB size limit.`;
  }
  if (!ALLOWED_ATTACHMENT_TYPES.includes(file.type)) {
    return `File "${file.name}" is not a supported format. Allowed: images, PDF, Word, Excel, text files.`;
  }
  return null;
}

export interface AttachmentDraftSelection {
  accepted: PendingAttachment[];
  errors: string[];
}

// Validates each selected file, creating a preview object URL for images only,
// and collects per-file validation messages for the rejected ones.
export function collectAttachmentDrafts(files: ArrayLike<File>): AttachmentDraftSelection {
  const accepted: PendingAttachment[] = [];
  const errors: string[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const error = validateAttachmentFile(file);
    if (error) {
      errors.push(error);
      continue;
    }
    const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
    accepted.push({ file, preview });
  }

  return { accepted, errors };
}

// Returns a copy with the draft at `index` removed, revoking its preview URL
// (if any) so removed image drafts don't leak object URLs.
export function removeAttachmentDraftAt(
  attachments: PendingAttachment[],
  index: number,
): PendingAttachment[] {
  const newArr = [...attachments];
  if (newArr[index].preview) URL.revokeObjectURL(newArr[index].preview!);
  newArr.splice(index, 1);
  return newArr;
}

export function revokeAttachmentPreviews(attachments: PendingAttachment[]): void {
  attachments.forEach((att) => {
    if (att.preview) URL.revokeObjectURL(att.preview);
  });
}
