import { Route, Routes } from 'react-router-dom';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/renderWithProviders';
import { apiFetch } from '@/lib/api';
import { DocumentsPage } from './DocumentsPage';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: vi.fn() };
});

const apiFetchMock = vi.mocked(apiFetch);
let projectRole = 'admin';
let documentTotal = 0;

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

function renderDocumentsPage(initialEntry: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/projects/:projectId/documents" element={<DocumentsPage />} />
    </Routes>,
    { initialEntries: [initialEntry] },
  );
}

describe('DocumentsPage', () => {
  beforeEach(() => {
    projectRole = 'admin';
    documentTotal = 0;
    apiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/projects/project-1') {
        return { project: { currentUserRole: projectRole } };
      }

      if (path.endsWith('/signed-url')) {
        return {
          signedUrl: '/signed/document-preview',
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        };
      }

      if (path.startsWith('/api/documents/project-1')) {
        const url = new URL(path, 'http://siteproof.test');
        const page = Number(url.searchParams.get('page') || '1');
        return {
          documents:
            documentTotal > 0
              ? [
                  {
                    id: `doc-page-${page}`,
                    documentType: 'photo',
                    category: 'quality',
                    filename: `document-page-${page}.jpg`,
                    fileSize: 1024,
                    mimeType: 'image/jpeg',
                    uploadedAt: '2026-06-01T00:00:00.000Z',
                    uploadedBy: { id: 'user-1', fullName: 'QA User', email: 'qa@example.com' },
                    caption: null,
                    lot: null,
                    isFavourite: false,
                  },
                ]
              : [],
          categories: documentTotal > 0 ? { quality: documentTotal } : {},
          pagination: {
            total: documentTotal,
            page,
            limit: 100,
            totalPages: Math.max(1, Math.ceil(documentTotal / 100)),
            hasPrevPage: page > 1,
            hasNextPage: page < Math.ceil(documentTotal / 100),
          },
        };
      }

      if (path === '/api/lots?projectId=project-1') {
        return {
          lots: [{ id: 'lot-1', lotNumber: 'L-001', description: 'Northern footing' }],
        };
      }

      throw new Error(`Unexpected apiFetch path in test: ${path}`);
    });
  });

  afterEach(() => {
    cleanup();
    apiFetchMock.mockReset();
  });

  it('uses lotId and upload query params to filter documents and preselect upload lot', async () => {
    renderDocumentsPage('/projects/project-1/documents?lotId=lot-1&upload=1');

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        '/api/documents/project-1?lotId=lot-1&page=1&limit=100',
      );
    });

    expect(screen.getByLabelText('Lot')).toHaveValue('lot-1');
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Upload Document' })).toBeInTheDocument();
    });
    expect(screen.getByLabelText('Link to Lot (optional)')).toHaveValue('lot-1');
  });

  it('hides upload controls for project viewers', async () => {
    projectRole = 'viewer';
    renderDocumentsPage('/projects/project-1/documents');

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith('/api/projects/project-1');
    });

    expect(screen.queryByRole('button', { name: 'Upload Document' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Upload Document' })).not.toBeInTheDocument();
  });

  it('keeps viewer document reads available while hiding mutation controls', async () => {
    projectRole = 'viewer';
    documentTotal = 1;
    renderDocumentsPage('/projects/project-1/documents');

    await waitFor(() => {
      expect(screen.getByText('document-page-1.jpg')).toBeInTheDocument();
    });

    expect(
      screen.queryByRole('button', { name: 'Add document-page-1.jpg to favourites' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Delete document-page-1.jpg' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download document-page-1.jpg' })).toBeVisible();
  });

  it('paginates past the first 100 documents', async () => {
    documentTotal = 101;
    renderDocumentsPage('/projects/project-1/documents');

    await waitFor(() => {
      expect(screen.getByText('Showing 1-1 of 101 documents')).toBeInTheDocument();
    });

    screen.getByRole('button', { name: 'Next' }).click();

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith('/api/documents/project-1?page=2&limit=100');
    });
  });

  it('resets to page 1 when a category chip is selected after pagination', async () => {
    documentTotal = 101;
    renderDocumentsPage('/projects/project-1/documents');

    await waitFor(() => {
      expect(screen.getByText('quality: 101')).toBeInTheDocument();
    });

    screen.getByRole('button', { name: 'Next' }).click();

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith('/api/documents/project-1?page=2&limit=100');
    });

    screen.getByText('quality: 101').click();

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        '/api/documents/project-1?category=quality&page=1&limit=100',
      );
    });
  });

  it('uses the backend favourites filter and resets pagination', async () => {
    documentTotal = 101;
    renderDocumentsPage('/projects/project-1/documents');

    await waitFor(() => {
      expect(screen.getByText('Showing 1-1 of 101 documents')).toBeInTheDocument();
    });

    screen.getByRole('button', { name: 'Next' }).click();

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith('/api/documents/project-1?page=2&limit=100');
    });

    screen.getByRole('button', { name: 'Favourites' }).click();

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        '/api/documents/project-1?favourite=true&page=1&limit=100',
      );
    });
  });

  it('ignores stale signed viewer URL responses after the viewer closes', async () => {
    const signedUrl = createDeferred<{
      signedUrl: string;
      expiresAt: string;
    }>();
    documentTotal = 1;
    apiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/projects/project-1') {
        return { project: { currentUserRole: projectRole } };
      }
      if (path.endsWith('/signed-url')) {
        return signedUrl.promise;
      }
      if (path.startsWith('/api/documents/project-1')) {
        return {
          documents: [
            {
              id: 'doc-page-1',
              documentType: 'photo',
              category: 'quality',
              filename: 'document-page-1.jpg',
              fileSize: 1024,
              mimeType: 'image/jpeg',
              uploadedAt: '2026-06-01T00:00:00.000Z',
              uploadedBy: { id: 'user-1', fullName: 'QA User', email: 'qa@example.com' },
              caption: null,
              lot: null,
              isFavourite: false,
            },
          ],
          categories: { quality: 1 },
          pagination: {
            total: 1,
            page: 1,
            limit: 100,
            totalPages: 1,
            hasPrevPage: false,
            hasNextPage: false,
          },
        };
      }
      if (path === '/api/lots?projectId=project-1') {
        return { lots: [] };
      }
      throw new Error(`Unexpected apiFetch path in stale viewer test: ${path}`);
    });

    renderDocumentsPage('/projects/project-1/documents');

    await waitFor(() => {
      expect(screen.getByText('document-page-1.jpg')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'View document-page-1.jpg' }));
    await waitFor(() => {
      expect(screen.getByTestId('document-viewer-modal')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    signedUrl.resolve({
      signedUrl: '/signed/stale-viewer-url',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });

    await waitFor(() => {
      expect(screen.queryByTestId('document-viewer-modal')).not.toBeInTheDocument();
    });
  });
});
