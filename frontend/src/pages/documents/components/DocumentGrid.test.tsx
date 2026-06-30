import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DocumentAccessUrl } from '@/lib/documentAccess';
import { DocumentGrid, type DocumentGridDoc } from './DocumentGrid';

const imageDocument: DocumentGridDoc = {
  id: 'doc-1',
  documentType: 'photo',
  category: 'quality',
  filename: 'site-photo.jpg',
  fileSize: 1024,
  mimeType: 'image/jpeg',
  uploadedAt: '2026-06-01T00:00:00.000Z',
  uploadedBy: { fullName: 'QA User' },
  caption: null,
  lot: null,
  isFavourite: false,
};

function accessUrl(url: string): DocumentAccessUrl {
  return {
    url,
    expiresAt: Number.POSITIVE_INFINITY,
    refreshAt: Number.POSITIVE_INFINITY,
  };
}

function renderGrid(documentUrls: Record<string, DocumentAccessUrl>) {
  const props = {
    loading: false,
    error: null,
    visibleDocuments: [imageDocument],
    showFavouritesOnly: false,
    canManageDocuments: true,
    documentUrls,
    onToggleFavourite: vi.fn(),
    onOpenViewer: vi.fn(),
    onDownload: vi.fn(),
    onMarkPendingDelete: vi.fn(),
  };

  const view = render(<DocumentGrid {...props} />);
  return {
    ...view,
    rerenderGrid: (nextDocumentUrls: Record<string, DocumentAccessUrl>) =>
      view.rerender(<DocumentGrid {...props} documentUrls={nextDocumentUrls} />),
  };
}

describe('DocumentGrid thumbnails', () => {
  it('shows the image thumbnail when a missing signed URL later loads', () => {
    const { rerenderGrid } = renderGrid({});

    expect(screen.queryByAltText('site-photo.jpg')).not.toBeInTheDocument();
    expect(screen.getByTestId('image-icon')).toBeInTheDocument();

    rerenderGrid({ 'doc-1': accessUrl('/signed/site-photo.jpg') });

    const image = screen.getByAltText('site-photo.jpg');
    expect(image).toBeVisible();
    expect(image).toHaveAttribute('src', '/signed/site-photo.jpg');
  });

  it('resets a failed thumbnail when a replacement signed URL arrives', async () => {
    const { rerenderGrid } = renderGrid({ 'doc-1': accessUrl('/signed/expired-photo.jpg') });

    fireEvent.error(screen.getByAltText('site-photo.jpg'));

    rerenderGrid({ 'doc-1': accessUrl('/signed/fresh-photo.jpg') });

    await waitFor(() => {
      const image = screen.getByAltText('site-photo.jpg');
      expect(image).toBeVisible();
      expect(image).toHaveAttribute('src', '/signed/fresh-photo.jpg');
    });
  });
});

describe('DocumentGrid empty states', () => {
  it('shows a favourites-specific empty state for server-filtered favourite results', () => {
    render(
      <DocumentGrid
        loading={false}
        error={null}
        visibleDocuments={[]}
        showFavouritesOnly
        canManageDocuments
        documentUrls={{}}
        onToggleFavourite={vi.fn()}
        onOpenViewer={vi.fn()}
        onDownload={vi.fn()}
        onMarkPendingDelete={vi.fn()}
      />,
    );

    expect(screen.getByText('No favourite documents found')).toBeInTheDocument();
    expect(
      screen.getByText('Clear the favourites filter to view all documents.'),
    ).toBeInTheDocument();
  });
});
