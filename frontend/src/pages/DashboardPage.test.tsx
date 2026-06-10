import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/renderWithProviders';

// Mutable auth user, hoisted so the vi.mock factories below (which run before
// the imports) can close over it. DashboardPage and the role dashboards only
// read `user` from useAuth.
const authState = vi.hoisted(() => ({ user: null as Record<string, unknown> | null }));
const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth')>();
  return { ...actual, useAuth: () => ({ user: authState.user }) };
});

// Keep ApiError and apiUrl real for the rest of the import tree; only the
// fetcher is stubbed.
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: apiFetchMock };
});

// jsdom has no matchMedia; pin the desktop layout (the mobile foreman
// dashboard is a separate component with its own coverage).
vi.mock('@/hooks/useMediaQuery', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useMediaQuery')>();
  return { ...actual, useIsMobile: () => false };
});

import { DashboardPage } from './DashboardPage';

const ZERO_STATS = {
  totalProjects: 0,
  activeProjects: 0,
  totalLots: 0,
  lotStatusCounts: {},
  openHoldPoints: 0,
  openNCRs: 0,
  attentionItems: { total: 0, overdueNCRs: [], staleHoldPoints: [] },
  recentActivities: [],
};

const NO_PROJECT_FOREMAN_DATA = {
  todayDiary: { exists: false, status: null, id: null },
  pendingDockets: { count: 0, totalLabourHours: 0, totalPlantHours: 0 },
  inspectionsDueToday: { count: 0, items: [] },
  weather: { conditions: null, temperatureMin: null, temperatureMax: null, rainfallMm: null },
  project: null,
};

interface MockApiOptions {
  stats?: Record<string, unknown> | 'pending';
  projects?: unknown[];
}

function mockDashboardApi({ stats = ZERO_STATS, projects = [] }: MockApiOptions = {}) {
  apiFetchMock.mockImplementation((path: string) => {
    if (path.startsWith('/api/dashboard/stats')) {
      if (stats === 'pending') return new Promise(() => {});
      return Promise.resolve(stats);
    }
    if (path === '/api/projects') return Promise.resolve({ projects });
    if (path === '/api/subcontractors/my-pending-invitation') {
      return Promise.resolve({ invitation: null });
    }
    if (path === '/api/dashboard/foreman') return Promise.resolve(NO_PROJECT_FOREMAN_DATA);
    return Promise.reject(new Error(`Unhandled apiFetch path in test: ${path}`));
  });
}

beforeEach(() => {
  authState.user = null;
  apiFetchMock.mockReset();
});

describe('DashboardPage first-run zero state', () => {
  it('shows the setup checklist instead of all-zero KPIs and export chrome for an admin with no projects', async () => {
    authState.user = {
      id: 'u1',
      email: 'admin@example.com',
      role: 'admin',
      roleInCompany: 'admin',
      companyId: 'c1',
      name: 'Ada Admin',
    };
    mockDashboardApi({ stats: ZERO_STATS, projects: [] });

    renderWithProviders(<DashboardPage />);

    expect(await screen.findByText('Create your first project')).toBeInTheDocument();
    expect(screen.getByText('Add lots')).toBeInTheDocument();
    expect(screen.getByText('Assign an ITP template')).toBeInTheDocument();
    expect(screen.getByText('Invite your team')).toBeInTheDocument();

    // The all-zero KPI grid and export chrome are replaced, not rendered.
    expect(screen.queryByText('Total Projects')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Export PDF/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Refresh/ })).not.toBeInTheDocument();
  });

  it('shows the simple no-project state for a foreman instead of the setup checklist', async () => {
    authState.user = {
      id: 'u2',
      email: 'foreman@example.com',
      role: 'foreman',
      roleInCompany: 'foreman',
      companyId: 'c1',
      fullName: 'Frank Foreman',
    };
    mockDashboardApi();

    renderWithProviders(<DashboardPage />);

    // Foremen route to their own dashboard, whose existing no-project state is
    // the simple "you'll be assigned" message — never the admin setup
    // checklist or export chrome.
    expect(await screen.findByText('No Project Assigned')).toBeInTheDocument();
    expect(screen.queryByText('Create your first project')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Export PDF/ })).not.toBeInTheDocument();
  });

  it('shows the member notice for a company member who cannot create projects', async () => {
    authState.user = {
      id: 'u3',
      email: 'site@example.com',
      role: 'site_manager',
      roleInCompany: 'site_manager',
      companyId: 'c1',
      name: 'Sam Site',
    };
    mockDashboardApi({ stats: ZERO_STATS, projects: [] });

    renderWithProviders(<DashboardPage />);

    expect(
      await screen.findByText(/Your projects will appear here once your team adds you/),
    ).toBeInTheDocument();
    // No create affordance for roles whose POST /api/projects would 403.
    expect(screen.queryByText('Create your first project')).not.toBeInTheDocument();
    expect(screen.queryByText('Total Projects')).not.toBeInTheDocument();
  });

  it('keeps the normal dashboard for a company with projects', async () => {
    authState.user = {
      id: 'u4',
      email: 'admin@example.com',
      role: 'admin',
      roleInCompany: 'admin',
      companyId: 'c1',
      name: 'Ada Admin',
    };
    mockDashboardApi({
      stats: { ...ZERO_STATS, totalProjects: 3, activeProjects: 2, totalLots: 14 },
      projects: [{ id: 'p1', status: 'active' }],
    });

    renderWithProviders(<DashboardPage />);

    expect(await screen.findByText('Total Projects')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Export PDF/ })).toBeInTheDocument();
    expect(screen.queryByText('Create your first project')).not.toBeInTheDocument();
    expect(screen.queryByText(/once your team adds you/)).not.toBeInTheDocument();
  });

  it('never flashes the setup state while stats are still loading', async () => {
    authState.user = {
      id: 'u5',
      email: 'admin@example.com',
      role: 'admin',
      roleInCompany: 'admin',
      companyId: 'c1',
      name: 'Ada Admin',
    };
    mockDashboardApi({ stats: 'pending', projects: [] });

    renderWithProviders(<DashboardPage />);

    // Even after the projects query has resolved to zero projects, the page
    // stays on the loading spinner until stats actually load.
    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith('/api/projects');
    });
    expect(screen.getByRole('status', { name: 'Loading dashboard' })).toBeInTheDocument();
    expect(screen.queryByText('Create your first project')).not.toBeInTheDocument();
  });
});
