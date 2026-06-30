import { describe, expect, it, vi } from 'vitest';

const authFetchMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', () => ({
  authFetch: authFetchMock,
}));

import { getPushStatus } from './pushNotifications';

describe('getPushStatus', () => {
  it('does not call the push status API when the browser does not support push', async () => {
    authFetchMock.mockRejectedValue(new Error('push API unavailable'));

    const status = await getPushStatus('token');

    expect(status).toEqual({
      supported: false,
      permission: 'unsupported',
      subscribed: false,
      configured: false,
    });
    expect(authFetchMock).not.toHaveBeenCalled();
  });
});
