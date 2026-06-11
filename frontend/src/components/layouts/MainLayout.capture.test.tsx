import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { fireEvent, renderWithProviders, screen, waitFor } from '@/test/renderWithProviders';

// MainLayout's chrome isn't under test here, so stub it and keep the render
// focused on the foreman capture-modal mount. The bottom-nav Capture trigger
// lives in MobileNav -> ForemanBottomNavV2 (covered by ForemanBottomNavV2.test)
// and just sets the same `isCameraOpen` store flag this test drives.
vi.mock('./Sidebar', () => ({ Sidebar: () => null }));
vi.mock('./Header', () => ({ Header: () => null }));
vi.mock('./MobileNav', () => ({ MobileNav: () => null }));

vi.mock('@/lib/auth', () => ({ useAuth: vi.fn() }));
vi.mock('@/hooks/useEffectiveProjectId', () => ({ useEffectiveProjectId: vi.fn() }));
vi.mock('@/hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => ({ isOnline: true, pendingSyncCount: 0 }),
}));
vi.mock('@/hooks/useGeoLocation', () => ({
  useGeoLocation: () => ({
    latitude: null,
    longitude: null,
    accuracy: null,
    error: null,
    loading: false,
    refresh: vi.fn(),
    isSupported: false,
  }),
}));
// CaptureModal persists captured photos to IndexedDB on save; keep that out of jsdom.
vi.mock('@/lib/offlineDb', () => ({ capturePhotoOffline: vi.fn() }));
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: vi.fn() };
});

import { MainLayout } from './MainLayout';
import { ForemanMobileDashboard } from '@/components/foreman/ForemanMobileDashboard';
import { useAuth } from '@/lib/auth';
import { useEffectiveProjectId } from '@/hooks/useEffectiveProjectId';
import { apiFetch } from '@/lib/api';
import { useForemanMobileStore } from '@/stores/foremanMobileStore';

const useAuthMock = vi.mocked(useAuth);
const useEffectiveProjectIdMock = vi.mocked(useEffectiveProjectId);
const apiFetchMock = vi.mocked(apiFetch);

const dashboardData = {
  todayDiary: { exists: false, status: null, id: null },
  pendingDockets: { count: 0, totalLabourHours: 0, totalPlantHours: 0 },
  inspectionsDueToday: { count: 0, items: [] },
  weather: { conditions: null, temperatureMin: null, temperatureMax: null, rainfallMm: null },
  project: { id: 'p1', name: 'Test Project', projectNumber: 'P-001' },
};

// Both the shared CaptureModal and the former dashboard PhotoCaptureModal render
// as a full-screen black overlay with this exact wrapper, so counting these is a
// faithful "how many camera modals are mounted?" check.
function cameraOverlays(): NodeListOf<Element> {
  return document.querySelectorAll('div.fixed.inset-0.z-50.bg-black');
}

function renderDashboardInLayout() {
  return renderWithProviders(
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/dashboard" element={<ForemanMobileDashboard />} />
      </Route>
    </Routes>,
    { initialEntries: ['/dashboard'] },
  );
}

beforeEach(() => {
  useForemanMobileStore.setState({ isCameraOpen: false });
  useAuthMock.mockReturnValue({
    user: { id: 'u1', fullName: 'Fred Foreman', role: 'foreman', roleInCompany: 'foreman' },
  } as unknown as ReturnType<typeof useAuth>);
  useEffectiveProjectIdMock.mockReturnValue({
    projectId: 'p1',
    isResolving: false,
    hasNoProject: false,
  });
  // One payload serves both reads: the foreman dashboard query consumes the full
  // shape; CaptureModal's lot lookup just reads `.lots` (absent -> empty list).
  apiFetchMock.mockResolvedValue(dashboardData);
});

afterEach(() => {
  useForemanMobileStore.setState({ isCameraOpen: false });
  vi.clearAllMocks();
});

describe('foreman mobile capture is a single shared workflow on /dashboard', () => {
  it('mounts exactly one capture modal - the shared CaptureModal, not the legacy dashboard one', async () => {
    useForemanMobileStore.setState({ isCameraOpen: true });

    renderDashboardInLayout();

    // Wait for the dashboard to finish loading: before this change it would have
    // mounted its own PhotoCaptureModal here once loaded.
    await screen.findByText(/Good (morning|afternoon|evening)/i);

    // The shared, camera-first CaptureModal (mounted by MainLayout) is on screen.
    expect(screen.getByText('Opening camera...')).toBeInTheDocument();
    // The legacy dashboard PhotoCaptureModal is gone (its distinctive copy).
    expect(screen.queryByText('Capture Photo')).not.toBeInTheDocument();
    expect(screen.queryByText('Tap to take photo')).not.toBeInTheDocument();
    // Exactly one full-screen camera overlay -> no two stacked modals.
    await waitFor(() => expect(cameraOverlays()).toHaveLength(1));
  });

  it('mounts the shared capture modal for project-role foremen whose company role is member', async () => {
    useAuthMock.mockReturnValue({
      user: {
        id: 'u1',
        fullName: 'Fred Foreman',
        role: 'member',
        roleInCompany: 'member',
        dashboardRole: 'foreman',
      },
    } as unknown as ReturnType<typeof useAuth>);
    useForemanMobileStore.setState({ isCameraOpen: true });

    renderDashboardInLayout();

    await screen.findByText(/Good (morning|afternoon|evening)/i);
    expect(screen.getByText('Opening camera...')).toBeInTheDocument();
    await waitFor(() => expect(cameraOverlays()).toHaveLength(1));
  });

  it('opens that one shared modal from the dashboard quick-capture FAB', async () => {
    renderDashboardInLayout();
    await screen.findByText(/Good (morning|afternoon|evening)/i);

    // Nothing open yet; the quick-capture FAB is the dashboard entry point.
    expect(cameraOverlays()).toHaveLength(0);
    const fab = document.querySelector('.fixed.bottom-20.right-4 button');
    expect(fab).not.toBeNull();

    // Expand the FAB, then tap Photo.
    fireEvent.click(fab as Element);
    fireEvent.click(screen.getByText('Photo'));

    // The shared store flag flips and the single shared CaptureModal opens -
    // there is no second, dashboard-owned modal.
    expect(useForemanMobileStore.getState().isCameraOpen).toBe(true);
    await screen.findByText('Opening camera...');
    expect(screen.queryByText('Capture Photo')).not.toBeInTheDocument();
    await waitFor(() => expect(cameraOverlays()).toHaveLength(1));
  });
});
