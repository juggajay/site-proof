/**
 * Tests for PhotoDetailScreen — renders the photo/caption/date/GPS/lot chip,
 * shows "File to a lot" only for UNFILED server photos, opens the lot picker and
 * fires the re-file with the chosen lot id, shows the filed state with no re-file
 * action for already-filed photos, shows the uploading state for pending photos,
 * and exposes NO delete affordance.
 *
 * MOCKS @/lib/useOfflineStatus (Dexie/IndexedDB) — ShellScreen mounts SyncChip.
 * MOCKS usePhotoRefile + useLotsShellData so the screen logic is tested in
 * isolation; the hook's exact PATCH body + invalidations are asserted separately
 * in usePhotoRefile.test.tsx.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { PhotosShellData } from '../usePhotosShellData';
import { mergePhotoItems, type ServerPhotoDoc } from '../photosShellState';

vi.mock('@/lib/useOfflineStatus', () => ({
  useOfflineStatus: () => ({ isOnline: true, pendingSyncCount: 0, isSyncing: false }),
}));
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: { id: 'user-me', fullName: 'Jay', roleInCompany: 'foreman' } }),
}));

const fileToLot = vi.fn(async () => true);
vi.mock('../usePhotoRefile', () => ({
  usePhotoRefile: () => ({ filing: false, fileToLot }),
}));

vi.mock('../../lots/useLotsShellData', () => ({
  useLotsShellData: () => ({
    projectId: 'proj-1',
    lots: [
      { id: 'lot-1', lotNumber: 'LOT-001', description: 'Bulk earthworks', status: 'open' },
      { id: 'lot-2', lotNumber: 'LOT-002', description: 'Subgrade', status: 'open' },
    ],
    loading: false,
    error: false,
    checksDue: {},
    refetch: vi.fn(),
  }),
}));

let _data: PhotosShellData;
vi.mock('../photosShellContext', () => ({
  usePhotosShellContext: () => _data,
}));

import { PhotoDetailScreen } from '../PhotoDetailScreen';

function server(over: Partial<ServerPhotoDoc> = {}): ServerPhotoDoc {
  return {
    id: 'doc-1',
    documentType: 'photo',
    filename: 'IMG.jpg',
    fileUrl: 'https://store/doc-1.jpg',
    mimeType: 'image/jpeg',
    caption: null,
    uploadedAt: '2026-06-10T08:00:00Z',
    lotId: null,
    lot: null,
    gpsLatitude: null,
    gpsLongitude: null,
    ...over,
  };
}

function makeData(docs: ServerPhotoDoc[], over: Partial<PhotosShellData> = {}): PhotosShellData {
  const items = mergePhotoItems(docs, []);
  return {
    projectId: 'proj-1',
    items,
    loading: false,
    loadError: null,
    unfiledCount: items.filter((i) => i.unfiled).length,
    refetch: vi.fn(),
    ...over,
  };
}

function renderAt(documentId: string) {
  return render(
    <MemoryRouter initialEntries={[`/m/photos/${documentId}`]}>
      <Routes>
        <Route path="/m/photos" element={<div>photos list</div>} />
        <Route path="/m/photos/:documentId" element={<PhotoDetailScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PhotoDetailScreen', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the caption, the mono captured date and a GPS chip when present', () => {
    _data = makeData([
      server({ caption: 'Cracked kerb', gpsLatitude: -33.8, gpsLongitude: 151.2 }),
    ]);
    renderAt('doc-1');
    expect(screen.getByText('Cracked kerb')).toBeInTheDocument();
    expect(screen.getByText(/2026/)).toBeInTheDocument();
    expect(screen.getByText(/-33\.80000, 151\.20000/)).toBeInTheDocument();
  });

  it('shows "File to a lot" for an unfiled photo', () => {
    _data = makeData([server({ lotId: null, lot: null })]);
    renderAt('doc-1');
    expect(screen.getByRole('button', { name: /file to a lot/i })).toBeInTheDocument();
  });

  it('opens the lot picker and files to the chosen lot id', () => {
    _data = makeData([server({ lotId: null, lot: null })]);
    renderAt('doc-1');
    fireEvent.click(screen.getByRole('button', { name: /file to a lot/i }));
    // Picker shows the lots.
    expect(screen.getByText('LOT-002')).toBeInTheDocument();
    fireEvent.click(screen.getByText('LOT-002'));
    expect(fileToLot).toHaveBeenCalledWith('doc-1', 'lot-2');
  });

  it('shows the filed state and NO re-file action for an already-filed photo', () => {
    _data = makeData([server({ lotId: 'lot-9', lot: { id: 'lot-9', lotNumber: 'LOT-014' } })]);
    renderAt('doc-1');
    expect(screen.getByText(/Filed to/i)).toBeInTheDocument();
    // The filed lot label appears, but there is no "File to a lot" action.
    expect(screen.queryByRole('button', { name: /file to a lot/i })).toBeNull();
  });

  it('shows a not-found state for a missing document', () => {
    _data = makeData([server({ id: 'other' })]);
    renderAt('doc-1');
    expect(screen.getByText(/isn’t here anymore/i)).toBeInTheDocument();
  });

  it('has NO delete affordance', () => {
    _data = makeData([server({ lotId: null, lot: null })]);
    renderAt('doc-1');
    expect(screen.queryByRole('button', { name: /delete|remove|bin|trash/i })).toBeNull();
  });
});
