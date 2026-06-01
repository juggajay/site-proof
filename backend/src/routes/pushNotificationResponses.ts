export function buildPushPublicConfigResponse(publicKey: string, configured: boolean) {
  return { publicKey, configured };
}

export function buildPushSubscriptionRegisteredResponse(subscriptionId: string) {
  return {
    success: true,
    message: 'Push notification subscription registered',
    subscriptionId,
  };
}

export function buildPushUnsubscribedResponse() {
  return { success: true, message: 'Unsubscribed from push notifications' };
}

export function buildPushSubscriptionsResponse(subscriptions: unknown[]) {
  return {
    subscriptions,
    count: subscriptions.length,
  };
}

export function buildPushTestSendResponse(results: Array<{ success: boolean }>) {
  const successCount = results.filter((result) => result.success).length;
  return {
    success: successCount > 0,
    message: `Sent push notification to ${successCount}/${results.length} device(s)`,
    results,
  };
}

export function buildPushServiceStatusResponse({
  configured,
  vapidConfigured,
  usingGeneratedKeys,
  totalSubscriptions,
  userSubscriptionCount,
  currentDeviceSubscribed,
}: {
  configured: boolean;
  vapidConfigured: boolean;
  usingGeneratedKeys: boolean;
  totalSubscriptions: number;
  userSubscriptionCount: number;
  currentDeviceSubscribed?: boolean;
}) {
  return {
    configured,
    vapidConfigured,
    usingGeneratedKeys,
    totalSubscriptions,
    userSubscriptionCount,
    currentDeviceSubscribed,
    message: configured
      ? 'Push notifications are configured and ready'
      : 'Push notifications require VAPID keys to be configured',
  };
}

export function buildGeneratedVapidKeysResponse(publicKey: string, privateKey: string) {
  return {
    message: 'New VAPID keys generated. Add these to your .env file:',
    publicKey,
    privateKey,
    envFormat: `VAPID_PUBLIC_KEY="${publicKey}"\nVAPID_PRIVATE_KEY="${privateKey}"`,
  };
}
