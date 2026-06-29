/**
 * SubbieShellGuard — wraps classic subcontractor portal routes to redirect
 * mobile subbie shell users to the matching /p route.
 *
 * When the subbie shell is active (subcontractor role + mobile + override on),
 * a user landing on /subcontractor-portal is redirected to /p. Disable via
 * ?shell=off to restore the classic portal dashboard.
 *
 * Classic pages stay reachable on desktop and when ?shell=off is set.
 *
 * Usage in App.tsx:
 *   <Route
 *     path="/subcontractor-portal"
 *     element={<SubbieShellGuard><SubcontractorDashboard /></SubbieShellGuard>}
 *   />
 */

import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSubbieShellActive } from './shellFlag';

interface SubbieShellGuardProps {
  children: ReactNode;
}

const CLASSIC_TO_SHELL_PATH: Record<string, string> = {
  '/subcontractor-portal': '/p',
  '/subcontractor-portal/docket/new': '/p/docket',
  '/subcontractor-portal/dockets': '/p/dockets',
  '/subcontractor-portal/work': '/p/work',
  '/subcontractor-portal/itps': '/p/itps',
  '/subcontractor-portal/holdpoints': '/p/quality',
  '/subcontractor-portal/tests': '/p/quality',
  '/subcontractor-portal/ncrs': '/p/ncrs',
  '/subcontractor-portal/documents': '/p/docs',
  '/my-company': '/p/company',
};

function subbieShellPathForClassicPath(pathname: string): string {
  const shellPath = CLASSIC_TO_SHELL_PATH[pathname];
  if (shellPath) return shellPath;

  const docketMatch = pathname.match(/^\/subcontractor-portal\/docket\/([^/]+)$/);
  if (docketMatch) {
    return `/p/docket/${encodeURIComponent(decodeURIComponent(docketMatch[1]))}`;
  }

  const lotItpMatch = pathname.match(/^\/subcontractor-portal\/lots\/([^/]+)\/itp$/);
  if (lotItpMatch) {
    return `/p/lots/${encodeURIComponent(decodeURIComponent(lotItpMatch[1]))}/itp`;
  }

  return '/p';
}

export function SubbieShellGuard({ children }: SubbieShellGuardProps) {
  const shellActive = useSubbieShellActive();
  const location = useLocation();

  if (shellActive) {
    return (
      <Navigate
        to={`${subbieShellPathForClassicPath(location.pathname)}${location.search}`}
        replace
      />
    );
  }

  return <>{children}</>;
}
