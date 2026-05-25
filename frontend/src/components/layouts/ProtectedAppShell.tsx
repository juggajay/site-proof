import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import {
  KeyboardShortcutsHelp,
  useKeyboardShortcutsHelp,
} from '@/components/KeyboardShortcutsHelp';
import { ChangelogNotification } from '@/components/ChangelogNotification';
import { OnboardingTour } from '@/components/OnboardingTour';
import { SessionTimeoutWarning } from '@/components/SessionTimeoutWarning';
import { useAuth } from '@/lib/auth';
import { getCompanyRole, hasSubcontractorPortalIdentity } from '@/lib/subcontractorIdentity';
import { MainLayout } from './MainLayout';

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
  const showGeneralOnboarding =
    Boolean(user?.companyId) &&
    !SUBCONTRACTOR_ROLES.includes(userRole) &&
    !hasSubcontractorPortalIdentity(user) &&
    !isCompanySetupRoute;

  return (
    <>
      {children}
      <KeyboardShortcutsHelp isOpen={isOpen} onClose={closeHelp} />
      <OnboardingTour enabled={showGeneralOnboarding} />
      {!isCompanySetupRoute && <ChangelogNotification />}
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
