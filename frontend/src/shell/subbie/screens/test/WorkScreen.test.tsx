/**
 * Tests for the subbie shell WorkScreen (/p/work).
 *
 * MOCKS @/lib/useOfflineStatus (ShellScreen → SyncChip → Dexie) for CI coverage.
 * Pins: the exact data URL (portalModule=lots), module-gate denial, status
 * grouping (In Progress / Not Started / On Hold / Completed), lot-tap
 * navigation, and LOTS ONLY — no hub tiles below the groups (locked design:
 * NCRs/Documents live behind the lot in SubbieLotHubScreen).
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
          <Route path="/p/lots/:lotId" element={<div>lot hub</div>} />
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

  it('fetches assigned lots with the portalModule=lots URL (paginated)', async () => {
    setLots([]);
    renderWork();
    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith(
        '/api/lots?projectId=proj-1&portalModule=lots&limit=100&page=1',
      ),
    );
  });

  it('encodes projectId before building the assigned lots URL', async () => {
    _ctx = makeCtx({ projectId: 'proj-1&subcontractorView=false' });
    setLots([]);
    renderWork();
    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith(
        '/api/lots?projectId=proj-1%26subcontractorView%3Dfalse&portalModule=lots&limit=100&page=1',
      ),
    );
  });

  it('follows pagination so lots beyond the first page stay visible (F-07)', async () => {
    // 35 assigned lots across two pages — the first page alone would hide 15.
    const page1 = Array.from({ length: 20 }, (_, i) => ({
      id: `l${i}`,
      lotNumber: `LOT-${String(i).padStart(3, '0')}`,
      status: 'in_progress',
    }));
    const page2 = Array.from({ length: 15 }, (_, i) => ({
      id: `l${i + 20}`,
      lotNumber: `LOT-${String(i + 20).padStart(3, '0')}`,
      status: 'in_progress',
    }));
    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation((url: string) => {
      if (url.includes('page=2'))
        return Promise.resolve({ lots: page2, pagination: { totalPages: 2 } });
      return Promise.resolve({ lots: page1, pagination: { totalPages: 2 } });
    });
    renderWork();
    // A lot from the SECOND page must render.
    expect(await screen.findByText('LOT-034')).toBeInTheDocument();
    expect(screen.getByText('LOT-000')).toBeInTheDocument();
    expect(screen.getByText(new RegExp('In Progress \\(35\\)'))).toBeInTheDocument();
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

  it('navigates to the lot hub on tap', async () => {
    setLots([{ id: 'l1', lotNumber: 'LOT-001', status: 'in_progress' }]);
    renderWork();
    const card = await screen.findByRole('button', { name: /Lot LOT-001/ });
    fireEvent.click(card);
    expect(await screen.findByText('lot hub')).toBeInTheDocument();
  });

  it('lot cards still navigate to the hub even when the itps module is off', async () => {
    const portalAccess: PortalAccess = { ...DEFAULT_PORTAL_ACCESS, itps: false };
    _ctx = makeCtx({ isModuleEnabled: (m: keyof PortalAccess) => portalAccess[m] });
    setLots([{ id: 'l1', lotNumber: 'LOT-001', status: 'in_progress' }]);
    renderWork();
    const card = await screen.findByRole('button', { name: /Lot LOT-001/ });
    fireEvent.click(card);
    expect(await screen.findByText('lot hub')).toBeInTheDocument();
  });

  it('renders lots only — no hub tiles or links below the groups (even with all modules on)', async () => {
    const portalAccess: PortalAccess = { ...DEFAULT_PORTAL_ACCESS, ncrs: true };
    _ctx = makeCtx({ isModuleEnabled: (m: keyof PortalAccess) => portalAccess[m] });
    setLots([{ id: 'l1', lotNumber: 'LOT-001', status: 'in_progress' }]);
    renderWork();
    await screen.findByText('LOT-001');
    ['Holds and Tests', 'NCRs', 'Documents'].forEach((name) => {
      expect(screen.queryByRole('button', { name })).toBeNull();
    });
    expect(screen.queryByRole('link', { name: /View all holds & tests/i })).toBeNull();
  });
});
