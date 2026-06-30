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

import { HOLD_POINTS_REGISTER_LIMIT, fetchAllProjectHoldPoints } from './holdPointsApi';

beforeEach(() => {
  apiFetchMock.mockReset();
  logErrorMock.mockClear();
  reportClientErrorMock.mockClear();
});

describe('fetchAllProjectHoldPoints', () => {
  it('fetches the full bounded register in one backend call', async () => {
    apiFetchMock.mockResolvedValue({
      holdPoints: [{ id: 'hp-1' }, { id: 'hp-2' }, { id: 'hp-3' }],
      pagination: { page: 1, totalPages: 1, hasNextPage: false },
    });

    const holdPoints = await fetchAllProjectHoldPoints('project-1');

    expect(holdPoints.map((hp) => hp.id)).toEqual(['hp-1', 'hp-2', 'hp-3']);
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(apiFetchMock).toHaveBeenCalledWith('/api/holdpoints/project/project-1?all=true');
    expect(logErrorMock).not.toHaveBeenCalled();
  });

  it('logs telemetry when the backend says the bounded register was capped', async () => {
    apiFetchMock.mockResolvedValue({
      holdPoints: [{ id: 'hp-1' }],
      pagination: { page: 1, totalPages: 2, hasNextPage: true },
    });

    const holdPoints = await fetchAllProjectHoldPoints('project-1');

    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(holdPoints).toHaveLength(1);
    expect(logErrorMock).toHaveBeenCalledWith(
      'Hold point register item cap reached:',
      expect.any(Error),
    );
    expect(logErrorMock.mock.calls[0][1].message).toContain(
      `${HOLD_POINTS_REGISTER_LIMIT}-item cap`,
    );
    expect(reportClientErrorMock).toHaveBeenCalledTimes(1);
  });

  it('propagates fetch failures so the register error state can surface them', async () => {
    apiFetchMock.mockRejectedValue(new Error('register unavailable'));

    await expect(fetchAllProjectHoldPoints('project-1')).rejects.toThrow('register unavailable');
  });
});
