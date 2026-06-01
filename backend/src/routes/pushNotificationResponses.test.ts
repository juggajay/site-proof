import { describe, expect, it } from 'vitest';
import {
  buildGeneratedVapidKeysResponse,
  buildPushPublicConfigResponse,
  buildPushServiceStatusResponse,
  buildPushSubscriptionRegisteredResponse,
  buildPushSubscriptionsResponse,
  buildPushTestSendResponse,
  buildPushUnsubscribedResponse,
} from './pushNotificationResponses.js';

describe('pushNotificationResponses', () => {
  it('builds the public push config response', () => {
    expect(buildPushPublicConfigResponse('public-key', true)).toEqual({
      publicKey: 'public-key',
      configured: true,
    });
  });

  it('builds subscription mutation responses', () => {
    expect(buildPushSubscriptionRegisteredResponse('sub-1')).toEqual({
      success: true,
      message: 'Push notification subscription registered',
      subscriptionId: 'sub-1',
    });
    expect(buildPushUnsubscribedResponse()).toEqual({
      success: true,
      message: 'Unsubscribed from push notifications',
    });
  });

  it('builds the subscriptions list with derived count', () => {
    const subscriptions = [{ id: 'sub-1' }, { id: 'sub-2' }];

    expect(buildPushSubscriptionsResponse(subscriptions)).toEqual({
      subscriptions,
      count: 2,
    });
  });

  it('builds the test-send result summary from per-device outcomes', () => {
    const results = [{ success: true }, { success: false }, { success: true }];

    expect(buildPushTestSendResponse(results)).toEqual({
      success: true,
      message: 'Sent push notification to 2/3 device(s)',
      results,
    });
  });

  it('builds the service status response including optional current device state', () => {
    expect(
      buildPushServiceStatusResponse({
        configured: false,
        vapidConfigured: false,
        usingGeneratedKeys: true,
        totalSubscriptions: 4,
        userSubscriptionCount: 1,
        currentDeviceSubscribed: false,
      }),
    ).toEqual({
      configured: false,
      vapidConfigured: false,
      usingGeneratedKeys: true,
      totalSubscriptions: 4,
      userSubscriptionCount: 1,
      currentDeviceSubscribed: false,
      message: 'Push notifications require VAPID keys to be configured',
    });
  });

  it('builds generated VAPID keys with the existing env-format copy', () => {
    expect(buildGeneratedVapidKeysResponse('public-key', 'private-key')).toEqual({
      message: 'New VAPID keys generated. Add these to your .env file:',
      publicKey: 'public-key',
      privateKey: 'private-key',
      envFormat: 'VAPID_PUBLIC_KEY="public-key"\nVAPID_PRIVATE_KEY="private-key"',
    });
  });
});
