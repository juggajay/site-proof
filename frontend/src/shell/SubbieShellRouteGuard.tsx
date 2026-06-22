import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSubbieShellActive } from './shellFlag';

interface SubbieShellRouteGuardProps {
  children: ReactNode;
}

function classicPortalPath(pathname: string): string {
  if (pathname === '/p' || pathname === '/p/') return '/subcontractor-portal';
  if (pathname === '/p/docket') return '/subcontractor-portal/docket/new';
  if (pathname === '/p/dockets') return '/subcontractor-portal/dockets';
  if (pathname === '/p/work') return '/subcontractor-portal/work';
  if (pathname === '/p/itps') return '/subcontractor-portal/itps';
  if (pathname === '/p/quality') return '/subcontractor-portal/holdpoints';
  if (pathname === '/p/ncrs') return '/subcontractor-portal/ncrs';
  if (pathname === '/p/docs') return '/subcontractor-portal/documents';
  if (pathname === '/p/company') return '/my-company';

  const docketMatch = pathname.match(/^\/p\/docket\/([^/]+)$/);
  if (docketMatch) {
    return `/subcontractor-portal/docket/${encodeURIComponent(decodeURIComponent(docketMatch[1]))}`;
  }

  const lotItpMatch = pathname.match(/^\/p\/lots\/([^/]+)\/itp$/);
  if (lotItpMatch) {
    return `/subcontractor-portal/lots/${encodeURIComponent(
      decodeURIComponent(lotItpMatch[1]),
    )}/itp`;
  }

  return '/subcontractor-portal';
}

export function SubbieShellRouteGuard({ children }: SubbieShellRouteGuardProps) {
  const shellActive = useSubbieShellActive();
  const location = useLocation();

  if (!shellActive) {
    return <Navigate to={`${classicPortalPath(location.pathname)}${location.search}`} replace />;
  }

  return <>{children}</>;
}
