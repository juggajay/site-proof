import { afterEach, describe, expect, it, vi } from 'vitest';
import { readResponseError, runExclusiveOfflineSync } from './syncClient';

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, 'locks');
});

describe('readResponseError', () => {
  it('prefers nested API error messages from JSON responses', async () => {
    const response = new Response(JSON.stringify({ error: { message: 'Invalid diary data' } }), {
      status: 400,
    });

    await expect(readResponseError(response)).resolves.toBe('Invalid diary data');
  });

  it('falls back to plain text and status-only errors', async () => {
    await expect(
      readResponseError(new Response('Server unavailable', { status: 503 })),
    ).resolves.toBe('Server unavailable');
    await expect(readResponseError(new Response('', { status: 502 }))).resolves.toBe(
      'Request failed with 502',
    );
  });
});

describe('runExclusiveOfflineSync', () => {
  it('coalesces concurrent sync workers into one active promise', async () => {
    let calls = 0;
    let releaseWorker!: () => void;
    const worker = vi.fn(async () => {
      calls += 1;
      await new Promise<void>((resolve) => {
        releaseWorker = resolve;
      });
      return { syncedCount: 2 };
    });

    const first = runExclusiveOfflineSync(worker);
    const second = runExclusiveOfflineSync(async () => ({ syncedCount: 99 }));

    releaseWorker();

    await expect(Promise.all([first, second])).resolves.toEqual([
      { syncedCount: 2 },
      { syncedCount: 2 },
    ]);
    expect(calls).toBe(1);
    expect(worker).toHaveBeenCalledTimes(1);
  });

  it('uses the browser lock manager when available and skips work if unavailable', async () => {
    const worker = vi.fn(async () => ({ syncedCount: 1 }));
    const request = vi.fn(async (_name, _options, callback) => callback(null));

    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: { request },
    });

    await expect(runExclusiveOfflineSync(worker)).resolves.toEqual({ syncedCount: 0 });

    expect(request).toHaveBeenCalledWith(
      'siteproof-offline-sync',
      { ifAvailable: true },
      expect.any(Function),
    );
    expect(worker).not.toHaveBeenCalled();
  });
});
