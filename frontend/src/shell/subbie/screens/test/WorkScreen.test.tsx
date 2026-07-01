/**
 * Tests for the subbie shell WorkScreen (/p/work).
 *
 * MOCKS @/lib/useOfflineStatus (ShellScreen → SyncChip → Dexie) for CI coverage.
 * Pins: the exact data URL (portalModule=lots), module-gate denial, status
 * grouping (In Progress / Not Started / On Hold / Completed), and lot-tap
 * navigation only when the itps module is enabled.
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

import { WorkScreen } from '../WorkScreen';

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
  activity?: string;
  status: string;
  area?: number;
}

function setLots(lots: LotSeed[]) {
  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation((url: string) => {
    if (url.startsWith('/api/lots')) return Promise.resolve({ lots });
    return Promise.resolve({});
  });
}

function renderWork() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/p/work']}>
        <Routes>
          <Route path="/p/work" element={<WorkScreen />} />
          <Route path="/p/lots/:lotId/itp" element={<div>itp run</div>} />
          <Route path="/p" element={<div>home</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('subbie shell WorkScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _ctx = makeCtx();
  });

  it('module-gate denial renders when lots is disabled (no fetch)', () => {
    _ctx = makeCtx({ isModuleEnabled: () => false });
    setLots([]);
    renderWork();
    expect(screen.getByRole('alert')).toHaveTextContent(/not enabled for your company/i);
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it('fetches assigned lots with the portalModule=lots URL', async () => {
    setLots([]);
    renderWork();
    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith('/api/lots?projectId=proj-1&portalModule=lots'),
    );
  });

  it('encodes projectId before building the assigned lots URL', async () => {
    _ctx = makeCtx({ projectId: 'proj-1&subcontractorView=false' });
    setLots([]);
    renderWork();
    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith(
        '/api/lots?projectId=proj-1%26subcontractorView%3Dfalse&portalModule=lots',
      ),
    );
  });

  it('groups lots by status into the four sections', async () => {
    setLots([
      { id: 'l1', lotNumber: 'LOT-001', status: 'in_progress' },
      { id: 'l2', lotNumber: 'LOT-002', status: 'not_started' },
      { id: 'l3', lotNumber: 'LOT-003', status: 'on_hold' },
      { id: 'l4', lotNumber: 'LOT-004', status: 'completed' },
    ]);
    renderWork();
    await screen.findByText('LOT-001');
    ['In Progress', 'Not Started', 'On Hold', 'Completed'].forEach((group) => {
      expect(screen.getByText(new RegExp(`${group} \\(1\\)`))).toBeInTheDocument();
    });
  });

  it('keeps later lifecycle statuses visible instead of dropping assigned lots', async () => {
    setLots([
      { id: 'l1', lotNumber: 'LOT-CONF', status: 'conformed' },
      { id: 'l2', lotNumber: 'LOT-NCR', status: 'ncr_raised' },
      { id: 'l3', lotNumber: 'LOT-TEST', status: 'awaiting_test' },
      { id: 'l4', lotNumber: 'LOT-CUSTOM', status: 'custom_status' },
    ]);
    renderWork();

    await screen.findByText('LOT-CONF');
    ['Completed', 'On Hold', 'In Progress', 'Other'].forEach((group) => {
      expect(screen.getByText(new RegExp(`${group} \\(1\\)`))).toBeInTheDocument();
    });
    ['CONFORMED', 'NCR RAISED', 'AWAITING TEST', 'CUSTOM STATUS'].forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  it('navigates to the ITP run on tap when the itps module is enabled', async () => {
    setLots([{ id: 'l1', lotNumber: 'LOT-001', status: 'in_progress' }]);
    renderWork();
    const card = await screen.findByRole('button', { name: /Lot LOT-001/ });
    fireEvent.click(card);
    expect(await screen.findByText('itp run')).toBeInTheDocument();
  });

  it('lot cards do not navigate when the itps module is disabled', async () => {
    const portalAccess: PortalAccess = { ...DEFAULT_PORTAL_ACCESS, itps: false };
    _ctx = makeCtx({ isModuleEnabled: (m: keyof PortalAccess) => portalAccess[m] });
    setLots([{ id: 'l1', lotNumber: 'LOT-001', status: 'in_progress' }]);
    renderWork();
    // Rendered as a non-button presentation card (no role=button), so no nav.
    await screen.findByText('LOT-001');
    expect(screen.queryByRole('button', { name: /Lot LOT-001/ })).not.toBeInTheDocument();
  });
});
