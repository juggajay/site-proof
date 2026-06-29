import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '@/lib/api';
import { getUnsyncedPhotos } from '@/lib/offlineDb';
import { createShellQueryWrapper } from '@/shell/test/queryWrapper';
import { usePhotosShellData } from '../usePhotosShellData';
import type { ServerPhotoDoc } from '../photosShellState';

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getAuthToken: vi.fn(() => 'test-token'),
}));

vi.mock('@/lib/offlineDb', () => ({
  getUnsyncedPhotos: vi.fn(),
}));

const apiFetchMock = vi.mocked(apiFetch);
const getUnsyncedPhotosMock = vi.mocked(getUnsyncedPhotos);

function serverPhoto(id: string, uploadedAt: string): ServerPhotoDoc {
  return {
    id,
    documentType: 'photo',
    filename: `${id}.jpg`,
    fileUrl: `/uploads/documents/${id}.jpg`,
    mimeType: 'image/jpeg',
    caption: null,
    uploadedAt,
    lotId: null,
    lot: null,
    gpsLatitude: null,
    gpsLongitude: null,
  };
}

describe('usePhotosShellData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUnsyncedPhotosMock.mockResolvedValue([]);
  });

  it('loads every server photo page for the shell grid', async () => {
    apiFetchMock.mockImplementation(async (path: string) => {
      if (path.includes('page=1')) {
        return {
          documents: [serverPhoto('photo-1', '2026-06-01T00:00:00.000Z')],
          pagination: { page: 1, totalPages: 2, hasNextPage: true },
        };
      }
      if (path.includes('page=2')) {
        return {
          documents: [serverPhoto('photo-101', '2026-06-02T00:00:00.000Z')],
          pagination: { page: 2, totalPages: 2, hasNextPage: false },
        };
      }
      throw new Error(`Unexpected path ${path}`);
    });

    const { result } = renderHook(() => usePhotosShellData('project-1'), {
      wrapper: createShellQueryWrapper(),
    });

    await waitFor(() => {
      expect(result.current.items.map((item) => item.id)).toEqual(['photo-101', 'photo-1']);
    });

    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/documents/project-1?documentType=photo&page=1&limit=100',
    );
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/documents/project-1?documentType=photo&page=2&limit=100',
    );
  });
});
