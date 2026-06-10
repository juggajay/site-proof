import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiFetchMock = vi.hoisted(() => vi.fn());
const logErrorMock = vi.hoisted(() => vi.fn());
const reportClientErrorMock = vi.hoisted(() => vi.fn().mockResolvedValue(false));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: apiFetchMock };
});

vi.mock('@/lib/logger', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/logger')>();
  return { ...actual, logError: logErrorMock, reportClientError: reportClientErrorMock };
});

import {
  HOLD_POINTS_MAX_PAGES,
  HOLD_POINTS_PAGE_LIMIT,
  fetchAllProjectHoldPoints,
} from './holdPointsApi';

function buildPage(page: number, totalPages: number) {
  return {
    holdPoints: [{ id: `hp-page-${page}` }],
    pagination: { page, totalPages, hasNextPage: page < totalPages },
  };
}

beforeEach(() => {
  apiFetchMock.mockReset();
  logErrorMock.mockClear();
  reportClientErrorMock.mockClear();
});

describe('fetchAllProjectHoldPoints', () => {
  it('aggregates every page until the backend reports no next page', async () => {
    apiFetchMock.mockImplementation((path: string) => {
      const page = Number(new URLSearchParams(path.split('?')[1]).get('page'));
      return Promise.resolve(buildPage(page, 3));
    });

    const holdPoints = await fetchAllProjectHoldPoints('project-1');

    expect(holdPoints.map((hp) => hp.id)).toEqual(['hp-page-1', 'hp-page-2', 'hp-page-3']);
    expect(apiFetchMock).toHaveBeenCalledTimes(3);
    expect(apiFetchMock).toHaveBeenNthCalledWith(
      1,
      `/api/holdpoints/project/project-1?page=1&limit=${HOLD_POINTS_PAGE_LIMIT}`,
    );
    expect(apiFetchMock).toHaveBeenNthCalledWith(
      3,
      `/api/holdpoints/project/project-1?page=3&limit=${HOLD_POINTS_PAGE_LIMIT}`,
    );
    expect(logErrorMock).not.toHaveBeenCalled();
  });

  it('stops at the hard page cap, logs telemetry, and still returns the partial register', async () => {
    // A pagination payload that always claims another page — the exact shape
    // that would have spun the previous unbounded while(true) loop forever.
    apiFetchMock.mockImplementation((path: string) => {
      const page = Number(new URLSearchParams(path.split('?')[1]).get('page'));
      return Promise.resolve(buildPage(page, Number.MAX_SAFE_INTEGER));
    });

    const holdPoints = await fetchAllProjectHoldPoints('project-1');

    expect(apiFetchMock).toHaveBeenCalledTimes(HOLD_POINTS_MAX_PAGES);
    expect(holdPoints).toHaveLength(HOLD_POINTS_MAX_PAGES);
    expect(logErrorMock).toHaveBeenCalledWith(
      'Hold point register page cap reached:',
      expect.any(Error),
    );
    expect(reportClientErrorMock).toHaveBeenCalledTimes(1);
  });

  it('propagates fetch failures so the register error state can surface them', async () => {
    apiFetchMock.mockRejectedValue(new Error('register unavailable'));

    await expect(fetchAllProjectHoldPoints('project-1')).rejects.toThrow('register unavailable');
  });
});
