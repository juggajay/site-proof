import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiFetch } from '@/lib/api';

import { normaliseSpatialPhotoCoords, useSpatialSearch } from './spatialSearchData';

vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }));
const apiFetchMock = vi.mocked(apiFetch);

const emptyResult = {
  lots: [],
  lotsTruncated: false,
  photos: [],
  photosTruncated: false,
  testResults: [],
  testResultsTruncated: false,
};

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return createElement(QueryClientProvider, { client }, children);
}

const BOUNDS = { west: 150.9, south: -33.9, east: 151.1, north: -33.7 };

function bodyOf(call: number): Record<string, unknown> {
  return JSON.parse((apiFetchMock.mock.calls[call][1] as { body: string }).body);
}

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

describe('useSpatialSearch request body', () => {
  afterEach(() => {
    apiFetchMock.mockReset();
  });

  it('sends only { bounds } by default (find-by-area full search)', async () => {
    apiFetchMock.mockResolvedValue(emptyResult);
    const { result } = renderHook(() => useSpatialSearch('proj-1'), { wrapper });

    await act(async () => {
      result.current.mutate(BOUNDS);
    });
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));

    expect(bodyOf(0)).toEqual({ bounds: BOUNDS });
    expect(bodyOf(0)).not.toHaveProperty('only');
  });

  it('sends only: "photos" when photosOnly is set (map Photos layer)', async () => {
    apiFetchMock.mockResolvedValue(emptyResult);
    const { result } = renderHook(() => useSpatialSearch('proj-1', { photosOnly: true }), {
      wrapper,
    });

    await act(async () => {
      result.current.mutate(BOUNDS);
    });
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));

    expect(bodyOf(0)).toEqual({ bounds: BOUNDS, only: 'photos' });
  });
});
