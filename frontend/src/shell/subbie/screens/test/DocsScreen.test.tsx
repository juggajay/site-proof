/**
 * Tests for the subbie shell DocsScreen (/p/docs).
 *
 * MOCKS @/lib/useOfflineStatus, @/lib/documentAccess (openDocumentAccessUrl),
 * and the toaster. apiFetch + context mocked per test.
 *
 * Pins:
 *   - documents module gating (off → PortalAccessDenied, no query)
 *   - exact query URL incl. subcontractorView=true
 *   - grouping by category
 *   - tapping a row delegates to openDocumentAccessUrl(id, fileUrl)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

const openDocumentAccessUrlMock = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/documentAccess', () => ({
  openDocumentAccessUrl: (...a: unknown[]) => openDocumentAccessUrlMock(...a),
}));
vi.mock('@/components/ui/toaster', () => ({ toast: vi.fn() }));

const apiFetchMock = vi.fn();
vi.mock('@/lib/api', () => ({ apiFetch: (...a: unknown[]) => apiFetchMock(...a) }));

let _ctx: SubbieShellData;
vi.mock('../../subbieShellContext', () => ({ useSubbieShellContext: () => _ctx }));

import { DocsScreen } from '../DocsScreen';

function makeCtx(modules: Partial<PortalAccess> = {}): SubbieShellData {
  const portalAccess: PortalAccess = { ...DEFAULT_PORTAL_ACCESS, ...modules };
  return {
    projectId: 'proj-1',
    company: null,
    companyName: 'Hargraves Earthmoving',
    projectName: 'Demo',
    availableProjects: [],
    loading: false,
    loadError: null,
    isModuleEnabled: (m) => portalAccess[m],
  };
}

function setApi({ documents = [] as unknown[] } = {}) {
  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation((url: string) => {
    if (url.startsWith('/api/documents')) return Promise.resolve({ documents });
    return Promise.resolve({});
  });
}

function renderScreen() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/p/docs']}>
        <DocsScreen />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('subbie shell DocsScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _ctx = makeCtx();
    setApi();
  });

  it('shows access-denied and fires no query when the documents module is off', () => {
    _ctx = makeCtx({ documents: false });
    renderScreen();
    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Documents' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Documents portal access is not enabled for your company.',
    );
    expect(screen.getByRole('link', { name: /back to home/i })).toHaveAttribute('href', '/p');
  });

  it('queries the exact subcontractorView URL', () => {
    renderScreen();
    expect(
      screen.getByText('Shared with Hargraves Earthmoving — Demo — view only'),
    ).toBeInTheDocument();
    expect(apiFetchMock).toHaveBeenCalledWith('/api/documents/proj-1?subcontractorView=true');
  });

  it('groups documents by category', async () => {
    setApi({
      documents: [
        {
          id: 'd1',
          filename: 'SW-201 Rev C',
          fileUrl: 'u1',
          category: 'Drawings',
          uploadedAt: '2026-06-08T00:00:00.000Z',
        },
        {
          id: 'd2',
          filename: 'Spec 1142',
          fileUrl: 'u2',
          category: 'Specifications',
          uploadedAt: '2026-06-08T00:00:00.000Z',
        },
      ],
    });
    renderScreen();
    expect(await screen.findByText('DRAWINGS')).toBeInTheDocument();
    expect(screen.getByText('SPECIFICATIONS')).toBeInTheDocument();
    expect(screen.getByText('SW-201 Rev C')).toBeInTheDocument();
  });

  it('delegates open to openDocumentAccessUrl(id, fileUrl)', async () => {
    setApi({
      documents: [
        {
          id: 'd1',
          filename: 'SW-201 Rev C',
          fileUrl: 'https://x/sw201.pdf',
          category: 'Drawings',
          uploadedAt: '2026-06-08T00:00:00.000Z',
        },
      ],
    });
    renderScreen();
    const row = await screen.findByRole('button', { name: 'Open SW-201 Rev C' });
    fireEvent.click(row);
    await waitFor(() =>
      expect(openDocumentAccessUrlMock).toHaveBeenCalledWith('d1', 'https://x/sw201.pdf'),
    );
  });
});
