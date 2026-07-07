/**
 * Bulk-approval coverage for DocketApprovalsPage. There is no batch endpoint, so
 * the page loops the per-docket approve route with an empty (unadjusted) payload;
 * these tests pin that it fires one POST per selected pending docket and surfaces
 * per-docket failures by docket number.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Docket } from './docketApprovalsData';

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: { id: 'u1', role: 'foreman' } }),
}));
vi.mock('@/hooks/useMediaQuery', () => ({ useIsMobile: () => false }));

const toastMock = vi.fn();
vi.mock('@/components/ui/toaster', () => ({ toast: (...args: unknown[]) => toastMock(...args) }));

const apiFetchMock = vi.fn();
vi.mock('@/lib/api', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
  ApiError: class ApiError extends Error {},
}));

import { DocketApprovalsPage } from './DocketApprovalsPage';

function makeDocket(over: Partial<Docket> = {}): Docket {
  return {
    id: 'd1',
    docketNumber: 'DKT-001',
    subcontractor: 'Ryox Carpentry',
    subcontractorId: 'sub-1',
    date: '2026-06-04',
    status: 'pending_approval',
    notes: null,
    labourHours: 8,
    plantHours: 0,
    totalLabourSubmitted: 600,
    totalLabourApproved: 8,
    totalPlantSubmitted: 0,
    totalPlantApproved: 0,
    totalLabourApprovedCost: null,
    totalPlantApprovedCost: null,
    submittedAt: '2026-06-04T08:00:00.000Z',
    approvedAt: null,
    foremanNotes: null,
    ...over,
  };
}

function setApi(dockets: Docket[], approveImpl: (id: string) => Promise<unknown>) {
  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation((url: string, opts?: { method?: string }) => {
    if (url.startsWith('/api/projects/')) {
      return Promise.resolve({ project: { name: 'Demo', currentUserRole: 'foreman' } });
    }
    const approveMatch = url.match(/^\/api\/dockets\/([^/]+)\/approve$/);
    if (approveMatch && opts?.method === 'POST') {
      return approveImpl(approveMatch[1]);
    }
    if (/^\/api\/dockets\?/.test(url)) {
      if (url.includes('status=draft')) return Promise.resolve({ dockets: [] });
      return Promise.resolve({ dockets });
    }
    return Promise.resolve({});
  });
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/x/proj-1']}>
        <Routes>
          <Route path="/x/:projectId" element={<DocketApprovalsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('DocketApprovalsPage bulk approval', () => {
  beforeEach(() => {
    toastMock.mockReset();
  });

  it('fires one unadjusted approve POST per selected pending docket', async () => {
    const approve = vi.fn().mockResolvedValue({});
    setApi([makeDocket(), makeDocket({ id: 'd2', docketNumber: 'DKT-002' })], approve);

    renderPage();

    fireEvent.click(await screen.findByLabelText('Select docket DKT-001'));
    fireEvent.click(screen.getByLabelText('Select docket DKT-002'));
    fireEvent.click(screen.getByRole('button', { name: 'Approve 2 selected' }));

    await waitFor(() => expect(approve).toHaveBeenCalledTimes(2));
    expect(approve).toHaveBeenCalledWith('d1');
    expect(approve).toHaveBeenCalledWith('d2');
    // Empty (unadjusted) payload: no adjusted hours are sent.
    const approveCall = apiFetchMock.mock.calls.find(
      (c) => /\/approve$/.test(c[0] as string) && (c[1] as { method?: string })?.method === 'POST',
    );
    const body = JSON.parse((approveCall![1] as { body: string }).body);
    expect(body.adjustedLabourHours).toBeUndefined();
    expect(body.adjustedPlantHours).toBeUndefined();

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'success', description: 'Approved 2 dockets.' }),
      ),
    );
  });

  it('surfaces per-docket failures by docket number', async () => {
    const approve = vi.fn((id: string) =>
      id === 'd2' ? Promise.reject(new Error('boom')) : Promise.resolve({}),
    );
    setApi([makeDocket(), makeDocket({ id: 'd2', docketNumber: 'DKT-002' })], approve);

    renderPage();

    fireEvent.click(await screen.findByLabelText('Select docket DKT-001'));
    fireEvent.click(screen.getByLabelText('Select docket DKT-002'));
    fireEvent.click(screen.getByRole('button', { name: 'Approve 2 selected' }));

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'warning',
          description: 'Approved 1 of 2. Failed: DKT-002',
        }),
      ),
    );
  });
});
