import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { ReactElement } from 'react';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders, screen } from '@/test/renderWithProviders';

const authState = vi.hoisted(() => ({
  user: null as Record<string, unknown> | null,
  loading: false,
}));

const apiState = vi.hoisted(() => ({
  role: 'project_manager',
  error: null as Error | null,
}));

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: authState.user, loading: authState.loading, sessionExpired: false }),
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    apiFetch: vi.fn(async () => {
      if (apiState.error) {
        throw apiState.error;
      }

      return {
        access: {
          hasProjectAccess: true,
          role: apiState.role,
          isProjectAdmin: apiState.role === 'project_manager',
        },
      };
    }),
  };
});

import { ProjectProtectedRoute } from './ProjectProtectedRoute';

function renderRoute(element: ReactElement, initialEntry = '/projects/project-1/claims') {
  return renderWithProviders(
    <Routes>
      <Route path="/projects/:projectId/claims" element={element} />
      <Route path="/projects" element={<div>Projects</div>} />
      <Route path="/login" element={<div>Login</div>} />
    </Routes>,
    { initialEntries: [initialEntry] },
  );
}

beforeEach(() => {
  authState.loading = false;
  authState.user = {
    id: 'u1',
    role: 'member',
    roleInCompany: 'member',
    dashboardRole: 'project_manager',
    companyId: 'c1',
  };
  apiState.role = 'project_manager';
  apiState.error = null;
});

describe('ProjectProtectedRoute', () => {
  it('allows users whose role on this project is allowed', async () => {
    renderRoute(
      <ProjectProtectedRoute allowedRoles={['owner', 'admin', 'project_manager']}>
        <div>Claims route reached</div>
      </ProjectProtectedRoute>,
    );

    expect(await screen.findByText('Claims route reached')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Access Denied' })).not.toBeInTheDocument();
  });

  it('does not let a global dashboard role unlock a project where the API returns viewer', async () => {
    apiState.role = 'viewer';

    renderRoute(
      <ProjectProtectedRoute allowedRoles={['owner', 'admin', 'project_manager']}>
        <div>Claims route reached</div>
      </ProjectProtectedRoute>,
    );

    expect(await screen.findByRole('heading', { name: 'Access Denied' })).toBeInTheDocument();
    expect(screen.queryByText('Claims route reached')).not.toBeInTheDocument();
  });

  it('shows access denied when the project access endpoint rejects the user', async () => {
    apiState.error = new Error('Access denied to this project');

    renderRoute(
      <ProjectProtectedRoute allowedRoles={['owner', 'admin', 'project_manager']}>
        <div>Claims route reached</div>
      </ProjectProtectedRoute>,
    );

    expect(await screen.findByText('Access denied to this project')).toBeInTheDocument();
    expect(screen.queryByText('Claims route reached')).not.toBeInTheDocument();
  });

  it('redirects unauthenticated users to login', async () => {
    authState.user = null;

    renderRoute(
      <ProjectProtectedRoute allowedRoles={['owner', 'admin', 'project_manager']}>
        <div>Claims route reached</div>
      </ProjectProtectedRoute>,
    );

    expect(await screen.findByText('Login')).toBeInTheDocument();
    expect(screen.queryByText('Claims route reached')).not.toBeInTheDocument();
  });
});
