import { devWarn } from './logger';
import { readSessionStorageItem, writeSessionStorageItem } from './storagePreferences';

const RECOVERY_ATTEMPT_KEY = 'siteproof:stale-asset-recovery-at';
const RECOVERY_ATTEMPT_WINDOW_MS = 60_000;
const STALE_ASSET_PATTERNS = [
  'Failed to fetch dynamically imported module',
  'Importing a module script failed',
  'error loading dynamically imported module',
  'CSS_CHUNK_LOAD_FAILED',
  'Loading chunk',
];

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  try {
    return JSON.stringify(error) || '';
  } catch {
    return '';
  }
}

export function isStaleAssetLoadError(error: unknown): boolean {
  const message = getErrorMessage(error);
  return STALE_ASSET_PATTERNS.some((pattern) =>
    message.toLowerCase().includes(pattern.toLowerCase()),
  );
}

function isAssetElement(target: EventTarget | null): boolean {
  if (target instanceof HTMLScriptElement) {
    return target.src.includes('/assets/');
  }

  if (target instanceof HTMLLinkElement) {
    return target.href.includes('/assets/') && target.rel.includes('stylesheet');
  }

  return false;
}

function shouldAttemptRecovery(): boolean {
  const lastAttempt = Number(readSessionStorageItem(RECOVERY_ATTEMPT_KEY) || '0');
  const now = Date.now();
  if (lastAttempt && now - lastAttempt < RECOVERY_ATTEMPT_WINDOW_MS) {
    return false;
  }

  writeSessionStorageItem(RECOVERY_ATTEMPT_KEY, String(now));
  return true;
}

async function clearServiceWorkerState(): Promise<void> {
  if ('caches' in window) {
    const names = await caches.keys();
    await Promise.all(names.map((name) => caches.delete(name)));
  }

  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }
}

export function recoverFromStaleAssetLoad(error?: unknown): boolean {
  if (!shouldAttemptRecovery()) {
    return false;
  }

  devWarn('Recovering from stale frontend asset after deployment', error);
  void clearServiceWorkerState().finally(() => {
    window.location.reload();
  });
  return true;
}

export function installStaleAssetRecovery(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.addEventListener(
    'error',
    (event) => {
      if (isAssetElement(event.target)) {
        recoverFromStaleAssetLoad(event.error ?? event.message);
      }
    },
    true,
  );

  window.addEventListener('unhandledrejection', (event) => {
    if (isStaleAssetLoadError(event.reason)) {
      recoverFromStaleAssetLoad(event.reason);
    }
  });
}
