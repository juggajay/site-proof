import { describe, expect, it } from 'vitest';

import {
  assertCommentAttachmentLimit,
  requireCommentAttachmentArray,
  requireCommentAuthor,
  requireCommentUserId,
  validateUploadedCommentFiles,
} from './routeGuards.js';

describe('comment route guards', () => {
  it('requires an authenticated comment user id', () => {
    expect(requireCommentUserId('user-1')).toBe('user-1');
    expect(() => requireCommentUserId(undefined)).toThrow('Authentication required');
  });

  it('preserves caller-provided author failure messages', () => {
    expect(() => requireCommentAuthor('author-1', 'author-1', 'Only author')).not.toThrow();
    expect(() => requireCommentAuthor('author-1', 'user-2', 'Only author')).toThrow('Only author');
  });

  it('rejects too many attachment references', () => {
    const attachments = Array.from({ length: 6 }, (_, index) => ({ id: `att-${index}` }));

    expect(() => assertCommentAttachmentLimit(attachments)).toThrow(
      'attachments cannot include more than 5 files',
    );
  });

  it('requires a non-empty attachment array for attachment-only routes', () => {
    expect(requireCommentAttachmentArray([{ id: 'att-1' }])).toEqual([{ id: 'att-1' }]);
    expect(() => requireCommentAttachmentArray(undefined)).toThrow('attachments array is required');
    expect(() => requireCommentAttachmentArray([])).toThrow('attachments array is required');
  });

  it('validates uploaded file MIME declarations', () => {
    const file = {
      originalname: 'photo.jpg',
      mimetype: 'image/jpeg',
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0xdb]),
    } as Express.Multer.File;

    expect(validateUploadedCommentFiles([file])).toEqual([file]);
  });
});
