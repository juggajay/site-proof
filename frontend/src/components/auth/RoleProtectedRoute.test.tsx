import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { ReactElement } from 'react';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders, screen } from '@/test/renderWithProviders';

const authState = vi.hoisted(() => ({
  user: null as Record<string, unknown> | null,
  loading: false,
}));

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: authState.user, loading: authState.loading }),
}));

import { RoleProtectedRoute } from './RoleProtectedRoute';

function renderRoute(element: ReactElement) {
  return renderWithProviders(
    <Routes>
      <Route path="/" element={element} />
      <Route path="/login" element={<div>Login</div>} />
      <Route path="/dashboard" element={<div>Dashboard</div>} />
    </Routes>,
  );
}

beforeEach(() => {
  authState.loading = false;
  authState.user = {
    id: 'u1',
    role: 'member',
    roleInCompany: 'member',
    dashboardRole: 'foreman',
    companyId: 'c1',
  };
});

describe('RoleProtectedRoute', () => {
  it('does not use dashboardRole for ordinary company-role guards by default', () => {
    renderRoute(
      <RoleProtectedRoute allowedRoles={['foreman']}>
        <div>Protected Content</div>
      </RoleProtectedRoute>,
    );

    expect(screen.getByRole('heading', { name: 'Access Denied' })).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('can use dashboardRole for project-scoped route guards', () => {
    renderRoute(
      <RoleProtectedRoute allowedRoles={['foreman']} allowProjectScopedRole>
        <div>Protected Content</div>
      </RoleProtectedRoute>,
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Access Denied' })).not.toBeInTheDocument();
  });

  it('does not let subcontractor portal users borrow dashboardRole into internal routes', () => {
    authState.user = {
      id: 'sub1',
      role: 'subcontractor',
      roleInCompany: 'subcontractor',
      dashboardRole: 'foreman',
      companyId: null,
      hasSubcontractorPortalAccess: true,
    };

    renderRoute(
      <RoleProtectedRoute allowedRoles={['foreman']} allowProjectScopedRole>
        <div>Protected Content</div>
      </RoleProtectedRoute>,
    );

    expect(screen.getByRole('heading', { name: 'Access Denied' })).toBeInTheDocument();
  });
});
