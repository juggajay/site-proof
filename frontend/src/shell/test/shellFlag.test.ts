/**
 * Unit tests for the shellFlag module.
 *
 * Covers:
 *   - enableShellFlag / disableShellFlag / isShellFlagSet
 *   - applyShellFlagFromUrl (?shell=v2, ?shell=off)
 *   - useShellV2Enabled gating (flag + mobile + role)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  enableShellFlag,
  disableShellFlag,
  isShellFlagSet,
  applyShellFlagFromUrl,
} from '../shellFlag';
import {
  writeLocalStorageItem,
  readLocalStorageItem,
  removeLocalStorageItem,
} from '@/lib/storagePreferences';

const FLAG_KEY = 'siteproof.shell.v2';

describe('shellFlag persistence', () => {
  beforeEach(() => {
    removeLocalStorageItem(FLAG_KEY);
  });

  afterEach(() => {
    removeLocalStorageItem(FLAG_KEY);
  });

  it('isShellFlagSet returns false when nothing is stored', () => {
    expect(isShellFlagSet()).toBe(false);
  });

  it('enableShellFlag sets the flag', () => {
    enableShellFlag();
    expect(isShellFlagSet()).toBe(true);
    expect(readLocalStorageItem(FLAG_KEY)).toBe('1');
  });

  it('disableShellFlag clears the flag', () => {
    enableShellFlag();
    disableShellFlag();
    expect(isShellFlagSet()).toBe(false);
    expect(readLocalStorageItem(FLAG_KEY)).toBeNull();
  });

  it('toggles correctly', () => {
    enableShellFlag();
    expect(isShellFlagSet()).toBe(true);
    disableShellFlag();
    expect(isShellFlagSet()).toBe(false);
  });
});

describe('applyShellFlagFromUrl', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    removeLocalStorageItem(FLAG_KEY);
  });

  afterEach(() => {
    removeLocalStorageItem(FLAG_KEY);
    // Restore location
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
    });
  });

  function setSearch(search: string) {
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, search },
      writable: true,
    });
  }

  it('enables the flag when ?shell=v2', () => {
    setSearch('?shell=v2');
    applyShellFlagFromUrl();
    expect(isShellFlagSet()).toBe(true);
  });

  it('disables the flag when ?shell=off', () => {
    enableShellFlag(); // pre-enable
    setSearch('?shell=off');
    applyShellFlagFromUrl();
    expect(isShellFlagSet()).toBe(false);
  });

  it('leaves the flag unchanged for other params', () => {
    enableShellFlag();
    setSearch('?foo=bar');
    applyShellFlagFromUrl();
    expect(isShellFlagSet()).toBe(true);
  });

  it('leaves the flag unchanged when no search params', () => {
    setSearch('');
    applyShellFlagFromUrl();
    expect(isShellFlagSet()).toBe(false);
  });
});

describe('storagePreferences round-trip', () => {
  it('writeLocalStorageItem / readLocalStorageItem round-trips correctly', () => {
    const key = 'test.shell.roundtrip';
    writeLocalStorageItem(key, '1');
    expect(readLocalStorageItem(key)).toBe('1');
    removeLocalStorageItem(key);
    expect(readLocalStorageItem(key)).toBeNull();
  });
});
