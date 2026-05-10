import {
  readLocalStorageItem,
  readSessionStorageItem,
  removeLocalStorageItem,
  removeSessionStorageItem,
  writeLocalStorageItem,
  writeSessionStorageItem,
} from './storagePreferences';

export const AUTH_STORAGE_KEY = 'siteproof_auth';
export const REMEMBER_ME_KEY = 'siteproof_remember_me';
export const OFFLINE_OWNER_STORAGE_KEY = 'siteproof_offline_owner_id';
export const AUTH_SESSION_EXPIRED_EVENT = 'siteproof:session-expired';

export type AuthStorageKind = 'local' | 'session';

export interface StoredAuthPayload {
  source: AuthStorageKind;
  value: string;
}

export function getAuthStorageKind(): AuthStorageKind {
  return readLocalStorageItem(REMEMBER_ME_KEY) === 'true' ? 'local' : 'session';
}

export function readAuthFromStorage(): StoredAuthPayload | null {
  const localAuth = readLocalStorageItem(AUTH_STORAGE_KEY);
  if (localAuth) {
    return { source: 'local', value: localAuth };
  }

  const sessionAuth = readSessionStorageItem(AUTH_STORAGE_KEY);
  if (sessionAuth) {
    return { source: 'session', value: sessionAuth };
  }

  return null;
}

export function writeAuthToStorage(source: AuthStorageKind, value: string): boolean {
  return source === 'local'
    ? writeLocalStorageItem(AUTH_STORAGE_KEY, value)
    : writeSessionStorageItem(AUTH_STORAGE_KEY, value);
}

export function writeRememberMePreference(rememberMe: boolean): boolean {
  if (!rememberMe) {
    removeLocalStorageItem(REMEMBER_ME_KEY);
    return true;
  }

  return writeLocalStorageItem(REMEMBER_ME_KEY, 'true');
}

// Helper to clear auth from both storages (including any orphaned keys)
export function clearAuthFromAllStorages() {
  removeLocalStorageItem(AUTH_STORAGE_KEY);
  removeSessionStorageItem(AUTH_STORAGE_KEY);
  removeLocalStorageItem(REMEMBER_ME_KEY);
  // Clean up orphaned token keys from older code paths
  removeLocalStorageItem('auth_token');
  removeLocalStorageItem('refresh_token');
  removeSessionStorageItem('auth_token');
  removeSessionStorageItem('refresh_token');
}

export function notifySessionExpired() {
  clearAuthFromAllStorages();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AUTH_SESSION_EXPIRED_EVENT));
  }
}

export function getOfflineOwnerId(): string | null {
  return readLocalStorageItem(OFFLINE_OWNER_STORAGE_KEY);
}

export function setOfflineOwnerId(userId: string) {
  writeLocalStorageItem(OFFLINE_OWNER_STORAGE_KEY, userId);
}

export function clearOfflineOwnerId() {
  removeLocalStorageItem(OFFLINE_OWNER_STORAGE_KEY);
}
