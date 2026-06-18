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
  getShellOverride,
  isShellActiveForRole,
  isSubbieShellActiveForRole,
  isForemanShellActiveForUser,
  getActiveShellHomePath,
  SUBBIE_SHELL_DEFAULT_ROLES,
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

  // Behavior re-pin (foreman-default change): disable is now an EXPLICIT '0'
  // (an opt-out that overrides the foreman role default), not a key removal.
  it('disableShellFlag stores an explicit off override', () => {
    enableShellFlag();
    disableShellFlag();
    expect(isShellFlagSet()).toBe(false);
    expect(readLocalStorageItem(FLAG_KEY)).toBe('0');
    expect(getShellOverride()).toBe('off');
  });

  it('toggles correctly', () => {
    enableShellFlag();
    expect(isShellFlagSet()).toBe(true);
    disableShellFlag();
    expect(isShellFlagSet()).toBe(false);
  });

  it('getShellOverride is tri-state: null when unset', () => {
    expect(getShellOverride()).toBeNull();
    enableShellFlag();
    expect(getShellOverride()).toBe('on');
  });
});

describe('isShellActiveForRole (foreman default, owner decision 2026-06-12)', () => {
  it('foreman with no override: ON by default', () => {
    expect(isShellActiveForRole('foreman', null)).toBe(true);
  });

  it('foreman with explicit off override: OFF (the escape hatch)', () => {
    expect(isShellActiveForRole('foreman', 'off')).toBe(false);
  });

  it('other internal roles with no override: OFF (opt-in only)', () => {
    for (const role of ['owner', 'admin', 'project_manager', 'site_manager', 'quality_manager']) {
      expect(isShellActiveForRole(role, null)).toBe(false);
    }
  });

  it('other internal roles forced on: ON', () => {
    expect(isShellActiveForRole('owner', 'on')).toBe(true);
    expect(isShellActiveForRole('site_manager', 'on')).toBe(true);
  });

  it('subcontractor roles: NEVER, regardless of override', () => {
    expect(isShellActiveForRole('subcontractor', 'on')).toBe(false);
    expect(isShellActiveForRole('subcontractor_admin', 'on')).toBe(false);
    expect(isShellActiveForRole('subcontractor', null)).toBe(false);
  });

  it('no role: never', () => {
    expect(isShellActiveForRole(null, 'on')).toBe(false);
    expect(isShellActiveForRole(undefined, null)).toBe(false);
  });
});

describe('isSubbieShellActiveForRole (default-ON for portal roles)', () => {
  it('SUBBIE_SHELL_DEFAULT_ROLES is exactly the two portal roles', () => {
    expect([...SUBBIE_SHELL_DEFAULT_ROLES].sort()).toEqual([
      'subcontractor',
      'subcontractor_admin',
    ]);
  });

  // Full role × override matrix.
  const subbieRoles = ['subcontractor', 'subcontractor_admin'];
  const internalRoles = [
    'owner',
    'admin',
    'project_manager',
    'site_manager',
    'quality_manager',
    'site_engineer',
    'foreman',
  ];

  it('subbie roles with no override: ON by default (the shell IS the portal)', () => {
    for (const role of subbieRoles) {
      expect(isSubbieShellActiveForRole(role, null)).toBe(true);
    }
  });

  it('subbie roles forced on (?shell=v2): ON', () => {
    for (const role of subbieRoles) {
      expect(isSubbieShellActiveForRole(role, 'on')).toBe(true);
    }
  });

  it('subbie roles forced off (?shell=off): OFF (escape hatch)', () => {
    for (const role of subbieRoles) {
      expect(isSubbieShellActiveForRole(role, 'off')).toBe(false);
    }
  });

  it('internal (non-subbie) roles: NEVER, regardless of override', () => {
    for (const role of internalRoles) {
      expect(isSubbieShellActiveForRole(role, 'on')).toBe(false);
      expect(isSubbieShellActiveForRole(role, 'off')).toBe(false);
      expect(isSubbieShellActiveForRole(role, null)).toBe(false);
    }
  });

  it('no role: never', () => {
    expect(isSubbieShellActiveForRole(null, 'on')).toBe(false);
    expect(isSubbieShellActiveForRole(undefined, null)).toBe(false);
    expect(isSubbieShellActiveForRole('', 'on')).toBe(false);
  });

  it('the foreman and subbie role gates are mutually exclusive', () => {
    // No single role is active in BOTH shells for any override — the guard that
    // keeps /m and /p from bleeding into each other on a shared device.
    const allRoles = [...subbieRoles, ...internalRoles, 'viewer', 'member'];
    for (const role of allRoles) {
      for (const override of ['on', 'off', null] as const) {
        const foreman = isShellActiveForRole(role, override);
        const subbie = isSubbieShellActiveForRole(role, override);
        expect(foreman && subbie).toBe(false);
      }
    }
  });
});

describe('active shell home path', () => {
  it('routes a mobile subcontractor portal user to the subbie shell by default', () => {
    expect(
      getActiveShellHomePath(
        {
          role: 'subcontractor',
          roleInCompany: 'subcontractor',
          companyId: null,
          hasSubcontractorPortalAccess: true,
        },
        { isMobile: true, override: null },
      ),
    ).toBe('/p');
  });

  it('routes a mobile company foreman to the foreman shell by default', () => {
    expect(
      getActiveShellHomePath(
        {
          role: 'foreman',
          roleInCompany: 'foreman',
          companyId: 'company-1',
        },
        { isMobile: true, override: null },
      ),
    ).toBe('/m');
  });

  it('uses dashboardRole for project-scoped foreman shell defaults', () => {
    const projectForeman = {
      role: 'member',
      roleInCompany: 'member',
      dashboardRole: 'foreman' as const,
      companyId: 'company-1',
    };

    expect(isForemanShellActiveForUser(projectForeman, null)).toBe(true);
    expect(getActiveShellHomePath(projectForeman, { isMobile: true, override: null })).toBe('/m');
  });

  it('does not let subcontractor portal users borrow dashboardRole into the foreman shell', () => {
    const portalUserWithDashboardRole = {
      role: 'subcontractor',
      roleInCompany: 'subcontractor',
      dashboardRole: 'foreman' as const,
      companyId: null,
      hasSubcontractorPortalAccess: true,
    };

    expect(isForemanShellActiveForUser(portalUserWithDashboardRole, null)).toBe(false);
    expect(
      getActiveShellHomePath(portalUserWithDashboardRole, { isMobile: true, override: null }),
    ).toBe('/p');
  });

  it('returns no shell path on desktop even when the role defaults to a shell', () => {
    expect(
      getActiveShellHomePath(
        {
          role: 'foreman',
          roleInCompany: 'foreman',
          companyId: 'company-1',
        },
        { isMobile: false, override: null },
      ),
    ).toBeNull();
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
