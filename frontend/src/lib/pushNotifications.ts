// Push notification utilities for Web Push API
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4008'

// Check if push notifications are supported
export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window
}

// Check current notification permission status
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported'
  return Notification.permission
}

// Request notification permission
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isPushSupported()) {
    throw new Error('Push notifications are not supported in this browser')
  }

  const permission = await Notification.requestPermission()
  return permission
}

// Get the VAPID public key from the server
export async function getVapidPublicKey(token: string): Promise<string | null> {
  try {
    const response = await fetch(`${API_BASE}/api/push/vapid-public-key`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (!response.ok) {
      console.error('Failed to get VAPID key:', response.status)
      return null
    }

    const data = await response.json()
    return data.publicKey
  } catch (error) {
    console.error('Error getting VAPID key:', error)
    return null
  }
}

// Convert VAPID key to Uint8Array for subscription
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

// Subscribe to push notifications
export async function subscribeToPush(token: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!isPushSupported()) {
      return { success: false, error: 'Push notifications not supported' }
    }

    // Request permission if needed
    const permission = await requestNotificationPermission()
    if (permission !== 'granted') {
      return { success: false, error: 'Permission denied' }
    }

    // Get VAPID key
    const vapidKey = await getVapidPublicKey(token)
    if (!vapidKey) {
      return { success: false, error: 'Could not get VAPID key' }
    }

    // Wait for service worker to be ready
    const registration = await navigator.serviceWorker.ready

    // Check for existing subscription
    let subscription = await registration.pushManager.getSubscription()

    if (!subscription) {
      // Create new subscription
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey)
      })
    }

    // Send subscription to server
    const response = await fetch(`${API_BASE}/api/push/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        subscription: {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: arrayBufferToBase64(subscription.getKey('p256dh')),
            auth: arrayBufferToBase64(subscription.getKey('auth'))
          }
        }
      })
    })

    if (!response.ok) {
      const error = await response.json()
      return { success: false, error: error.error || 'Failed to subscribe' }
    }

    console.log('[Push] Successfully subscribed to push notifications')
    return { success: true }
  } catch (error) {
    console.error('[Push] Subscription error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// Unsubscribe from push notifications
export async function unsubscribeFromPush(token: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!isPushSupported()) {
      return { success: false, error: 'Push notifications not supported' }
    }

    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()

    if (!subscription) {
      return { success: true } // Already unsubscribed
    }

    // Unsubscribe from browser
    await subscription.unsubscribe()

    // Notify server
    await fetch(`${API_BASE}/api/push/unsubscribe`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        endpoint: subscription.endpoint
      })
    })

    console.log('[Push] Successfully unsubscribed from push notifications')
    return { success: true }
  } catch (error) {
    console.error('[Push] Unsubscribe error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// Check if currently subscribed to push
export async function isSubscribedToPush(): Promise<boolean> {
  try {
    if (!isPushSupported()) return false

    // Add timeout for service worker ready - don't hang forever
    const timeoutPromise = new Promise<null>((_, reject) =>
      setTimeout(() => reject(new Error('Service worker ready timeout')), 3000)
    )

    const registration = await Promise.race([
      navigator.serviceWorker.ready,
      timeoutPromise
    ]) as ServiceWorkerRegistration

    if (!registration) return false

    const subscription = await registration.pushManager.getSubscription()

    return subscription !== null
  } catch (error) {
    console.error('[Push] Error checking subscription:', error)
    return false
  }
}

// Send a test push notification
export async function sendTestPush(token: string): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/api/push/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    })

    const data = await response.json()

    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to send test notification' }
    }

    return { success: true, message: data.message }
  } catch (error) {
    console.error('[Push] Test push error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// Get push notification status
export async function getPushStatus(token: string): Promise<{
  supported: boolean
  permission: NotificationPermission | 'unsupported'
  subscribed: boolean
  configured: boolean
}> {
  const supported = isPushSupported()
  const permission = getNotificationPermission()
  const subscribed = await isSubscribedToPush()

  let configured = false
  try {
    const response = await fetch(`${API_BASE}/api/push/status`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    if (response.ok) {
      const data = await response.json()
      configured = data.configured
    }
  } catch {
    // Ignore errors
  }

  return {
    supported,
    permission,
    subscribed,
    configured
  }
}

// Helper function to convert ArrayBuffer to base64
function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return ''
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return window.btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}
