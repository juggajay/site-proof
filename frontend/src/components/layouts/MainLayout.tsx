import { Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobileNav } from './MobileNav';
import { useAuth } from '@/lib/auth';
import { useForemanMobileStore } from '@/stores/foremanMobileStore';
import { CaptureModal } from '@/components/foreman/CaptureModal';
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
          <Outlet />
        </main>
      </div>
      <MobileNav />

      {/* Foreman capture modal - triggered by the bottom nav Capture button via
          the store. Sourced from the effective project id so it works on
          project-less routes too. Skipped on /dashboard, which mounts its own
          capture modal (the duplicate B2 consolidates) - avoids stacking two
          camera modals until that consolidation lands. */}
      {isForeman && effectiveProjectId && location.pathname !== '/dashboard' && (
        <CaptureModal
          projectId={effectiveProjectId}
          isOpen={isCameraOpen}
          onClose={() => setIsCameraOpen(false)}
        />
      )}
    </div>
  );
}
