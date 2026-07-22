import { afterEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders, screen, fireEvent, waitFor } from '@/test/renderWithProviders';

// UserMenu is the shared identity popover rendered in both the sidebar (drop-up,
// md+) and the header (drop-down, below md). These tests lock in the gating of
// the relocated utility rows and the popover's positioning per variant. All
// external boundaries are mocked.
vi.mock('@/lib/auth', () => ({ useAuth: vi.fn() }));
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: vi.fn() };
});
vi.mock('@/lib/theme', () => ({
  useTheme: () => ({ setTheme: vi.fn(), resolvedTheme: 'light' }),
}));
vi.mock('@/components/OnboardingTour', () => ({
  useOnboarding: () => ({ resetOnboarding: vi.fn() }),
  startOnboardingTour: vi.fn(),
}));
vi.mock('@/components/UnsyncedSignOutDialog', () => ({
  useUnsyncedSignOut: () => ({ requestSignOut: vi.fn(), dialog: null }),
}));

import { UserMenu } from './UserMenu';
import { useAuth } from '@/lib/auth';
import { apiFetch } from '@/lib/api';

const useAuthMock = vi.mocked(useAuth);
const apiFetchMock = vi.mocked(apiFetch);

function setUser(user: Record<string, unknown>) {
  useAuthMock.mockReturnValue({ user } as unknown as ReturnType<typeof useAuth>);
}

function renderMenu(variant: 'header' | 'sidebar' = 'sidebar') {
  return renderWithProviders(<UserMenu variant={variant} />);
}

function renderMenuAtProject(currentUserRole: string) {
  apiFetchMock.mockResolvedValue({ project: { currentUserRole } });
  return renderWithProviders(
    <Routes>
      <Route path="/projects/:projectId/lots" element={<UserMenu variant="sidebar" />} />
    </Routes>,
    { initialEntries: ['/projects/project-1/lots'] },
  );
}

function openMenu() {
  fireEvent.click(screen.getByRole('button', { name: 'User menu' }));
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('UserMenu', () => {
  it('shows all five relocated utility rows for an owner', () => {
    setUser({ email: 'owner@ryox.com.au', companyId: 'c1', roleInCompany: 'owner' });
    renderMenu();
    openMenu();
    expect(screen.getByRole('menuitem', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Company Settings' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Audit Log' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Documentation' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Help & Support' })).toBeInTheDocument();
  });

  it('hides Company Settings and Audit Log from a role without access', () => {
    setUser({ email: 'site@ryox.com.au', companyId: 'c1', roleInCompany: 'site_manager' });
    renderMenu();
    openMenu();
    expect(screen.getByRole('menuitem', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Documentation' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Company Settings' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Audit Log' })).not.toBeInTheDocument();
  });

  it('hides the Settings group for subcontractors but keeps Help', () => {
    setUser({ email: 'subbie@ryox.com.au', companyId: 'c1', roleInCompany: 'subcontractor' });
    renderMenu();
    openMenu();
    expect(screen.queryByRole('menuitem', { name: 'Settings' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Company Settings' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Audit Log' })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Documentation' })).toBeInTheDocument();
  });

  it('grants Audit Log via the project-scoped role but not Company Settings', async () => {
    setUser({ email: 'pm@ryox.com.au', companyId: 'c1', roleInCompany: 'member' });
    renderMenuAtProject('project_manager');
    openMenu();
    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: 'Audit Log' })).toBeInTheDocument();
    });
    expect(screen.queryByRole('menuitem', { name: 'Company Settings' })).not.toBeInTheDocument();
  });

  it('keeps the menu open after toggling the theme', () => {
    setUser({ email: 'owner@ryox.com.au', companyId: 'c1', roleInCompany: 'owner' });
    renderMenu();
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Switch to dark mode' }));
    // Menu stays open for instant feedback — Profile is still reachable.
    expect(screen.getByRole('menuitem', { name: 'Profile' })).toBeInTheDocument();
  });

  it('drops up in the sidebar variant and down in the header variant', () => {
    setUser({ email: 'owner@ryox.com.au', companyId: 'c1', roleInCompany: 'owner' });
    const { unmount } = renderMenu('sidebar');
    openMenu();
    expect(screen.getByRole('menu')).toHaveClass('bottom-full');
    unmount();

    renderMenu('header');
    openMenu();
    expect(screen.getByRole('menu')).toHaveClass('top-full');
  });
});
