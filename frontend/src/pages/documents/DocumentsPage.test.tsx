import { Route, Routes } from 'react-router-dom';
import { cleanup, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/renderWithProviders';
import { apiFetch } from '@/lib/api';
import { DocumentsPage } from './DocumentsPage';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: vi.fn() };
});

const apiFetchMock = vi.mocked(apiFetch);

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
    apiFetchMock.mockImplementation(async (path: string) => {
      if (path.startsWith('/api/documents/project-1')) {
        return { documents: [], categories: {} };
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
      expect(apiFetchMock).toHaveBeenCalledWith('/api/documents/project-1?lotId=lot-1&limit=100');
    });

    expect(screen.getByLabelText('Lot')).toHaveValue('lot-1');
    expect(screen.getByRole('heading', { name: 'Upload Document' })).toBeInTheDocument();
    expect(screen.getByLabelText('Link to Lot (optional)')).toHaveValue('lot-1');
  });
});
