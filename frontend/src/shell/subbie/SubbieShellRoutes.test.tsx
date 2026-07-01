import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SubbieShellData } from './subbieShellData';
import type { PortalAccess } from '@/pages/subcontractor-portal/portalAccessModel';

vi.mock('@/lib/useOfflineStatus', () => ({
  useOfflineStatus: () => ({ isOnline: true, pendingSyncCount: 0, isSyncing: false }),
}));
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({
    user: { id: 'u1', fullName: 'E2E Subbie', roleInCompany: 'subcontractor' },
  }),
}));
vi.mock('@/hooks/useEffectiveProjectId', () => ({
  useEffectiveProjectId: () => ({ projectId: null, isResolving: false }),
}));

let shellData: SubbieShellData;
vi.mock('./subbieShellData', () => ({
  useSubbieShellData: () => shellData,
}));

import { SubbieShellRoutes } from './SubbieShellRoutes';

function makeShellData(overrides: Partial<SubbieShellData> = {}): SubbieShellData {
  return {
    projectId: 'proj-1',
    subcontractorCompanyId: 'sub-1',
    company: null,
    companyName: null,
    projectName: null,
    availableProjects: [],
    loading: false,
    loadError: null,
    isModuleEnabled: (_module: keyof PortalAccess) => true,
    ...overrides,
  };
}

function renderSubbieShell() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/p']}>
        <Routes>
          <Route path="/p/*" element={<SubbieShellRoutes />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SubbieShellRoutes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    shellData = makeShellData();
  });

  it('shows bootstrap access errors before rendering child portal screens', () => {
    shellData = makeShellData({
      projectId: null,
      subcontractorCompanyId: null,
      loadError: 'Select a subcontractor company for this project.',
    });

    renderSubbieShell();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Select a subcontractor company for this project.',
    );
    expect(screen.queryByText('Start today')).toBeNull();
  });
});
