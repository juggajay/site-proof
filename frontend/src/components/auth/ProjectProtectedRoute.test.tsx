import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders, screen } from '@/test/renderWithProviders';

const authState = vi.hoisted(() => ({
  user: null as Record<string, unknown> | null,
  loading: false,
}));
const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: authState.user, loading: authState.loading }),
}));

vi.mock('@/lib/api', () => ({
  apiFetch: apiFetchMock,
}));

import { ProjectProtectedRoute } from './ProjectProtectedRoute';

describe('ProjectProtectedRoute', () => {
  beforeEach(() => {
    authState.user = {
      id: 'user-1',
      email: 'member@example.com',
      role: 'member',
      roleInCompany: 'member',
      companyId: 'company-1',
    };
    authState.loading = false;
    apiFetchMock.mockReset();
  });

  it('allows a company member through when their active project role is allowed', async () => {
    apiFetchMock.mockResolvedValue({
      access: {
        hasProjectAccess: true,
        role: 'project_manager',
        isProjectAdmin: true,
      },
    });

    renderWithProviders(
      <Routes>
        <Route
          path="/projects/:projectId/settings"
          element={
            <ProjectProtectedRoute allowedRoles={['owner', 'admin', 'project_manager']}>
              <div>Project settings loaded</div>
            </ProjectProtectedRoute>
          }
        />
      </Routes>,
      { initialEntries: ['/projects/project-1/settings'] },
    );

    expect(await screen.findByText('Project settings loaded')).toBeInTheDocument();
    expect(apiFetchMock).toHaveBeenCalledWith('/api/projects/project-1/access');
    expect(screen.queryByRole('heading', { name: 'Access Denied' })).not.toBeInTheDocument();
  });

  it('denies a project member when their project role is not allowed for the route', async () => {
    apiFetchMock.mockResolvedValue({
      access: {
        hasProjectAccess: true,
        role: 'viewer',
        isProjectAdmin: false,
      },
    });

    renderWithProviders(
      <Routes>
        <Route
          path="/projects/:projectId/settings"
          element={
            <ProjectProtectedRoute allowedRoles={['owner', 'admin', 'project_manager']}>
              <div>Project settings loaded</div>
            </ProjectProtectedRoute>
          }
        />
      </Routes>,
      { initialEntries: ['/projects/project-1/settings'] },
    );

    expect(await screen.findByRole('heading', { name: 'Access Denied' })).toBeInTheDocument();
    expect(screen.queryByText('Project settings loaded')).not.toBeInTheDocument();
  });
});
