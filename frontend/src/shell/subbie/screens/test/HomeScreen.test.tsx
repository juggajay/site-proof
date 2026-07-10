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
 *   - hero states: setup (prerequisites unmet → taps to My Company; replaces
 *     the deleted FinishSetupNotice) / none / draft-with-total / queried
 *   - default home = exactly My Dockets / My Work / My Company hub tiles
 *   - NCRs / Documents live behind the lot (SubbieLotHubScreen) when lots is
 *     on; module-gated home fallback tiles only when lots is off; Holds &
 *     Tests is removed from the subbie UI entirely
 *   - My Company always present as a plain tile: company name as title, no
 *     chips; falls back to the "My Company" label when no company is loaded
 *   - role chip text (SUBCONTRACTOR)
 *   - bottom bar navigation target (/p/docket)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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
let _role = 'subcontractor';
let _actualRole = 'subcontractor';
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({
    user: { id: 'u1', fullName: 'Mick Hargraves', role: _role },
    actualRole: _actualRole,
  }),
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

import { HomeScreen } from '../HomeScreen';

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

function setApi({ dockets = [] as DocketSeed[], lots = [] as unknown[] } = {}) {
  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation((url: string) => {
    if (url.startsWith('/api/dockets')) return Promise.resolve({ dockets });
    if (url.startsWith('/api/lots')) return Promise.resolve({ lots });
    if (url.startsWith('/api/notifications')) return Promise.resolve({ notifications: [] });
    return Promise.resolve({});
  });
}

// Docket-prerequisites-met fixtures: an approved employee + an assigned lot,
// so the hero shows docket states instead of the setup call-to-action.
const READY_LOT = { id: 'l1', lotNumber: 'LOT-1', status: 'in_progress' };

function makeReadyCtx(over: Partial<SubbieShellData> = {}): SubbieShellData {
  return makeCtx({
    company: {
      ...makeCtx().company!,
      employees: [{ id: 'e1', name: 'Mick Hargraves', status: 'approved' }],
    },
    ...over,
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
          <Route path="/p/company" element={<LocationProbe />} />
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
    _role = 'subcontractor';
    _actualRole = 'subcontractor';
    _ctx = makeCtx();
    setApi();
  });

  it('renders the SUBCONTRACTOR role chip and company/project label', () => {
    renderHome();
    expect(screen.getByText('SUBCONTRACTOR')).toBeInTheDocument();
    expect(screen.getByText(/Hargraves Earthmoving — Demo Project/)).toBeInTheDocument();
  });

  it('hero "none" state when there is no docket today (prerequisites met)', () => {
    _ctx = makeReadyCtx();
    setApi({ dockets: [], lots: [READY_LOT] });
    renderHome();
    expect(screen.getByText("Start today's docket")).toBeInTheDocument();
  });

  it('hero "draft" state shows running total', async () => {
    _ctx = makeReadyCtx();
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
      lots: [READY_LOT],
    });
    renderHome();
    expect(await screen.findByText('Keep adding hours')).toBeInTheDocument();
    // 1280 + 1170 = 2450, formatted as AUD with no decimals.
    expect(await screen.findByText('$2,450.00')).toBeInTheDocument();
  });

  it('hero "queried" state routes attention to the docket', async () => {
    _ctx = makeReadyCtx();
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
      lots: [READY_LOT],
    });
    renderHome();
    expect(await screen.findByText('Answer the foreman')).toBeInTheDocument();
  });

  it('renders the non-admin setup hero without promising roster setup access', () => {
    // Default ctx: no approved crew/plant → the hero IS the setup CTA, and the
    // old finish-setup notice is gone (the hero carries it now).
    renderHome();
    expect(screen.getByRole('button', { name: 'View company setup' })).toBeInTheDocument();
    expect(screen.getByText('COMPANY SETUP')).toBeInTheDocument();
    expect(screen.getByText('Company setup needed')).toBeInTheDocument();
    expect(
      screen.getByText(
        /Ask your Hargraves Earthmoving admin to add crew and plant rates before you can submit dockets\./i,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Set up your company')).toBeNull();
    expect(screen.queryByText("Start today's docket")).toBeNull();
    expect(screen.queryByText(/finish setup before filling out a docket/i)).toBeNull();
  });

  it('keeps the admin setup hero copy and CTA', () => {
    _role = 'subcontractor';
    _actualRole = 'subcontractor_admin';
    renderHome();
    expect(screen.getByRole('button', { name: 'Set up your company' })).toBeInTheDocument();
    expect(screen.getByText('GET SET UP')).toBeInTheDocument();
    expect(screen.getByText('Set up your company')).toBeInTheDocument();
    expect(
      screen.getByText(
        /Add your crew & plant in My Company and wait for rate approval — then dockets unlock\./i,
      ),
    ).toBeInTheDocument();
  });

  it('setup hero taps through to My Company with the project query', () => {
    renderHome();
    fireEvent.click(screen.getByRole('button', { name: 'View company setup' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/p/company?projectId=proj-1');
  });

  it('hides the NCRs tile by default (ncrs module off)', () => {
    renderHome();
    expect(screen.queryByRole('button', { name: 'NCRs' })).toBeNull();
  });

  it('keeps NCRs off the home when lots is on, even with the ncrs module enabled', () => {
    const portalAccess: PortalAccess = { ...DEFAULT_PORTAL_ACCESS, ncrs: true };
    _ctx = makeCtx({ isModuleEnabled: (m) => portalAccess[m] });
    renderHome();
    expect(screen.queryByRole('button', { name: 'NCRs' })).toBeNull();
  });

  it('falls back to a home NCRs tile (→ /p/ncrs) when the lots module is off', () => {
    const portalAccess: PortalAccess = { ...DEFAULT_PORTAL_ACCESS, ncrs: true, lots: false };
    _ctx = makeCtx({ isModuleEnabled: (m) => portalAccess[m] });
    renderHome();
    fireEvent.click(screen.getByRole('button', { name: 'NCRs' }));
    expect(screen.getByText('ncrs screen')).toBeInTheDocument();
  });

  it('default home shows exactly the My Dockets / My Work / My Company hub tiles', () => {
    renderHome();
    expect(screen.getByRole('button', { name: /My Dockets/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /My Work/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /My Company/ })).toBeInTheDocument();
    // NCRs / Documents live behind the lot hub; no fallback tiles, no chip links.
    ['NCRs', 'Documents', 'Inspections', 'Holds and Tests'].forEach((name) => {
      expect(screen.queryByRole('button', { name })).toBeNull();
    });
    expect(screen.queryByRole('link', { name: 'Documents' })).toBeNull();
  });

  it('hides the fallback Documents tile when its module is disabled', () => {
    const portalAccess: PortalAccess = { ...DEFAULT_PORTAL_ACCESS, lots: false, documents: false };
    _ctx = makeCtx({ isModuleEnabled: (m) => portalAccess[m] });
    renderHome();
    expect(screen.queryByRole('button', { name: 'Documents' })).toBeNull();
  });

  it('My Company tile shows the company name as its title with no chips', () => {
    // Owner FINAL 2026-07-05: plain uniform tile — company name only, no chips
    // in any state (default ctx is setup-incomplete; the hero carries setup).
    renderHome();
    const companyBtn = screen.getByRole('button', { name: 'My Company — Hargraves Earthmoving' });
    expect(within(companyBtn).getByText('Hargraves Earthmoving')).toBeInTheDocument();
    expect(within(companyBtn).queryByText('Setup needed')).toBeNull();
    expect(within(companyBtn).queryByText(/crew/)).toBeNull();
    expect(within(companyBtn).queryByText(/plant/)).toBeNull();
  });

  it('My Company tile falls back to the "My Company" label when no company is loaded', () => {
    _ctx = makeCtx({ company: null });
    renderHome();
    const companyBtn = screen.getByRole('button', { name: 'My Company' });
    expect(within(companyBtn).getByText('My Company')).toBeInTheDocument();
    expect(within(companyBtn).queryByText('Setup needed')).toBeNull();
  });

  it('fallback Documents tile preserves the selected project query', () => {
    const portalAccess: PortalAccess = { ...DEFAULT_PORTAL_ACCESS, lots: false };
    _ctx = makeCtx({
      projectId: 'project-2',
      projectName: 'Second Project',
      isModuleEnabled: (m) => portalAccess[m],
    });
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
      '/api/lots?projectId=proj-1%26portalModule%3Ditps&portalModule=lots&limit=100&page=1',
    );
  });

  it('no longer renders the duplicate "Add today\'s hours" cambar', () => {
    renderHome();
    expect(screen.queryByRole('button', { name: "Add today's hours" })).toBeNull();
  });

  it('hides the Inspections top-level tile when the lots module is on', () => {
    renderHome();
    expect(screen.queryByRole('button', { name: 'Inspections' })).toBeNull();
  });

  it('keeps Inspections + Documents tiles as a fallback when the lots module is off (no Holds & Tests — removed)', () => {
    const portalAccess: PortalAccess = { ...DEFAULT_PORTAL_ACCESS, lots: false };
    _ctx = makeCtx({ isModuleEnabled: (m) => portalAccess[m] });
    setApi();
    renderHome();
    expect(screen.getByRole('button', { name: 'Inspections' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Documents' })).toBeInTheDocument();
    // Holds & Tests is gone from the subbie UI entirely.
    expect(screen.queryByRole('button', { name: 'Holds and Tests' })).toBeNull();
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

  it('does not flash the setup hero before assigned lots finish loading', async () => {
    const lotsDeferred = createDeferred<{ lots: [] }>();
    _ctx = makeReadyCtx();
    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation((url: string) => {
      if (url.startsWith('/api/dockets')) return Promise.resolve({ dockets: [] });
      if (url.startsWith('/api/lots')) return lotsDeferred.promise;
      if (url.startsWith('/api/notifications')) return Promise.resolve({ notifications: [] });
      return Promise.resolve({});
    });

    renderHome();

    // While assigned lots are loading, prerequisites are treated as met — the
    // docket hero shows, not a transient setup flash.
    expect(screen.getByText("Start today's docket")).toBeInTheDocument();
    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith(expect.stringMatching(/^\/api\/lots/)),
    );
    expect(screen.queryByRole('button', { name: 'Set up your company' })).toBeNull();

    // No lots assigned → prerequisites unmet → the hero flips to setup.
    lotsDeferred.resolve({ lots: [] });
    expect(await screen.findByRole('button', { name: 'View company setup' })).toBeInTheDocument();
  });
});
