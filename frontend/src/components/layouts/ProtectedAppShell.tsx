import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import {
  KeyboardShortcutsHelp,
  useKeyboardShortcutsHelp,
} from '@/components/KeyboardShortcutsHelp';
import { OnboardingTour } from '@/components/OnboardingTour';
import { SessionTimeoutWarning } from '@/components/SessionTimeoutWarning';
import { useAuth } from '@/lib/auth';
import {
  getCompanyRole,
  hasSubcontractorPortalIdentity,
  isForemanDashboardUser,
} from '@/lib/subcontractorIdentity';
import { MainLayout } from './MainLayout';
import { shouldAutoShowGeneralOnboardingForPath } from './protectedAppShellOnboarding';

const SUBCONTRACTOR_ROLES = ['subcontractor', 'subcontractor_admin'];

function CompanyOnboardingGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  const isSubcontractor = hasSubcontractorPortalIdentity(user);
  const needsCompany = Boolean(user) && !user?.companyId && !isSubcontractor;

  if (needsCompany && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  if (!needsCompany && location.pathname === '/onboarding') {
    return <Navigate to="/projects" replace />;
  }

  return <>{children}</>;
}

function KeyboardShortcutsProvider({ children }: { children: ReactNode }) {
  const { isOpen, closeHelp } = useKeyboardShortcutsHelp();
  const { user } = useAuth();
  const location = useLocation();
  const userRole = getCompanyRole(user);
  const isCompanySetupRoute = location.pathname === '/onboarding';
  // Tour audience: company users outside the subcontractor portal. Gates both
  // the first-run auto-show and the "Take the tour" replay from the header.
  const showGeneralOnboarding =
    Boolean(user?.companyId) &&
    !SUBCONTRACTOR_ROLES.includes(userRole) &&
    !hasSubcontractorPortalIdentity(user) &&
    !isCompanySetupRoute;
  // First-run auto-show. OnboardingTour persists a per-user seen marker the
  // moment it opens, which is the root-cause fix for the recurring launch
  // modals that PR #203 originally stopped by hardcoding the tour off.
  // Foremen are excluded from the auto-show: their day-to-day surface is the
  // mobile-first foreman dashboard, while the tour walks desktop chrome
  // (sidebar navigation, Cmd+K, keyboard shortcuts). They can still start it
  // from the header user menu.
  const autoShowGeneralOnboarding =
    showGeneralOnboarding &&
    !isForemanDashboardUser(user) &&
    shouldAutoShowGeneralOnboardingForPath(location.pathname);

  return (
    <>
      {children}
      <KeyboardShortcutsHelp isOpen={isOpen} onClose={closeHelp} />
      <OnboardingTour enabled={showGeneralOnboarding} autoShow={autoShowGeneralOnboarding} />
      <SessionTimeoutWarning />
    </>
  );
}

export function ProtectedAppShell() {
  return (
    <ProtectedRoute>
      <KeyboardShortcutsProvider>
        <CompanyOnboardingGate>
          <MainLayout />
        </CompanyOnboardingGate>
      </KeyboardShortcutsProvider>
    </ProtectedRoute>
  );
}
