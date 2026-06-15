import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders, screen } from '@/test/renderWithProviders';

vi.mock('@/lib/auth', () => ({ useAuth: vi.fn() }));
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: vi.fn() };
});

import { Sidebar } from './Sidebar';
import { useAuth } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { useUIStore } from '@/stores/uiStore';

const useAuthMock = vi.mocked(useAuth);
const apiFetchMock = vi.mocked(apiFetch);

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
  apiFetchMock.mockResolvedValue({
    project: { name: 'Project One', settings: { enabledModules: {} } },
  });
});

describe('Sidebar project navigation', () => {
  it('hides internal-only project links for company-level viewers', () => {
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

  it('keeps internal project links visible for non-viewer field roles', () => {
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

    expect(screen.getByRole('link', { name: /ITPs/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Hold Points/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /NCRs/i })).toBeInTheDocument();
  });
});
