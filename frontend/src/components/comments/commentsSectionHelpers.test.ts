import { describe, expect, it } from 'vitest';
import {
  buildCommentFormData,
  formatCommentDate,
  isSupabaseCommentAttachmentUrl,
} from './commentsSectionHelpers';
import type { PendingAttachment } from './commentAttachmentDrafts';

function makePendingAttachment(name: string, type = 'image/png'): PendingAttachment {
  return {
    file: new File(['x'], name, { type }),
    preview: type.startsWith('image/') ? `blob:${name}` : undefined,
  };
}

describe('buildCommentFormData', () => {
  it('builds multipart comment fields with optional parent and all files', () => {
    const formData = buildCommentFormData({
      entityType: 'Lot',
      entityId: 'lot-1',
      content: 'Comment body',
      parentId: 'parent-1',
      files: [
        makePendingAttachment('photo.png'),
        makePendingAttachment('evidence.pdf', 'application/pdf'),
      ],
    });

    expect(formData.get('entityType')).toBe('Lot');
    expect(formData.get('entityId')).toBe('lot-1');
    expect(formData.get('content')).toBe('Comment body');
    expect(formData.get('parentId')).toBe('parent-1');

    const files = formData.getAll('files') as File[];
    expect(files.map((file) => file.name)).toEqual(['photo.png', 'evidence.pdf']);
  });

  it('omits parentId when creating a top-level comment', () => {
    const formData = buildCommentFormData({
      entityType: 'NCR',
      entityId: 'ncr-1',
      content: 'Top-level',
      files: [],
    });

    expect(formData.get('parentId')).toBeNull();
    expect(formData.getAll('files')).toEqual([]);
  });
});

describe('isSupabaseCommentAttachmentUrl', () => {
  const supabaseUrl = 'https://example.supabase.co';

  it('accepts public Supabase comment attachment URLs for the configured origin', () => {
    expect(
      isSupabaseCommentAttachmentUrl(
        'https://example.supabase.co/storage/v1/object/public/documents/comments/file.png',
        supabaseUrl,
      ),
    ).toBe(true);
  });

  it('rejects non-http URLs, missing config, other origins, and non-comment storage paths', () => {
    expect(isSupabaseCommentAttachmentUrl('/uploads/comments/file.png', supabaseUrl)).toBe(false);
    expect(
      isSupabaseCommentAttachmentUrl(
        'https://example.supabase.co/storage/v1/object/public/documents/comments/file.png',
        undefined,
      ),
    ).toBe(false);
    expect(
      isSupabaseCommentAttachmentUrl(
        'https://other.supabase.co/storage/v1/object/public/documents/comments/file.png',
        supabaseUrl,
      ),
    ).toBe(false);
    expect(
      isSupabaseCommentAttachmentUrl(
        'https://example.supabase.co/storage/v1/object/public/documents/general/file.png',
        supabaseUrl,
      ),
    ).toBe(false);
  });

  it('rejects malformed URLs safely', () => {
    expect(isSupabaseCommentAttachmentUrl('https://[bad-url', supabaseUrl)).toBe(false);
    expect(
      isSupabaseCommentAttachmentUrl('https://example.supabase.co/file.png', 'not a url'),
    ).toBe(false);
  });
});

describe('formatCommentDate', () => {
  it('formats valid timestamps with the Australian locale', () => {
    const result = formatCommentDate('2026-06-01T03:04:00.000Z');

    expect(result).toContain('01 June 2026');
  });

  it('returns a stable fallback for invalid dates', () => {
    expect(formatCommentDate('not-a-date')).toBe('Unknown date');
  });
});
