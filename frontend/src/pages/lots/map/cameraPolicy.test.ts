import { beforeEach, describe, expect, it } from 'vitest';

import { removeLocalStorageItem, writeLocalStorageItem } from '@/lib/storagePreferences';

import type { ProjectLotGeometry } from './lotMapData';
import { chooseCamera, readSavedViewport, writeSavedViewport } from './cameraPolicy';

function geom(over: Partial<ProjectLotGeometry> = {}): ProjectLotGeometry {
  return {
    id: 'g1',
    lotId: 'lot-1',
    lotNumber: 'LOT-001',
    status: 'conformed',
    activityType: null,
    kind: 'chainage_offset',
    controlLineId: null,
    geometryWgs84: {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [151.0, -33.8],
            [151.001, -33.8],
            [151.001, -33.801],
            [151.0, -33.8],
          ],
        ],
      },
    },
    areaM2: null,
    lengthM: null,
    chainageStart: null,
    chainageEnd: null,
    ...over,
  };
}

const KEY = 'siteproof.mapViewport.proj-1';

describe('saved viewport round-trip', () => {
  beforeEach(() => removeLocalStorageItem(KEY));

  it('round-trips a viewport and rejects malformed payloads', () => {
    expect(readSavedViewport('proj-1')).toBeNull();
    writeSavedViewport('proj-1', { lat: -33.8, lng: 151.0, zoom: 15 });
    expect(readSavedViewport('proj-1')).toEqual({ lat: -33.8, lng: 151.0, zoom: 15 });

    writeLocalStorageItem(KEY, '{"lat":"nope"}');
    expect(readSavedViewport('proj-1')).toBeNull();
    writeLocalStorageItem(KEY, 'not json');
    expect(readSavedViewport('proj-1')).toBeNull();
  });
});

describe('chooseCamera cascade', () => {
  const base = {
    saved: null,
    isFiltered: false,
    filteredGeometries: [] as ProjectLotGeometry[],
    allGeometries: [] as ProjectLotGeometry[],
    extentFeatures: [],
  };

  it('1. a saved viewport wins over everything', () => {
    const target = chooseCamera({
      ...base,
      saved: { lat: -33.8, lng: 151.0, zoom: 16 },
      isFiltered: true,
      filteredGeometries: [geom()],
      allGeometries: [geom({ status: 'in_progress' })],
    });
    expect(target).toEqual({ kind: 'viewport', center: [-33.8, 151.0], zoom: 16 });
  });

  it('2. an active register filter fits the filtered subset', () => {
    const target = chooseCamera({
      ...base,
      isFiltered: true,
      filteredGeometries: [geom()],
      allGeometries: [geom(), geom({ id: 'g2', lotId: 'lot-2', status: 'in_progress' })],
    });
    expect(target?.kind).toBe('bounds');
  });

  it('3. unfiltered opens on the active work fronts, not the whole corridor', () => {
    const active = geom({
      id: 'g2',
      lotId: 'lot-2',
      status: 'hold_point',
      geometryWgs84: {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [152.0, -34.8],
              [152.001, -34.8],
              [152.001, -34.801],
              [152.0, -34.8],
            ],
          ],
        },
      },
    });
    const target = chooseCamera({
      ...base,
      allGeometries: [geom(), active],
    });
    expect(target?.kind).toBe('bounds');
    if (target?.kind === 'bounds') {
      // Bounds cover the hold_point lot only — the conformed lot near 151° is out.
      expect(target.bounds[0][1]).toBeGreaterThan(151.5);
    }
  });

  it('4. no active work falls back to project extent', () => {
    const target = chooseCamera({ ...base, allGeometries: [geom()] });
    expect(target?.kind).toBe('bounds');
  });

  it('5. nothing at all leaves the default camera alone', () => {
    expect(chooseCamera(base)).toBeNull();
  });
});
