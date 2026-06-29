import { screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from '@/test/renderWithProviders';

// MobileNav reaches the full slide-out drawer (Test Results, Documents, Reports,
// Subcontractors, etc.) only via a bottom-bar "Menu" trigger. These tests lock
// in that the trigger exists for non-foreman/non-subcontractor users, that it
// opens the drawer, and that navigating closes it again — so management work is
// never stranded as desktop-only on a phone. The auth + foreman store boundaries
// are mocked; the role helpers run for real so the gating logic is exercised.
vi.mock('@/lib/auth', () => ({ useAuth: vi.fn() }));
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: vi.fn() };
});
vi.mock('@/stores/foremanMobileStore', () => ({
  useForemanMobileStore: () => ({ setIsCameraOpen: vi.fn() }),
}));
vi.mock('@/components/foreman/ForemanBottomNavV2', () => ({
  ForemanBottomNavV2: () => <div>Foreman bottom nav</div>,
}));

import { MobileNav } from './MobileNav';
import { useAuth } from '@/lib/auth';
import { apiFetch } from '@/lib/api';

const useAuthMock = vi.mocked(useAuth);
const apiFetchMock = vi.mocked(apiFetch);

type TestUser = {
  role?: string;
  roleInCompany?: string;
  dashboardRole?: 'project_manager' | 'quality_manager' | 'foreman' | 'viewer' | null;
  companyId?: string | null;
  hasSubcontractorPortalAccess?: boolean;
};

function setUser(user: TestUser | null) {
  // Only `user` is read by MobileNav; the rest of the context is irrelevant here.
  useAuthMock.mockReturnValue({ user } as unknown as ReturnType<typeof useAuth>);
}

// Render MobileNav under a real route so useParams() resolves :projectId the same
// way it does inside the app's project routes.
function renderNav(initialPath = '/projects/p1/lots') {
  renderWithProviders(
    <>
      <Routes>
        <Route path="/projects/:projectId/*" element={<MobileNav />} />
        <Route path="*" element={<MobileNav />} />
      </Routes>
    </>,
    { initialEntries: [initialPath] },
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('MobileNav menu trigger', () => {
  beforeEach(() => {
    apiFetchMock.mockResolvedValue({
      project: { name: 'Project One', settings: { enabledModules: {} } },
    });
  });

  it('shows a Menu trigger for an admin on mobile', () => {
    setUser({ role: 'admin', companyId: 'c1' });

    renderNav();

    expect(screen.getByRole('button', { name: /open menu/i })).toBeInTheDocument();
  });

  it('opens the slide-out drawer with management entries when tapped (PM)', () => {
    setUser({ role: 'project_manager', companyId: 'c1' });

    renderNav();

    // Drawer entries are not present until the menu is opened.
    expect(screen.queryByRole('link', { name: /test results/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /open menu/i }));

    expect(screen.getByRole('link', { name: /test results/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /documents/i })).toBeInTheDocument();
  });

  it('closes the drawer when a drawer entry is navigated', () => {
    setUser({ role: 'admin', companyId: 'c1' });

    renderNav();

    fireEvent.click(screen.getByRole('button', { name: /open menu/i }));
    const documentsLink = screen.getByRole('link', { name: /documents/i });
    expect(documentsLink).toBeInTheDocument();

    fireEvent.click(documentsLink);

    expect(screen.queryByRole('link', { name: /test results/i })).not.toBeInTheDocument();
  });

  it('closes the drawer from its close button', () => {
    setUser({ role: 'admin', companyId: 'c1' });

    renderNav();

    fireEvent.click(screen.getByRole('button', { name: /open menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /close menu/i }));

    expect(screen.queryByRole('link', { name: /documents/i })).not.toBeInTheDocument();
  });

  it('does not render the Menu trigger for a subcontractor (own bottom bar covers nav)', () => {
    setUser({ role: 'subcontractor', companyId: null, hasSubcontractorPortalAccess: true });

    renderNav();

    expect(screen.queryByRole('button', { name: /open menu/i })).not.toBeInTheDocument();
  });

  it('renders foreman bottom nav for project-role foremen whose company role is member', () => {
    setUser({ role: 'member', roleInCompany: 'member', dashboardRole: 'foreman', companyId: 'c1' });

    renderNav();

    expect(screen.getByText('Foreman bottom nav')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /open menu/i })).not.toBeInTheDocument();
  });

  it('shows commercial drawer links for project-scoped project managers', () => {
    setUser({
      role: 'member',
      roleInCompany: 'member',
      dashboardRole: 'project_manager',
      companyId: 'c1',
    });

    renderNav();

    fireEvent.click(screen.getByRole('button', { name: /open menu/i }));

    expect(screen.getByRole('link', { name: /progress claims/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /costs/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /subcontractors/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /project settings/i })).toBeInTheDocument();
  });

  it('uses the loaded project role instead of aggregate dashboard role in the drawer', async () => {
    apiFetchMock.mockResolvedValue({
      project: {
        name: 'Project One',
        currentUserRole: 'viewer',
        settings: { enabledModules: {} },
      },
    });
    setUser({
      role: 'member',
      roleInCompany: 'member',
      dashboardRole: 'project_manager',
      companyId: 'c1',
    });

    renderNav();
    fireEvent.click(screen.getByRole('button', { name: /open menu/i }));

    await waitFor(() => {
      expect(screen.queryByRole('link', { name: /progress claims/i })).not.toBeInTheDocument();
    });
    expect(screen.queryByRole('link', { name: /project settings/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /lots/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /reports/i })).toBeInTheDocument();
  });

  it('hides project settings for site managers in the mobile drawer', () => {
    setUser({ role: 'site_manager', roleInCompany: 'site_manager', companyId: 'c1' });

    renderNav();
    fireEvent.click(screen.getByRole('button', { name: /open menu/i }));

    expect(screen.getByRole('link', { name: /subcontractors/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /project settings/i })).not.toBeInTheDocument();
  });

  it('publishes the bottom bar height so the offline sync pill clears it', () => {
    const offsetHeight = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(64);
    setUser({ role: 'admin', companyId: 'c1' });

    renderNav();

    expect(document.documentElement.style.getPropertyValue('--bottom-nav-height')).toBe('64px');

    offsetHeight.mockRestore();
  });

  it('keeps the Menu trigger reachable even with no project selected', () => {
    setUser({ role: 'admin', companyId: 'c1' });

    renderNav('/dashboard');

    fireEvent.click(screen.getByRole('button', { name: /open menu/i }));

    // Drawer opens (close button present) even with no project, but the
    // project-only section (e.g. Test Results) stays hidden until a project is set.
    expect(screen.getByRole('button', { name: /close menu/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /test results/i })).not.toBeInTheDocument();
  });

  it('hides drawer links for disabled project modules', async () => {
    setUser({ role: 'project_manager', companyId: 'c1' });
    apiFetchMock.mockResolvedValue({
      project: {
        name: 'Project One',
        settings: {
          enabledModules: {
            dailyDiary: false,
            dockets: false,
            progressClaims: false,
            costTracking: false,
            subcontractors: false,
          },
        },
      },
    });

    renderNav();
    fireEvent.click(screen.getByRole('button', { name: /open menu/i }));

    await waitFor(() => {
      expect(screen.queryByRole('link', { name: /daily diary/i })).not.toBeInTheDocument();
    });
    expect(screen.queryByRole('link', { name: /docket approvals/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /progress claims/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /costs/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /subcontractors/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /lots/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /documents/i })).toBeInTheDocument();
  });

  it('limits viewer project drawer links to lots and reports', () => {
    setUser({
      role: 'member',
      roleInCompany: 'member',
      dashboardRole: 'viewer',
      companyId: 'c1',
    });

    renderNav();
    fireEvent.click(screen.getByRole('button', { name: /open menu/i }));

    expect(screen.getAllByRole('link', { name: /lots/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /reports/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /itps/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /documents/i })).not.toBeInTheDocument();
  });
});
