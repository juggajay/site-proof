/**
 * Tests for the subbie shell HomeScreen.
 *
 * MOCKS @/lib/useOfflineStatus (Dexie/IndexedDB) so coverage runs in CI —
 * ShellScreen mounts SyncChip → useOfflineStatus, which fails unmocked.
 *
 * Wrapped in QueryClientProvider + MemoryRouter; apiFetch is mocked per-URL.
 * The subbie context is mocked so each test pins company / module flags.
 *
 * Pins:
 *   - hero states: none / draft-with-total / queried
 *   - NCR tile hidden by default, shown when ncrs module enabled
 *   - Documents / My Company render as standard hub tiles (same gating)
 *   - role chip text (SUBCONTRACTOR)
 *   - bottom bar navigation target (/p/docket)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
  useAuth: () => ({ user: { id: 'u1', fullName: 'Mick Hargraves', role: 'subcontractor' } }),
}));

// apiFetch — resolve per URL.
const apiFetchMock = vi.fn();
vi.mock('@/lib/api', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

// Subbie shell context — pinned per test.
let _ctx: SubbieShellData;
vi.mock('../../subbieShellContext', () => ({
  useSubbieShellContext: () => _ctx,
}));

import { HomeScreen, FinishSetupNotice } from '../HomeScreen';
import type { DocketPrerequisiteState } from '@/pages/subcontractor-portal/subcontractorDashboardHelpers';

interface DocketSeed {
  id: string;
  date: string;
  status: string;
  totalLabourSubmitted: number;
  totalPlantSubmitted: number;
  foremanNotes?: string;
}

function today(): string {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === 'year')!.value;
  const m = parts.find((p) => p.type === 'month')!.value;
  const d = parts.find((p) => p.type === 'day')!.value;
  return `${y}-${m}-${d}`;
}

function makeCtx(over: Partial<SubbieShellData> = {}): SubbieShellData {
  const portalAccess: PortalAccess = { ...DEFAULT_PORTAL_ACCESS };
  const company = {
    id: 'c1',
    companyName: 'Hargraves Earthmoving',
    projectId: 'proj-1',
    projectName: 'Demo Project',
    availableProjects: [],
    employees: [],
    plant: [],
    portalAccess,
  };
  return {
    projectId: 'proj-1',
    company,
    companyName: 'Hargraves Earthmoving',
    projectName: 'Demo Project',
    availableProjects: [],
    loading: false,
    loadError: null,
    isModuleEnabled: (m: keyof PortalAccess) => portalAccess[m],
    ...over,
  };
}

function setApi({ dockets = [] as DocketSeed[] } = {}) {
  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation((url: string) => {
    if (url.startsWith('/api/dockets')) return Promise.resolve({ dockets });
    if (url.startsWith('/api/lots')) return Promise.resolve({ lots: [] });
    if (url.startsWith('/api/notifications')) return Promise.resolve({ notifications: [] });
    return Promise.resolve({});
  });
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function renderHome() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/p']}>
        <Routes>
          <Route path="/p" element={<HomeScreen />} />
          <Route path="/p/docket" element={<div>docket editor</div>} />
          <Route path="/p/ncrs" element={<div>ncrs screen</div>} />
          <Route path="/p/docs" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

describe('subbie shell HomeScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _ctx = makeCtx();
    setApi();
  });

  it('renders the SUBCONTRACTOR role chip and company/project label', () => {
    renderHome();
    expect(screen.getByText('SUBCONTRACTOR')).toBeInTheDocument();
    expect(screen.getByText(/Hargraves Earthmoving — Demo Project/)).toBeInTheDocument();
  });

  it('hero "none" state when there is no docket today', () => {
    setApi({ dockets: [] });
    renderHome();
    expect(screen.getByText("Start today's docket")).toBeInTheDocument();
  });

  it('hero "draft" state shows running total', async () => {
    setApi({
      dockets: [
        {
          id: 'd1',
          date: today(),
          status: 'draft',
          totalLabourSubmitted: 1280,
          totalPlantSubmitted: 1170,
        },
      ],
    });
    renderHome();
    expect(await screen.findByText('Keep adding hours')).toBeInTheDocument();
    // 1280 + 1170 = 2450, formatted as AUD with no decimals.
    expect(await screen.findByText('$2,450')).toBeInTheDocument();
  });

  it('hero "queried" state routes attention to the docket', async () => {
    setApi({
      dockets: [
        {
          id: 'dq',
          date: today(),
          status: 'queried',
          totalLabourSubmitted: 500,
          totalPlantSubmitted: 0,
          foremanNotes: 'Confirm water cart hours',
        },
      ],
    });
    renderHome();
    expect(await screen.findByText('Answer the foreman')).toBeInTheDocument();
  });

  it('hides the NCRs tile by default (ncrs module off)', () => {
    renderHome();
    expect(screen.queryByRole('button', { name: 'NCRs' })).toBeNull();
  });

  it('shows the NCRs tile when the ncrs module is enabled', () => {
    const portalAccess: PortalAccess = { ...DEFAULT_PORTAL_ACCESS, ncrs: true };
    _ctx = makeCtx({ isModuleEnabled: (m) => portalAccess[m] });
    renderHome();
    expect(screen.getByRole('button', { name: 'NCRs' })).toBeInTheDocument();
  });

  it('NCRs tile navigates to /p/ncrs (not the classic page)', () => {
    const portalAccess: PortalAccess = { ...DEFAULT_PORTAL_ACCESS, ncrs: true };
    _ctx = makeCtx({ isModuleEnabled: (m) => portalAccess[m] });
    renderHome();
    fireEvent.click(screen.getByRole('button', { name: 'NCRs' }));
    expect(screen.getByText('ncrs screen')).toBeInTheDocument();
  });

  it('renders Documents and My Company as standard hub tiles', async () => {
    _ctx = makeCtx({
      company: {
        ...makeCtx().company!,
        employees: [{ id: 'e1', name: 'Mick Hargraves', status: 'approved' }],
      },
    });
    // A lot must come back so docket prerequisites are met (My Company gating).
    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation((url: string) => {
      if (url.startsWith('/api/dockets')) return Promise.resolve({ dockets: [] });
      if (url.startsWith('/api/lots'))
        return Promise.resolve({ lots: [{ id: 'l1', lotNumber: 'LOT-1', status: 'in_progress' }] });
      if (url.startsWith('/api/notifications')) return Promise.resolve({ notifications: [] });
      return Promise.resolve({});
    });
    renderHome();
    expect(screen.getByRole('button', { name: 'Documents' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'My Company' })).toBeInTheDocument();
    // No small chip links any more — one uniform card style.
    expect(screen.queryByRole('link', { name: 'Documents' })).toBeNull();
  });

  it('hides the Documents tile when its module is disabled', () => {
    const portalAccess: PortalAccess = { ...DEFAULT_PORTAL_ACCESS, documents: false };
    _ctx = makeCtx({ isModuleEnabled: (m) => portalAccess[m] });
    renderHome();
    expect(screen.queryByRole('button', { name: 'Documents' })).toBeNull();
  });

  it('hides the My Company tile until docket prerequisites are met', () => {
    // Default ctx has no approved crew/plant → prerequisites unmet → no tile.
    renderHome();
    expect(screen.queryByRole('button', { name: 'My Company' })).toBeNull();
  });

  it('Documents tile preserves the selected project query', () => {
    _ctx = makeCtx({ projectId: 'project-2', projectName: 'Second Project' });
    renderHome();
    fireEvent.click(screen.getByRole('button', { name: 'Documents' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/p/docs?projectId=project-2');
  });

  it('encodes projectId before building dashboard query URLs', async () => {
    _ctx = makeCtx({ projectId: 'proj-1&portalModule=itps' });
    renderHome();
    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith(
        '/api/dockets?projectId=proj-1%26portalModule%3Ditps',
      ),
    );
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/lots?projectId=proj-1%26portalModule%3Ditps&portalModule=lots',
    );
  });

  it('no longer renders the duplicate "Add today\'s hours" cambar', () => {
    renderHome();
    expect(screen.queryByRole('button', { name: "Add today's hours" })).toBeNull();
  });

  it('hides the Inspections and Holds & Tests top-level tiles when the lots module is on', () => {
    renderHome();
    expect(screen.queryByRole('button', { name: 'Inspections' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Holds and Tests' })).toBeNull();
  });

  it('keeps Inspections + Holds & Tests tiles as a fallback when the lots module is off', () => {
    const portalAccess: PortalAccess = { ...DEFAULT_PORTAL_ACCESS, lots: false };
    _ctx = makeCtx({ isModuleEnabled: (m) => portalAccess[m] });
    setApi();
    renderHome();
    expect(screen.getByRole('button', { name: 'Inspections' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Holds and Tests' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /My Work/ })).toBeNull();
  });

  it('My Work chip shows the actionable "N checks to do" count from ITP data', async () => {
    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation((url: string) => {
      if (url.startsWith('/api/dockets')) return Promise.resolve({ dockets: [] });
      if (url.includes('includeITP=true')) {
        return Promise.resolve({
          lots: [
            {
              id: 'l1',
              itpInstances: [{ status: 'in_progress' }],
              subcontractorAssignments: [{ canCompleteITP: true }],
            },
            {
              id: 'l2',
              itpInstances: [{ status: 'completed' }],
              subcontractorAssignments: [{ canCompleteITP: true }],
            },
            {
              id: 'l3',
              itpInstances: [{ status: 'not_started' }],
              subcontractorAssignments: [{ canCompleteITP: false }],
            },
          ],
        });
      }
      if (url.startsWith('/api/lots')) {
        return Promise.resolve({ lots: [{ id: 'l1', lotNumber: 'LOT-1', status: 'in_progress' }] });
      }
      if (url.startsWith('/api/notifications')) return Promise.resolve({ notifications: [] });
      return Promise.resolve({});
    });
    renderHome();
    expect(await screen.findByText('1 check to do')).toBeInTheDocument();
  });

  it('does not flash the My Work chip while ITP checks are still loading', async () => {
    const itpsDeferred = createDeferred<{ lots: [] }>();
    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation((url: string) => {
      if (url.startsWith('/api/dockets')) return Promise.resolve({ dockets: [] });
      if (url.includes('includeITP=true')) return itpsDeferred.promise;
      if (url.startsWith('/api/lots')) return Promise.resolve({ lots: [] });
      if (url.startsWith('/api/notifications')) return Promise.resolve({ notifications: [] });
      return Promise.resolve({});
    });

    renderHome();

    // While the ITP query is pending, no chip text at all (avoid the green
    // "0 checks to do" flash).
    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith(expect.stringContaining('includeITP=true')),
    );
    expect(screen.queryByText(/checks? to do/)).toBeNull();

    itpsDeferred.resolve({ lots: [] });
    expect(await screen.findByText('0 checks to do')).toBeInTheDocument();
  });

  it('does not show the no-lots warning before assigned lots finish loading', async () => {
    const lotsDeferred = createDeferred<{ lots: [] }>();
    _ctx = makeCtx({
      company: {
        ...makeCtx().company!,
        employees: [{ id: 'e1', name: 'Mick Hargraves', status: 'approved' }],
      },
    });
    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation((url: string) => {
      if (url.startsWith('/api/dockets')) return Promise.resolve({ dockets: [] });
      if (url.startsWith('/api/lots')) return lotsDeferred.promise;
      if (url.startsWith('/api/notifications')) return Promise.resolve({ notifications: [] });
      return Promise.resolve({});
    });

    renderHome();

    expect(screen.getByText("Start today's docket")).toBeInTheDocument();
    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith(expect.stringMatching(/^\/api\/lots/)),
    );
    expect(screen.queryByText(/no lots assigned yet/i)).not.toBeInTheDocument();

    lotsDeferred.resolve({ lots: [] });
    expect(await screen.findByText(/no lots assigned yet/i)).toBeInTheDocument();
  });
});

describe('FinishSetupNotice (M78)', () => {
  const renderNotice = (state: DocketPrerequisiteState) =>
    render(
      <MemoryRouter>
        <FinishSetupNotice state={state} myCompanyLink="/p/company?projectId=p1" />
      </MemoryRouter>,
    );

  it('shows the finish-setup notice with a My Company link when there are no approved resources', () => {
    renderNotice({
      hasDocketResources: false,
      needsLotAssignment: false,
      lotsModuleDisabled: false,
      prerequisitesMet: false,
    });

    expect(screen.getByText(/finish setup before filling out a docket/i)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /my company/i });
    expect(link.getAttribute('href')).toBe('/p/company?projectId=p1');
  });

  it('renders nothing once prerequisites are met', () => {
    const { container } = renderNotice({
      hasDocketResources: true,
      needsLotAssignment: false,
      lotsModuleDisabled: false,
      prerequisitesMet: true,
    });
    expect(container).toBeEmptyDOMElement();
  });
});
