import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authFetchMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', () => ({
  authFetch: authFetchMock,
}));

import { getPushStatus, subscribeToPush } from './pushNotifications';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

function arrayBufferFrom(bytes: number[]): ArrayBuffer {
  return new Uint8Array(bytes).buffer;
}

function installSupportedPushEnvironment(options?: {
  permission?: NotificationPermission;
  requestPermission?: NotificationPermission;
}) {
  const unsubscribe = vi.fn().mockResolvedValue(true);
  const subscription = {
    endpoint: 'https://push.example/subscription-1',
    getKey: vi.fn((key: string) => {
      if (key === 'p256dh') return arrayBufferFrom([1, 2, 3]);
      if (key === 'auth') return arrayBufferFrom([4, 5, 6]);
      return null;
    }),
    unsubscribe,
  } as unknown as PushSubscription;
  const subscribe = vi.fn().mockResolvedValue(subscription);
  const getSubscription = vi.fn().mockResolvedValue(null);

  Object.defineProperty(window, 'PushManager', {
    configurable: true,
    value: function PushManager() {},
  });
  Object.defineProperty(window, 'Notification', {
    configurable: true,
    value: {
      permission: options?.permission ?? 'default',
      requestPermission: vi.fn().mockResolvedValue(options?.requestPermission ?? 'granted'),
    },
  });
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      ready: Promise.resolve({
        pushManager: {
          getSubscription,
          subscribe,
        },
      }),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  });

  return { unsubscribe, subscribe, getSubscription };
}

beforeEach(() => {
  authFetchMock.mockReset();
});

afterEach(() => {
  Reflect.deleteProperty(window, 'PushManager');
  Reflect.deleteProperty(window, 'Notification');
  Reflect.deleteProperty(navigator, 'serviceWorker');
  vi.restoreAllMocks();
});

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

describe('subscribeToPush', () => {
  it('cleans up a newly created browser subscription when server registration fails', async () => {
    const push = installSupportedPushEnvironment();
    authFetchMock
      .mockResolvedValueOnce(jsonResponse({ publicKey: 'AQAB' }))
      .mockResolvedValueOnce(
        jsonResponse({ error: { message: 'Server rejected subscription' } }, 500),
      );

    const result = await subscribeToPush('token');

    expect(result).toEqual({ success: false, error: 'Server rejected subscription' });
    expect(push.subscribe).toHaveBeenCalledTimes(1);
    expect(push.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('stops before VAPID/server registration when notification permission is denied', async () => {
    installSupportedPushEnvironment({ requestPermission: 'denied' });

    const result = await subscribeToPush('token');

    expect(result).toEqual({ success: false, error: 'Permission denied' });
    expect(authFetchMock).not.toHaveBeenCalled();
  });
});
