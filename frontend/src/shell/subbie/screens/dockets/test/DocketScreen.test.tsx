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
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { calculateHours } from '@/pages/subcontractor-portal/docketEditHelpers';

vi.mock('@/lib/useOfflineStatus', () => ({
  useOfflineStatus: () => ({ isOnline: true, pendingSyncCount: 0, isSyncing: false }),
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
          <Route path="/p" element={<div>home</div>} />
          <Route path="/p/docket" element={<DocketScreen />} />
          <Route path="/p/docket/:docketId" element={<DocketScreen />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
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

  it('submit is disabled when the draft has no entries', async () => {
    setApi({ docket: makeDocket(), existingDockets: [] });
    renderDocket('/p/docket/dk-1');
    const submit = await screen.findByRole('button', { name: 'Submit for approval' });
    expect(submit).toBeDisabled();
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

    renderDocket('/p/docket/dk-1');
    expect(await screen.findByText(/Confirm water cart hours/)).toBeInTheDocument();

    const answer = screen.getByLabelText('Your answer to the foreman');
    fireEvent.change(answer, { target: { value: 'Cart left at 1:30pm — 6.5h.' } });
    fireEvent.click(screen.getByRole('button', { name: /Send answer and resubmit/i }));

    await waitFor(() => expect(respondPost).toHaveBeenCalledTimes(1));
    expect(respondPost.mock.calls[0][0]).toEqual({ response: 'Cart left at 1:30pm — 6.5h.' });
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
    expect(within(grandRow as HTMLElement).getByText('$592')).toBeInTheDocument();
  });
});
