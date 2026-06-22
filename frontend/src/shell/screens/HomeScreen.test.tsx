/**
 * HomeScreen (foreman shell /m) — the no-project first-run state.
 *
 * ShellScreen mounts SyncChip → useOfflineStatus, so that (Dexie/IndexedDB)
 * boundary is mocked. useEffectiveProjectId is mocked to drive the hasNoProject
 * branch. Queries are disabled without a project, so apiFetch is never called.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/lib/useOfflineStatus', () => ({
  useOfflineStatus: () => ({ isOnline: true, pendingSyncCount: 0, isSyncing: false }),
}));
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: { fullName: 'Jay Foreman', roleInCompany: 'foreman' } }),
}));

const mockUseEffectiveProjectId = vi.fn();
vi.mock('@/hooks/useEffectiveProjectId', () => ({
  useEffectiveProjectId: () => mockUseEffectiveProjectId(),
}));

import { HomeScreen } from './HomeScreen';

function renderHome() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <HomeScreen />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('HomeScreen no-project state', () => {
  it('shows a guided empty state instead of dead tiles when the foreman has no project', () => {
    mockUseEffectiveProjectId.mockReturnValue({
      projectId: null,
      isResolving: false,
      hasNoProject: true,
    });

    renderHome();

    // A clear explanation + a way forward, mirroring ForemanMobileDashboard.
    expect(screen.getByRole('heading', { name: /no project assigned/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view projects/i })).toBeInTheDocument();
    // The inert camera/capture affordance must NOT render in this state.
    expect(screen.queryByLabelText(/take a photo/i)).not.toBeInTheDocument();
  });
});
