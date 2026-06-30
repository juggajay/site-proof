import { getActiveShellHomePath } from '@/shell/shellFlag';
import { getSubbieShellPathForClassicPath } from '@/shell/subbieShellRoutes';
import { hasSubcontractorPortalIdentity, type DashboardRole } from '@/lib/subcontractorIdentity';

export type RedirectUser = {
  role?: string;
  roleInCompany?: string;
  dashboardRole?: DashboardRole | null;
  companyId?: string | null;
  hasSubcontractorPortalAccess?: boolean;
};

export function getSafeRedirectPath(redirect: string | null): string | null {
  if (!redirect || !redirect.startsWith('/') || redirect.startsWith('//')) {
    return null;
  }
  return redirect;
}

function getSafeLocationRedirect(from: unknown): string | null {
  if (!from || typeof from !== 'object') return null;

  const location = from as { pathname?: unknown; search?: unknown; hash?: unknown };
  if (typeof location.pathname !== 'string') return null;
  if (!location.pathname.startsWith('/') || location.pathname.startsWith('//')) return null;

  const search =
    typeof location.search === 'string' && location.search.startsWith('?') ? location.search : '';
  const hash =
    typeof location.hash === 'string' && location.hash.startsWith('#') ? location.hash : '';

  return `${location.pathname}${search}${hash}`;
}

export function getRequestedPostLoginRedirect(
  searchParams: URLSearchParams,
  locationState: unknown,
): string | null {
  return (
    getSafeRedirectPath(searchParams.get('redirect')) ||
    getSafeLocationRedirect((locationState as { from?: unknown } | null)?.from)
  );
}

function getRedirectPathname(redirect: string): string {
  return new URL(redirect, 'https://siteproof.local').pathname;
}

function mapLegacySubbiePortalPath(pathname: string): string | null {
  if (pathname === '/' || pathname === '/dashboard') {
    return '/p';
  }

  return getSubbieShellPathForClassicPath(pathname);
}

function mapLegacyForemanPath(pathname: string): string | null {
  if (pathname === '/' || pathname === '/dashboard') return '/m';
  if (/^\/projects\/[^/]+\/foreman(?:\/.*)?$/.test(pathname)) return '/m';
  return null;
}

function preserveSearchAndHash(redirect: string, targetPath: string): string {
  const url = new URL(redirect, 'https://siteproof.local');
  return `${targetPath}${url.search}${url.hash}`;
}

export function mapLegacyRedirectToActiveShell(redirect: string, user: RedirectUser): string {
  const shellHome = getActiveShellHomePath(user);
  if (!shellHome) return redirect;

  const pathname = getRedirectPathname(redirect);
  const mappedPath =
    shellHome === '/p' ? mapLegacySubbiePortalPath(pathname) : mapLegacyForemanPath(pathname);

  return mappedPath ? preserveSearchAndHash(redirect, mappedPath) : redirect;
}

export function getDefaultPostLoginRedirect(user: RedirectUser): string {
  return (
    getActiveShellHomePath(user) ??
    (hasSubcontractorPortalIdentity(user) ? '/subcontractor-portal' : '/dashboard')
  );
}

function isAllowedPostLoginRedirect(redirect: string, user: RedirectUser): boolean {
  if (redirect.startsWith('/subcontractor-portal/accept-invite')) {
    return true;
  }

  if (redirect === '/subcontractor-portal' || redirect.startsWith('/subcontractor-portal/')) {
    return hasSubcontractorPortalIdentity(user);
  }

  if (redirect === '/p' || redirect.startsWith('/p/')) {
    return hasSubcontractorPortalIdentity(user);
  }

  if (redirect === '/m' || redirect.startsWith('/m/')) {
    return getActiveShellHomePath(user) === '/m';
  }

  return true;
}

export function getPostLoginRedirect(
  searchParams: URLSearchParams,
  locationState: unknown,
  user: RedirectUser,
): string {
  const redirect = getRequestedPostLoginRedirect(searchParams, locationState);

  if (redirect && isAllowedPostLoginRedirect(redirect, user)) {
    return mapLegacyRedirectToActiveShell(redirect, user);
  }

  return getDefaultPostLoginRedirect(user);
}
