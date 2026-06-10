// Unit tests for the retriable-network-failure classifier that decides whether
// a failed field write is queued for offline sync (timeouts, fetch-level
// failures, 5xx, browser offline) or surfaced as a real error (4xx).
import { afterEach, describe, expect, it } from 'vitest';

import { ApiError, isRetriableNetworkFailure } from './api';
import { RequestTimeoutError } from './fetchWithTimeout';

const originalOnLine = navigator.onLine;

function setNavigatorOnLine(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true });
}

afterEach(() => {
  setNavigatorOnLine(originalOnLine);
});

describe('isRetriableNetworkFailure', () => {
  it('is true for a request timeout while the browser reports online', () => {
    setNavigatorOnLine(true);
    expect(isRetriableNetworkFailure(new RequestTimeoutError(30000))).toBe(true);
  });

  it('is true for a fetch-level TypeError (connection/DNS failure)', () => {
    setNavigatorOnLine(true);
    expect(isRetriableNetworkFailure(new TypeError('Failed to fetch'))).toBe(true);
  });

  it('is true for 5xx server errors', () => {
    setNavigatorOnLine(true);
    expect(isRetriableNetworkFailure(new ApiError(500, 'boom'))).toBe(true);
    expect(isRetriableNetworkFailure(new ApiError(503, 'unavailable'))).toBe(true);
  });

  it('is true for any error while the browser reports offline', () => {
    setNavigatorOnLine(false);
    expect(isRetriableNetworkFailure(new Error('network down'))).toBe(true);
  });

  it('is false for 4xx responses — definitive rejections must surface', () => {
    setNavigatorOnLine(true);
    expect(isRetriableNetworkFailure(new ApiError(400, 'bad request'))).toBe(false);
    expect(isRetriableNetworkFailure(new ApiError(403, 'forbidden'))).toBe(false);
    expect(isRetriableNetworkFailure(new ApiError(404, 'not found'))).toBe(false);
    expect(isRetriableNetworkFailure(new ApiError(422, 'validation failed'))).toBe(false);
  });

  it('is false for generic errors while online (including caller aborts)', () => {
    setNavigatorOnLine(true);
    expect(isRetriableNetworkFailure(new Error('something else'))).toBe(false);
    expect(isRetriableNetworkFailure(new DOMException('Request aborted', 'AbortError'))).toBe(
      false,
    );
  });
});
