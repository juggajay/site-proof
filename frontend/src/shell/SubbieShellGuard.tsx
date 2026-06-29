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
import { getSubbieShellPathForClassicPath } from './subbieShellRoutes';

interface SubbieShellGuardProps {
  children: ReactNode;
}

export function SubbieShellGuard({ children }: SubbieShellGuardProps) {
  const shellActive = useSubbieShellActive();
  const location = useLocation();

  if (shellActive) {
    return (
      <Navigate
        to={`${getSubbieShellPathForClassicPath(location.pathname) ?? '/p'}${location.search}${
          location.hash
        }`}
        replace
      />
    );
  }

  return <>{children}</>;
}
