import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '@/lib/api';
import { createShellQueryWrapper } from '@/shell/test/queryWrapper';
import { useDocsShellData } from '../useDocsShellData';
import type { DrawingRegisterRow } from '../docsShellState';

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

describe('useDocsShellData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads every drawing register page for the shell list', async () => {
    apiFetchMock.mockImplementation(async (path: string) => {
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
});
