import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchWithTimeout, FetchTimeoutError } from './fetchWithTimeout.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  globalThis.fetch = originalFetch;
});

function installAbortAwareHangingFetch() {
  const fetchMock = vi.fn(
    (_input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        });
      }),
  );
  globalThis.fetch = fetchMock as typeof fetch;
  return fetchMock;
}

describe('fetchWithTimeout', () => {
  it('rejects with a timeout error when the upstream request hangs', async () => {
    vi.useFakeTimers();
    installAbortAwareHangingFetch();

    const request = fetchWithTimeout('https://example.test/hang', undefined, 25);
    const assertion = expect(request).rejects.toBeInstanceOf(FetchTimeoutError);
    await vi.advanceTimersByTimeAsync(25);

    await assertion;
  });

  it('preserves caller abort behavior when the caller cancels first', async () => {
    installAbortAwareHangingFetch();

    const controller = new AbortController();
    const request = fetchWithTimeout(
      'https://example.test/cancel',
      { signal: controller.signal },
      1000,
    );
    controller.abort();

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
  });
});
