/**
 * Tests for PhotosListScreen — the grid renders server + offline-pending tiles
 * from a mocked context, the UNFILED chip shows on lot-less photos, pending tiles
 * show an Uploading badge, the All/Unfiled filter works, empty + loading states,
 * and there is NO delete affordance anywhere (research doc 14: kept out of PR-6).
 *
 * MOCKS @/lib/useOfflineStatus (Dexie/IndexedDB) because ShellScreen mounts
 * SyncChip → useOfflineStatus.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { PhotosShellData } from '../usePhotosShellData';
import {
  mergePhotoItems,
  unfiledPhotoCount,
  type OfflinePendingPhoto,
  type ServerPhotoDoc,
} from '../photosShellState';

vi.mock('@/lib/useOfflineStatus', () => ({
  useOfflineStatus: () => ({ isOnline: true, pendingSyncCount: 0, isSyncing: false }),
}));
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: { id: 'user-me', fullName: 'Jay', roleInCompany: 'foreman' } }),
}));
vi.mock('@/hooks/useEffectiveProjectId', () => ({
  useEffectiveProjectId: () => ({ projectId: 'proj-1', isResolving: false }),
}));

let _data: PhotosShellData;
vi.mock('../photosShellContext', () => ({
  usePhotosShellContext: () => _data,
}));

import { PhotosListScreen } from '../PhotosListScreen';

function makeData(over: Partial<PhotosShellData> = {}): PhotosShellData {
  const items = over.items ?? [];
  return {
    projectId: 'proj-1',
    items,
    loading: false,
    loadError: null,
    unfiledCount: unfiledPhotoCount(items),
    refetch: vi.fn(),
    ...over,
  };
}

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

function pending(over: Partial<OfflinePendingPhoto> = {}): OfflinePendingPhoto {
  return {
    id: 'photo_local_1',
    fileName: 'cap.jpg',
    mimeType: 'image/jpeg',
    dataUrl: 'data:image/jpeg;base64,AAAA',
    capturedAt: '2026-06-11T09:00:00Z',
    syncStatus: 'pending',
    ...over,
  };
}

function renderScreen(initialEntry = '/m/photos') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/m/photos" element={<PhotosListScreen />} />
        <Route path="/m/photos/:documentId" element={<div>photo detail</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PhotosListScreen', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders a server tile with an UNFILED chip on a lot-less photo', () => {
    _data = makeData({ items: mergePhotoItems([server({ id: 'unfiled-doc' })], []) });
    renderScreen();
    expect(screen.getByText('UNFILED')).toBeInTheDocument();
  });

  it('renders the filed lot chip on a filed photo (no UNFILED)', () => {
    _data = makeData({
      items: mergePhotoItems(
        [server({ id: 'filed', lotId: 'lot-9', lot: { id: 'lot-9', lotNumber: 'LOT-014' } })],
        [],
      ),
    });
    renderScreen();
    expect(screen.getByText('LOT-014')).toBeInTheDocument();
    expect(screen.queryByText('UNFILED')).toBeNull();
  });

  it('renders an offline-pending tile with an Uploading badge', () => {
    _data = makeData({ items: mergePhotoItems([], [pending()]) });
    renderScreen();
    expect(screen.getByText('Uploading')).toBeInTheDocument();
  });

  it('renders a failed pending tile with a Retry badge', () => {
    _data = makeData({ items: mergePhotoItems([], [pending({ syncStatus: 'error' })]) });
    renderScreen();
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('shows pending tiles above server tiles in the grid', () => {
    _data = makeData({
      items: mergePhotoItems([server({ id: 'srv' })], [pending({ id: 'pend' })]),
    });
    renderScreen();
    const tiles = screen.getAllByRole('button', { name: /^Photo/ });
    // First tile is the pending capture.
    expect(within(tiles[0]).getByText('Uploading')).toBeInTheDocument();
  });

  it('filters to Unfiled and hides filed photos', () => {
    _data = makeData({
      items: mergePhotoItems(
        [
          server({ id: 'filed', lotId: 'l1', lot: { id: 'l1', lotNumber: 'LOT-1' } }),
          server({ id: 'unfiled' }),
        ],
        [],
      ),
    });
    renderScreen();
    expect(screen.getByText('LOT-1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Unfiled/ }));
    expect(screen.queryByText('LOT-1')).toBeNull();
    expect(screen.getByText('UNFILED')).toBeInTheDocument();
  });

  it('honours lot-scoped deep links from the lot hub', () => {
    _data = makeData({
      items: mergePhotoItems(
        [
          server({ id: 'lot-photo', lotId: 'lot-77', lot: { id: 'lot-77', lotNumber: 'LOT-077' } }),
          server({
            id: 'other-photo',
            lotId: 'lot-88',
            lot: { id: 'lot-88', lotNumber: 'LOT-088' },
          }),
          server({ id: 'unfiled-photo' }),
        ],
        [],
      ),
    });

    renderScreen('/m/photos?projectId=proj-1&lotId=lot-77');

    expect(screen.getByText('Photos filed to this lot')).toBeInTheDocument();
    expect(screen.getByText('LOT-077')).toBeInTheDocument();
    expect(screen.queryByText('LOT-088')).toBeNull();
    expect(screen.queryByText('UNFILED')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Unfiled/ })).toBeNull();
  });

  it('shows the loading skeleton grid', () => {
    _data = makeData({ loading: true });
    const { container } = renderScreen();
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('shows the load-error banner with a retry', () => {
    _data = makeData({ loadError: 'Couldn’t load photos.' });
    renderScreen();
    expect(screen.getByText('Couldn’t load photos.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('shows the all-empty state when there are no photos', () => {
    _data = makeData({ items: [] });
    renderScreen();
    expect(screen.getByText(/No photos yet/i)).toBeInTheDocument();
  });

  it('shows the tidy empty state when nothing is unfiled', () => {
    _data = makeData({
      items: mergePhotoItems(
        [server({ id: 'filed', lotId: 'l1', lot: { id: 'l1', lotNumber: 'LOT-1' } })],
        [],
      ),
    });
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: /^Unfiled/ }));
    expect(screen.getByText(/Nothing unfiled\. Nice and tidy\./i)).toBeInTheDocument();
  });

  it('navigates to the detail screen when a tile is pressed', () => {
    _data = makeData({ items: mergePhotoItems([server({ id: 'doc-1' })], []) });
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: /^Photo/ }));
    expect(screen.getByText('photo detail')).toBeInTheDocument();
  });

  it('has NO delete affordance anywhere (foreman delete kept out of PR-6)', () => {
    _data = makeData({
      items: mergePhotoItems([server({ id: 'd1' }), server({ id: 'd2' })], [pending()]),
    });
    renderScreen();
    expect(screen.queryByRole('button', { name: /delete|remove|bin|trash/i })).toBeNull();
  });
});
