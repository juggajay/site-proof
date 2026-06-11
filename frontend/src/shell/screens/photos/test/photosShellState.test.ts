/**
 * Exhaustive unit tests for the pure Photos shell state helpers: unfiled
 * detection, the merge+order of offline-pending + server photos, filtering,
 * counts, and date/gps formatting.
 */
import { describe, it, expect } from 'vitest';
import {
  PHOTO_FILTERS,
  filterPhotos,
  formatGps,
  formatPhotoDate,
  formatPhotoDateLong,
  isUnfiledServerPhoto,
  mergePhotoItems,
  unfiledPhotoCount,
  type OfflinePendingPhoto,
  type ServerPhotoDoc,
} from '../photosShellState';

function serverDoc(over: Partial<ServerPhotoDoc> = {}): ServerPhotoDoc {
  return {
    id: 'doc-1',
    documentType: 'photo',
    filename: 'IMG_001.jpg',
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
    fileName: 'capture.jpg',
    mimeType: 'image/jpeg',
    dataUrl: 'data:image/jpeg;base64,AAAA',
    capturedAt: '2026-06-11T09:00:00Z',
    syncStatus: 'pending',
    ...over,
  };
}

describe('isUnfiledServerPhoto', () => {
  it('is unfiled when there is no lotId and no lot relation', () => {
    expect(isUnfiledServerPhoto({ lotId: null, lot: null })).toBe(true);
  });
  it('is filed when a lotId is present', () => {
    expect(isUnfiledServerPhoto({ lotId: 'lot-1', lot: null })).toBe(false);
  });
  it('is filed when only the lot relation is present', () => {
    expect(isUnfiledServerPhoto({ lotId: null, lot: { id: 'lot-1', lotNumber: 'LOT-1' } })).toBe(
      false,
    );
  });
});

describe('mergePhotoItems', () => {
  it('maps a filed server doc to a filed item with the lot label and id', () => {
    const [item] = mergePhotoItems(
      [serverDoc({ lotId: 'lot-9', lot: { id: 'lot-9', lotNumber: 'LOT-014' } })],
      [],
    );
    expect(item.source).toBe('server');
    expect(item.unfiled).toBe(false);
    expect(item.lotLabel).toBe('LOT-014');
    expect(item.lotId).toBe('lot-9');
    expect(item.documentId).toBe('doc-1');
    expect(item.syncState).toBe('synced');
  });

  it('maps an unfiled server doc to an unfiled item with no lot label', () => {
    const [item] = mergePhotoItems([serverDoc({ lotId: null, lot: null })], []);
    expect(item.unfiled).toBe(true);
    expect(item.lotLabel).toBeNull();
  });

  it('maps a pending photo to a pending, uploading item with a data-url src', () => {
    const [item] = mergePhotoItems([], [pending()]);
    expect(item.source).toBe('pending');
    expect(item.src).toBe('data:image/jpeg;base64,AAAA');
    expect(item.documentId).toBeNull();
    expect(item.syncState).toBe('uploading');
    expect(item.unfiled).toBe(true);
  });

  it('marks a pending photo with syncStatus error as error state', () => {
    const [item] = mergePhotoItems([], [pending({ syncStatus: 'error' })]);
    expect(item.syncState).toBe('error');
  });

  it('treats a pending photo carrying a lotId as filed', () => {
    const [item] = mergePhotoItems([], [pending({ lotId: 'lot-3' })]);
    expect(item.unfiled).toBe(false);
    expect(item.lotId).toBe('lot-3');
  });

  it('always orders pending photos above server photos, even older ones', () => {
    const merged = mergePhotoItems(
      [serverDoc({ id: 'newer-server', uploadedAt: '2030-01-01T00:00:00Z' })],
      [pending({ id: 'older-pending', capturedAt: '2000-01-01T00:00:00Z' })],
    );
    expect(merged.map((i) => i.id)).toEqual(['older-pending', 'newer-server']);
  });

  it('orders server photos newest-first within their group', () => {
    const merged = mergePhotoItems(
      [
        serverDoc({ id: 'old', uploadedAt: '2026-06-01T00:00:00Z' }),
        serverDoc({ id: 'new', uploadedAt: '2026-06-09T00:00:00Z' }),
      ],
      [],
    );
    expect(merged.map((i) => i.id)).toEqual(['new', 'old']);
  });

  it('orders multiple pending photos newest-first too', () => {
    const merged = mergePhotoItems(
      [],
      [
        pending({ id: 'p-old', capturedAt: '2026-06-01T00:00:00Z' }),
        pending({ id: 'p-new', capturedAt: '2026-06-09T00:00:00Z' }),
      ],
    );
    expect(merged.map((i) => i.id)).toEqual(['p-new', 'p-old']);
  });

  it('falls back to a stable id tiebreak when timestamps are equal', () => {
    const merged = mergePhotoItems(
      [
        serverDoc({ id: 'b', uploadedAt: '2026-06-01T00:00:00Z' }),
        serverDoc({ id: 'a', uploadedAt: '2026-06-01T00:00:00Z' }),
      ],
      [],
    );
    expect(merged.map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('de-duplicates a server doc that shares an id with a pending photo', () => {
    const merged = mergePhotoItems([serverDoc({ id: 'shared' })], [pending({ id: 'shared' })]);
    expect(merged).toHaveLength(1);
    expect(merged[0].source).toBe('pending');
  });

  it('reads GPS from numeric or string decimals and sets hasGps', () => {
    const [numeric] = mergePhotoItems([serverDoc({ gpsLatitude: -33.8, gpsLongitude: 151.2 })], []);
    expect(numeric.hasGps).toBe(true);
    expect(numeric.gps).toEqual({ lat: -33.8, lng: 151.2 });

    const [strDecimal] = mergePhotoItems(
      [serverDoc({ id: 'd2', gpsLatitude: '-33.8', gpsLongitude: '151.2' })],
      [],
    );
    expect(strDecimal.hasGps).toBe(true);

    const [none] = mergePhotoItems([serverDoc({ id: 'd3' })], []);
    expect(none.hasGps).toBe(false);
    expect(none.gps).toBeNull();
  });

  it('does not mutate its inputs', () => {
    const server = [serverDoc({ id: 'a' }), serverDoc({ id: 'b' })];
    const pend = [pending({ id: 'p' })];
    const snapServer = JSON.stringify(server);
    const snapPend = JSON.stringify(pend);
    mergePhotoItems(server, pend);
    expect(JSON.stringify(server)).toBe(snapServer);
    expect(JSON.stringify(pend)).toBe(snapPend);
  });
});

describe('filterPhotos', () => {
  const items = mergePhotoItems(
    [
      serverDoc({ id: 'filed', lotId: 'lot-1', lot: { id: 'lot-1', lotNumber: 'LOT-1' } }),
      serverDoc({ id: 'unfiled', lotId: null, lot: null }),
    ],
    [],
  );

  it('"all" returns everything', () => {
    expect(
      filterPhotos(items, 'all')
        .map((i) => i.id)
        .sort(),
    ).toEqual(['filed', 'unfiled']);
  });

  it('"unfiled" returns only lot-less photos', () => {
    expect(filterPhotos(items, 'unfiled').map((i) => i.id)).toEqual(['unfiled']);
  });

  it('exposes exactly All + Unfiled filters (no per-lot filter)', () => {
    expect(PHOTO_FILTERS.map((f) => f.key)).toEqual(['all', 'unfiled']);
  });
});

describe('unfiledPhotoCount', () => {
  it('counts only the unfiled items', () => {
    const items = mergePhotoItems(
      [
        serverDoc({ id: 'f', lotId: 'lot-1', lot: { id: 'lot-1', lotNumber: 'L1' } }),
        serverDoc({ id: 'u1' }),
        serverDoc({ id: 'u2' }),
      ],
      [],
    );
    expect(unfiledPhotoCount(items)).toBe(2);
  });
});

describe('formatters', () => {
  it('formats a short tile date', () => {
    expect(formatPhotoDate('2026-06-10T08:00:00Z')).toMatch(/Jun/);
  });
  it('returns the raw string for an unparseable short date', () => {
    expect(formatPhotoDate('not-a-date')).toBe('not-a-date');
  });
  it('formats a long detail date with the year', () => {
    expect(formatPhotoDateLong('2026-06-10T08:00:00Z')).toMatch(/2026/);
  });
  it('returns the raw string for an unparseable long date', () => {
    expect(formatPhotoDateLong('nope')).toBe('nope');
  });
  it('formats a GPS pair to 5 decimals', () => {
    expect(formatGps({ lat: -33.812341, lng: 151.223456 })).toBe('-33.81234, 151.22346');
  });
});
