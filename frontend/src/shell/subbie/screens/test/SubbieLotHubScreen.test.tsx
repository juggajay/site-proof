/**
 * Tests for the subbie lot hub (/p/lots/:lotId).
 *
 * MOCKS @/lib/useOfflineStatus (ShellScreen → SyncChip → Dexie) for CI coverage.
 * apiFetch is mocked per-URL; the subbie context is pinned per test.
 *
 * Pins:
 *   - lot number title from the shared portalAssignedWork cache
 *   - Inspection tile: template name in the aria-label (no visible description
 *     line — uniform card anatomy) + canCompleteITP permission signal both ways
 *   - continue-inspection primary visibility (actionable vs completed vs view-only)
 *   - cards are exactly Inspection / NCRs / Documents (Holds & Tests removed)
 *   - NCRs card: lotId-scoped navigation (server-side filter on /p/ncrs)
 *   - Documents card: unscoped navigation; per-module gating + empty state
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
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

const apiFetchMock = vi.fn();
vi.mock('@/lib/api', () => ({ apiFetch: (...a: unknown[]) => apiFetchMock(...a) }));

let _ctx: SubbieShellData;
vi.mock('../../subbieShellContext', () => ({ useSubbieShellContext: () => _ctx }));

import { SubbieLotHubScreen } from '../SubbieLotHubScreen';

function makeCtx(modules: Partial<PortalAccess> = {}): SubbieShellData {
  const portalAccess: PortalAccess = { ...DEFAULT_PORTAL_ACCESS, ...modules };
  return {
    projectId: 'proj-1',
    company: null,
    companyName: 'Hargraves',
    projectName: 'Demo',
    availableProjects: [],
    loading: false,
    loadError: null,
    isModuleEnabled: (m) => portalAccess[m],
  };
}

interface ItpLotSeed {
  id: string;
  lotNumber: string;
  itpInstances?: Array<{ id: string; status: string; template: { id: string; name: string } }>;
  subcontractorAssignments?: Array<{ canCompleteITP: boolean }>;
}

function setApi({
  workLots = [{ id: 'l1', lotNumber: 'LOT-014', status: 'in_progress' }],
  itpLots = [] as ItpLotSeed[],
} = {}) {
  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation((url: string) => {
    if (url.includes('includeITP=true')) return Promise.resolve({ lots: itpLots });
    if (url.startsWith('/api/lots')) return Promise.resolve({ lots: workLots });
    return Promise.resolve({});
  });
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function renderHub(path = '/p/lots/l1') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/p/lots/:lotId" element={<SubbieLotHubScreen />} />
          <Route path="/p/lots/:lotId/itp" element={<LocationProbe />} />
          <Route path="/p/ncrs" element={<LocationProbe />} />
          <Route path="/p/docs" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const completableItp: ItpLotSeed = {
  id: 'l1',
  lotNumber: 'LOT-014',
  itpInstances: [
    { id: 'i1', status: 'in_progress', template: { id: 't1', name: 'Concrete Pour ITP' } },
  ],
  subcontractorAssignments: [{ canCompleteITP: true }],
};

describe('subbie lot hub (SubbieLotHubScreen)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _ctx = makeCtx();
    setApi();
  });

  it('shows the lot number as the title', async () => {
    setApi({ itpLots: [completableItp] });
    renderHub();
    expect(await screen.findByRole('heading', { name: 'LOT-014' })).toBeInTheDocument();
  });

  it('renders the Inspection tile with the template name in its aria-label and "YOU CAN COMPLETE" when the crew can complete', async () => {
    setApi({ itpLots: [completableItp] });
    renderHub();
    // Uniform card anatomy: no visible description line — the template name
    // lives in the accessible name only.
    expect(
      await screen.findByRole('button', { name: /Inspection — Concrete Pour ITP/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Concrete Pour ITP')).toBeNull();
    expect(screen.getByText('YOU CAN COMPLETE')).toBeInTheDocument();
    // The ITP status pill is dropped — only the permission pill remains, so the
    // card matches its icon+label+chevron siblings (status stays in aria-label).
    // (The lot-status header still shows IN PROGRESS as a .shell-mono line — the
    // assertion targets the dropped .shell-pill specifically.)
    expect(
      screen.queryAllByText('IN PROGRESS').some((el) => el.className.includes('shell-pill')),
    ).toBe(false);
  });

  it('shows the view-only permission signal when the crew cannot complete', async () => {
    setApi({
      itpLots: [{ ...completableItp, subcontractorAssignments: [{ canCompleteITP: false }] }],
    });
    renderHub();
    expect(await screen.findByText(/VIEW ONLY — ASK YOUR PM/)).toBeInTheDocument();
  });

  it('shows the Continue inspection primary when actionable', async () => {
    setApi({ itpLots: [completableItp] });
    renderHub();
    expect(await screen.findByRole('button', { name: 'Continue inspection' })).toBeInTheDocument();
  });

  it('hides Continue inspection once the ITP is completed', async () => {
    setApi({
      itpLots: [
        {
          ...completableItp,
          itpInstances: [
            { id: 'i1', status: 'completed', template: { id: 't1', name: 'Concrete Pour ITP' } },
          ],
        },
      ],
    });
    renderHub();
    await screen.findByRole('button', { name: /Inspection — Concrete Pour ITP/ });
    expect(screen.queryByRole('button', { name: 'Continue inspection' })).toBeNull();
  });

  it('hides Continue inspection for a view-only crew', async () => {
    setApi({
      itpLots: [{ ...completableItp, subcontractorAssignments: [{ canCompleteITP: false }] }],
    });
    renderHub();
    await screen.findByRole('button', { name: /Inspection — Concrete Pour ITP/ });
    expect(screen.queryByRole('button', { name: 'Continue inspection' })).toBeNull();
  });

  it('never renders a Holds & Tests card (removed from the subbie UI)', async () => {
    renderHub();
    await screen.findByRole('heading', { name: 'LOT-014' });
    expect(screen.queryByRole('button', { name: /Holds and Tests/ })).toBeNull();
  });

  it('NCRs card deep-links to /p/ncrs with the lotId scope when the ncrs module is on', async () => {
    _ctx = makeCtx({ ncrs: true });
    setApi();
    renderHub();
    fireEvent.click(await screen.findByRole('button', { name: 'NCRs on this lot' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/p/ncrs?projectId=proj-1&lotId=l1');
  });

  it('hides the NCRs card when the ncrs module is off (default)', async () => {
    renderHub();
    await screen.findByRole('heading', { name: 'LOT-014' });
    expect(screen.queryByRole('button', { name: /NCRs/ })).toBeNull();
  });

  it('Documents card navigates unscoped to /p/docs (portal docs are not lot-scoped)', async () => {
    renderHub();
    fireEvent.click(await screen.findByRole('button', { name: 'Documents' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/p/docs?projectId=proj-1');
    expect(screen.getByTestId('location')).not.toHaveTextContent('lotId');
  });

  it('hides the Documents card when the documents module is off', async () => {
    _ctx = makeCtx({ documents: false });
    setApi();
    renderHub();
    await screen.findByRole('heading', { name: 'LOT-014' });
    expect(screen.queryByRole('button', { name: 'Documents' })).toBeNull();
  });

  it('hides the Inspection tile when the itps module is off', () => {
    _ctx = makeCtx({ itps: false });
    setApi();
    renderHub();
    expect(screen.queryByText(/Inspection/)).toBeNull();
  });

  it('shows an honest empty state when itps, ncrs, and documents are all off', () => {
    _ctx = makeCtx({ itps: false, ncrs: false, documents: false });
    setApi();
    renderHub();
    expect(screen.getByText(/nothing enabled for this lot/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Continue inspection' })).toBeNull();
  });
});
