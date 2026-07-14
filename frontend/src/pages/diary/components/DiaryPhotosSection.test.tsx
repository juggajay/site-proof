/**
 * "Today's photos" diary section. Verifies the grid renders the day's photos
 * through the secure (backend-mediated) image pipeline, shows a quiet empty
 * state for a photoless day, and opens the viewer on tap.
 */

import { fireEvent, renderWithProviders, screen, waitFor } from '@/test/renderWithProviders';
import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: vi.fn() };
});

// Stub the secure image so the test asserts documentId-based (not raw-URL)
// rendering without invoking the signed-url fetch.
vi.mock('@/components/documents/SecureDocumentImage', () => ({
  SecureDocumentImage: ({
    documentId,
    variant,
    alt,
  }: {
    documentId: string;
    variant?: string;
    alt?: string;
  }) => (
    <img data-testid="secure-image" data-doc-id={documentId} data-variant={variant} alt={alt} />
  ),
}));

// Stub the viewer so a tap is observable without its full lightbox/map tree.
vi.mock('@/pages/lots/components/PhotoViewerModal', () => ({
  PhotoViewerModal: ({ selectedPhoto }: { selectedPhoto: { id: string } | null }) =>
    selectedPhoto ? <div data-testid="photo-viewer">{selectedPhoto.id}</div> : null,
}));

import { apiFetch } from '@/lib/api';
import { DiaryPhotosSection } from './DiaryPhotosSection';

const apiFetchMock = vi.mocked(apiFetch) as unknown as MockInstance<
  (path: string) => Promise<unknown>
>;

function makePhotoDoc(overrides: Record<string, unknown> = {}) {
  return {
    id: 'doc-1',
    filename: 'inlet.jpg',
    caption: 'Inlet pour',
    uploadedAt: '2026-06-07T02:00:00.000Z',
    uploadedBy: { id: 'u1', fullName: 'Foreman Jo', email: 'jo@example.com' },
    gpsLatitude: null,
    gpsLongitude: null,
    lot: { id: 'lot-1', lotNumber: '12', description: null },
    ...overrides,
  };
}

beforeEach(() => {
  apiFetchMock.mockReset();
});

describe('DiaryPhotosSection', () => {
  it('renders the day photos through the secure image pipeline with lot tags', async () => {
    apiFetchMock.mockResolvedValue({
      documents: [makePhotoDoc(), makePhotoDoc({ id: 'doc-2', lot: null, caption: null })],
    });

    renderWithProviders(<DiaryPhotosSection projectId="project-1" selectedDate="2026-06-07" />);

    await waitFor(() => {
      expect(screen.getAllByTestId('secure-image')).toHaveLength(2);
    });

    // Backend-mediated: rendered by documentId + server thumbnail variant.
    const images = screen.getAllByTestId('secure-image');
    expect(images[0]).toHaveAttribute('data-doc-id', 'doc-1');
    expect(images[0]).toHaveAttribute('data-variant', 'thumb');

    // Lot tag surfaced when present.
    expect(screen.getByText('Lot 12')).toBeInTheDocument();

    // The date filter is passed to the reused documents endpoint.
    expect(apiFetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/documents/project-1?'));
    const calledUrl = apiFetchMock.mock.calls[0][0];
    expect(calledUrl).toContain('documentType=photo');
    expect(calledUrl).toContain('dateFrom=2026-06-07');
    expect(calledUrl).toContain('dateTo=2026-06-07');
  });

  it('shows a quiet one-liner when the day has no photos', async () => {
    apiFetchMock.mockResolvedValue({ documents: [] });

    renderWithProviders(<DiaryPhotosSection projectId="project-1" selectedDate="2026-06-07" />);

    await waitFor(() => {
      expect(screen.getByTestId('diary-photos-empty')).toBeInTheDocument();
    });
    expect(screen.getByText('No photos captured on this day.')).toBeInTheDocument();
    expect(screen.queryByTestId('secure-image')).not.toBeInTheDocument();
  });

  it('opens the viewer when a photo is tapped', async () => {
    apiFetchMock.mockResolvedValue({ documents: [makePhotoDoc()] });

    renderWithProviders(<DiaryPhotosSection projectId="project-1" selectedDate="2026-06-07" />);

    const image = await screen.findByTestId('secure-image');
    expect(screen.queryByTestId('photo-viewer')).not.toBeInTheDocument();

    fireEvent.click(image);

    expect(screen.getByTestId('photo-viewer')).toHaveTextContent('doc-1');
  });
});
