import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useShellV2Enabled } from './shellFlag';

interface ShellRouteGuardProps {
  children: ReactNode;
}

export function ShellRouteGuard({ children }: ShellRouteGuardProps) {
  const shellEnabled = useShellV2Enabled();

  if (!shellEnabled) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
