/**
 * Tests for the subbie shell DocketsListScreen.
 *
 * MOCKS @/lib/useOfflineStatus (Dexie/IndexedDB) so coverage runs in CI.
 *
 * Pins: filter chips (All / Needs attention / Pending / Approved) with the
 * approved grouping (needs-attention = queried + rejected); rows show entry
 * count + $ total + badge; queried/rejected rows surface a foremanNotes snippet;
 * rows link into /p/docket/:id.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/lib/useOfflineStatus', () => ({
  useOfflineStatus: () => ({ isOnline: true, pendingSyncCount: 0, isSyncing: false }),
}));
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: { id: 'u1', fullName: 'Mick', role: 'subcontractor' } }),
}));
let projectId = 'proj-1';
vi.mock('../../../subbieShellContext', () => ({
  useSubbieShellContext: () => ({ projectId }),
}));

const apiFetchMock = vi.fn();
vi.mock('@/lib/api', () => ({
  ApiError: class ApiError extends Error {},
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

import { DocketsListScreen } from '../DocketsListScreen';

const now = new Date();
const thisMonth = (day: number) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

type DocketListTestRow = {
  id: string;
  date: string;
  status: string;
  totalLabourSubmitted: number;
  totalPlantSubmitted: number;
  labourEntryCount?: number;
  plantEntryCount?: number;
  labourEntries?: { id: string }[];
  plantEntries?: { id: string }[];
  foremanNotes?: string;
};

const DOCKETS: DocketListTestRow[] = [
  {
    id: 'd-draft',
    date: thisMonth(12),
    status: 'draft',
    totalLabourSubmitted: 1280,
    totalPlantSubmitted: 1170,
    labourEntries: [{ id: 'a' }, { id: 'b' }],
    plantEntries: [{ id: 'c' }],
  },
  {
    id: 'd-queried',
    date: thisMonth(9),
    status: 'queried',
    totalLabourSubmitted: 3180,
    totalPlantSubmitted: 0,
    labourEntries: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }],
    plantEntries: [],
    foremanNotes: 'Water cart hours look high',
  },
  {
    id: 'd-approved',
    date: thisMonth(10),
    status: 'approved',
    totalLabourSubmitted: 2180,
    totalPlantSubmitted: 0,
    labourEntries: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
    plantEntries: [],
  },
  {
    id: 'd-rejected',
    date: thisMonth(8),
    status: 'rejected',
    totalLabourSubmitted: 1640,
    totalPlantSubmitted: 0,
    labourEntries: [{ id: 'a' }, { id: 'b' }],
    plantEntries: [],
    foremanNotes: 'No lot allocated for labour',
  },
  {
    id: 'd-pending',
    date: thisMonth(7),
    status: 'pending_approval',
    totalLabourSubmitted: 1000,
    totalPlantSubmitted: 0,
    labourEntries: [{ id: 'a' }],
    plantEntries: [],
  },
];

function setApi(dockets = DOCKETS) {
  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation((url: string) => {
    if (url.startsWith('/api/dockets')) return Promise.resolve({ dockets });
    return Promise.resolve({});
  });
}

function renderList() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/p/dockets']}>
        <Routes>
          <Route path="/p/dockets" element={<DocketsListScreen />} />
          <Route path="/p/docket/:docketId" element={<div>docket detail</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('subbie shell DocketsListScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectId = 'proj-1';
    setApi();
  });

  it('encodes projectId before building the dockets URL', async () => {
    projectId = 'proj-1&subcontractorView=false';
    setApi([]);
    renderList();
    await screen.findByText('No dockets yet.');
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/dockets?projectId=proj-1%26subcontractorView%3Dfalse',
    );
  });

  it('renders the month-approved sub-line', async () => {
    renderList();
    // Only the approved docket counts: $2,180.
    expect(await screen.findByText('$2,180.00')).toBeInTheDocument();
    expect(screen.getByText(/approved/)).toBeInTheDocument();
  });

  it('shows a load error instead of an empty docket history when the API fails', async () => {
    apiFetchMock.mockReset();
    apiFetchMock.mockRejectedValue(new Error('Docket history unavailable'));

    renderList();

    expect(await screen.findByRole('alert')).toHaveTextContent('Docket history unavailable');
    expect(screen.queryByText('No dockets yet.')).not.toBeInTheDocument();
  });

  it('shows all dockets under All, with entry count + $ total', async () => {
    renderList();
    // Draft total 1280 + 1170 = 2450 (unique); row also shows "3 entries".
    const draftRow = await screen.findByRole('button', { name: /\$2,450/ });
    expect(within(draftRow).getByText(/3 entries/)).toBeInTheDocument();
    // All five dockets render under the All filter.
    expect(screen.getByText(/DRAFT/)).toBeInTheDocument();
    expect(screen.getByText(/QUERIED/)).toBeInTheDocument();
    expect(screen.getByText(/APPROVED/)).toBeInTheDocument();
    expect(screen.getByText(/REJECTED/)).toBeInTheDocument();
    expect(screen.getByText(/PENDING/)).toBeInTheDocument();
  });

  it('uses explicit entry counts from the list API when entry arrays are omitted', async () => {
    setApi([
      {
        id: 'd-approved-counts',
        date: thisMonth(10),
        status: 'approved',
        totalLabourSubmitted: 748,
        totalPlantSubmitted: 1200,
        labourEntryCount: 1,
        plantEntryCount: 1,
      },
    ]);

    renderList();

    const row = await screen.findByRole('button', { name: /2 entries/ });
    expect(within(row).getByText(/2 entries/)).toBeInTheDocument();
    expect(within(row).getByText(/\$1,948/)).toBeInTheDocument();
  });

  it('Needs attention filter shows only queried + rejected', async () => {
    renderList();
    await screen.findByRole('button', { name: /\$2,450/ }); // wait for load
    fireEvent.click(screen.getByRole('button', { name: /Needs attention/ }));
    expect(screen.getByText(/Water cart hours look high/)).toBeInTheDocument();
    expect(screen.getByText(/No lot allocated for labour/)).toBeInTheDocument();
    // Approved / pending / draft are filtered out.
    expect(screen.queryByText(/APPROVED/)).toBeNull();
    expect(screen.queryByText(/PENDING/)).toBeNull();
    expect(screen.queryByText(/DRAFT/)).toBeNull();
  });

  it('Approved filter shows only approved dockets', async () => {
    renderList();
    await screen.findByRole('button', { name: /\$2,450/ });
    fireEvent.click(screen.getByRole('button', { name: 'Approved' }));
    expect(screen.getByText(/APPROVED/)).toBeInTheDocument();
    expect(screen.queryByText(/QUERIED/)).toBeNull();
    expect(screen.queryByText(/DRAFT/)).toBeNull();
  });

  it('Pending filter shows only pending_approval dockets', async () => {
    renderList();
    await screen.findByRole('button', { name: /\$2,450/ });
    fireEvent.click(screen.getByRole('button', { name: 'Pending' }));
    expect(screen.getByText(/PENDING/)).toBeInTheDocument();
    expect(screen.queryByText(/QUERIED/)).toBeNull();
  });

  it('rows navigate to /p/docket/:id', async () => {
    renderList();
    fireEvent.click(await screen.findByRole('button', { name: /\$2,450/ }));
    expect(screen.getByText('docket detail')).toBeInTheDocument();
  });
});
