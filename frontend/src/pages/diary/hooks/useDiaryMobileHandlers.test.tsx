/**
 * Offline resilience contract for the mobile diary quick-add handlers.
 *
 * The diary is legal evidence. Before this wiring, every quick-add was a bare
 * apiFetch POST: on a dead or flaky network the save failed and the sheet
 * could only offer a retry against the same dead network. These tests pin the
 * new contract:
 *
 *  - retriable network failure (offline / timeout / fetch failure / 5xx) ->
 *    the typed entry is queued through the offline store, the handler RESOLVES
 *    (so the sheet closes as a success), and the honest "Saved Offline" toast
 *    fires — without the online-path refetches that would fail anyway;
 *  - definitive 4xx rejection -> the handler still throws, keeping the #776
 *    keep-open-with-failure-banner sheet behavior, and nothing is queued;
 *  - personnel stays online-only (the offline snapshot cannot represent it).
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: vi.fn() };
});

vi.mock('@/components/ui/toaster', () => ({ toast: vi.fn() }));

vi.mock('@/lib/offlineDb', () => ({
  queueDiaryActivityOffline: vi.fn(),
  queueDiaryDelayOffline: vi.fn(),
  queueDiaryDeliveryOffline: vi.fn(),
  queueDiaryEventOffline: vi.fn(),
  queueDiaryPlantOffline: vi.fn(),
  queueDiaryWeatherOffline: vi.fn(),
}));

import { apiFetch, ApiError } from '@/lib/api';
import { toast } from '@/components/ui/toaster';
import {
  queueDiaryActivityOffline,
  queueDiaryDelayOffline,
  queueDiaryDeliveryOffline,
  queueDiaryEventOffline,
  queueDiaryPlantOffline,
  queueDiaryWeatherOffline,
} from '@/lib/offlineDb';
import type { TimelineEntry } from '@/components/foreman/DiaryTimelineEntry';
import type { DailyDiary } from '../types';
import { useDiaryMobileHandlers } from './useDiaryMobileHandlers';

const apiFetchMock = vi.mocked(apiFetch);
const toastMock = vi.mocked(toast);

function makeDiary(overrides: Partial<DailyDiary> = {}): DailyDiary {
  return {
    id: 'd-1',
    projectId: 'project-1',
    date: '2026-06-09',
    status: 'draft',
    personnel: [],
    plant: [],
    activities: [],
    delays: [],
    deliveries: [],
    events: [],
    createdAt: '2026-06-09T00:00:00.000Z',
    updatedAt: '2026-06-09T00:00:00.000Z',
    ...overrides,
  };
}

function renderHandlers(overrides: Partial<Parameters<typeof useDiaryMobileHandlers>[0]> = {}) {
  const params = {
    projectId: 'project-1',
    selectedDate: '2026-06-09',
    diary: makeDiary(),
    timeline: [],
    ensureDiaryExists: vi.fn().mockResolvedValue(null),
    fetchTimeline: vi.fn().mockResolvedValue(undefined),
    fetchDiaryForDate: vi.fn().mockResolvedValue(undefined),
    fetchDocketSummary: vi.fn().mockResolvedValue(undefined),
    setDiary: vi.fn(),
    setError: vi.fn(),
    setWeatherForm: vi.fn(),
    ...overrides,
  };

  const { result } = renderHook(() => useDiaryMobileHandlers(params), {
    wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter>,
  });

  return { result, params };
}

beforeEach(() => {
  vi.clearAllMocks();
  // isRetriableNetworkFailure short-circuits to retriable whenever the browser
  // reports offline; default to online so each ApiError classifies by status.
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
});

describe('quick-add success path (unchanged)', () => {
  it('POSTs the activity and refetches the timeline and diary', async () => {
    apiFetchMock.mockResolvedValue({});
    const { result, params } = renderHandlers();

    await result.current.addActivityFromSheet({ description: 'Pour kerb' });

    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/diary/d-1/activities',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(params.fetchTimeline).toHaveBeenCalledWith('d-1');
    expect(params.fetchDiaryForDate).toHaveBeenCalledWith('2026-06-09');
    expect(queueDiaryActivityOffline).not.toHaveBeenCalled();
    expect(toastMock).not.toHaveBeenCalled();
  });
});

describe('existing timeline entry edit/delete path', () => {
  it('PUTs edits for an existing activity and refreshes the diary', async () => {
    apiFetchMock.mockResolvedValue({});
    const { result, params } = renderHandlers();
    const entry: TimelineEntry = {
      id: 'activity-1',
      type: 'activity',
      createdAt: '2026-06-09T01:00:00.000Z',
      description: 'Original activity',
      lot: null,
      data: { quantity: 10, unit: 'm3' },
    };

    act(() => {
      result.current.handleEditEntry(entry);
    });

    await result.current.addActivityFromSheet({
      description: 'Edited activity',
      quantity: 12,
      unit: 'm3',
    });

    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/diary/d-1/activities/activity-1',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          description: 'Edited activity',
          quantity: 12,
          unit: 'm3',
          lotId: undefined,
        }),
      }),
    );
    expect(params.fetchTimeline).toHaveBeenCalledWith('d-1');
    expect(params.fetchDiaryForDate).toHaveBeenCalledWith('2026-06-09');
    expect(queueDiaryActivityOffline).not.toHaveBeenCalled();
  });

  it('DELETEs the endpoint that matches the timeline entry type', async () => {
    apiFetchMock.mockResolvedValue({});
    const { result, params } = renderHandlers();

    await result.current.handleDeleteEntry({ id: 'personnel-1', type: 'personnel' });

    expect(apiFetchMock).toHaveBeenCalledWith('/api/diary/d-1/personnel/personnel-1', {
      method: 'DELETE',
    });
    expect(params.fetchTimeline).toHaveBeenCalledWith('d-1');
    expect(params.fetchDiaryForDate).toHaveBeenCalledWith('2026-06-09');
  });

  it('ignores delete requests for unknown timeline entry types', async () => {
    const { result } = renderHandlers();

    await result.current.handleDeleteEntry({ id: 'unknown-1', type: 'unknown' });

    expect(apiFetchMock).not.toHaveBeenCalled();
  });
});

describe('retriable network failure -> queued offline + reported as success', () => {
  it('queues an activity on a 5xx and resolves with the honest Saved Offline toast', async () => {
    apiFetchMock.mockRejectedValue(new ApiError(503, 'service unavailable'));
    const { result, params } = renderHandlers();

    await expect(
      result.current.addActivityFromSheet({ description: 'Pour kerb', quantity: 12, unit: 'm3' }),
    ).resolves.toBeUndefined();

    expect(queueDiaryActivityOffline).toHaveBeenCalledWith('project-1', '2026-06-09', {
      description: 'Pour kerb',
      quantity: 12,
      unit: 'm3',
      lotId: undefined,
    });
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Saved Offline' }));
    // No refetch against the same dead network.
    expect(params.fetchTimeline).not.toHaveBeenCalled();
    expect(params.fetchDiaryForDate).not.toHaveBeenCalled();
  });

  it('queues a delay on a fetch-level failure (TypeError)', async () => {
    apiFetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const { result } = renderHandlers();

    await result.current.addDelayFromSheet({ delayType: 'weather', description: 'Rain' });

    expect(queueDiaryDelayOffline).toHaveBeenCalledWith(
      'project-1',
      '2026-06-09',
      expect.objectContaining({ delayType: 'weather', description: 'Rain' }),
    );
  });

  it('queues a delivery against the existing server diary id', async () => {
    apiFetchMock.mockRejectedValue(new ApiError(500, 'boom'));
    const { result } = renderHandlers();

    await result.current.addDeliveryFromSheet({ description: '20t road base', quantity: 20 });

    expect(queueDiaryDeliveryOffline).toHaveBeenCalledWith(
      { diaryId: 'd-1' },
      expect.objectContaining({ description: '20t road base', quantity: 20 }),
    );
  });

  it('queues an event against the existing server diary id', async () => {
    apiFetchMock.mockRejectedValue(new ApiError(500, 'boom'));
    const { result } = renderHandlers();

    await result.current.addEventFromSheet({ eventType: 'inspection', description: 'Walkover' });

    expect(queueDiaryEventOffline).toHaveBeenCalledWith(
      { diaryId: 'd-1' },
      expect.objectContaining({ eventType: 'inspection', description: 'Walkover' }),
    );
  });

  it('queues manual plant on a 5xx', async () => {
    apiFetchMock.mockRejectedValue(new ApiError(502, 'bad gateway'));
    const { result } = renderHandlers();

    await result.current.handleSavePlant({ description: '20t excavator', hoursOperated: 6 });

    expect(queueDiaryPlantOffline).toHaveBeenCalledWith(
      'project-1',
      '2026-06-09',
      expect.objectContaining({ description: '20t excavator', hoursOperated: 6 }),
    );
  });

  it('resolves the quick-add lot from the active lot selector before queueing', async () => {
    apiFetchMock.mockRejectedValue(new ApiError(500, 'boom'));
    const { result } = renderHandlers();
    act(() => result.current.setActiveLotId('lot-7'));

    await result.current.addActivityFromSheet({ description: 'Pour kerb' });

    expect(queueDiaryActivityOffline).toHaveBeenCalledWith(
      'project-1',
      '2026-06-09',
      expect.objectContaining({ lotId: 'lot-7' }),
    );
  });
});

describe('genuinely offline with no diary yet', () => {
  it('queues the delivery anchored to project+date, clears the page error, and resolves', async () => {
    // ensureDiaryExists swallows its network error and resolves null (its
    // contract); the browser reporting offline is what classifies this
    // failure as retriable.
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const { result, params } = renderHandlers({ diary: null });

    await expect(
      result.current.addDeliveryFromSheet({ description: '20t road base' }),
    ).resolves.toBeUndefined();

    expect(params.ensureDiaryExists).toHaveBeenCalled();
    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(queueDiaryDeliveryOffline).toHaveBeenCalledWith(
      { projectId: 'project-1', date: '2026-06-09' },
      expect.objectContaining({ description: '20t road base' }),
    );
    // ensureDiaryExists reported a page-level error; a queued save must not
    // leave the contradictory "Failed to create diary" banner up.
    expect(params.setError).toHaveBeenCalledWith(null);
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Saved Offline' }));
  });

  it('still surfaces an ONLINE diary-creation failure to the sheet', async () => {
    const { result } = renderHandlers({ diary: null });

    await expect(result.current.addActivityFromSheet({ description: 'Pour kerb' })).rejects.toThrow(
      'Diary could not be created',
    );

    expect(queueDiaryActivityOffline).not.toHaveBeenCalled();
    expect(toastMock).not.toHaveBeenCalled();
  });
});

describe('definitive 4xx rejections keep the sheet failure banner', () => {
  it('rethrows a 4xx and queues nothing', async () => {
    apiFetchMock.mockRejectedValue(new ApiError(422, 'validation failed'));
    const { result } = renderHandlers();

    await expect(result.current.addActivityFromSheet({ description: 'Pour kerb' })).rejects.toThrow(
      'API Error 422',
    );

    expect(queueDiaryActivityOffline).not.toHaveBeenCalled();
    expect(toastMock).not.toHaveBeenCalled();
  });

  it('personnel stays online-only: even a 5xx surfaces to the sheet, nothing is queued', async () => {
    apiFetchMock.mockRejectedValue(new ApiError(500, 'boom'));
    const { result } = renderHandlers();

    await expect(result.current.handleSavePersonnel({ name: 'J. Smith' })).rejects.toThrow(
      'API Error 500',
    );

    expect(toastMock).not.toHaveBeenCalled();
  });
});

describe('weather quick-save offline fallback', () => {
  it('queues weather on a 5xx, reflects it locally, and resolves', async () => {
    apiFetchMock.mockRejectedValue(new ApiError(500, 'boom'));
    const { result, params } = renderHandlers();

    await expect(
      result.current.handleSaveWeather({
        conditions: 'Rain',
        temperatureMin: '8',
        temperatureMax: '14',
        rainfallMm: '6',
      }),
    ).resolves.toBeUndefined();

    expect(queueDiaryWeatherOffline).toHaveBeenCalledWith('project-1', '2026-06-09', {
      conditions: 'Rain',
      temperatureMin: 8,
      temperatureMax: 14,
      rainfallMm: 6,
    });
    // Local visibility: the diary state and weather form reflect the queued
    // values immediately.
    expect(params.setDiary).toHaveBeenCalledWith(
      expect.objectContaining({ weatherConditions: 'Rain', temperatureMin: 8, rainfallMm: 6 }),
    );
    expect(params.setWeatherForm).toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Saved Offline' }));
  });

  it('rethrows a 4xx weather rejection so the sheet keeps its failure banner', async () => {
    apiFetchMock.mockRejectedValue(new ApiError(400, 'bad weather payload'));
    const { result } = renderHandlers();

    await expect(
      result.current.handleSaveWeather({
        conditions: 'Rain',
        temperatureMin: '',
        temperatureMax: '',
        rainfallMm: '',
      }),
    ).rejects.toThrow('API Error 400');

    expect(queueDiaryWeatherOffline).not.toHaveBeenCalled();
  });
});
