/**
 * Seam tests for useDocketEditorController — the shared money-critical core that
 * BOTH docket editors (classic DocketEditPage and shell DocketScreen) now import.
 *
 * The two screens' full JSX behaviour is pinned by DocketScreen.test.tsx; these
 * tests pin the rules directly at the controller seam so the CLASSIC editor — which
 * has no render harness of its own — is covered for the same rules it silently
 * lacked before the extraction:
 *   - lazy create: no POST /api/dockets until the first entry is added.
 *   - running-total math: add trusts runningTotal.cost; delete falls back to
 *     max(0, prevTotal - entryCost) when the server omits it.
 *   - status gating: canEdit / canSubmit.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { buildPortalCompanyQuery } from './portalCompanyScope';
import { useDocketEditorController } from './useDocketEditorController';

vi.mock('@/lib/useOfflineStatus', () => ({
  useOfflineStatus: () => ({ isOnline: true }),
}));
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: { id: 'u1', role: 'subcontractor' } }),
}));

const apiFetchMock = vi.fn();
vi.mock('@/lib/api', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
  ApiError: class ApiError extends Error {},
}));

const PROJECT_ID = 'proj-1';
const COMPANY = {
  id: 'c1',
  projectId: PROJECT_ID,
  projectName: 'Demo',
  employees: [{ id: 'emp-1', name: 'Tommy', hourlyRate: 74, status: 'approved' }],
  plant: [{ id: 'plant-1', type: 'Excavator', dryRate: 180, wetRate: 210, status: 'approved' }],
};
const ASSIGNED_LOTS = [{ id: 'lot-1', lotNumber: 'LOT-014', activity: 'Stormwater' }];

// Shell-style route builder (identical seam contract to the classic one).
const buildDocketPath = (
  docketId: string,
  scope: { projectId?: string | null; subcontractorCompanyId?: string | null },
) => `/p/docket/${encodeURIComponent(docketId)}${buildPortalCompanyQuery(scope)}`;

function wrapper(initialPath: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[initialPath]}>
          <Routes>
            <Route path="/p/docket" element={<>{children}</>} />
            <Route path="/p/docket/:docketId" element={<>{children}</>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };
}

function renderController(initialPath: string) {
  return renderHook(() => useDocketEditorController({ buildDocketPath }), {
    wrapper: wrapper(initialPath),
  });
}

beforeEach(() => {
  apiFetchMock.mockReset();
});

describe('useDocketEditorController', () => {
  it('lazily creates the docket (no POST /api/dockets before the first entry) and trusts runningTotal.cost', async () => {
    apiFetchMock.mockImplementation((url: string, opts?: { method?: string }) => {
      const method = opts?.method ?? 'GET';
      if (url.startsWith('/api/subcontractors/my-company'))
        return Promise.resolve({ company: COMPANY });
      if (url.startsWith('/api/lots')) return Promise.resolve({ lots: ASSIGNED_LOTS });
      if (/^\/api\/dockets\?/.test(url)) return Promise.resolve({ dockets: [] });
      if (url === '/api/dockets' && method === 'POST') {
        return Promise.resolve({ docket: { id: 'dok-new', status: 'draft', date: '2026-07-12' } });
      }
      if (url === '/api/dockets/dok-new/labour' && method === 'POST') {
        return Promise.resolve({
          labourEntry: {
            id: 'le-1',
            employee: { name: 'Tommy' },
            startTime: '07:00',
            finishTime: '15:00',
            lotAllocations: [],
            submittedHours: 8,
            submittedCost: 592,
          },
          runningTotal: { cost: 592 },
        });
      }
      return Promise.resolve({});
    });

    const { result } = renderController('/p/docket?projectId=proj-1&subcontractorCompanyId=c1');
    await waitFor(() => expect(result.current.loading).toBe(false));

    // No docket created yet — lazy.
    expect(apiFetchMock).not.toHaveBeenCalledWith(
      '/api/dockets',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result.current.docket).toBeNull();
    expect(result.current.canSubmit).toBe(false);

    await act(async () => {
      await result.current.postLabourEntry({
        employeeId: 'emp-1',
        startTime: '07:00',
        finishTime: '15:00',
        lotId: 'lot-1',
      });
    });

    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/dockets',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result.current.docket?.labourEntries).toHaveLength(1);
    expect(result.current.docket?.totalLabourSubmitted).toBe(592);
    expect(result.current.canSubmit).toBe(true);
    expect(result.current.canEdit).toBe(true);
  });

  it('delete falls back to max(0, prevTotal - entryCost) when the server omits runningTotal', async () => {
    const existing = {
      id: 'dok-1',
      status: 'draft',
      date: '2026-07-12',
      notes: '',
      labourEntries: [
        {
          id: 'le-1',
          employee: { name: 'Tommy' },
          startTime: '07:00',
          finishTime: '15:00',
          lotAllocations: [],
          submittedHours: 8,
          submittedCost: 592,
        },
      ],
      plantEntries: [],
      totalLabourSubmitted: 592,
      totalPlantSubmitted: 0,
    };
    apiFetchMock.mockImplementation((url: string, opts?: { method?: string }) => {
      const method = opts?.method ?? 'GET';
      if (url.startsWith('/api/subcontractors/my-company'))
        return Promise.resolve({ company: COMPANY });
      if (url.startsWith('/api/lots')) return Promise.resolve({ lots: ASSIGNED_LOTS });
      if (/^\/api\/dockets\/[^/]+$/.test(url) && method === 'GET')
        return Promise.resolve({ docket: existing });
      if (url === '/api/dockets/dok-1/labour/le-1' && method === 'DELETE')
        return Promise.resolve({}); // no runningTotal
      return Promise.resolve({});
    });

    const { result } = renderController(
      '/p/docket/dok-1?projectId=proj-1&subcontractorCompanyId=c1',
    );
    await waitFor(() => expect(result.current.docket?.labourEntries).toHaveLength(1));

    await act(async () => {
      await result.current.removeLabourEntry('le-1');
    });

    expect(result.current.docket?.labourEntries).toHaveLength(0);
    expect(result.current.docket?.totalLabourSubmitted).toBe(0); // max(0, 592 - 592)
    expect(result.current.canSubmit).toBe(false); // no entries left
  });

  it('gates editing on docket status — pending_approval is read-only', async () => {
    const pending = {
      id: 'dok-2',
      status: 'pending_approval',
      date: '2026-07-12',
      notes: '',
      labourEntries: [],
      plantEntries: [],
      totalLabourSubmitted: 0,
      totalPlantSubmitted: 0,
    };
    apiFetchMock.mockImplementation((url: string, opts?: { method?: string }) => {
      const method = opts?.method ?? 'GET';
      if (url.startsWith('/api/subcontractors/my-company'))
        return Promise.resolve({ company: COMPANY });
      if (url.startsWith('/api/lots')) return Promise.resolve({ lots: ASSIGNED_LOTS });
      if (/^\/api\/dockets\/[^/]+$/.test(url) && method === 'GET')
        return Promise.resolve({ docket: pending });
      return Promise.resolve({});
    });

    const { result } = renderController(
      '/p/docket/dok-2?projectId=proj-1&subcontractorCompanyId=c1',
    );
    await waitFor(() => expect(result.current.docket?.status).toBe('pending_approval'));

    expect(result.current.canEdit).toBe(false);
    expect(result.current.canWrite).toBe(false);
    expect(result.current.canSubmit).toBe(false);
  });
});
