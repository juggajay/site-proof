import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSubbieShellActive } from './shellFlag';
import { getClassicPortalPathForSubbieShellPath } from './subbieShellRoutes';

interface SubbieShellRouteGuardProps {
  children: ReactNode;
}

export function SubbieShellRouteGuard({ children }: SubbieShellRouteGuardProps) {
  const shellActive = useSubbieShellActive();
  const location = useLocation();

  if (!shellActive) {
    return (
      <Navigate
        to={`${
          getClassicPortalPathForSubbieShellPath(location.pathname) ?? '/subcontractor-portal'
        }${location.search}${location.hash}`}
        replace
      />
    );
  }

  return <>{children}</>;
}
