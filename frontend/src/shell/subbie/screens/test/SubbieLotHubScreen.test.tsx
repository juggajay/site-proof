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
 *   - Holds & Tests tile: per-lot hold count chip + lotId-scoped navigation
 *   - per-module tile gating (itps off / holds+tests off)
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
  holdPoints = [] as unknown[],
} = {}) {
  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation((url: string) => {
    if (url.includes('includeITP=true')) return Promise.resolve({ lots: itpLots });
    if (url.startsWith('/api/lots')) return Promise.resolve({ lots: workLots });
    if (url.startsWith('/api/holdpoints')) return Promise.resolve({ holdPoints });
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
          <Route path="/p/quality" element={<LocationProbe />} />
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

  it('Holds & Tests tile shows the per-lot hold count and deep-links with lotId', async () => {
    setApi({
      holdPoints: [
        { id: 'h1', lotId: 'l1', lotNumber: 'LOT-014', description: 'Bedding', status: 'notified' },
        { id: 'h2', lotId: 'l2', lotNumber: 'LOT-099', description: 'Other', status: 'notified' },
      ],
    });
    renderHub();
    // Waits for the async hold-point query — chip counts only THIS lot's hold point.
    const tile = await screen.findByRole('button', {
      name: /Holds and Tests on this lot — 1 hold points/,
    });
    fireEvent.click(tile);
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/p/quality?projectId=proj-1&lotId=l1',
    );
  });

  it('hides the Inspection tile when the itps module is off', () => {
    _ctx = makeCtx({ itps: false });
    setApi();
    renderHub();
    expect(screen.queryByText(/Inspection/)).toBeNull();
  });

  it('hides the Holds & Tests tile when both holds and tests are off', () => {
    _ctx = makeCtx({ holdPoints: false, testResults: false });
    setApi();
    renderHub();
    expect(screen.queryByRole('button', { name: /Holds and Tests/ })).toBeNull();
  });

  it('shows an honest empty state when no lot modules are enabled (no tiles, no action)', () => {
    _ctx = makeCtx({ itps: false, holdPoints: false, testResults: false });
    setApi();
    renderHub();
    expect(screen.getByText(/nothing enabled for this lot/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Continue inspection' })).toBeNull();
  });
});
