/**
 * ShellGuard — wraps the /dashboard route to redirect foreman shell v2 users.
 *
 * When the shell flag is active (flag set + mobile + internal role), a user
 * landing on /dashboard or / is redirected to /m (the shell home).
 * Disable via ?shell=off to restore the normal dashboard.
 *
 * This guard is SURGICAL: it only affects the dashboard entry point and is
 * easily reversible. All other routes are unaffected.
 *
 * Usage in App.tsx:
 *   <Route path="/dashboard" element={<ShellGuard><DashboardPage /></ShellGuard>} />
 */

import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useShellV2Enabled } from './shellFlag';

interface ShellGuardProps {
  children: ReactNode;
}

export function ShellGuard({ children }: ShellGuardProps) {
  const shellEnabled = useShellV2Enabled();
  const location = useLocation();

  if (shellEnabled) {
    return <Navigate to={`/m${location.search}${location.hash}`} replace />;
  }

  return <>{children}</>;
}
