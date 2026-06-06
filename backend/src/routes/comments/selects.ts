import type { Prisma } from '@prisma/client';

export const commentAuthorSelect = {
  id: true,
  email: true,
  fullName: true,
  avatarUrl: true,
} satisfies Prisma.UserSelect;

export const commentAttachmentSelect = {
  id: true,
  filename: true,
  fileUrl: true,
  fileSize: true,
  mimeType: true,
  createdAt: true,
} satisfies Prisma.CommentAttachmentSelect;
