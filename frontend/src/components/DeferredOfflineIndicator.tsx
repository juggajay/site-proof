import { useEffect, useState, type ComponentType } from 'react';

type OfflineIndicatorComponent = ComponentType;

type IdleWindow = Window & {
  requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
  cancelIdleCallback?: (handle: number) => void;
};

let offlineIndicatorPromise: Promise<OfflineIndicatorComponent> | null = null;

function loadOfflineIndicator(): Promise<OfflineIndicatorComponent> {
  offlineIndicatorPromise ??= import('./OfflineIndicator').then(
    (module) => module.OfflineIndicator,
  );
  return offlineIndicatorPromise;
}

export function DeferredOfflineIndicator() {
  const [OfflineIndicator, setOfflineIndicator] = useState<OfflineIndicatorComponent | null>(null);

  useEffect(() => {
    if (OfflineIndicator) {
      return;
    }

    let cancelled = false;
    let idleHandle: number | undefined;
    let timeoutHandle: number | undefined;
    const idleWindow = window as IdleWindow;

    const load = () => {
      loadOfflineIndicator().then((Component) => {
        if (!cancelled) {
          setOfflineIndicator(() => Component);
        }
      });
    };

    if (!navigator.onLine) {
      load();
      return () => {
        cancelled = true;
      };
    }

    window.addEventListener('offline', load, { once: true });

    if (idleWindow.requestIdleCallback) {
      idleHandle = idleWindow.requestIdleCallback(load, { timeout: 4000 });
    } else {
      timeoutHandle = window.setTimeout(load, 1500);
    }

    return () => {
      cancelled = true;
      window.removeEventListener('offline', load);
      if (idleHandle !== undefined) {
        idleWindow.cancelIdleCallback?.(idleHandle);
      }
      if (timeoutHandle !== undefined) {
        window.clearTimeout(timeoutHandle);
      }
    };
  }, [OfflineIndicator]);

  return OfflineIndicator ? <OfflineIndicator /> : null;
}
