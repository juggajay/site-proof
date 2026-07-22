import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { waitFor } from '@testing-library/react';
import { renderWithProviders, screen } from '@/test/renderWithProviders';

vi.mock('@/lib/auth', () => ({ useAuth: vi.fn() }));
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: vi.fn() };
});
// The pinned footer now renders UserMenu; stub its extra boundaries so the
// Sidebar renders in isolation (menu contents are covered in UserMenu.test).
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

import { Sidebar } from './Sidebar';
import { useAuth } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { useUIStore } from '@/stores/uiStore';

const useAuthMock = vi.mocked(useAuth);
const apiFetchMock = vi.mocked(apiFetch);

function mockProjectDetail(
  currentUserRole: string | null = 'project_manager',
  settings: Record<string, unknown> = { enabledModules: {} },
) {
  apiFetchMock.mockResolvedValue({
    project: { name: 'Project One', currentUserRole, settings },
  });
}

function renderProjectSidebar() {
  return renderWithProviders(
    <Routes>
      <Route path="/projects/:projectId/lots" element={<Sidebar />} />
    </Routes>,
    { initialEntries: ['/projects/project-1/lots'] },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  useUIStore.setState({
    sidebar: {
      isCollapsed: false,
      expandedSections: ['projects', 'quality'],
    },
    currentProjectId: null,
  });
  mockProjectDetail();
});

describe('Sidebar project navigation', () => {
  it('hides internal-only project links for company-level viewers', () => {
    mockProjectDetail('viewer');
    useAuthMock.mockReturnValue({
      user: {
        id: 'viewer-1',
        email: 'viewer@example.com',
        role: 'viewer',
        roleInCompany: 'viewer',
        companyId: 'company-1',
      },
    } as unknown as ReturnType<typeof useAuth>);

    renderProjectSidebar();

    expect(screen.getByRole('link', { name: /Lots/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Reports/i })).toBeInTheDocument();

    expect(screen.queryByRole('link', { name: /ITPs/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Hold Points/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Test Results/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /NCRs/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Daily Diary/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Docket Approvals/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Documents/i })).not.toBeInTheDocument();
  });

  it('uses the project-scoped viewer role when the company role is only member', () => {
    mockProjectDetail('viewer');
    useAuthMock.mockReturnValue({
      user: {
        id: 'viewer-2',
        email: 'project-viewer@example.com',
        role: 'member',
        roleInCompany: 'member',
        dashboardRole: 'viewer',
        companyId: 'company-1',
      },
    } as unknown as ReturnType<typeof useAuth>);

    renderProjectSidebar();

    expect(screen.getByRole('link', { name: /Lots/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Reports/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /ITPs/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Documents/i })).not.toBeInTheDocument();
  });

  it('keeps internal project links visible for non-viewer field roles', async () => {
    mockProjectDetail('foreman');
    useAuthMock.mockReturnValue({
      user: {
        id: 'foreman-1',
        email: 'foreman@example.com',
        role: 'foreman',
        roleInCompany: 'foreman',
        companyId: 'company-1',
      },
    } as unknown as ReturnType<typeof useAuth>);

    renderProjectSidebar();

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /ITPs/i })).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: /Hold Points/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /NCRs/i })).toBeInTheDocument();
  });

  it('shows commercial project links for project-scoped project managers', async () => {
    useAuthMock.mockReturnValue({
      user: {
        id: 'project-pm-1',
        email: 'project-pm@example.com',
        role: 'member',
        roleInCompany: 'member',
        dashboardRole: 'project_manager',
        companyId: 'company-1',
      },
    } as unknown as ReturnType<typeof useAuth>);

    renderProjectSidebar();

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /Progress Claims/i })).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: /Variations/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Costs/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Subcontractors/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Project Settings/i })).toBeInTheDocument();
  });

  it('does not expose aggregate project-manager links while the project role is loading', () => {
    apiFetchMock.mockReturnValue(new Promise(() => {}) as ReturnType<typeof apiFetch>);
    useAuthMock.mockReturnValue({
      user: {
        id: 'mixed-role-loading-1',
        email: 'mixed-role-loading@example.com',
        role: 'member',
        roleInCompany: 'member',
        dashboardRole: 'project_manager',
        companyId: 'company-1',
      },
    } as unknown as ReturnType<typeof useAuth>);

    renderProjectSidebar();

    expect(screen.getByRole('link', { name: /Lots/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Reports/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Progress Claims/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Variations/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Costs/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Subcontractors/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Project Settings/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Documents/i })).not.toBeInTheDocument();
  });

  it('uses the loaded project role instead of the aggregate dashboard role', async () => {
    mockProjectDetail('viewer');
    useAuthMock.mockReturnValue({
      user: {
        id: 'mixed-role-1',
        email: 'mixed-role@example.com',
        role: 'member',
        roleInCompany: 'member',
        dashboardRole: 'project_manager',
        companyId: 'company-1',
      },
    } as unknown as ReturnType<typeof useAuth>);

    renderProjectSidebar();

    await waitFor(() => {
      expect(screen.queryByRole('link', { name: /Progress Claims/i })).not.toBeInTheDocument();
    });
    expect(screen.queryByRole('link', { name: /Project Settings/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Lots/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Reports/i })).toBeInTheDocument();
  });

  it('hides project settings for site managers because settings are project-admin only', async () => {
    mockProjectDetail('site_manager');
    useAuthMock.mockReturnValue({
      user: {
        id: 'site-manager-1',
        email: 'site-manager@example.com',
        role: 'site_manager',
        roleInCompany: 'site_manager',
        companyId: 'company-1',
      },
    } as unknown as ReturnType<typeof useAuth>);

    renderProjectSidebar();

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /Subcontractors/i })).toBeInTheDocument();
    });
    expect(screen.queryByRole('link', { name: /Project Settings/i })).not.toBeInTheDocument();
  });

  it('groups the office menu into sections and drops Daily Diary for owners', async () => {
    mockProjectDetail('owner');
    useAuthMock.mockReturnValue({
      user: {
        id: 'owner-1',
        email: 'owner@example.com',
        role: 'owner',
        roleInCompany: 'owner',
        companyId: 'company-1',
      },
    } as unknown as ReturnType<typeof useAuth>);

    renderProjectSidebar();

    await waitFor(() => {
      expect(screen.getByText('Quality')).toBeInTheDocument();
    });
    expect(screen.getByText('Commercial')).toBeInTheDocument();
    expect(screen.getByText('Records')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
    // Owner is a docket-amount viewer, so Docket Approvals stays.
    expect(screen.getByRole('link', { name: /Docket Approvals/i })).toBeInTheDocument();
    // Daily Diary is nav-removed for office roles.
    expect(screen.queryByRole('link', { name: /Daily Diary/i })).not.toBeInTheDocument();
  });

  it('keeps the flat menu with Daily Diary and no section labels for foremen', async () => {
    mockProjectDetail('foreman');
    useAuthMock.mockReturnValue({
      user: {
        id: 'foreman-diary-1',
        email: 'foreman-diary@example.com',
        role: 'foreman',
        roleInCompany: 'foreman',
        companyId: 'company-1',
      },
    } as unknown as ReturnType<typeof useAuth>);

    renderProjectSidebar();

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /Daily Diary/i })).toBeInTheDocument();
    });
    expect(screen.queryByText('Quality')).not.toBeInTheDocument();
    expect(screen.queryByText('Commercial')).not.toBeInTheDocument();
  });

  it('hides Docket Approvals from quality managers but keeps it for project managers', async () => {
    mockProjectDetail('quality_manager');
    useAuthMock.mockReturnValue({
      user: {
        id: 'qm-dockets-1',
        email: 'qm-dockets@example.com',
        role: 'member',
        roleInCompany: 'member',
        dashboardRole: 'quality_manager',
        companyId: 'company-1',
      },
    } as unknown as ReturnType<typeof useAuth>);

    const { unmount } = renderProjectSidebar();

    await waitFor(() => {
      expect(screen.getByText('Quality')).toBeInTheDocument();
    });
    expect(screen.queryByRole('link', { name: /Docket Approvals/i })).not.toBeInTheDocument();

    unmount();

    mockProjectDetail('project_manager');
    useAuthMock.mockReturnValue({
      user: {
        id: 'pm-dockets-1',
        email: 'pm-dockets@example.com',
        role: 'member',
        roleInCompany: 'member',
        dashboardRole: 'project_manager',
        companyId: 'company-1',
      },
    } as unknown as ReturnType<typeof useAuth>);

    renderProjectSidebar();

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /Docket Approvals/i })).toBeInTheDocument();
    });
  });

  it('no longer pins the utility cluster; the Collapse control stays pinned', async () => {
    mockProjectDetail('owner');
    useAuthMock.mockReturnValue({
      user: {
        id: 'owner-cluster-1',
        email: 'owner-cluster@example.com',
        role: 'owner',
        roleInCompany: 'owner',
        companyId: 'company-1',
      },
    } as unknown as ReturnType<typeof useAuth>);

    renderProjectSidebar();

    await waitFor(() => {
      expect(screen.getByTestId('sidebar-toggle')).toBeInTheDocument();
    });
    // The five utility destinations moved to the user menu; they are no longer
    // sidebar links.
    expect(screen.queryByRole('link', { name: /^Settings$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Documentation/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Help & Support/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Company Settings/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Audit Log/i })).not.toBeInTheDocument();
  });

  it('pins the user identity menu in the footer', async () => {
    mockProjectDetail('owner');
    useAuthMock.mockReturnValue({
      user: {
        id: 'owner-identity-1',
        email: 'owner-identity@example.com',
        role: 'owner',
        roleInCompany: 'owner',
        companyId: 'company-1',
      },
    } as unknown as ReturnType<typeof useAuth>);

    renderProjectSidebar();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'User menu' })).toBeInTheDocument();
    });
  });
});
