import { describe, expect, it } from 'vitest';

import { normaliseSpatialPhotoCoords } from './spatialSearchData';

const base = {
  id: 'doc-1',
  filename: 'IMG_1.jpg',
  caption: null,
  captureTimestamp: null,
  lotId: 'lot-1',
};

describe('normaliseSpatialPhotoCoords', () => {
  it('parses Prisma Decimal strings into finite numbers', () => {
    const out = normaliseSpatialPhotoCoords({
      ...base,
      gpsLatitude: '-33.8688',
      gpsLongitude: '151.2093',
    });
    expect(out.gpsLatitude).toBe(-33.8688);
    expect(out.gpsLongitude).toBe(151.2093);
  });

  it('passes numbers through unchanged', () => {
    const out = normaliseSpatialPhotoCoords({ ...base, gpsLatitude: -33.5, gpsLongitude: 151.5 });
    expect(out.gpsLatitude).toBe(-33.5);
    expect(out.gpsLongitude).toBe(151.5);
  });

  it('maps null/undefined/blank coords to null (not NaN)', () => {
    expect(
      normaliseSpatialPhotoCoords({ ...base, gpsLatitude: null, gpsLongitude: null }),
    ).toMatchObject({ gpsLatitude: null, gpsLongitude: null });
    expect(normaliseSpatialPhotoCoords({ ...base })).toMatchObject({
      gpsLatitude: null,
      gpsLongitude: null,
    });
    expect(
      normaliseSpatialPhotoCoords({ ...base, gpsLatitude: '', gpsLongitude: 'nope' }),
    ).toMatchObject({ gpsLatitude: null, gpsLongitude: null });
  });
});
