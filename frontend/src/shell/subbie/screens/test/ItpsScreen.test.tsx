/**
 * Tests for the subbie shell ItpsScreen (/p/itps).
 *
 * MOCKS @/lib/useOfflineStatus for CI coverage (ShellScreen → SyncChip → Dexie).
 * Pins: the exact data URL (includeITP=true&portalModule=itps), module-gate
 * denial, the permission pill BOTH ways (canCompleteITP true → "YOU CAN
 * COMPLETE", false → "VIEW ONLY — ASK YOUR PM"), filter to lots with instances,
 * and lot-tap navigation to the run.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { SubbieShellData } from '../../subbieShellData';
import {
  DEFAULT_PORTAL_ACCESS,
  type PortalAccess,
} from '@/pages/subcontractor-portal/portalAccessModel';

vi.mock('@/lib/useOfflineStatus', () => ({
  useOfflineStatus: () => ({ isOnline: true, pendingSyncCount: 0, isSyncing: false }),
}));
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: { id: 'u1', fullName: 'Mick', role: 'subcontractor' } }),
}));
vi.mock('@/hooks/useEffectiveProjectId', () => ({
  useEffectiveProjectId: () => ({ projectId: 'proj-1', isResolving: false }),
}));

const apiFetchMock = vi.fn();
vi.mock('@/lib/api', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

let _ctx: SubbieShellData;
vi.mock('../../subbieShellContext', () => ({
  useSubbieShellContext: () => _ctx,
}));

import { ItpsScreen } from '../ItpsScreen';

function makeCtx(over: Partial<SubbieShellData> = {}): SubbieShellData {
  const portalAccess: PortalAccess = { ...DEFAULT_PORTAL_ACCESS };
  return {
    projectId: 'proj-1',
    company: { portalAccess } as never,
    companyName: 'Hargraves Earthmoving',
    projectName: 'Demo Project',
    availableProjects: [],
    loading: false,
    loadError: null,
    isModuleEnabled: (m: keyof PortalAccess) => portalAccess[m],
    ...over,
  };
}

interface LotSeed {
  id: string;
  lotNumber: string;
  status: string;
  itpInstances?: Array<{ id: string; status: string; template: { id: string; name: string } }>;
  subcontractorAssignments?: Array<{ canCompleteITP: boolean; itpRequiresVerification: boolean }>;
}

function setLots(lots: LotSeed[]) {
  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation((url: string) => {
    if (url.startsWith('/api/lots')) return Promise.resolve({ lots });
    return Promise.resolve({});
  });
}

function renderItps() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/p/itps']}>
        <Routes>
          <Route path="/p/itps" element={<ItpsScreen />} />
          <Route path="/p/lots/:lotId/itp" element={<div>itp run</div>} />
          <Route path="/p" element={<div>home</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const instance = (status: string) => ({
  id: 'inst-1',
  status,
  template: { id: 't1', name: 'Stormwater ITP' },
});

describe('subbie shell ItpsScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _ctx = makeCtx();
  });

  it('module-gate denial renders when itps is disabled (no fetch)', () => {
    _ctx = makeCtx({ isModuleEnabled: () => false });
    setLots([]);
    renderItps();
    expect(screen.getByRole('alert')).toHaveTextContent(/not enabled for your company/i);
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it('fetches with the includeITP=true & portalModule=itps URL', async () => {
    setLots([]);
    renderItps();
    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith(
        '/api/lots?projectId=proj-1&includeITP=true&portalModule=itps',
      ),
    );
  });

  it('filters out lots without ITP instances', async () => {
    setLots([
      {
        id: 'l1',
        lotNumber: 'LOT-001',
        status: 'in_progress',
        itpInstances: [instance('in_progress')],
      },
      { id: 'l2', lotNumber: 'LOT-002', status: 'in_progress' },
    ]);
    renderItps();
    await screen.findByText('LOT-001');
    expect(screen.queryByText('LOT-002')).not.toBeInTheDocument();
  });

  it('shows "YOU CAN COMPLETE" when an assignment grants completion', async () => {
    setLots([
      {
        id: 'l1',
        lotNumber: 'LOT-001',
        status: 'in_progress',
        itpInstances: [instance('in_progress')],
        subcontractorAssignments: [{ canCompleteITP: true, itpRequiresVerification: false }],
      },
    ]);
    renderItps();
    expect(await screen.findByText('YOU CAN COMPLETE')).toBeInTheDocument();
    expect(screen.queryByText(/VIEW ONLY/)).not.toBeInTheDocument();
  });

  it('shows "VIEW ONLY — ASK YOUR PM" when no assignment grants completion', async () => {
    setLots([
      {
        id: 'l1',
        lotNumber: 'LOT-001',
        status: 'in_progress',
        itpInstances: [instance('in_progress')],
        subcontractorAssignments: [{ canCompleteITP: false, itpRequiresVerification: false }],
      },
    ]);
    renderItps();
    expect(await screen.findByText(/VIEW ONLY — ASK YOUR PM/)).toBeInTheDocument();
    expect(screen.queryByText('YOU CAN COMPLETE')).not.toBeInTheDocument();
  });

  it('navigates to the ITP run on card tap', async () => {
    setLots([
      {
        id: 'l1',
        lotNumber: 'LOT-001',
        status: 'in_progress',
        itpInstances: [instance('in_progress')],
        subcontractorAssignments: [{ canCompleteITP: true, itpRequiresVerification: false }],
      },
    ]);
    renderItps();
    const card = await screen.findByRole('button', { name: /LOT-001/ });
    fireEvent.click(card);
    expect(await screen.findByText('itp run')).toBeInTheDocument();
  });
});
