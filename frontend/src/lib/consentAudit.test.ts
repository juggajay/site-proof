import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAuthToken: vi.fn(),
  apiUrl: vi.fn((path: string) => path),
  fetchWithTimeout: vi.fn(),
}));

vi.mock('./auth', () => ({
  getAuthToken: mocks.getAuthToken,
}));

vi.mock('./config', () => ({
  apiUrl: mocks.apiUrl,
}));

vi.mock('./fetchWithTimeout', () => ({
  fetchWithTimeout: mocks.fetchWithTimeout,
}));

import { recordCookiePolicyConsentDecision } from './consentAudit';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetchWithTimeout.mockResolvedValue({ ok: true, status: 201 } as Response);
});

describe('recordCookiePolicyConsentDecision', () => {
  it('does not request an audit write when no auth token is available', async () => {
    mocks.getAuthToken.mockReturnValue(null);

    await recordCookiePolicyConsentDecision(true);

    expect(mocks.fetchWithTimeout).not.toHaveBeenCalled();
  });

  it('posts an authenticated cookie-policy consent decision when a token exists', async () => {
    mocks.getAuthToken.mockReturnValue('session-token');

    await recordCookiePolicyConsentDecision(false);

    expect(mocks.fetchWithTimeout).toHaveBeenCalledWith('/api/consent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer session-token',
      },
      body: JSON.stringify({
        consentType: 'cookie_policy',
        granted: false,
      }),
    });
  });

  it('suppresses backend audit failures', async () => {
    mocks.getAuthToken.mockReturnValue('session-token');
    mocks.fetchWithTimeout.mockRejectedValue(new Error('network unavailable'));

    await expect(recordCookiePolicyConsentDecision(true)).resolves.toBeUndefined();
  });
});
