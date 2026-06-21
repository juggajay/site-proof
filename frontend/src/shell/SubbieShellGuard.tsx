/**
 * SubbieShellGuard — wraps the /subcontractor-portal dashboard route to redirect
 * subbie shell users to /p (the shell home).
 *
 * When the subbie shell is active (subcontractor role + mobile + override on),
 * a user landing on /subcontractor-portal is redirected to /p. Disable via
 * ?shell=off to restore the classic portal dashboard.
 *
 * This guard is SURGICAL — the mirror of ShellGuard for the foreman shell. It
 * only affects the dashboard entry point (NOT the other /subcontractor-portal/*
 * surfaces), so the classic portal pages stay reachable directly and the shell
 * stubs can link back to them. Easily reversible.
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

export function SubbieShellGuard({ children }: SubbieShellGuardProps) {
  const shellActive = useSubbieShellActive();
  const location = useLocation();

  if (shellActive) {
    return <Navigate to={`/p${location.search}`} replace />;
  }

  return <>{children}</>;
}
