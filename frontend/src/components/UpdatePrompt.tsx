// UpdatePrompt — shown when a new service worker version is waiting.
//
// Uses `registerType: 'prompt'` (vite.config.ts) so the SW never reloads the
// app automatically while a foreman is mid-form.  The banner appears above the
// bottom nav (`.above-bottom-nav`) and is dismissible.
//
// Periodic update checks are set up in `onRegisteredSW`:
//   • Every 60 minutes via `setInterval`.
//   • On `window focus` via an event listener.
// Both use a ref so the cleanup effect can clear them on unmount.

import { useEffect, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';

const UPDATE_INTERVAL_MS = 60 * 60 * 1000; // 60 minutes

export function UpdatePrompt() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const focusHandlerRef = useRef<(() => void) | null>(null);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;

      const doUpdate = () => {
        registration.update().catch(() => {
          // update() can reject if the network is offline — ignore silently.
        });
      };

      // Store interval handle so the cleanup effect can clear it.
      intervalRef.current = setInterval(doUpdate, UPDATE_INTERVAL_MS);

      // Check on window focus so a backgrounded tab picks up a new build
      // promptly when the foreman brings the app back into view.
      focusHandlerRef.current = doUpdate;
      window.addEventListener('focus', doUpdate);
    },
  });

  // Clean up the interval and focus listener when the component unmounts.
  useEffect(() => {
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (focusHandlerRef.current !== null) {
        window.removeEventListener('focus', focusHandlerRef.current);
        focusHandlerRef.current = null;
      }
    };
  }, []);

  const handleDismiss = () => setNeedRefresh(false);

  if (!needRefresh) {
    return null;
  }

  return (
    /* above-bottom-nav keeps the banner clear of the mobile bottom nav
       (height published by usePublishBottomNavHeight) and device safe-area
       inset.  The banner is fixed to the right side, matching OfflineIndicator. */
    <div
      role="status"
      aria-live="polite"
      className="fixed right-4 z-50 above-bottom-nav flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-lg shadow-lg border border-primary/20"
    >
      <RefreshCw className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
      <span className="text-sm font-medium">A new version of SiteProof is available</span>
      <button
        onClick={() => void updateServiceWorker(true)}
        className="ml-1 text-xs bg-primary/20 hover:bg-primary/30 transition-colors px-2 py-0.5 rounded font-medium"
        aria-label="Apply update and reload"
      >
        Update
      </button>
      <button
        onClick={handleDismiss}
        className="ml-1 hover:bg-primary/20 rounded p-0.5 transition-colors"
        aria-label="Dismiss update notification"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
