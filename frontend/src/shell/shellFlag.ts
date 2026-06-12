/**
 * shellFlag.ts — activation logic for foremanShellV2
 *
 * The shell is the DEFAULT mobile experience for the foreman role (owner
 * decision 2026-06-12). For other internal roles it remains opt-in, because
 * the shell intentionally has no office surfaces (claims, costs, settings).
 *
 * Per-device override, tri-state in localStorage:
 *   '1'    — forced ON  (visit ?shell=v2)
 *   '0'    — forced OFF (visit ?shell=off — the escape hatch)
 *   absent — role default: foreman → ON, everyone else → OFF
 *
 * Active only when (regardless of override):
 *   1. useIsMobile() is true (viewport < 768 px)
 *   2. The user is authenticated AND has an internal (non-subcontractor) role
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
import { readLocalStorageItem, writeLocalStorageItem } from '@/lib/storagePreferences';

const FLAG_KEY = 'siteproof.shell.v2';

/** Roles that get the shell with no flag set. */
const SHELL_DEFAULT_ROLES = new Set(['foreman']);

export type ShellOverride = 'on' | 'off' | null;

// ── persistence helpers ──────────────────────────────────────────────────────

/** Returns the per-device override: forced on, forced off, or none. */
export function getShellOverride(): ShellOverride {
  const raw = readLocalStorageItem(FLAG_KEY);
  if (raw === '1') return 'on';
  if (raw === '0') return 'off';
  return null;
}

/** Back-compat helper (older tests/callers): true when forced ON. */
export function isShellFlagSet(): boolean {
  return getShellOverride() === 'on';
}

/** Forces the shell ON for this device. */
export function enableShellFlag(): void {
  writeLocalStorageItem(FLAG_KEY, '1');
}

/**
 * Forces the shell OFF for this device — an explicit opt-out that also
 * overrides the foreman role default (this is the escape hatch).
 */
export function disableShellFlag(): void {
  writeLocalStorageItem(FLAG_KEY, '0');
}

/**
 * Reads the ?shell= query param on the current URL and applies it:
 *   ?shell=v2  → force on
 *   ?shell=off → force off (overrides the foreman default)
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

/**
 * Pure decision: should the shell be active for this role + override state?
 * Exported for exhaustive unit testing.
 */
export function isShellActiveForRole(
  role: string | null | undefined,
  override: ShellOverride,
): boolean {
  if (!role || isSubcontractorRole(role)) return false;
  if (override === 'on') return true;
  if (override === 'off') return false;
  return SHELL_DEFAULT_ROLES.has(role);
}

// ── react hook ───────────────────────────────────────────────────────────────

/**
 * Returns true when the shell should render:
 *  - viewport is mobile-width
 *  - authenticated internal (non-subcontractor) role
 *  - and: forced on, OR (no override AND the role defaults to the shell)
 *
 * Also reads ?shell= on mount so the URL param is honoured on first render.
 */
export function useShellV2Enabled(): boolean {
  const isMobile = useIsMobile();
  const { user } = useAuth();

  // Sync the URL param on mount, then track the override reactively so a
  // ?shell=off navigation immediately disables the shell without a full reload.
  const [override, setOverride] = useState<ShellOverride>(() => {
    applyShellFlagFromUrl();
    return getShellOverride();
  });

  useEffect(() => {
    // Re-read after the URL param has been applied (runs once on mount).
    setOverride(getShellOverride());
  }, []);

  if (!isMobile || !user) return false;

  return isShellActiveForRole(getCompanyRole(user), override);
}
