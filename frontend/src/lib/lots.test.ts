import { describe, it, expect, vi, beforeEach } from 'vitest';

const apiFetchMock = vi.fn();
vi.mock('./api', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

import { fetchAllLotPages } from './lots';

describe('fetchAllLotPages', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('returns a single page unchanged when there is only one', async () => {
    apiFetchMock.mockResolvedValue({
      lots: [{ id: 'a' }, { id: 'b' }],
      pagination: { totalPages: 1 },
    });
    const lots = await fetchAllLotPages<{ id: string }>('/api/lots?projectId=p1&portalModule=lots');
    expect(lots).toEqual([{ id: 'a' }, { id: 'b' }]);
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/lots?projectId=p1&portalModule=lots&limit=100&page=1',
    );
  });

  it('follows totalPages and concatenates every record (docket lot selector gets the full set)', async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => ({ id: `lot-${i}` }));
    const page2 = Array.from({ length: 35 }, (_, i) => ({ id: `lot-${i + 100}` }));
    apiFetchMock.mockImplementation((url: string) => {
      if (url.includes('page=2'))
        return Promise.resolve({ lots: page2, pagination: { totalPages: 2 } });
      return Promise.resolve({ lots: page1, pagination: { totalPages: 2 } });
    });

    const lots = await fetchAllLotPages<{ id: string }>('/api/lots?projectId=p1');

    expect(lots).toHaveLength(135);
    expect(lots[0]).toEqual({ id: 'lot-0' });
    expect(lots[134]).toEqual({ id: 'lot-134' });
    expect(apiFetchMock).toHaveBeenCalledTimes(2);
    expect(apiFetchMock).toHaveBeenNthCalledWith(1, '/api/lots?projectId=p1&limit=100&page=1');
    expect(apiFetchMock).toHaveBeenNthCalledWith(2, '/api/lots?projectId=p1&limit=100&page=2');
  });

  it('reads the data alias and appends ? when the base path has no query', async () => {
    apiFetchMock.mockResolvedValue({ data: [{ id: 'x' }], pagination: { totalPages: 1 } });
    const lots = await fetchAllLotPages<{ id: string }>('/api/lots');
    expect(lots).toEqual([{ id: 'x' }]);
    expect(apiFetchMock).toHaveBeenCalledWith('/api/lots?limit=100&page=1');
  });
});
