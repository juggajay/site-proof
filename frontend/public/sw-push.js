// Service Worker for Push Notifications
// This file is loaded by VitePWA's service worker

self.addEventListener('push', function(event) {
  console.log('[SW] Push received:', event)

  if (!event.data) {
    console.log('[SW] Push event has no data')
    return
  }

  let data
  try {
    data = event.data.json()
  } catch (e) {
    data = {
      title: 'SiteProof Notification',
      body: event.data.text()
    }
  }

  const options = {
    body: data.body || 'You have a new notification',
    icon: data.icon || '/pwa-192x192.png',
    badge: data.badge || '/pwa-192x192.png',
    tag: data.tag || 'siteproof-notification',
    renotify: true,
    requireInteraction: data.requireInteraction || false,
    data: data.data || {},
    actions: data.actions || []
  }

  // Add vibration pattern for mobile
  if ('vibrate' in navigator) {
    options.vibrate = [100, 50, 100]
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'SiteProof', options)
  )
})

self.addEventListener('notificationclick', function(event) {
  console.log('[SW] Notification click:', event.notification.tag)

  event.notification.close()

  // Get the URL to open from the notification data
  const url = event.notification.data?.url || '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(clientList) {
        // Check if there's already a window/tab open
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            // Focus the existing window and navigate
            return client.focus().then(function() {
              return client.navigate(url)
            })
          }
        }
        // Open a new window
        if (clients.openWindow) {
          return clients.openWindow(url)
        }
      })
  )
})

self.addEventListener('notificationclose', function(event) {
  console.log('[SW] Notification dismissed:', event.notification.tag)
})

// Handle push subscription change (e.g., browser refreshes subscription)
self.addEventListener('pushsubscriptionchange', function(event) {
  console.log('[SW] Push subscription changed')

  event.waitUntil(
    // Re-subscribe with new subscription
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      // Note: applicationServerKey should be stored/retrieved properly
      // This is a fallback - the main subscription logic is in the app
    }).then(function(subscription) {
      // The app will need to send this new subscription to the server
      console.log('[SW] Re-subscribed to push')
    }).catch(function(error) {
      console.error('[SW] Failed to re-subscribe:', error)
    })
  )
})

console.log('[SW] Push notification service worker loaded')
