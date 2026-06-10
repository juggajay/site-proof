// Tests for the vite:preloadError handler added by PR-A.
//
// The existing asset-error and unhandledrejection paths are exercised
// indirectly (they share `recoverFromStaleAssetLoad`), so this file focuses on
// the new `vite:preloadError` branch and its reload-once loop guard.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock storagePreferences so tests control the session-storage flag.
const { readItem, writeItem } = vi.hoisted(() => ({
  readItem: vi.fn(),
  writeItem: vi.fn(),
}));

vi.mock('@/lib/storagePreferences', () => ({
  readSessionStorageItem: readItem,
  writeSessionStorageItem: writeItem,
}));

// Suppress devWarn noise during tests.
vi.mock('@/lib/logger', () => ({
  devWarn: vi.fn(),
}));

// We can't easily mock window.location.reload in jsdom without a special
// wrapper, so we spy on it via Object.defineProperty.
let reloadSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  reloadSpy = vi.fn();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, reload: reloadSpy },
  });

  // Reset storage mock: no prior attempt recorded.
  readItem.mockReturnValue(null);
  writeItem.mockReturnValue(true);

  // Flush any cached module state by re-importing fresh.
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function freshInstall() {
  const { installStaleAssetRecovery } = await import('./staleAssetRecovery');
  installStaleAssetRecovery();
}

describe('vite:preloadError handler', () => {
  it('triggers a reload on first vite:preloadError event', async () => {
    await freshInstall();

    // VitePreloadErrorEvent extends plain Event and has .payload; we dispatch
    // a plain CustomEvent here — the handler only calls recoverFromStaleAssetLoad
    // with the payload, which is not type-checked at runtime.
    const evt = Object.assign(new Event('vite:preloadError'), {
      payload: new Error('chunk 404'),
    });
    window.dispatchEvent(evt);

    // reload is called inside clearServiceWorkerState().finally(); give the
    // microtask queue a chance to settle.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(writeItem).toHaveBeenCalled();
    // In jsdom the reload mock is invoked inside the Promise finally() after
    // caches.keys() / getRegistrations() resolve.
    expect(reloadSpy).toHaveBeenCalled();
  });

  it('does NOT reload on a second vite:preloadError within the guard window', async () => {
    // Simulate that a recovery was already attempted recently.
    readItem.mockReturnValue(String(Date.now()));

    await freshInstall();

    const evt = Object.assign(new Event('vite:preloadError'), {
      payload: new Error('chunk 404'),
    });
    window.dispatchEvent(evt);

    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    // writeItem should not be called again (guard rejected the attempt).
    expect(writeItem).not.toHaveBeenCalled();
    expect(reloadSpy).not.toHaveBeenCalled();
  });
});
