import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./api', () => ({
  getAuthToken: vi.fn(() => 'test-token'),
  authFetch: vi.fn(() => Promise.resolve({ ok: true } as Response)),
}));

import { authFetch, getAuthToken } from './api';
import { __resetProductEventsQueueForTest, flushProductEvents, trackEvent } from './productEvents';

const mockAuthFetch = vi.mocked(authFetch);

describe('product events transport', () => {
  beforeEach(() => {
    __resetProductEventsQueueForTest();
    vi.mocked(getAuthToken).mockReturnValue('test-token');
    mockAuthFetch.mockResolvedValue({ ok: true } as Response);
  });

  afterEach(() => {
    __resetProductEventsQueueForTest();
    vi.clearAllMocks();
  });

  it('queues events and flushes them as one batch', async () => {
    trackEvent('lot_create.opened');
    trackEvent('lot_create.submitted', undefined, { activityType: 'earthworks' });
    expect(mockAuthFetch).not.toHaveBeenCalled();

    await flushProductEvents();

    expect(mockAuthFetch).toHaveBeenCalledTimes(1);
    const [path, init] = mockAuthFetch.mock.calls[0];
    expect(path).toBe('/api/product-events');
    expect(init?.method).toBe('POST');
    expect(init?.keepalive).toBe(false);

    const body = JSON.parse(init?.body as string);
    expect(body.events).toHaveLength(2);
    expect(body.events[0].event).toBe('lot_create.opened');
    expect(body.events[0].clientTs).toBeTruthy();
    expect(body.events[1].metadata).toEqual({ activityType: 'earthworks' });
  });

  it('is a no-op when the queue is empty', async () => {
    await flushProductEvents();
    expect(mockAuthFetch).not.toHaveBeenCalled();
  });

  it('sends keepalive on the pagehide path', async () => {
    trackEvent('lot_create.opened');
    await flushProductEvents(true);
    expect(mockAuthFetch.mock.calls[0][1]?.keepalive).toBe(true);
  });

  it('swallows request failures without throwing', async () => {
    mockAuthFetch.mockRejectedValueOnce(new Error('network'));
    trackEvent('lot_create.opened');
    await expect(flushProductEvents()).resolves.toBeUndefined();
  });

  it('does not send when there is no auth token', async () => {
    vi.mocked(getAuthToken).mockReturnValue(null);
    trackEvent('lot_create.opened');
    await flushProductEvents();
    expect(mockAuthFetch).not.toHaveBeenCalled();
  });

  it('flushes eagerly once a full batch (20) accumulates', () => {
    for (let i = 0; i < 20; i += 1) {
      trackEvent('lot_create.opened');
    }
    // The 20th enqueue triggers a synchronous flush (authFetch is invoked before
    // the first await inside postBatch).
    expect(mockAuthFetch).toHaveBeenCalledTimes(1);
  });
});
