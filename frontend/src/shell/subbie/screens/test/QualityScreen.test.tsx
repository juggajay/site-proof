/**
 * Tests for the subbie shell QualityScreen (/p/quality).
 *
 * MOCKS @/lib/useOfflineStatus (Dexie/IndexedDB) so ShellScreen → SyncChip mounts
 * in CI. apiFetch is mocked per-URL; the subbie context is mocked per test.
 *
 * Pins:
 *   - section-level module gating (holds-only / tests-only / both)
 *   - neither-module → access-denied notice (no queries fired)
 *   - exact query URLs incl. subcontractorView=true
 *   - hold-point WAITING (pending+notified) / RELEASED / rejected presentation
 *   - test PASS/PENDING + mono value line with requirement
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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

import { QualityScreen } from '../QualityScreen';

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

function setApi({ holdPoints = [] as unknown[], testResults = [] as unknown[] } = {}) {
  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation((url: string) => {
    if (url.startsWith('/api/holdpoints')) return Promise.resolve({ holdPoints });
    if (url.startsWith('/api/test-results')) return Promise.resolve({ testResults });
    return Promise.resolve({});
  });
}

function renderScreen(path = '/p/quality') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <QualityScreen />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('subbie shell QualityScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _ctx = makeCtx();
    setApi();
  });

  it('renders both section labels when both modules are on', () => {
    renderScreen();
    expect(screen.getByText('HOLD POINTS')).toBeInTheDocument();
    expect(screen.getByText('TEST RESULTS')).toBeInTheDocument();
  });

  it('hides the TEST RESULTS section when testResults is off', () => {
    _ctx = makeCtx({ testResults: false });
    renderScreen();
    expect(screen.getByText('HOLD POINTS')).toBeInTheDocument();
    expect(screen.queryByText('TEST RESULTS')).toBeNull();
  });

  it('hides the HOLD POINTS section when holdPoints is off', () => {
    _ctx = makeCtx({ holdPoints: false });
    renderScreen();
    expect(screen.queryByText('HOLD POINTS')).toBeNull();
    expect(screen.getByText('TEST RESULTS')).toBeInTheDocument();
  });

  it('shows an access-denied notice and fires NO queries when neither module is on', () => {
    _ctx = makeCtx({ holdPoints: false, testResults: false });
    renderScreen();
    expect(screen.getByText(/hasn’t shared hold points or test results/i)).toBeInTheDocument();
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it('queries the exact subcontractorView URLs', () => {
    renderScreen();
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/holdpoints/project/proj-1?subcontractorView=true',
    );
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/test-results?projectId=proj-1&subcontractorView=true',
    );
  });

  it('encodes projectId in both quality endpoints', () => {
    _ctx = { ...makeCtx(), projectId: 'proj-1&subcontractorView=false' };
    renderScreen();
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/holdpoints/project/proj-1%26subcontractorView%3Dfalse?subcontractorView=true',
    );
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/test-results?projectId=proj-1%26subcontractorView%3Dfalse&subcontractorView=true',
    );
  });

  it('renders a WAITING badge for a notified hold point', async () => {
    setApi({
      holdPoints: [
        {
          id: 'h1',
          lotId: 'l1',
          lotNumber: 'LOT-014',
          description: 'Bedding inspection',
          status: 'notified',
        },
      ],
    });
    renderScreen();
    expect(await screen.findByText('WAITING')).toBeInTheDocument();
    expect(screen.getByText(/Bedding inspection — LOT-014/)).toBeInTheDocument();
  });

  it('renders RELEASED with releaser for a released hold point', async () => {
    setApi({
      holdPoints: [
        {
          id: 'h2',
          lotId: 'l2',
          lotNumber: 'LOT-009',
          description: 'Subgrade proof roll',
          status: 'released',
          releasedAt: '2026-06-09T00:00:00.000Z',
          releasedByName: 'Sarah M',
          releasedByOrg: 'Council Superintendent',
          releaseMethod: 'secure_link',
          releaseRecipientEmail: 'sarah.super@example.com',
        },
      ],
    });
    renderScreen();
    expect(await screen.findByText('RELEASED')).toBeInTheDocument();
    expect(screen.getByText(/Released by Sarah M, Council Superintendent/)).toBeInTheDocument();
    expect(screen.getByText(/Secure link .* sent to sarah.super@example.com/)).toBeInTheDocument();
  });

  it('renders a PASS test with mono value + requirement', async () => {
    setApi({
      testResults: [
        {
          id: 't1',
          lotId: 'l2',
          lot: { lotNumber: 'LOT-009' },
          testType: 'Compaction',
          passFail: 'pass',
          resultValue: '98.2',
          resultUnit: '% standard',
          requirement: '≥ 98%',
          createdAt: '2026-06-09T00:00:00.000Z',
        },
      ],
    });
    renderScreen();
    expect(await screen.findByText('PASS')).toBeInTheDocument();
    expect(screen.getByText(/98\.2 % standard · req ≥ 98%/)).toBeInTheDocument();
  });

  it('scopes hold points and tests to ?lotId and offers a view-all link', async () => {
    setApi({
      holdPoints: [
        { id: 'h1', lotId: 'l1', lotNumber: 'LOT-1', description: 'HP one', status: 'notified' },
        { id: 'h2', lotId: 'l2', lotNumber: 'LOT-2', description: 'HP two', status: 'notified' },
      ],
      testResults: [
        {
          id: 't1',
          lotId: 'l1',
          lot: { lotNumber: 'LOT-1' },
          testType: 'Compaction',
          passFail: 'pass',
          createdAt: '2026-06-09T00:00:00.000Z',
        },
        {
          id: 't2',
          lotId: 'l2',
          lot: { lotNumber: 'LOT-2' },
          testType: 'Slump',
          passFail: 'fail',
          createdAt: '2026-06-09T00:00:00.000Z',
        },
      ],
    });
    renderScreen('/p/quality?lotId=l1');

    expect(await screen.findByText(/HP one — LOT-1/)).toBeInTheDocument();
    expect(screen.queryByText(/HP two — LOT-2/)).toBeNull();
    expect(screen.getByText('Compaction — LOT-1')).toBeInTheDocument();
    expect(screen.queryByText('Slump — LOT-2')).toBeNull();

    // Scope banner + view-all escape hatch back to the unfiltered surface.
    expect(screen.getByText(/Showing/)).toBeInTheDocument();
    const viewAll = screen.getByRole('link', { name: 'View all' });
    expect(viewAll.getAttribute('href')).toBe('/p/quality?projectId=proj-1');
  });

  it('shows no scope banner without a lotId param', () => {
    renderScreen();
    expect(screen.queryByText(/Showing/)).toBeNull();
    expect(screen.queryByRole('link', { name: 'View all' })).toBeNull();
  });
});
