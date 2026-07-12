import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getDocumentAccessMock = vi.hoisted(() => vi.fn());
const invalidateMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/documentAccess', () => ({
  getDocumentAccess: getDocumentAccessMock,
  invalidateDocumentAccessUrl: invalidateMock,
}));

vi.mock('@/lib/logger', () => ({ logError: vi.fn() }));

import { SecureDocumentImage } from './SecureDocumentImage';

describe('SecureDocumentImage', () => {
  beforeEach(() => {
    getDocumentAccessMock.mockReset();
    getDocumentAccessMock.mockResolvedValue({
      url: '/api/documents/download/doc-1?token=abc',
      expiresAt: Number.POSITIVE_INFINITY,
      refreshAt: Number.POSITIVE_INFINITY,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('requests the thumb variant when variant="thumb" is passed (grid surface)', async () => {
    render(
      <SecureDocumentImage
        documentId="doc-1"
        fileUrl="supabase://documents/p/photo.jpg"
        variant="thumb"
      />,
    );

    await waitFor(() => {
      expect(getDocumentAccessMock).toHaveBeenCalledWith(
        'doc-1',
        'supabase://documents/p/photo.jpg',
        { disposition: 'inline', variant: 'thumb' },
      );
    });
  });

  it('requests the original (no variant) by default (full-size surface)', async () => {
    render(<SecureDocumentImage documentId="doc-1" fileUrl="supabase://documents/p/photo.jpg" />);

    await waitFor(() => {
      expect(getDocumentAccessMock).toHaveBeenCalledWith(
        'doc-1',
        'supabase://documents/p/photo.jpg',
        { disposition: 'inline', variant: undefined },
      );
    });
  });
});
