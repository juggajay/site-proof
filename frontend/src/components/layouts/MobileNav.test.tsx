import { render, screen, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// MobileNav reaches the full slide-out drawer (Test Results, Documents, Reports,
// Subcontractors, etc.) only via a bottom-bar "Menu" trigger. These tests lock
// in that the trigger exists for non-foreman/non-subcontractor users, that it
// opens the drawer, and that navigating closes it again — so management work is
// never stranded as desktop-only on a phone. The auth + foreman store boundaries
// are mocked; the role helpers run for real so the gating logic is exercised.
vi.mock('@/lib/auth', () => ({ useAuth: vi.fn() }));
vi.mock('@/stores/foremanMobileStore', () => ({
  useForemanMobileStore: () => ({ setIsCameraOpen: vi.fn() }),
}));

import { MobileNav } from './MobileNav';
import { useAuth } from '@/lib/auth';

const useAuthMock = vi.mocked(useAuth);

type TestUser = {
  role?: string;
  roleInCompany?: string;
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
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/projects/:projectId/*" element={<MobileNav />} />
        <Route path="*" element={<MobileNav />} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('MobileNav menu trigger', () => {
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

  it('keeps the Menu trigger reachable even with no project selected', () => {
    setUser({ role: 'admin', companyId: 'c1' });

    renderNav('/dashboard');

    fireEvent.click(screen.getByRole('button', { name: /open menu/i }));

    // Drawer opens (close button present) even with no project, but the
    // project-only section (e.g. Test Results) stays hidden until a project is set.
    expect(screen.getByRole('button', { name: /close menu/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /test results/i })).not.toBeInTheDocument();
  });
});
