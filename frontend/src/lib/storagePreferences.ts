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
