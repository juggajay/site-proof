import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Route, Routes, useSearchParams } from 'react-router-dom';
import { renderWithProviders, screen } from '@/test/renderWithProviders';

const authState = vi.hoisted(() => ({
  user: null as Record<string, unknown> | null,
  isMobile: true,
  shellEnabled: true,
}));

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: authState.user }),
}));
vi.mock('@/hooks/useMediaQuery', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useMediaQuery')>();
  return { ...actual, useIsMobile: () => authState.isMobile };
});
vi.mock('@/shell/shellFlag', () => ({
  useShellV2Enabled: () => authState.shellEnabled,
}));
vi.mock('@/components/dashboard/ProjectDashboard', () => ({
  ProjectDashboard: () => <div>Project dashboard</div>,
}));

import { ProjectDetailPage } from './ProjectDetailPage';

// Probe for the /m shell route so the test can assert the redirect carried the
// project through ?projectId (useEffectiveProjectId reads that param).
function MShellProbe() {
  const [params] = useSearchParams();
  return <div>M shell: {params.get('projectId')}</div>;
}

function renderProjectDetail() {
  return renderWithProviders(
    <Routes>
      <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
      <Route path="/projects/:projectId/foreman/today" element={<div>Foreman today</div>} />
      <Route path="/m" element={<MShellProbe />} />
    </Routes>,
    { initialEntries: ['/projects/p1'] },
  );
}

beforeEach(() => {
  authState.isMobile = true;
  authState.shellEnabled = true;
  authState.user = {
    id: 'u1',
    role: 'member',
    roleInCompany: 'member',
    dashboardRole: 'foreman',
    companyId: 'c1',
  };
});

describe('ProjectDetailPage', () => {
  it('converges a default-shell mobile foreman onto the /m shell scoped to the project (M77)', async () => {
    renderProjectDetail();

    expect(await screen.findByText('M shell: p1')).toBeInTheDocument();
    expect(screen.queryByText('Project dashboard')).not.toBeInTheDocument();
    expect(screen.queryByText('Foreman today')).not.toBeInTheDocument();
  });

  it('keeps a ?shell=off mobile foreman on the classic foreman surface', async () => {
    authState.shellEnabled = false;
    renderProjectDetail();

    expect(await screen.findByText('Foreman today')).toBeInTheDocument();
    expect(screen.queryByText('M shell: p1')).not.toBeInTheDocument();
  });

  it('keeps non-foreman project members on the project dashboard', () => {
    authState.shellEnabled = false;
    authState.user = {
      id: 'u2',
      role: 'member',
      roleInCompany: 'member',
      dashboardRole: null,
      companyId: 'c1',
    };

    renderProjectDetail();

    expect(screen.getByText('Project dashboard')).toBeInTheDocument();
  });
});
