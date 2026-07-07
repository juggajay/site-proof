/**
 * Tests for the subbie shell DocketScreen — the money-critical state machine.
 *
 * MOCKS @/lib/useOfflineStatus (Dexie/IndexedDB) so coverage runs in CI —
 * ShellScreen mounts SyncChip → useOfflineStatus, which fails unmocked.
 *
 * apiFetch is mocked per-URL. The classic calculateHours helper is IMPORTED and
 * called for total/payload expectations (never reimplemented in test math).
 *
 * Pins (per PR spec):
 *   - lazy ensureDocket: no POST before first entry; URL rewrite after.
 *   - labour payload shape incl. lotAllocations + times HH:mm.
 *   - plant payload incl. wetOrDry literal + hoursOperated.
 *   - approved-only picker: pending row locked/disabled.
 *   - editable-status gating: pending_approval read-only (no add/delete/submit).
 *   - submit guard: no entries → submit disabled.
 *   - queried respond payload + transition UI.
 *   - rejected resubmit affordance.
 *   - notes blur PATCH only when changed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { calculateHours } from '@/pages/subcontractor-portal/docketEditHelpers';

const useOfflineStatusMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/useOfflineStatus', () => ({
  useOfflineStatus: () => useOfflineStatusMock(),
}));
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: { id: 'u1', fullName: 'Mick Hargraves', role: 'subcontractor' } }),
}));
vi.mock('@/components/ui/toaster', () => ({ toast: vi.fn() }));

const apiFetchMock = vi.fn();
vi.mock('@/lib/api', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
  ApiError: class ApiError extends Error {},
}));

// Subbie shell context (DocketsList uses it; DocketScreen uses classic query hooks).
vi.mock('../../../subbieShellContext', () => ({
  useSubbieShellContext: () => ({ projectId: 'proj-1' }),
}));

import { DocketScreen } from '../DocketScreen';

const PROJECT_ID = 'proj-1';

const APPROVED_EMP = {
  id: 'emp-approved',
  name: 'Tommy Vella',
  role: 'Pipe Layer',
  hourlyRate: 74,
  status: 'approved',
};
const PENDING_EMP = {
  id: 'emp-pending',
  name: 'Ben K',
  role: 'Labourer',
  hourlyRate: 60,
  status: 'pending',
};
const APPROVED_PLANT = {
  id: 'plant-1',
  type: 'Excavator',
  description: 'CAT 320',
  idRego: 'EXC-014',
  dryRate: 180,
  wetRate: 210,
  status: 'approved',
};

const ASSIGNED_LOTS = [{ id: 'lot-1', lotNumber: 'LOT-014', activity: 'Stormwater' }];

interface ApiState {
  company?: Record<string, unknown>;
  lots?: unknown[];
  docket?: Record<string, unknown> | null;
  existingDockets?: unknown[];
}

function setApi(state: ApiState = {}) {
  const company = state.company ?? {
    id: 'c1',
    projectId: PROJECT_ID,
    projectName: 'Demo',
    employees: [APPROVED_EMP, PENDING_EMP],
    plant: [APPROVED_PLANT],
  };
  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation((url: string, opts?: { method?: string; body?: string }) => {
    const method = opts?.method ?? 'GET';
    if (url.startsWith('/api/subcontractors/my-company')) {
      return Promise.resolve({ company });
    }
    if (url.startsWith('/api/lots')) {
      return Promise.resolve({ lots: state.lots ?? ASSIGNED_LOTS });
    }
    if (/^\/api\/dockets\?/.test(url)) {
      return Promise.resolve({ dockets: state.existingDockets ?? [] });
    }
    if (/^\/api\/dockets\/[^/]+$/.test(url) && method === 'GET') {
      return Promise.resolve({ docket: state.docket });
    }
    // Mutations handled by the individual test mock overrides.
    return Promise.resolve({});
  });
}

function renderDocket(initialPath: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/p" element={<HomeLocation />} />
          <Route path="/p/docket" element={<DocketScreen />} />
          <Route path="/p/docket/:docketId" element={<DocketScreen />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function HomeLocation() {
  const location = useLocation();
  return <div data-testid="home-location">home {location.search}</div>;
}

function makeDocket(over: Record<string, unknown> = {}) {
  return {
    id: 'dk-1',
    docketNumber: 'DKT-0001',
    date: '2026-06-12',
    status: 'draft',
    notes: '',
    totalLabourSubmitted: 0,
    totalPlantSubmitted: 0,
    labourEntries: [],
    plantEntries: [],
    ...over,
  };
}

describe('subbie shell DocketScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useOfflineStatusMock.mockReturnValue({
      isOnline: true,
      pendingSyncCount: 0,
      failedSyncCount: 0,
      isSyncing: false,
    });
  });

  it('scopes assigned lots to the selected subcontractor company', async () => {
    setApi({
      company: {
        id: 'company-selected',
        projectId: PROJECT_ID,
        projectName: 'Demo',
        employees: [APPROVED_EMP],
        plant: [APPROVED_PLANT],
      },
      existingDockets: [],
    });

    renderDocket('/p/docket?projectId=proj-1&subcontractorCompanyId=company-selected');

    await screen.findByRole('button', { name: 'Add crew hours' });
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/lots?projectId=proj-1&subcontractorCompanyId=company-selected',
    );
  });

  it('does NOT POST a docket before the first entry is added, then rewrites URL after', async () => {
    setApi({ existingDockets: [] }); // new docket, none today
    // Capture the labour POST.
    apiFetchMock.mockImplementation((url: string, opts?: { method?: string; body?: string }) => {
      const method = opts?.method ?? 'GET';
      if (url.startsWith('/api/subcontractors/my-company'))
        return Promise.resolve({
          company: {
            id: 'c1',
            projectId: PROJECT_ID,
            projectName: 'Demo',
            employees: [APPROVED_EMP, PENDING_EMP],
            plant: [APPROVED_PLANT],
          },
        });
      if (url.startsWith('/api/lots')) return Promise.resolve({ lots: ASSIGNED_LOTS });
      if (/^\/api\/dockets\?/.test(url)) return Promise.resolve({ dockets: [] });
      if (url === '/api/dockets' && method === 'POST')
        return Promise.resolve({ docket: makeDocket() });
      if (/\/labour$/.test(url) && method === 'POST')
        return Promise.resolve({
          labourEntry: {
            id: 'le-1',
            employee: {
              id: APPROVED_EMP.id,
              name: APPROVED_EMP.name,
              role: 'Pipe Layer',
              hourlyRate: 74,
            },
            startTime: '07:00',
            finishTime: '15:00',
            submittedHours: 8,
            hourlyRate: 74,
            submittedCost: 592,
            lotAllocations: [{ lotId: 'lot-1', lotNumber: 'LOT-014', hours: 8 }],
          },
          runningTotal: { cost: 592 },
        });
      return Promise.resolve({ docket: makeDocket() });
    });

    renderDocket('/p/docket');

    // Editable empty state — add buttons present.
    const addCrew = await screen.findByRole('button', { name: 'Add crew hours' });
    // No POST /api/dockets yet (only GET bootstrap reads).
    const isDocketPost = (call: unknown[]) =>
      call[0] === '/api/dockets' && (call[1] as { method?: string } | undefined)?.method === 'POST';
    const postCallsBefore = apiFetchMock.mock.calls.filter(isDocketPost);
    expect(postCallsBefore.length).toBe(0);

    // Open the labour sheet, pick the approved employee, add.
    fireEvent.click(addCrew);
    fireEvent.click(await screen.findByRole('button', { name: /Tommy Vella/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Add to docket' }));

    await waitFor(() => {
      const postDocket = apiFetchMock.mock.calls.filter(isDocketPost);
      expect(postDocket.length).toBe(1); // ensureDocket fired exactly once on first add
    });

    // ensureDocket POST body carried projectId + today's date + notes.
    const createCall = apiFetchMock.mock.calls.find(isDocketPost);
    const createBody = JSON.parse((createCall![1] as { body: string }).body);
    expect(createBody.projectId).toBe(PROJECT_ID);
    expect(createBody.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('labour POST payload uses lotAllocations + HH:mm times + imported calculateHours', async () => {
    setApi({ docket: makeDocket(), existingDockets: [] });
    const labourPost = vi.fn();
    apiFetchMock.mockImplementation((url: string, opts?: { method?: string; body?: string }) => {
      const method = opts?.method ?? 'GET';
      if (url.startsWith('/api/subcontractors/my-company'))
        return Promise.resolve({
          company: {
            id: 'c1',
            projectId: PROJECT_ID,
            projectName: 'Demo',
            employees: [APPROVED_EMP, PENDING_EMP],
            plant: [APPROVED_PLANT],
          },
        });
      if (url.startsWith('/api/lots')) return Promise.resolve({ lots: ASSIGNED_LOTS });
      if (/^\/api\/dockets\?/.test(url)) return Promise.resolve({ dockets: [] });
      if (/^\/api\/dockets\/dk-1$/.test(url) && method === 'GET')
        return Promise.resolve({ docket: makeDocket() });
      if (/\/labour$/.test(url) && method === 'POST') {
        labourPost(JSON.parse(opts!.body!));
        return Promise.resolve({
          labourEntry: {
            id: 'le-1',
            employee: { id: APPROVED_EMP.id, name: 'Tommy', role: 'Pipe Layer', hourlyRate: 74 },
            startTime: '07:00',
            finishTime: '15:00',
            submittedHours: 8,
            hourlyRate: 74,
            submittedCost: 592,
            lotAllocations: [{ lotId: 'lot-1', lotNumber: 'LOT-014', hours: 8 }],
          },
          runningTotal: { cost: 592 },
        });
      }
      return Promise.resolve({ docket: makeDocket() });
    });

    renderDocket('/p/docket/dk-1');

    fireEvent.click(await screen.findByRole('button', { name: 'Add crew hours' }));
    fireEvent.click(await screen.findByRole('button', { name: /Tommy Vella/ }));
    // Sheet defaults (classic useDocketEntrySheetState): 07:00 → 15:30.
    fireEvent.click(screen.getByRole('button', { name: 'Add to docket' }));

    await waitFor(() => expect(labourPost).toHaveBeenCalledTimes(1));
    const body = labourPost.mock.calls[0][0];
    const expectedHours = calculateHours('07:00', '15:30');
    expect(body).toEqual({
      employeeId: APPROVED_EMP.id,
      startTime: '07:00',
      finishTime: '15:30',
      lotAllocations: [{ lotId: 'lot-1', hours: expectedHours }],
    });
  });

  it('"Save & add another" keeps the sheet open, clears the person, and retains times + lot', async () => {
    setApi({ docket: makeDocket(), existingDockets: [] });
    const labourPost = vi.fn();
    apiFetchMock.mockImplementation((url: string, opts?: { method?: string; body?: string }) => {
      const method = opts?.method ?? 'GET';
      if (url.startsWith('/api/subcontractors/my-company'))
        return Promise.resolve({
          company: {
            id: 'c1',
            projectId: PROJECT_ID,
            projectName: 'Demo',
            employees: [APPROVED_EMP, PENDING_EMP],
            plant: [APPROVED_PLANT],
          },
        });
      if (url.startsWith('/api/lots')) return Promise.resolve({ lots: ASSIGNED_LOTS });
      if (/^\/api\/dockets\?/.test(url)) return Promise.resolve({ dockets: [] });
      if (/^\/api\/dockets\/dk-1$/.test(url) && method === 'GET')
        return Promise.resolve({ docket: makeDocket() });
      if (/\/labour$/.test(url) && method === 'POST') {
        labourPost(JSON.parse(opts!.body!));
        return Promise.resolve({
          labourEntry: {
            id: `le-${labourPost.mock.calls.length}`,
            employee: { id: APPROVED_EMP.id, name: 'Tommy', role: 'Pipe Layer', hourlyRate: 74 },
            startTime: '07:00',
            finishTime: '15:30',
            submittedHours: 8,
            hourlyRate: 74,
            submittedCost: 592,
            lotAllocations: [{ lotId: 'lot-1', lotNumber: 'LOT-014', hours: 8 }],
          },
          runningTotal: { cost: 592 },
        });
      }
      return Promise.resolve({ docket: makeDocket() });
    });

    renderDocket('/p/docket/dk-1');

    fireEvent.click(await screen.findByRole('button', { name: 'Add crew hours' }));
    const tommyRow = await screen.findByRole('button', { name: /Tommy Vella/ });
    fireEvent.click(tommyRow);
    fireEvent.click(screen.getByRole('button', { name: /Save and add another/i }));

    await waitFor(() => expect(labourPost).toHaveBeenCalledTimes(1));

    // Sheet stays open and the person is cleared (no longer selected).
    expect(screen.getByRole('button', { name: 'Add to docket' })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Tommy Vella/ })).toHaveAttribute(
        'aria-pressed',
        'false',
      ),
    );

    // Re-picking the same worker and adding again reuses the retained times + lot.
    fireEvent.click(screen.getByRole('button', { name: /Tommy Vella/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Add to docket' }));
    await waitFor(() => expect(labourPost).toHaveBeenCalledTimes(2));
    expect(labourPost.mock.calls[1][0]).toEqual(labourPost.mock.calls[0][0]);
  });

  it('plant POST payload carries wetOrDry literal + hoursOperated', async () => {
    setApi({ docket: makeDocket(), existingDockets: [] });
    const plantPost = vi.fn();
    apiFetchMock.mockImplementation((url: string, opts?: { method?: string; body?: string }) => {
      const method = opts?.method ?? 'GET';
      if (url.startsWith('/api/subcontractors/my-company'))
        return Promise.resolve({
          company: {
            id: 'c1',
            projectId: PROJECT_ID,
            projectName: 'Demo',
            employees: [APPROVED_EMP],
            plant: [APPROVED_PLANT],
          },
        });
      if (url.startsWith('/api/lots')) return Promise.resolve({ lots: ASSIGNED_LOTS });
      if (/^\/api\/dockets\?/.test(url)) return Promise.resolve({ dockets: [] });
      if (/^\/api\/dockets\/dk-1$/.test(url) && method === 'GET')
        return Promise.resolve({ docket: makeDocket() });
      if (/\/plant$/.test(url) && method === 'POST') {
        plantPost(JSON.parse(opts!.body!));
        return Promise.resolve({
          plantEntry: {
            id: 'pe-1',
            plant: {
              id: 'plant-1',
              type: 'Excavator',
              description: 'CAT 320',
              dryRate: 180,
              wetRate: 210,
            },
            hoursOperated: 6.5,
            wetOrDry: 'dry',
            hourlyRate: 180,
            submittedCost: 1170,
            lotAllocations: [{ lotId: 'lot-1', lotNumber: 'LOT-014', hours: 8 }],
          },
          runningTotal: { cost: 1170 },
        });
      }
      return Promise.resolve({ docket: makeDocket() });
    });

    renderDocket('/p/docket/dk-1');

    fireEvent.click(await screen.findByRole('button', { name: 'Add plant hours' }));
    fireEvent.click(await screen.findByRole('button', { name: /Excavator/ }));
    // Default hoursOperated = "8".
    fireEvent.click(screen.getByRole('button', { name: 'Add to docket' }));

    await waitFor(() => expect(plantPost).toHaveBeenCalledTimes(1));
    expect(plantPost.mock.calls[0][0]).toEqual({
      plantId: 'plant-1',
      hoursOperated: 8,
      wetOrDry: 'dry',
      lotAllocations: [{ lotId: 'lot-1', hours: 8 }],
    });
  });

  it('labour picker locks pending (non-approved) crew', async () => {
    setApi({ docket: makeDocket(), existingDockets: [] });
    renderDocket('/p/docket/dk-1');
    fireEvent.click(await screen.findByRole('button', { name: 'Add crew hours' }));
    const approved = await screen.findByRole('button', { name: /Tommy Vella/ });
    const pending = screen.getByRole('button', { name: /Ben K/ });
    expect(approved).not.toBeDisabled();
    expect(pending).toBeDisabled();
  });

  it('pending_approval docket is fully read-only (no add/delete/submit)', async () => {
    setApi({
      docket: makeDocket({
        status: 'pending_approval',
        labourEntries: [
          {
            id: 'le-1',
            employee: { id: 'e', name: 'Tommy', role: 'Pipe Layer', hourlyRate: 74 },
            startTime: '07:00',
            finishTime: '15:00',
            submittedHours: 8,
            hourlyRate: 74,
            submittedCost: 592,
            lotAllocations: [{ lotId: 'lot-1', lotNumber: 'LOT-014', hours: 8 }],
          },
        ],
        totalLabourSubmitted: 592,
      }),
      existingDockets: [],
    });
    renderDocket('/p/docket/dk-1');
    await screen.findByText('Tommy');
    expect(screen.queryByRole('button', { name: 'Add crew hours' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add plant hours' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Submit for approval/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Remove Tommy/ })).toBeNull();
    expect(screen.getByText(/waiting on the foreman/i)).toBeInTheDocument();
  });

  it('approved docket rows show approved costs and approved labour hours', async () => {
    setApi({
      docket: makeDocket({
        status: 'approved',
        labourEntries: [
          {
            id: 'le-1',
            employee: { id: 'e', name: 'Tommy', role: 'Pipe Layer', hourlyRate: 74 },
            startTime: '07:00',
            finishTime: '15:00',
            submittedHours: 8,
            hourlyRate: 74,
            submittedCost: 592,
            approvedHours: 6,
            approvedCost: 444,
            lotAllocations: [{ lotId: 'lot-1', lotNumber: 'LOT-014', hours: 8 }],
          },
        ],
        plantEntries: [
          {
            id: 'pe-1',
            plant: {
              id: 'plant-1',
              type: 'Excavator',
              description: 'CAT 320',
              dryRate: 150,
              wetRate: 180,
            },
            hoursOperated: 3,
            wetOrDry: 'dry',
            hourlyRate: 150,
            submittedCost: 450,
            approvedCost: 300,
            lotAllocations: [{ lotId: 'lot-1', lotNumber: 'LOT-014', hours: 3 }],
          },
        ],
        totalLabourSubmitted: 592,
        totalPlantSubmitted: 450,
        totalLabourApprovedCost: 444,
        totalPlantApprovedCost: 300,
        adjustmentReason: 'Reduced to verified site hours',
      }),
      existingDockets: [],
    });

    renderDocket('/p/docket/dk-1');

    expect(await screen.findByText('Tommy')).toBeInTheDocument();
    expect(screen.getAllByText('$444.00').length).toBeGreaterThan(0);
    expect(screen.getByText('6 h')).toBeInTheDocument();
    expect(screen.getAllByText('$300.00').length).toBeGreaterThan(0);
    expect(screen.getByText('was 8 h / $592.00')).toBeInTheDocument();
    expect(screen.getByText('was $450.00')).toBeInTheDocument();
    expect(screen.getAllByText('LOT-014').length).toBeGreaterThan(1);
    expect(screen.getByText(/Approved with adjustment/i)).toBeInTheDocument();
    expect(screen.getByText('Reduced to verified site hours')).toBeInTheDocument();

    const grandLabel = screen.getByText("Today's total");
    const grandRow = grandLabel.closest('.grand')!;
    expect(within(grandRow as HTMLElement).getByText('$744.00')).toBeInTheDocument();
  });

  it('submit is disabled when the draft has no entries', async () => {
    setApi({ docket: makeDocket(), existingDockets: [] });
    renderDocket('/p/docket/dk-1');
    const submit = await screen.findByRole('button', { name: 'Submit for approval' });
    expect(submit).toBeDisabled();
  });

  it('offline editable dockets show online-required copy and block writes', async () => {
    useOfflineStatusMock.mockReturnValue({
      isOnline: false,
      pendingSyncCount: 0,
      failedSyncCount: 0,
      isSyncing: false,
    });
    setApi({
      docket: makeDocket({
        notes: 'offline-visible note',
        labourEntries: [
          {
            id: 'le-1',
            employee: { id: 'e', name: 'Tommy', role: 'Pipe Layer', hourlyRate: 74 },
            startTime: '07:00',
            finishTime: '15:00',
            submittedHours: 8,
            hourlyRate: 74,
            submittedCost: 592,
            lotAllocations: [{ lotId: 'lot-1', lotNumber: 'LOT-014', hours: 8 }],
          },
        ],
        totalLabourSubmitted: 592,
      }),
      existingDockets: [],
    });

    renderDocket('/p/docket/dk-1');

    expect(await screen.findByText(/Dockets need a connection/i)).toBeInTheDocument();
    expect(screen.getByText(/Offline — reconnect to edit this docket/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add crew hours' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add plant hours' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remove Tommy/ })).not.toBeInTheDocument();
    expect(screen.getByText('offline-visible note')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit for approval' })).toBeDisabled();
  });

  it('queried docket shows the foreman query + answer box, and respond POSTs {response}', async () => {
    setApi({
      docket: makeDocket({
        status: 'queried',
        foremanNotes: 'Confirm water cart hours',
        labourEntries: [],
        plantEntries: [],
      }),
      existingDockets: [],
    });
    const respondPost = vi.fn();
    apiFetchMock.mockImplementation((url: string, opts?: { method?: string; body?: string }) => {
      const method = opts?.method ?? 'GET';
      if (url.startsWith('/api/subcontractors/my-company'))
        return Promise.resolve({
          company: {
            id: 'c1',
            projectId: PROJECT_ID,
            projectName: 'Demo',
            employees: [],
            plant: [],
          },
        });
      if (url.startsWith('/api/lots')) return Promise.resolve({ lots: ASSIGNED_LOTS });
      if (/^\/api\/dockets\?/.test(url)) return Promise.resolve({ dockets: [] });
      if (/^\/api\/dockets\/dk-1$/.test(url) && method === 'GET')
        return Promise.resolve({
          docket: makeDocket({ status: 'queried', foremanNotes: 'Confirm water cart hours' }),
        });
      if (/\/respond$/.test(url) && method === 'POST') {
        respondPost(JSON.parse(opts!.body!));
        return Promise.resolve({});
      }
      return Promise.resolve({});
    });

    renderDocket('/p/docket/dk-1?projectId=proj-1&subcontractorCompanyId=c1');
    expect(await screen.findByText(/Confirm water cart hours/)).toBeInTheDocument();

    const answer = screen.getByLabelText('Your answer to the foreman');
    fireEvent.change(answer, { target: { value: 'Cart left at 1:30pm — 6.5h.' } });
    fireEvent.click(screen.getByRole('button', { name: /Send answer and resubmit/i }));

    await waitFor(() => expect(respondPost).toHaveBeenCalledTimes(1));
    expect(respondPost.mock.calls[0][0]).toEqual({ response: 'Cart left at 1:30pm — 6.5h.' });
    await expect(screen.findByTestId('home-location')).resolves.toHaveTextContent(
      'home ?projectId=proj-1&subcontractorCompanyId=c1',
    );
  });

  it('rejected docket is editable and shows a Resubmit affordance', async () => {
    setApi({
      docket: makeDocket({
        status: 'rejected',
        foremanNotes: 'No lot allocated',
        labourEntries: [
          {
            id: 'le-1',
            employee: { id: 'e', name: 'Tommy', role: 'Pipe Layer', hourlyRate: 74 },
            startTime: '07:00',
            finishTime: '15:00',
            submittedHours: 8,
            hourlyRate: 74,
            submittedCost: 592,
            lotAllocations: [{ lotId: 'lot-1', lotNumber: 'LOT-014', hours: 8 }],
          },
        ],
        totalLabourSubmitted: 592,
      }),
      existingDockets: [],
    });
    renderDocket('/p/docket/dk-1');
    expect(await screen.findByText(/No lot allocated/)).toBeInTheDocument();
    // Editable → add buttons present.
    expect(screen.getByRole('button', { name: 'Add crew hours' })).toBeInTheDocument();
    // Resubmit bar present and enabled (has 1 entry).
    const resubmit = screen.getByRole('button', { name: 'Resubmit for approval' });
    expect(resubmit).not.toBeDisabled();
  });

  it('notes PATCH fires on blur ONLY when the text changed', async () => {
    setApi({ docket: makeDocket({ notes: 'original' }), existingDockets: [] });
    const notesPatch = vi.fn();
    apiFetchMock.mockImplementation((url: string, opts?: { method?: string; body?: string }) => {
      const method = opts?.method ?? 'GET';
      if (url.startsWith('/api/subcontractors/my-company'))
        return Promise.resolve({
          company: {
            id: 'c1',
            projectId: PROJECT_ID,
            projectName: 'Demo',
            employees: [],
            plant: [],
          },
        });
      if (url.startsWith('/api/lots')) return Promise.resolve({ lots: ASSIGNED_LOTS });
      if (/^\/api\/dockets\?/.test(url)) return Promise.resolve({ dockets: [] });
      if (/^\/api\/dockets\/dk-1$/.test(url) && method === 'GET')
        return Promise.resolve({ docket: makeDocket({ notes: 'original' }) });
      if (/^\/api\/dockets\/dk-1$/.test(url) && method === 'PATCH') {
        notesPatch(JSON.parse(opts!.body!));
        return Promise.resolve({ docket: makeDocket({ notes: 'changed' }) });
      }
      return Promise.resolve({});
    });

    renderDocket('/p/docket/dk-1');
    const notes = await screen.findByLabelText('Docket notes');

    // Blur with no change → no PATCH.
    fireEvent.blur(notes);
    expect(notesPatch).not.toHaveBeenCalled();

    // Change then blur → PATCH with new notes.
    fireEvent.change(notes, { target: { value: 'changed' } });
    fireEvent.blur(notes);
    await waitFor(() => expect(notesPatch).toHaveBeenCalledTimes(1));
    expect(notesPatch.mock.calls[0][0]).toEqual({ notes: 'changed' });
  });

  it('totals math comes from runningTotal.cost (entry cost rendered)', async () => {
    setApi({
      docket: makeDocket({
        status: 'draft',
        labourEntries: [
          {
            id: 'le-1',
            employee: { id: 'e', name: 'Tommy', role: 'Pipe Layer', hourlyRate: 74 },
            startTime: '07:00',
            finishTime: '15:00',
            submittedHours: calculateHours('07:00', '15:00'),
            hourlyRate: 74,
            submittedCost: 592,
            lotAllocations: [{ lotId: 'lot-1', lotNumber: 'LOT-014', hours: 8 }],
          },
        ],
        totalLabourSubmitted: 592,
      }),
      existingDockets: [],
    });
    renderDocket('/p/docket/dk-1');
    const grandLabel = await screen.findByText("Today's total");
    // The grand-total row pairs the label with the running total ($592).
    const grandRow = grandLabel.closest('.grand')!;
    expect(within(grandRow as HTMLElement).getByText('$592.00')).toBeInTheDocument();
  });

  it('entry delete is two-tap: first tap arms (no DELETE), second tap deletes', async () => {
    setApi({
      docket: makeDocket({
        labourEntries: [
          {
            id: 'le-1',
            employee: { id: APPROVED_EMP.id, name: 'Tommy Vella', role: 'Pipe Layer' },
            startTime: '07:00',
            finishTime: '15:00',
            submittedHours: 8,
            submittedCost: 592,
            lotAllocations: [],
          },
        ],
        totalLabourSubmitted: 592,
      }),
      existingDockets: [],
    });
    renderDocket('/p/docket/dk-1');

    const removeBtn = await screen.findByRole('button', { name: /Remove Tommy Vella/ });
    fireEvent.click(removeBtn);

    // Armed, visibly asking for the second tap — and NO DELETE sent yet.
    expect(removeBtn).toHaveTextContent('Remove?');
    expect(
      apiFetchMock.mock.calls.filter(
        ([, opts]) => (opts as { method?: string })?.method === 'DELETE',
      ),
    ).toHaveLength(0);

    fireEvent.click(removeBtn);
    await waitFor(() => {
      const deletes = apiFetchMock.mock.calls.filter(
        ([, opts]) => (opts as { method?: string })?.method === 'DELETE',
      );
      expect(deletes).toHaveLength(1);
      expect(deletes[0][0]).toBe('/api/dockets/dk-1/labour/le-1');
    });
  });

  it('entry delete refreshes the grand total from runningTotal.cost', async () => {
    apiFetchMock.mockImplementation((url: string, opts?: { method?: string }) => {
      const method = opts?.method ?? 'GET';
      if (url.startsWith('/api/subcontractors/my-company'))
        return Promise.resolve({
          company: {
            id: 'c1',
            projectId: PROJECT_ID,
            projectName: 'Demo',
            employees: [APPROVED_EMP],
            plant: [APPROVED_PLANT],
          },
        });
      if (url.startsWith('/api/lots')) return Promise.resolve({ lots: ASSIGNED_LOTS });
      if (/^\/api\/dockets\?/.test(url)) return Promise.resolve({ dockets: [] });
      if (/^\/api\/dockets\/dk-1$/.test(url) && method === 'GET')
        return Promise.resolve({
          docket: makeDocket({
            labourEntries: [
              {
                id: 'le-1',
                employee: { id: 'e1', name: 'Tommy Vella', role: 'Pipe Layer' },
                startTime: '07:00',
                finishTime: '15:00',
                submittedHours: 8,
                submittedCost: 592,
                lotAllocations: [],
              },
              {
                id: 'le-2',
                employee: { id: 'e2', name: 'Rina Costa', role: 'Labourer' },
                startTime: '07:00',
                finishTime: '09:00',
                submittedHours: 2,
                submittedCost: 148,
                lotAllocations: [],
              },
            ],
            totalLabourSubmitted: 740,
          }),
        });
      if (/\/labour\/le-1$/.test(url) && method === 'DELETE')
        return Promise.resolve({ runningTotal: { cost: 111 } });
      return Promise.resolve({});
    });
    renderDocket('/p/docket/dk-1');

    const totalBefore = (await screen.findByText("Today's total")).closest('.grand')!;
    expect(within(totalBefore as HTMLElement).getByText('$740.00')).toBeInTheDocument();

    const removeBtn = await screen.findByRole('button', { name: /Remove Tommy Vella/ });
    fireEvent.click(removeBtn);
    fireEvent.click(removeBtn);

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Remove Tommy Vella/ })).not.toBeInTheDocument();
    });
    const totalAfter = screen.getByText("Today's total").closest('.grand')!;
    expect(within(totalAfter as HTMLElement).getByText('$111.00')).toBeInTheDocument();
  });

  it('a slow docket GET after the lazy create cannot erase the first entry (seed-once guard)', async () => {
    // The race: ensureDocket's navigate(replace) enables the docket GET while
    // the first labour POST is still in flight. The GET was dispatched before
    // the entry existed — if its (entry-less) response lands AFTER the entry
    // was appended locally, a blind re-seed would erase the entry and grey out
    // Submit. Defer the GET to force exactly that ordering.
    let resolveStaleGet: (value: unknown) => void = () => {};
    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation((url: string, opts?: { method?: string; body?: string }) => {
      const method = opts?.method ?? 'GET';
      if (url.startsWith('/api/subcontractors/my-company'))
        return Promise.resolve({
          company: {
            id: 'c1',
            projectId: PROJECT_ID,
            projectName: 'Demo',
            employees: [APPROVED_EMP, PENDING_EMP],
            plant: [APPROVED_PLANT],
          },
        });
      if (url.startsWith('/api/lots')) return Promise.resolve({ lots: ASSIGNED_LOTS });
      if (/^\/api\/dockets\?/.test(url)) return Promise.resolve({ dockets: [] });
      if (url === '/api/dockets' && method === 'POST')
        return Promise.resolve({ docket: makeDocket() });
      if (/\/labour$/.test(url) && method === 'POST')
        return Promise.resolve({
          labourEntry: {
            id: 'le-1',
            employee: { id: APPROVED_EMP.id, name: 'Tommy Vella', role: 'Pipe Layer' },
            startTime: '07:00',
            finishTime: '15:00',
            submittedHours: 8,
            hourlyRate: 74,
            submittedCost: 592,
            lotAllocations: [],
          },
          runningTotal: { cost: 592 },
        });
      if (/^\/api\/dockets\/dk-1$/.test(url) && method === 'GET')
        return new Promise((resolve) => {
          resolveStaleGet = resolve;
        });
      return Promise.resolve({});
    });

    renderDocket('/p/docket');
    fireEvent.click(await screen.findByRole('button', { name: 'Add crew hours' }));
    fireEvent.click(await screen.findByRole('button', { name: /Tommy Vella/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Add to docket' }));

    // The entry landed locally and Submit is live. (findByRole — the appended
    // ?projectId= re-keys the my-company query, so a brief loading frame can
    // sit between renders here.)
    await screen.findByRole('button', { name: /Remove Tommy Vella/ });
    expect(await screen.findByRole('button', { name: /Submit for approval/ })).not.toBeDisabled();

    // NOW the stale, entry-less GET response arrives — it must be ignored.
    resolveStaleGet({ docket: makeDocket() });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Remove Tommy Vella/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Submit for approval/ })).not.toBeDisabled();
    });
  });
});
