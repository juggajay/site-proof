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
 *   - module-disabled tile hidden (documents off → no Documents tile)
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

function setApi({ dockets = [] as DocketSeed[] } = {}) {
  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation((url: string) => {
    if (url.startsWith('/api/dockets')) return Promise.resolve({ dockets });
    if (url.startsWith('/api/lots')) return Promise.resolve({ lots: [] });
    if (url.startsWith('/api/notifications')) return Promise.resolve({ notifications: [] });
    return Promise.resolve({});
  });
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

  it('hides a module tile when its module is disabled (documents off)', () => {
    const portalAccess: PortalAccess = { ...DEFAULT_PORTAL_ACCESS, documents: false };
    _ctx = makeCtx({ isModuleEnabled: (m) => portalAccess[m] });
    renderHome();
    expect(screen.queryByRole('button', { name: 'Documents' })).toBeNull();
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

  it('bottom bar "Add today\'s hours" navigates to /p/docket', () => {
    renderHome();
    fireEvent.click(screen.getByRole('button', { name: "Add today's hours" }));
    expect(screen.getByText('docket editor')).toBeInTheDocument();
  });
});
