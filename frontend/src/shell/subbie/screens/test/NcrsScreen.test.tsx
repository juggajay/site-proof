/**
 * Tests for the subbie shell NcrsScreen (/p/ncrs).
 *
 * MOCKS @/lib/useOfflineStatus. apiFetch + context mocked per test.
 *
 * Pins:
 *   - ncrs module gating (default OFF → access notice, no query)
 *   - exact query URL incl. subcontractorView=true
 *   - severity pill + status grouping (Open / In Progress / Closed)
 *   - lot numbers from ncrLots
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
vi.mock('@/lib/documentAccess', () => ({ openDocumentAccessUrl: vi.fn() }));
vi.mock('@/components/ui/toaster', () => ({ toast: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logError: vi.fn() }));

let _ctx: SubbieShellData;
vi.mock('../../subbieShellContext', () => ({ useSubbieShellContext: () => _ctx }));

import { NcrsScreen } from '../NcrsScreen';

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

function setApi({ ncrs = [] as unknown[] } = {}) {
  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation((url: string) => {
    if (url.startsWith('/api/ncrs')) return Promise.resolve({ ncrs });
    return Promise.resolve({});
  });
}

function renderScreen() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/p/ncrs']}>
        <NcrsScreen />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('subbie shell NcrsScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _ctx = makeCtx();
    setApi();
  });

  it('shows the access notice and fires no query when the ncrs module is off (default)', () => {
    renderScreen();
    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(screen.getByText(/No non-conformances have been shared/i)).toBeInTheDocument();
  });

  it('queries the exact subcontractorView URL when ncrs is enabled', () => {
    _ctx = makeCtx({ ncrs: true });
    renderScreen();
    expect(apiFetchMock).toHaveBeenCalledWith('/api/ncrs?projectId=proj-1&subcontractorView=true');
  });

  it('encodes projectId before building the NCR URL', () => {
    _ctx = { ...makeCtx({ ncrs: true }), projectId: 'proj-1&subcontractorView=false' };
    renderScreen();
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/ncrs?projectId=proj-1%26subcontractorView%3Dfalse&subcontractorView=true',
    );
  });

  it('groups by Open / In Progress / Closed and shows severity + lot', async () => {
    _ctx = makeCtx({ ncrs: true });
    setApi({
      ncrs: [
        {
          id: 'n1',
          ncrNumber: 'NCR-001',
          description: 'Open one',
          status: 'open',
          severity: 'critical',
          raisedAt: '2026-06-09T00:00:00.000Z',
          ncrLots: [{ lot: { lotNumber: 'LOT-014' } }],
          ncrEvidence: [
            {
              id: 'ev-1',
              evidenceType: 'photo',
              document: {
                id: 'doc-1',
                filename: 'rectification-photo.jpg',
                mimeType: 'image/jpeg',
              },
            },
          ],
        },
        {
          id: 'n2',
          ncrNumber: 'NCR-002',
          description: 'Working',
          status: 'rectification',
          severity: 'major',
          raisedAt: '2026-06-08T00:00:00.000Z',
        },
        {
          id: 'n3',
          ncrNumber: 'NCR-003',
          description: 'Done',
          status: 'closed',
          severity: 'minor',
          raisedAt: '2026-06-07T00:00:00.000Z',
        },
      ],
    });
    renderScreen();
    // "IN PROGRESS" is unique (the rectification badge reads "RECTIFICATION").
    expect(await screen.findByText('IN PROGRESS')).toBeInTheDocument();
    // "OPEN"/"CLOSED" each appear twice: the section label + a status badge.
    expect(screen.getAllByText('OPEN').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('CLOSED').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('RECTIFICATION')).toBeInTheDocument();
    expect(screen.getByText('CRITICAL')).toBeInTheDocument();
    expect(screen.getByText(/Lot: LOT-014/)).toBeInTheDocument();
    expect(screen.getByText('rectification-photo.jpg')).toBeInTheDocument();
  });
});
