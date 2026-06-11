/**
 * shellFlag.ts — feature flag for foremanShellV2
 *
 * Enable:  visit ?shell=v2  (persists to localStorage)
 * Disable: visit ?shell=off (removes the flag)
 *
 * Active only when:
 *   1. The flag bit is set
 *   2. useIsMobile() is true (viewport < 768 px)
 *   3. The user is authenticated AND has an internal (non-subcontractor) role
 *
 * Design consequence (foreman profile §Design consequences):
 * The shell never surfaces to subcontractors — the same URL space must not bleed
 * into their portal.
 */

import { useEffect, useState } from 'react';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { useAuth } from '@/lib/auth';
import { getCompanyRole } from '@/lib/subcontractorIdentity';
import { isSubcontractorRole } from '@/lib/roles';
import {
  readLocalStorageItem,
  writeLocalStorageItem,
  removeLocalStorageItem,
} from '@/lib/storagePreferences';

const FLAG_KEY = 'siteproof.shell.v2';

// ── persistence helpers ──────────────────────────────────────────────────────

/** Returns whether the flag bit is currently set. */
export function isShellFlagSet(): boolean {
  return readLocalStorageItem(FLAG_KEY) === '1';
}

/** Sets the flag bit. */
export function enableShellFlag(): void {
  writeLocalStorageItem(FLAG_KEY, '1');
}

/** Clears the flag bit. */
export function disableShellFlag(): void {
  removeLocalStorageItem(FLAG_KEY);
}

/**
 * Reads the ?shell= query param on the current URL and applies it:
 *   ?shell=v2  → enable
 *   ?shell=off → disable
 * Call this once at startup (e.g. in main.tsx or inside App).
 */
export function applyShellFlagFromUrl(): void {
  if (typeof window === 'undefined') return;
  const param = new URLSearchParams(window.location.search).get('shell');
  if (param === 'v2') {
    enableShellFlag();
  } else if (param === 'off') {
    disableShellFlag();
  }
}

// ── react hook ───────────────────────────────────────────────────────────────

/**
 * Returns true when all three activation conditions are met:
 *  - feature flag persisted in localStorage
 *  - viewport is mobile-width
 *  - authenticated user is an internal (non-subcontractor) role
 *
 * Also reads ?shell= on mount so the URL param is honoured on first render.
 */
export function useShellV2Enabled(): boolean {
  const isMobile = useIsMobile();
  const { user } = useAuth();

  // Sync the URL param on mount, then track the flag bit reactively so a
  // ?shell=off navigation immediately disables the shell without a full reload.
  const [flagSet, setFlagSet] = useState<boolean>(() => {
    applyShellFlagFromUrl();
    return isShellFlagSet();
  });

  useEffect(() => {
    // Re-read after the URL param has been applied (runs once on mount).
    setFlagSet(isShellFlagSet());
  }, []);

  if (!flagSet || !isMobile) return false;
  if (!user) return false;

  const role = getCompanyRole(user);
  // Must be authenticated AND internal (not subcontractor / subcontractor_admin)
  if (!role || isSubcontractorRole(role)) return false;

  return true;
}
