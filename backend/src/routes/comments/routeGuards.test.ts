import { describe, expect, it } from 'vitest';

import {
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

  it('validates uploaded file MIME declarations', () => {
    const file = {
      originalname: 'photo.jpg',
      mimetype: 'image/jpeg',
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0xdb]),
    } as Express.Multer.File;

    expect(validateUploadedCommentFiles([file])).toEqual([file]);
  });
});
