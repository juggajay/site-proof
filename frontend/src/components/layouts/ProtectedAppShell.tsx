import type { ReactNode } from 'react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import {
  KeyboardShortcutsHelp,
  useKeyboardShortcutsHelp,
} from '@/components/KeyboardShortcutsHelp';
import { ChangelogNotification } from '@/components/ChangelogNotification';
import { OnboardingTour } from '@/components/OnboardingTour';
import { SessionTimeoutWarning } from '@/components/SessionTimeoutWarning';
import { useAuth } from '@/lib/auth';
import { MainLayout } from './MainLayout';

const SUBCONTRACTOR_ROLES = ['subcontractor', 'subcontractor_admin'];

function KeyboardShortcutsProvider({ children }: { children: ReactNode }) {
  const { isOpen, closeHelp } = useKeyboardShortcutsHelp();
  const { user } = useAuth();
  const userRole = user?.role || user?.roleInCompany || '';
  const showGeneralOnboarding = !SUBCONTRACTOR_ROLES.includes(userRole);

  return (
    <>
      {children}
      <KeyboardShortcutsHelp isOpen={isOpen} onClose={closeHelp} />
      <OnboardingTour enabled={showGeneralOnboarding} />
      <ChangelogNotification />
      <SessionTimeoutWarning />
    </>
  );
}

export function ProtectedAppShell() {
  return (
    <ProtectedRoute>
      <KeyboardShortcutsProvider>
        <MainLayout />
      </KeyboardShortcutsProvider>
    </ProtectedRoute>
  );
}
