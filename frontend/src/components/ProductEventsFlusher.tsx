import { useEffect } from 'react';
import { flushProductEvents } from '@/lib/productEvents';

const FLUSH_INTERVAL_MS = 10_000;

/**
 * Mounts the product-events flusher for office surfaces only (rendered inside
 * ProtectedAppShell, alongside ClancyWidget). Field shells (/m/*, /p/*) don't
 * mount this, so they never flush telemetry. Renders nothing.
 */
export function ProductEventsFlusher() {
  useEffect(() => {
    const interval = window.setInterval(() => void flushProductEvents(), FLUSH_INTERVAL_MS);

    const flushKeepalive = () => void flushProductEvents(true);
    const flushOnHide = () => {
      if (document.visibilityState === 'hidden') {
        flushKeepalive();
      }
    };
    // pagehide is the reliable "page going away" signal on mobile Safari where
    // unload never fires; visibilitychange covers tab switches / app backgrounding.
    window.addEventListener('pagehide', flushKeepalive);
    document.addEventListener('visibilitychange', flushOnHide);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('pagehide', flushKeepalive);
      document.removeEventListener('visibilitychange', flushOnHide);
      flushKeepalive();
    };
  }, []);

  return null;
}
