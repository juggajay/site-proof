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
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@testing-library/react';
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
const authFetchMock = vi.fn();
vi.mock('@/lib/api', () => ({
  apiFetch: (...a: unknown[]) => apiFetchMock(...a),
  authFetch: (...a: unknown[]) => authFetchMock(...a),
}));
vi.mock('@/lib/documentAccess', () => ({ openDocumentAccessUrl: vi.fn() }));
vi.mock('@/components/ui/toaster', () => ({ toast: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logError: vi.fn() }));

let _ctx: SubbieShellData;
vi.mock('../../subbieShellContext', () => ({ useSubbieShellContext: () => _ctx }));

import { NcrsScreen } from '../NcrsScreen';

function mockMatchMedia() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

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
  apiFetchMock.mockImplementation((url: string, options?: { method?: string }) => {
    if (url === '/api/ncrs/ncr-shell-open/respond' && options?.method === 'POST') {
      return Promise.resolve({ ncr: { id: 'ncr-shell-open', status: 'investigating' } });
    }
    if (url === '/api/ncrs/ncr-shell-rectify/evidence' && options?.method === 'POST') {
      return Promise.resolve({ evidence: { id: 'evidence-uploaded' } });
    }
    if (
      url === '/api/ncrs/ncr-shell-rectify/submit-for-verification' &&
      options?.method === 'POST'
    ) {
      return Promise.resolve({ ncr: { id: 'ncr-shell-rectify', status: 'pending_verification' } });
    }
    if (url.startsWith('/api/ncrs')) return Promise.resolve({ ncrs });
    return Promise.resolve({});
  });
  authFetchMock.mockReset();
  authFetchMock.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ id: 'doc-uploaded-1', filename: 'repair-photo.jpg' }),
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
    mockMatchMedia();
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

  it('lets a responsible subcontractor submit an NCR response from the mobile shell', async () => {
    const user = userEvent.setup();
    _ctx = { ...makeCtx({ ncrs: true }), subcontractorCompanyId: 'sub-1' };
    setApi({
      ncrs: [
        {
          id: 'ncr-shell-open',
          ncrNumber: 'NCR-101',
          description: 'Open shell NCR',
          category: 'workmanship',
          status: 'open',
          severity: 'minor',
          raisedAt: '2026-06-09T00:00:00.000Z',
          responsibleSubcontractorId: 'sub-1',
          responsibleSubcontractor: { id: 'sub-1', companyName: 'Hargraves' },
          ncrLots: [{ lot: { lotNumber: 'LOT-101' } }],
        },
      ],
    });

    renderScreen();
    expect(await screen.findByText('NCR-101')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Respond' }));

    await user.selectOptions(screen.getByLabelText(/Root Cause Category/i), 'process');
    await user.type(screen.getByLabelText(/Root Cause Description/i), 'Sequence was missed.');
    await user.type(
      screen.getByLabelText(/Proposed Corrective Action/i),
      'Rework and brief the crew.',
    );
    await user.click(screen.getByRole('button', { name: 'Submit Response' }));

    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith(
        '/api/ncrs/ncr-shell-open/respond',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            rootCauseCategory: 'process',
            rootCauseDescription: 'Sequence was missed.',
            proposedCorrectiveAction: 'Rework and brief the crew.',
          }),
        }),
      ),
    );
  });

  it('shows reviewer feedback when rectification is returned to the subcontractor', async () => {
    _ctx = { ...makeCtx({ ncrs: true }), subcontractorCompanyId: 'sub-1' };
    setApi({
      ncrs: [
        {
          id: 'ncr-rectification-returned',
          ncrNumber: 'NCR-202',
          description: 'Returned rectification',
          category: 'workmanship',
          status: 'rectification',
          severity: 'major',
          raisedAt: '2026-06-09T00:00:00.000Z',
          responsibleSubcontractorId: 'sub-1',
          responsibleSubcontractor: { id: 'sub-1', companyName: 'Hargraves' },
          revisionRequested: true,
          verificationNotes: 'Photo does not show the repaired concrete edge clearly.',
        },
      ],
    });

    renderScreen();

    expect(await screen.findByText('NCR-202')).toBeInTheDocument();
    expect(screen.getByText('Rectification feedback')).toBeInTheDocument();
    expect(
      screen.getByText('Photo does not show the repaired concrete edge clearly.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit Rectification' })).toBeInTheDocument();
  });

  it('uploads rectification evidence, refreshes the NCR, then submits for verification', async () => {
    const user = userEvent.setup();
    _ctx = { ...makeCtx({ ncrs: true }), subcontractorCompanyId: 'sub-1' };
    setApi({
      ncrs: [
        {
          id: 'ncr-shell-rectify',
          ncrNumber: 'NCR-303',
          description: 'Ready for rectification evidence',
          category: 'workmanship',
          status: 'rectification',
          severity: 'major',
          raisedAt: '2026-06-09T00:00:00.000Z',
          responsibleSubcontractorId: 'sub-1',
          responsibleSubcontractor: { id: 'sub-1', companyName: 'Hargraves' },
          ncrEvidence: [],
        },
      ],
    });

    renderScreen();
    expect(await screen.findByText('NCR-303')).toBeInTheDocument();
    const listUrl =
      '/api/ncrs?projectId=proj-1&subcontractorCompanyId=sub-1&subcontractorView=true';
    const listCallsBeforeUpload = apiFetchMock.mock.calls.filter(([url]) => url === listUrl).length;

    await user.click(screen.getByRole('button', { name: 'Submit Rectification' }));
    const photoInput = document.querySelector(
      'input[type="file"][accept="image/*"]',
    ) as HTMLInputElement;
    expect(photoInput).toBeInTheDocument();
    await user.upload(
      photoInput,
      new File(['repair photo'], 'repair-photo.jpg', { type: 'image/jpeg' }),
    );

    await waitFor(() =>
      expect(authFetchMock).toHaveBeenCalledWith(
        '/api/documents/upload',
        expect.objectContaining({ method: 'POST', body: expect.any(FormData) }),
      ),
    );
    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith(
        '/api/ncrs/ncr-shell-rectify/evidence',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ documentId: 'doc-uploaded-1', evidenceType: 'photo' }),
        }),
      ),
    );
    await waitFor(() => {
      const listCallsAfterUpload = apiFetchMock.mock.calls.filter(
        ([url]) => url === listUrl,
      ).length;
      expect(listCallsAfterUpload).toBeGreaterThan(listCallsBeforeUpload);
    });

    await user.type(
      screen.getByPlaceholderText(/Describe the corrective actions taken/i),
      'Repaired failed area and retested.',
    );
    await user.click(screen.getByRole('button', { name: 'Submit for Verification' }));

    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith(
        '/api/ncrs/ncr-shell-rectify/submit-for-verification',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ rectificationNotes: 'Repaired failed area and retested.' }),
        }),
      ),
    );
  });
});
