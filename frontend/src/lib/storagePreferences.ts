import type { StateStorage } from 'zustand/middleware';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

type BrowserStorageKind = 'local' | 'session';

function getBrowserStorage(kind: BrowserStorageKind): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function readBrowserStorageItem(kind: BrowserStorageKind, key: string): string | null {
  try {
    return getBrowserStorage(kind)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeBrowserStorageItem(kind: BrowserStorageKind, key: string, value: string): boolean {
  try {
    const storage = getBrowserStorage(kind);
    if (!storage) {
      return false;
    }
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function removeBrowserStorageItem(kind: BrowserStorageKind, key: string): void {
  try {
    getBrowserStorage(kind)?.removeItem(key);
  } catch {
    // Browser storage can be unavailable in privacy-restricted browser contexts.
  }
}

export function readLocalStorageItem(key: string): string | null {
  return readBrowserStorageItem('local', key);
}

export function writeLocalStorageItem(key: string, value: string): boolean {
  return writeBrowserStorageItem('local', key, value);
}

export function removeLocalStorageItem(key: string): void {
  removeBrowserStorageItem('local', key);
}

export function readSessionStorageItem(key: string): string | null {
  return readBrowserStorageItem('session', key);
}

export function writeSessionStorageItem(key: string, value: string): boolean {
  return writeBrowserStorageItem('session', key, value);
}

export function removeSessionStorageItem(key: string): void {
  removeBrowserStorageItem('session', key);
}

export const safeLocalStateStorage: StateStorage = {
  getItem: readLocalStorageItem,
  setItem: writeLocalStorageItem,
  removeItem: removeLocalStorageItem,
};

export function parseJsonPreference<T>(
  raw: string | null,
  fallback: T,
  validator: (value: unknown) => T | null,
): T {
  if (!raw) return fallback;

  try {
    const parsed: unknown = JSON.parse(raw);
    return validator(parsed) ?? fallback;
  } catch {
    return fallback;
  }
}

// ─── Install nudge preferences ────────────────────────────────────────────────
// Namespace: `siteproof_install_nudge.*`
// These helpers track per-device app-open count and dismissal date so the
// install nudge can apply engagement gating (show after 2nd session) and
// re-show no sooner than 14 days after a dismiss.

const INSTALL_NUDGE_OPEN_COUNT_KEY = 'siteproof_install_nudge.open_count';
const INSTALL_NUDGE_DISMISSED_AT_KEY = 'siteproof_install_nudge.dismissed_at';

/** Returns the number of times the app has been opened on this device. */
export function readInstallNudgeOpenCount(): number {
  const raw = readLocalStorageItem(INSTALL_NUDGE_OPEN_COUNT_KEY);
  if (!raw) return 0;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Increments the open-count by 1 and persists it. */
export function incrementInstallNudgeOpenCount(): void {
  const next = readInstallNudgeOpenCount() + 1;
  writeLocalStorageItem(INSTALL_NUDGE_OPEN_COUNT_KEY, String(next));
}

/**
 * Returns the ISO timestamp (ms) when the user last dismissed the nudge,
 * or null if they have never dismissed it.
 */
export function readInstallNudgeDismissedAt(): number | null {
  const raw = readLocalStorageItem(INSTALL_NUDGE_DISMISSED_AT_KEY);
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Records the current time as the dismissal timestamp. */
export function writeInstallNudgeDismissedAt(): void {
  writeLocalStorageItem(INSTALL_NUDGE_DISMISSED_AT_KEY, String(Date.now()));
}
