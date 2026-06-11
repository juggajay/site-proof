import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders, screen } from '@/test/renderWithProviders';

const authState = vi.hoisted(() => ({
  user: null as Record<string, unknown> | null,
  isMobile: true,
}));

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: authState.user }),
}));
vi.mock('@/hooks/useMediaQuery', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useMediaQuery')>();
  return { ...actual, useIsMobile: () => authState.isMobile };
});
vi.mock('@/components/dashboard/ProjectDashboard', () => ({
  ProjectDashboard: () => <div>Project dashboard</div>,
}));

import { ProjectDetailPage } from './ProjectDetailPage';

function renderProjectDetail() {
  return renderWithProviders(
    <Routes>
      <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
      <Route path="/projects/:projectId/foreman/today" element={<div>Foreman today</div>} />
    </Routes>,
    { initialEntries: ['/projects/p1'] },
  );
}

beforeEach(() => {
  authState.isMobile = true;
  authState.user = {
    id: 'u1',
    role: 'member',
    roleInCompany: 'member',
    dashboardRole: 'foreman',
    companyId: 'c1',
  };
});

describe('ProjectDetailPage', () => {
  it('redirects mobile project-role foremen into the foreman project surface', async () => {
    renderProjectDetail();

    expect(await screen.findByText('Foreman today')).toBeInTheDocument();
    expect(screen.queryByText('Project dashboard')).not.toBeInTheDocument();
  });

  it('keeps non-foreman project members on the project dashboard', () => {
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
