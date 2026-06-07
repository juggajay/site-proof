import { Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobileNav } from './MobileNav';
import { useAuth } from '@/lib/auth';
import { useForemanMobileStore } from '@/stores/foremanMobileStore';
import { CaptureModal } from '@/components/foreman/CaptureModal';
import { EmailVerificationBanner } from '@/components/EmailVerificationBanner';
import { useEffectiveProjectId } from '@/hooks/useEffectiveProjectId';

export function MainLayout() {
  const location = useLocation();
  const { projectId: effectiveProjectId } = useEffectiveProjectId();
  const { user } = useAuth();
  const [isTransitioning, setIsTransitioning] = useState(false);

  const userRole = user?.roleInCompany || user?.role || '';
  const isForeman = userRole === 'foreman';
  const { isCameraOpen, setIsCameraOpen } = useForemanMobileStore();

  // Add subtle fade transition when navigating between pages
  useEffect(() => {
    setIsTransitioning(true);
    const timer = setTimeout(() => setIsTransitioning(false), 150);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main
          className={`flex-1 overflow-auto overflow-x-hidden p-4 pb-24 md:p-6 md:pb-6 transition-opacity duration-150 ${
            isTransitioning ? 'opacity-0' : 'opacity-100'
          }`}
        >
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
