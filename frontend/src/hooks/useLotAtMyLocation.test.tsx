import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { useLotAtMyLocation } from './useLotAtMyLocation';

const geoState = vi.hoisted(() => ({
  value: { latitude: 0, longitude: 0, accuracy: 5, loading: false } as {
    latitude: number | null;
    longitude: number | null;
    accuracy: number | null;
    loading: boolean;
  },
}));
const geomState = vi.hoisted(() => ({
  value: { data: undefined as unknown, isLoading: false },
}));

vi.mock('./useGeoLocation', () => ({
  useGeoLocation: () => geoState.value,
}));
vi.mock('@/pages/lots/map/lotMapData', () => ({
  useProjectLotGeometries: () => geomState.value,
}));

const square = {
  lotId: 'a',
  lotNumber: 'A-1',
  geometryWgs84: {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
          [0, 0],
        ],
      ],
    },
  },
};

describe('useLotAtMyLocation', () => {
  beforeEach(() => {
    geoState.value = { latitude: 0.5, longitude: 0.5, accuracy: 5, loading: false };
    geomState.value = { data: { geometries: [square] }, isLoading: false };
  });

  it('suggests the lot the point falls in', () => {
    const { result } = renderHook(() => useLotAtMyLocation('p1'));
    expect(result.current.suggestion).toEqual({ lotId: 'a', lotNumber: 'A-1' });
  });

  it('returns null when the point is in no lot', () => {
    geoState.value = { latitude: 9, longitude: 9, accuracy: 5, loading: false };
    const { result } = renderHook(() => useLotAtMyLocation('p1'));
    expect(result.current.suggestion).toBeNull();
  });

  it('returns null when accuracy is worse than 30m', () => {
    geoState.value = { latitude: 0.5, longitude: 0.5, accuracy: 45, loading: false };
    const { result } = renderHook(() => useLotAtMyLocation('p1'));
    expect(result.current.suggestion).toBeNull();
  });

  it('returns null when there is no GPS fix yet', () => {
    geoState.value = { latitude: null, longitude: null, accuracy: null, loading: true };
    const { result } = renderHook(() => useLotAtMyLocation('p1'));
    expect(result.current.suggestion).toBeNull();
  });

  it('returns null when no geometries exist (no control lines set up)', () => {
    geomState.value = { data: { geometries: [] }, isLoading: false };
    const { result } = renderHook(() => useLotAtMyLocation('p1'));
    expect(result.current.suggestion).toBeNull();
  });
});
