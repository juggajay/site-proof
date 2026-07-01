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
import {
  getCompanyRole,
  getDashboardRole,
  hasSubcontractorPortalIdentity,
} from '@/lib/subcontractorIdentity';
import { isSubcontractorRole } from '@/lib/roles';
import { readLocalStorageItem, writeLocalStorageItem } from '@/lib/storagePreferences';

const FLAG_KEY = 'siteproof.shell.v2';
const MOBILE_QUERY = '(max-width: 767px)';
type ShellUser = Parameters<typeof getCompanyRole>[0];

/** Roles that get the shell with no flag set. */
const SHELL_DEFAULT_ROLES = new Set(['foreman']);

/**
 * Subbie shell default roles — the /p shell IS the subbie portal mobile
 * experience (owner-approved 2026-06-12). Both portal roles get it with no
 * flag set; `?shell=off` still reverts a device to the classic portal. Keep
 * this separate from SHELL_DEFAULT_ROLES — the two shells are PARALLEL
 * activations on a shared device (a subbie role can't get /m, an internal
 * role can't get /p), and the role check is the only thing keeping them apart.
 */
export const SUBBIE_SHELL_DEFAULT_ROLES: ReadonlySet<string> = new Set([
  'subcontractor',
  'subcontractor_admin',
]);

export type ShellOverride = 'on' | 'off' | null;

export function getShellOverrideFromSearch(search: string): ShellOverride | undefined {
  const param = new URLSearchParams(search).get('shell');
  if (param === 'v2') return 'on';
  if (param === 'off') return 'off';
  return undefined;
}

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
  const override = getShellOverrideFromSearch(window.location.search);
  if (override === 'on') {
    enableShellFlag();
  } else if (override === 'off') {
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

/**
 * Pure decision: should the SUBBIE shell (/p) be active for this role +
 * override state? The mirror of isShellActiveForRole, gated to the inverse
 * role set: only a subcontractor portal role can ever get the subbie shell.
 *
 * Reuses the SAME per-device override (`getShellOverride`, ?shell=v2/?shell=off)
 * as the foreman shell — on a shared device the role check is what separates
 * the two. Default-ON for both portal roles (SUBBIE_SHELL_DEFAULT_ROLES);
 * ?shell=off reverts a device to the classic portal.
 *
 * Exported for exhaustive unit testing.
 */
export function isSubbieShellActiveForRole(
  role: string | null | undefined,
  override: ShellOverride,
): boolean {
  if (!role || !isSubcontractorRole(role)) return false;
  if (override === 'on') return true;
  if (override === 'off') return false;
  return SUBBIE_SHELL_DEFAULT_ROLES.has(role);
}

function isMobileViewport(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia(MOBILE_QUERY).matches;
}

export function isForemanShellActiveForUser(user: ShellUser, override: ShellOverride): boolean {
  if (!user || hasSubcontractorPortalIdentity(user)) return false;
  const companyRole = getCompanyRole(user);
  if (isSubcontractorRole(companyRole)) return false;
  return isShellActiveForRole(getDashboardRole(user), override);
}

export function getActiveShellHomePath(
  user: ShellUser,
  options: { isMobile?: boolean; override?: ShellOverride } = {},
): '/m' | '/p' | null {
  const isMobile = options.isMobile ?? isMobileViewport();
  if (!isMobile || !user) return null;

  const override = options.override ?? getShellOverride();
  if (isForemanShellActiveForUser(user, override)) return '/m';
  if (isSubbieShellActiveForRole(getCompanyRole(user), override)) return '/p';
  return null;
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

  return getActiveShellHomePath(user, { isMobile, override }) === '/m';
}

/**
 * Returns true when the SUBBIE shell (/p) should render:
 *  - viewport is mobile-width
 *  - authenticated subcontractor portal role
 *  - and: forced on, OR (no override AND the role defaults to the subbie shell)
 *
 * Mirrors useShellV2Enabled exactly, including reading ?shell= on mount, so the
 * URL param is honoured on first render and a ?shell=off navigation disables it
 * without a full reload.
 */
export function useSubbieShellActive(): boolean {
  const isMobile = useIsMobile();
  const { user } = useAuth();

  const [override, setOverride] = useState<ShellOverride>(() => {
    applyShellFlagFromUrl();
    return getShellOverride();
  });

  useEffect(() => {
    setOverride(getShellOverride());
  }, []);

  return getActiveShellHomePath(user, { isMobile, override }) === '/p';
}
