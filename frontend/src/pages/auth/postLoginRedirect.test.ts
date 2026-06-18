import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { disableShellFlag } from '@/shell/shellFlag';
import { removeLocalStorageItem } from '@/lib/storagePreferences';
import {
  getDefaultPostLoginRedirect,
  getPostLoginRedirect,
  mapLegacyRedirectToActiveShell,
  type RedirectUser,
} from './postLoginRedirect';

const FLAG_KEY = 'siteproof.shell.v2';
let mobileViewport = true;

function setMobileViewport(isMobile: boolean) {
  mobileViewport = isMobile;
}

beforeEach(() => {
  removeLocalStorageItem(FLAG_KEY);
  setMobileViewport(true);
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: mobileViewport,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

afterEach(() => {
  removeLocalStorageItem(FLAG_KEY);
  vi.restoreAllMocks();
});

const subbieUser: RedirectUser = {
  role: 'subcontractor',
  roleInCompany: 'subcontractor',
  companyId: null,
  hasSubcontractorPortalAccess: true,
};

const foremanUser: RedirectUser = {
  role: 'foreman',
  roleInCompany: 'foreman',
  companyId: 'company-1',
};

const projectScopedForeman: RedirectUser = {
  role: 'member',
  roleInCompany: 'member',
  dashboardRole: 'foreman',
  companyId: 'company-1',
};

describe('post-login shell redirects', () => {
  it('lands mobile subcontractor portal users directly in the subbie shell', () => {
    expect(getDefaultPostLoginRedirect(subbieUser)).toBe('/p');
  });

  it('keeps desktop subcontractor portal users on the classic portal', () => {
    setMobileViewport(false);
    expect(getDefaultPostLoginRedirect(subbieUser)).toBe('/subcontractor-portal');
  });

  it('maps legacy subcontractor portal redirects to the matching subbie shell route', () => {
    expect(
      mapLegacyRedirectToActiveShell('/subcontractor-portal/work?projectId=project-1', subbieUser),
    ).toBe('/p/work?projectId=project-1');

    expect(
      mapLegacyRedirectToActiveShell('/subcontractor-portal/docket/docket-1', subbieUser),
    ).toBe('/p/docket/docket-1');

    expect(mapLegacyRedirectToActiveShell('/subcontractor-portal/lots/lot-1/itp', subbieUser)).toBe(
      '/p/lots/lot-1/itp',
    );
  });

  it('lands mobile foreman users directly in the foreman shell', () => {
    expect(getDefaultPostLoginRedirect(foremanUser)).toBe('/m');
    expect(getDefaultPostLoginRedirect(projectScopedForeman)).toBe('/m');
  });

  it('maps the legacy dashboard and old foreman mobile route to the foreman shell', () => {
    expect(mapLegacyRedirectToActiveShell('/dashboard', foremanUser)).toBe('/m');
    expect(mapLegacyRedirectToActiveShell('/projects/project-1/foreman/today', foremanUser)).toBe(
      '/m',
    );
  });

  it('keeps classic redirects when the shell is explicitly disabled on the device', () => {
    disableShellFlag();

    expect(getDefaultPostLoginRedirect(subbieUser)).toBe('/subcontractor-portal');
    expect(getDefaultPostLoginRedirect(foremanUser)).toBe('/dashboard');
  });

  it('uses a safe requested redirect and shell-maps it before navigating', () => {
    const searchParams = new URLSearchParams({ redirect: '/subcontractor-portal/dockets' });

    expect(getPostLoginRedirect(searchParams, null, subbieUser)).toBe('/p/dockets');
  });

  it('ignores unsafe external redirect parameters', () => {
    const searchParams = new URLSearchParams({ redirect: '//evil.example.com' });

    expect(getPostLoginRedirect(searchParams, null, foremanUser)).toBe('/m');
  });
});
