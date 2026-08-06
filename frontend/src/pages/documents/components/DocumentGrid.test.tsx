import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { DocumentAccessUrl } from '@/lib/documentAccess';
import { DocumentGrid, type DocumentGridDoc } from './DocumentGrid';

// Radix's DropdownMenu calls the Pointer Capture API and scrollIntoView, neither
// of which jsdom implements. Stubbing them is what lets the menu actually open.
beforeAll(() => {
  const proto = window.HTMLElement.prototype as unknown as Record<string, unknown>;
  proto.hasPointerCapture ??= () => false;
  proto.setPointerCapture ??= () => {};
  proto.releasePointerCapture ??= () => {};
  proto.scrollIntoView ??= () => {};
});

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
    onViewVersions: vi.fn(),
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

describe('DocumentGrid row actions', () => {
  it('reaches all five actions: preview and download inline, the rest in the overflow menu', () => {
    const handlers = {
      onToggleFavourite: vi.fn(),
      onOpenViewer: vi.fn(),
      onDownload: vi.fn(),
      onViewVersions: vi.fn(),
      onMarkPendingDelete: vi.fn(),
    };
    render(
      <DocumentGrid
        loading={false}
        error={null}
        visibleDocuments={[imageDocument]}
        showFavouritesOnly={false}
        canManageDocuments
        documentUrls={{}}
        {...handlers}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'View site-photo.jpg' }));
    fireEvent.click(screen.getByRole('button', { name: 'Download site-photo.jpg' }));

    // Enter on the trigger, not a synthetic pointerdown: jsdom has no
    // PointerEvent so Radix never sees a real button-0 press.
    fireEvent.keyDown(screen.getByRole('button', { name: 'More actions for site-photo.jpg' }), {
      key: 'Enter',
    });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Add to favourites' }));

    fireEvent.keyDown(screen.getByRole('button', { name: 'More actions for site-photo.jpg' }), {
      key: 'Enter',
    });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Version history' }));

    fireEvent.keyDown(screen.getByRole('button', { name: 'More actions for site-photo.jpg' }), {
      key: 'Enter',
    });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));

    expect(handlers.onOpenViewer).toHaveBeenCalledWith(imageDocument);
    expect(handlers.onDownload).toHaveBeenCalledWith(imageDocument);
    expect(handlers.onToggleFavourite).toHaveBeenCalledWith(imageDocument);
    expect(handlers.onViewVersions).toHaveBeenCalledWith(imageDocument);
    expect(handlers.onMarkPendingDelete).toHaveBeenCalledWith(imageDocument);
  });

  it('keeps caption-less and captioned rows the same height', () => {
    render(
      <DocumentGrid
        loading={false}
        error={null}
        visibleDocuments={[imageDocument, { ...imageDocument, id: 'doc-2', caption: 'Pier 3' }]}
        showFavouritesOnly={false}
        canManageDocuments
        documentUrls={{}}
        onToggleFavourite={vi.fn()}
        onOpenViewer={vi.fn()}
        onDownload={vi.fn()}
        onViewVersions={vi.fn()}
        onMarkPendingDelete={vi.fn()}
      />,
    );

    // The caption line is rendered either way; only its text differs, so the
    // register cannot go ragged when some documents carry a caption.
    const captionLines = screen.getAllByTestId('document-row').map((row) => row.querySelector('p'));
    expect(captionLines).toHaveLength(2);
    expect(captionLines[0]).toBeEmptyDOMElement();
    expect(captionLines[1]).toHaveTextContent('Pier 3');
    expect(captionLines[0]?.className).toEqual(captionLines[1]?.className);
  });

  it('separates the metadata line with middots', () => {
    render(
      <DocumentGrid
        loading={false}
        error={null}
        visibleDocuments={[{ ...imageDocument, lot: { lotNumber: 'LOT-001' } }]}
        showFavouritesOnly={false}
        canManageDocuments
        documentUrls={{}}
        onToggleFavourite={vi.fn()}
        onOpenViewer={vi.fn()}
        onDownload={vi.fn()}
        onViewVersions={vi.fn()}
        onMarkPendingDelete={vi.fn()}
      />,
    );

    // The lot keeps its own emphasised span, so it sits after the last middot
    // rather than inside the joined text.
    expect(screen.getByText(/^1\.0 KB · .+ · by QA User ·$/)).toBeInTheDocument();
    expect(screen.getByText('Lot LOT-001')).toBeInTheDocument();
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
        onViewVersions={vi.fn()}
        onMarkPendingDelete={vi.fn()}
      />,
    );

    expect(screen.getByText('No favourite documents found')).toBeInTheDocument();
    expect(
      screen.getByText('Clear the favourites filter to view all documents.'),
    ).toBeInTheDocument();
  });

  it('offers an Upload Document CTA in the empty state when the user can manage documents', () => {
    const onUpload = vi.fn();
    render(
      <DocumentGrid
        loading={false}
        error={null}
        visibleDocuments={[]}
        showFavouritesOnly={false}
        canManageDocuments
        documentUrls={{}}
        onToggleFavourite={vi.fn()}
        onOpenViewer={vi.fn()}
        onDownload={vi.fn()}
        onViewVersions={vi.fn()}
        onMarkPendingDelete={vi.fn()}
        onUpload={onUpload}
      />,
    );

    const uploadButton = screen.getByRole('button', { name: /Upload Document/i });
    fireEvent.click(uploadButton);
    expect(onUpload).toHaveBeenCalledTimes(1);
  });

  it('hides the empty-state Upload CTA when the user cannot manage documents', () => {
    render(
      <DocumentGrid
        loading={false}
        error={null}
        visibleDocuments={[]}
        showFavouritesOnly={false}
        canManageDocuments={false}
        documentUrls={{}}
        onToggleFavourite={vi.fn()}
        onOpenViewer={vi.fn()}
        onDownload={vi.fn()}
        onViewVersions={vi.fn()}
        onMarkPendingDelete={vi.fn()}
        onUpload={vi.fn()}
      />,
    );

    expect(screen.getByText('No documents found')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Upload Document/i })).not.toBeInTheDocument();
  });

  it('does not show the Upload CTA in the favourites empty state', () => {
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
        onViewVersions={vi.fn()}
        onMarkPendingDelete={vi.fn()}
        onUpload={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: /Upload Document/i })).not.toBeInTheDocument();
  });
});
