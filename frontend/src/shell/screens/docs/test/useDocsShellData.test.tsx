import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '@/lib/api';
import { createShellQueryWrapper } from '@/shell/test/queryWrapper';
import { useDocsShellData } from '../useDocsShellData';
import type { DrawingDocumentRow, DrawingRegisterRow } from '../docsShellState';

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getAuthToken: vi.fn(() => 'test-token'),
}));

const apiFetchMock = vi.mocked(apiFetch);

function drawingRow(id: string, drawingNumber: string): DrawingRegisterRow {
  return {
    id,
    drawingNumber,
    title: `${drawingNumber} title`,
    revision: 'A',
    status: 'for_construction',
    document: { id: `document-${id}` },
    supersededBy: null,
  };
}

function documentRow(id: string, filename: string, lotId: string | null): DrawingDocumentRow {
  return {
    id,
    filename,
    caption: null,
    supersededById: null,
    lotId,
    lot: lotId ? { id: lotId, lotNumber: 'LOT-001' } : null,
  };
}

/** Empty page for whichever endpoint a test is not exercising. */
const EMPTY_PAGE = { pagination: { page: 1, totalPages: 1, hasNextPage: false } };

describe('useDocsShellData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads every drawing register page for the shell list', async () => {
    apiFetchMock.mockImplementation(async (path: string) => {
      if (path.startsWith('/api/documents/')) return { documents: [], ...EMPTY_PAGE };
      if (path.includes('page=1')) {
        return {
          drawings: [drawingRow('drawing-1', 'DRW-001')],
          pagination: { page: 1, totalPages: 2, hasNextPage: true },
        };
      }
      if (path.includes('page=2')) {
        return {
          drawings: [drawingRow('drawing-2', 'DRW-101')],
          pagination: { page: 2, totalPages: 2, hasNextPage: false },
        };
      }
      throw new Error(`Unexpected path ${path}`);
    });

    const { result } = renderHook(() => useDocsShellData('project-1'), {
      wrapper: createShellQueryWrapper(),
    });

    await waitFor(() => {
      expect(result.current.items.map((item) => item.number)).toEqual(['DRW-001', 'DRW-101']);
    });

    expect(apiFetchMock).toHaveBeenCalledWith('/api/drawings/project-1?page=1&limit=100');
    expect(apiFetchMock).toHaveBeenCalledWith('/api/drawings/project-1?page=2&limit=100');
  });

  it('also loads lot-filed drawing documents and merges them into the list', async () => {
    apiFetchMock.mockImplementation(async (path: string) => {
      if (path.startsWith('/api/drawings/')) {
        return { drawings: [drawingRow('drawing-1', 'DRW-001')], ...EMPTY_PAGE };
      }
      if (path.startsWith('/api/documents/')) {
        if (path.includes('page=1')) {
          return {
            documents: [documentRow('document-9', 'Lot sheet A.pdf', 'lot-1')],
            pagination: { page: 1, totalPages: 2, hasNextPage: true },
          };
        }
        return {
          documents: [documentRow('document-10', 'Lot sheet B.pdf', 'lot-1')],
          pagination: { page: 2, totalPages: 2, hasNextPage: false },
        };
      }
      throw new Error(`Unexpected path ${path}`);
    });

    const { result } = renderHook(() => useDocsShellData('project-1'), {
      wrapper: createShellQueryWrapper(),
    });

    await waitFor(() => {
      expect(result.current.items.map((item) => item.number)).toEqual([
        'DRW-001',
        'Lot sheet A.pdf',
        'Lot sheet B.pdf',
      ]);
    });

    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/documents/project-1?documentType=drawing&page=1&limit=100',
    );
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/documents/project-1?documentType=drawing&page=2&limit=100',
    );
    // The lot link the register cannot carry is what makes the ?lotId= filter real.
    expect(result.current.items.filter((i) => i.lotId === 'lot-1')).toHaveLength(2);
  });

  it('shows the document backing a register drawing exactly once', async () => {
    apiFetchMock.mockImplementation(async (path: string) => {
      if (path.startsWith('/api/drawings/')) {
        return { drawings: [drawingRow('drawing-1', 'DRW-001')], ...EMPTY_PAGE };
      }
      return {
        // The register drawing's own document row, as the documents endpoint
        // returns it (drawings.ts writes documentType 'drawing' for these too).
        documents: [documentRow('document-drawing-1', 'DRW-001-A.pdf', null)],
        ...EMPTY_PAGE,
      };
    });

    const { result } = renderHook(() => useDocsShellData('project-1'), {
      wrapper: createShellQueryWrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    await waitFor(() => {
      expect(result.current.items.map((item) => item.number)).toEqual(['DRW-001']);
    });
    expect(result.current.currentCount).toBe(1);
  });
});
