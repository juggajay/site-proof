import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Route, Routes, useLocation } from 'react-router-dom';
import { renderWithProviders } from '@/test/renderWithProviders';

vi.mock('@/lib/auth', () => ({ useAuth: vi.fn() }));
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: vi.fn() };
});
vi.mock('@/shell/shellFlag', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shell/shellFlag')>();
  return { ...actual, useSubbieShellActive: vi.fn() };
});

import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useSubbieShellActive } from '@/shell/shellFlag';
import { ProjectDetailRoute } from './appProjectRoutes';

const apiFetchMock = vi.mocked(apiFetch);
const useAuthMock = vi.mocked(useAuth);
const useSubbieShellActiveMock = vi.mocked(useSubbieShellActive);

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

describe('ProjectDetailRoute subcontractor bridge', () => {
  it('preserves subcontractor company scope when bridging project URLs into the subbie shell', async () => {
    apiFetchMock.mockResolvedValue({ company: { id: 'subbie-1' } });
    useSubbieShellActiveMock.mockReturnValue(true);
    useAuthMock.mockReturnValue({
      loading: false,
      user: {
        id: 'subbie-user-1',
        role: 'subcontractor_admin',
        roleInCompany: 'subcontractor_admin',
        companyId: null,
        hasSubcontractorPortalAccess: true,
      },
    } as unknown as ReturnType<typeof useAuth>);

    renderWithProviders(
      <Routes>
        <Route path="/projects/:projectId" element={<ProjectDetailRoute />} />
        <Route path="/p/work" element={<LocationProbe />} />
      </Routes>,
      { initialEntries: ['/projects/project-1?subcontractorCompanyId=subbie-1'] },
    );

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        '/api/subcontractors/my-company?projectId=project-1&subcontractorCompanyId=subbie-1',
      );
    });
    expect(await screen.findByTestId('location')).toHaveTextContent(
      '/p/work?projectId=project-1&subcontractorCompanyId=subbie-1',
    );
  });
});
