import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobileNav } from './MobileNav';
import { useAuth } from '@/lib/auth';
import { useForemanMobileStore } from '@/stores/foremanMobileStore';
import { CaptureModal } from '@/components/foreman/CaptureModal';
import { EmailVerificationBanner } from '@/components/EmailVerificationBanner';
import { useEffectiveProjectId } from '@/hooks/useEffectiveProjectId';
import { isForemanDashboardUser } from '@/lib/subcontractorIdentity';

export function MainLayout() {
  const { projectId: effectiveProjectId } = useEffectiveProjectId();
  const { user } = useAuth();

  const isForeman = isForemanDashboardUser(user);
  const { isCameraOpen, setIsCameraOpen } = useForemanMobileStore();

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        {/* Route content renders immediately — no transition fade. A previous
            150ms opacity fade on every pathname change hid content for ~300ms
            per navigation (and on initial mount) with no reduced-motion guard;
            perceived speed matters more than the flourish. */}
        <main className="flex-1 overflow-auto overflow-x-hidden p-4 pb-24 md:p-6 md:pb-6">
          <EmailVerificationBanner />
          <Outlet />
        </main>
      </div>
      <MobileNav />

      {/* Foreman capture modal - the single shared mobile capture workflow.
          Triggered by both the bottom-nav Capture button and the dashboard
          quick-capture FAB via the foreman store. Sourced from the effective
          project id so it works on project-less routes too, including the bare
          /dashboard landing screen (the dashboard no longer mounts its own
          capture modal, so there is exactly one camera modal everywhere). */}
      {isForeman && effectiveProjectId && (
        <CaptureModal
          projectId={effectiveProjectId}
          isOpen={isCameraOpen}
          onClose={() => setIsCameraOpen(false)}
        />
      )}
    </div>
  );
}
