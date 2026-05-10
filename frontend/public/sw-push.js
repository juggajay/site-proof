// Service Worker for Push Notifications.
// This file is loaded by VitePWA's generated service worker.

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function parsePushPayload(eventData) {
  if (!eventData) {
    return {
      title: 'SiteProof',
      body: 'You have a new notification',
      data: {},
    }
  }

  try {
    const parsed = eventData.json()
    if (isRecord(parsed)) {
      return parsed
    }
  } catch {
    return {
      title: 'SiteProof Notification',
      body: eventData.text(),
      data: {},
    }
  }

  return {
    title: 'SiteProof Notification',
    body: eventData.text(),
    data: {},
  }
}

function isSafeAppPath(value) {
  if (typeof value !== 'string') return false

  const normalized = value.trim()
  if (
    !normalized.startsWith('/') ||
    normalized.startsWith('//') ||
    normalized.includes('\\') ||
    /[\u0000-\u001f\u007f]/.test(normalized)
  ) {
    return false
  }

  try {
    const url = new URL(normalized, self.location.origin)
    return url.origin === self.location.origin
  } catch {
    return false
  }
}

function getNotificationNavigationUrl(notificationData) {
  const rawUrl = isRecord(notificationData) ? notificationData.url : undefined
  if (!isSafeAppPath(rawUrl)) {
    return new URL('/', self.location.origin).href
  }

  const url = new URL(rawUrl.trim(), self.location.origin)
  return url.href
}

async function notifyClientsOfSubscriptionChange() {
  const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true })
  for (const client of clientList) {
    client.postMessage({ type: 'PUSH_SUBSCRIPTION_CHANGED' })
  }
}

self.addEventListener('push', function(event) {
  const data = parsePushPayload(event.data)

  const options = {
    body: data.body || 'You have a new notification',
    icon: data.icon || '/pwa-192x192.png',
    badge: data.badge || '/pwa-192x192.png',
    tag: data.tag || 'siteproof-notification',
    renotify: true,
    requireInteraction: data.requireInteraction || false,
    data: isRecord(data.data) ? data.data : {},
    actions: Array.isArray(data.actions) ? data.actions : [],
    vibrate: [100, 50, 100],
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'SiteProof', options)
  )
})

self.addEventListener('notificationclick', function(event) {
  event.notification.close()

  const navigationUrl = getNotificationNavigationUrl(event.notification.data)

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(clientList) {
        for (const client of clientList) {
          try {
            if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
              return client.focus().then(function() {
                return client.navigate(navigationUrl)
              })
            }
          } catch {
            // Ignore malformed client URLs from old browser state.
          }
        }

        if (clients.openWindow) {
          return clients.openWindow(navigationUrl)
        }
      })
  )
})

self.addEventListener('pushsubscriptionchange', function(event) {
  event.waitUntil(notifyClientsOfSubscriptionChange())
})
