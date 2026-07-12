import { describe, expect, it } from 'vitest';
import { buildCommentFormData, formatCommentDate } from './commentsSectionHelpers';
import type { PendingAttachment } from './commentAttachmentDrafts';

function makePendingAttachment(name: string, type = 'image/png'): PendingAttachment {
  return {
    file: new File(['x'], name, { type }),
    preview: type.startsWith('image/') ? `blob:${name}` : undefined,
  };
}

describe('buildCommentFormData', () => {
  it('builds multipart comment fields with optional parent and all files', async () => {
    const formData = await buildCommentFormData({
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

    // Filenames are preserved: compression re-encodes under the original name,
    // and non-images / below-threshold files pass through untouched.
    const files = formData.getAll('files') as File[];
    expect(files.map((file) => file.name)).toEqual(['photo.png', 'evidence.pdf']);
  });

  it('omits parentId when creating a top-level comment', async () => {
    const formData = await buildCommentFormData({
      entityType: 'NCR',
      entityId: 'ncr-1',
      content: 'Top-level',
      files: [],
    });

    expect(formData.get('parentId')).toBeNull();
    expect(formData.getAll('files')).toEqual([]);
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
