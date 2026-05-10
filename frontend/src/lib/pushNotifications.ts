// Push notification utilities for Web Push API
import { authFetch } from '@/lib/api';
import { extractErrorMessage } from '@/lib/errorHandling';
import { devLog, logError } from '@/lib/logger';

export type PushStatus = {
  supported: boolean;
  permission: NotificationPermission | 'unsupported';
  subscribed: boolean;
  configured: boolean;
  message?: string;
};

async function readPushResponseError(response: Response): Promise<string> {
  const text = await response.text();
  if (!text) {
    return `Request failed with ${response.status}`;
  }

  try {
    const parsed = JSON.parse(text) as { error?: { message?: string } | string; message?: string };
    if (typeof parsed.error === 'string') return parsed.error;
    return parsed.error?.message || parsed.message || text;
  } catch {
    return text;
  }
}

async function getReadyServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  if (!isPushSupported()) {
    throw new Error('Push notifications are not supported in this browser');
  }

  const timeoutPromise = new Promise<never>((_, reject) => {
    window.setTimeout(() => reject(new Error('Service worker was not ready in time')), 5000);
  });

  return Promise.race([navigator.serviceWorker.ready, timeoutPromise]);
}

async function getCurrentPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) {
    return null;
  }

  const registration = await getReadyServiceWorkerRegistration();
  return registration.pushManager.getSubscription();
}

async function getSubscriptionIdForEndpoint(endpoint: string): Promise<string | null> {
  if (
    typeof window === 'undefined' ||
    !window.crypto?.subtle ||
    typeof TextEncoder === 'undefined'
  ) {
    return null;
  }

  try {
    const digest = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  } catch (error) {
    logError('[Push] Failed to fingerprint current subscription:', error);
    return null;
  }
}

async function unsubscribeBrowserSubscription(
  subscription: PushSubscription,
  reason: string,
): Promise<void> {
  try {
    const unsubscribed = await subscription.unsubscribe();
    if (!unsubscribed) {
      logError(`[Push] Browser declined to remove subscription after ${reason}`);
    }
  } catch (error) {
    logError(`[Push] Failed to remove browser subscription after ${reason}:`, error);
  }
}

// Check if push notifications are supported
export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

// Check current notification permission status
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported';
  return window.Notification.permission;
}

// Request notification permission
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isPushSupported()) {
    throw new Error('Push notifications are not supported in this browser');
  }

  const permission = await window.Notification.requestPermission();
  return permission;
}

// Get the VAPID public key from the server
export async function getVapidPublicKey(token: string): Promise<string> {
  const response = await authFetch('/api/push/vapid-public-key', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(await readPushResponseError(response));
  }

  const data = (await response.json()) as { publicKey?: unknown };
  if (typeof data.publicKey !== 'string' || !data.publicKey.trim()) {
    throw new Error('Push notification configuration did not return a VAPID public key');
  }

  return data.publicKey.trim();
}

// Convert VAPID key to Uint8Array for subscription
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Subscribe to push notifications
export async function subscribeToPush(
  token: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!isPushSupported()) {
      return { success: false, error: 'Push notifications not supported' };
    }

    // Request permission if needed
    const permission = await requestNotificationPermission();
    if (permission !== 'granted') {
      return { success: false, error: 'Permission denied' };
    }

    // Get VAPID key
    const vapidKey = await getVapidPublicKey(token);

    // Wait for service worker to be ready
    const registration = await getReadyServiceWorkerRegistration();

    // Check for existing subscription
    let subscription = await registration.pushManager.getSubscription();
    let createdSubscription = false;

    if (!subscription) {
      // Create new subscription
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as BufferSource,
      });
      createdSubscription = true;
    }

    const p256dh = subscription.getKey('p256dh');
    const auth = subscription.getKey('auth');
    if (!p256dh || !auth) {
      throw new Error('Browser did not return push subscription keys');
    }

    // Send subscription to server
    const response = await authFetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        subscription: {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: arrayBufferToBase64(p256dh),
            auth: arrayBufferToBase64(auth),
          },
        },
      }),
    });

    if (!response.ok) {
      const error = await readPushResponseError(response);
      if (createdSubscription || response.status === 403) {
        await unsubscribeBrowserSubscription(subscription, 'server registration failure');
      }
      return { success: false, error };
    }

    const data = (await response.json().catch(() => ({}))) as {
      success?: unknown;
      message?: unknown;
    };
    if (data.success === false) {
      if (createdSubscription) {
        await unsubscribeBrowserSubscription(subscription, 'rejected server registration');
      }
      return {
        success: false,
        error:
          typeof data.message === 'string' ? data.message : 'Server did not register this device',
      };
    }

    devLog('[Push] Successfully subscribed to push notifications');
    return { success: true };
  } catch (error) {
    logError('[Push] Subscription error:', error);
    return { success: false, error: extractErrorMessage(error, 'Unknown error') };
  }
}

// Unsubscribe from push notifications
export async function unsubscribeFromPush(
  token: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!isPushSupported()) {
      return { success: false, error: 'Push notifications not supported' };
    }

    const subscription = await getCurrentPushSubscription();

    if (!subscription) {
      return { success: true }; // Already unsubscribed
    }

    const response = await authFetch('/api/push/unsubscribe', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
      }),
    });

    if (!response.ok && response.status !== 404) {
      return { success: false, error: await readPushResponseError(response) };
    }

    const unsubscribed = await subscription.unsubscribe();
    if (!unsubscribed) {
      return { success: false, error: 'Browser did not unsubscribe this device' };
    }

    devLog('[Push] Successfully unsubscribed from push notifications');
    return { success: true };
  } catch (error) {
    logError('[Push] Unsubscribe error:', error);
    return { success: false, error: extractErrorMessage(error, 'Unknown error') };
  }
}

// Check if currently subscribed to push
export async function isSubscribedToPush(): Promise<boolean> {
  try {
    if (!isPushSupported()) return false;

    return (await getCurrentPushSubscription()) !== null;
  } catch (error) {
    logError('[Push] Error checking subscription:', error);
    return false;
  }
}

// Send a test push notification
export async function sendTestPush(
  token: string,
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const response = await authFetch('/api/push/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return { success: false, error: await readPushResponseError(response) };
    }

    const data = (await response.json()) as { success?: unknown; message?: unknown };
    const message = typeof data.message === 'string' ? data.message : undefined;

    if (data.success !== true) {
      return {
        success: false,
        error: message || 'Test push notification did not reach any devices',
      };
    }

    return { success: true, message };
  } catch (error) {
    logError('[Push] Test push error:', error);
    return { success: false, error: extractErrorMessage(error, 'Unknown error') };
  }
}

// Get push notification status
export async function getPushStatus(token: string): Promise<{
  supported: boolean;
  permission: NotificationPermission | 'unsupported';
  subscribed: boolean;
  configured: boolean;
  message?: string;
}> {
  const supported = isPushSupported();
  const permission = getNotificationPermission();

  const response = await authFetch('/api/push/status', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(await readPushResponseError(response));
  }

  const data = (await response.json()) as {
    configured?: unknown;
    currentDeviceSubscribed?: unknown;
    message?: unknown;
  };
  let subscribed = false;

  if (data.configured === true) {
    let currentSubscription: PushSubscription | null = null;
    try {
      currentSubscription = await getCurrentPushSubscription();
    } catch (error) {
      logError('[Push] Error checking current subscription:', error);
    }

    const subscriptionId = currentSubscription
      ? await getSubscriptionIdForEndpoint(currentSubscription.endpoint)
      : null;

    if (subscriptionId) {
      try {
        const currentDeviceResponse = await authFetch(
          `/api/push/status?subscriptionId=${encodeURIComponent(subscriptionId)}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (currentDeviceResponse.ok) {
          const currentDeviceData = (await currentDeviceResponse.json()) as {
            currentDeviceSubscribed?: unknown;
          };
          subscribed = currentDeviceData.currentDeviceSubscribed === true;
        }
      } catch (error) {
        logError('[Push] Error verifying current subscription:', error);
      }
    }
  }

  return {
    supported,
    permission,
    subscribed,
    configured: data.configured === true,
    message: typeof data.message === 'string' ? data.message : undefined,
  };
}

// Helper function to convert ArrayBuffer to base64
function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
