/**
 * Tests for DocketDetailScreen — renders the Labour/Plant/Notes cards with mono
 * figures and the labour/plant entry breakdowns; the primary Approve carries the
 * submitted hours in its label and fires the reused approve mutation; offline
 * disables Approve with an honest note; no create affordance anywhere.
 *
 * MOCKS @/lib/useOfflineStatus (ShellScreen → SyncChip) — toggled per test.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { Docket } from '@/pages/dockets/docketApprovalsData';
import type { DocketsShellData } from '../useDocketsShellData';

let _online = true;
vi.mock('@/lib/useOfflineStatus', () => ({
  useOfflineStatus: () => ({ isOnline: _online, pendingSyncCount: 0, isSyncing: false }),
}));
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: { fullName: 'Jay', roleInCompany: 'foreman' } }),
}));
vi.mock('@/hooks/useEffectiveProjectId', () => ({
  useEffectiveProjectId: () => ({ projectId: 'proj-1', isResolving: false }),
}));

let _data: DocketsShellData;
vi.mock('../docketsShellContext', () => ({
  useDocketsShellContext: () => _data,
}));

const runAction = vi.fn(() => Promise.resolve(true));
vi.mock('../useDocketAction', () => ({
  useDocketAction: () => ({ submitting: false, runAction }),
}));

let _entries: {
  labourEntries: Array<Record<string, unknown>>;
  plantEntries: Array<Record<string, unknown>>;
};
let _detailLoading = false;
let _detailError = false;
const refetchEntries = vi.fn();
vi.mock('@/pages/dockets/docketActionData', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/pages/dockets/docketActionData')>();
  return {
    ...actual,
    useDocketDetailEntriesQuery: () => ({
      data: _entries,
      isLoading: _detailLoading,
      isError: _detailError,
      refetch: refetchEntries,
    }),
  };
});

import { DocketDetailScreen } from '../DocketDetailScreen';

function makeDocket(over: Partial<Docket>): Docket {
  return {
    id: 'd1',
    docketNumber: 'DKT-0142',
    subcontractor: 'CivilWorx Pty Ltd',
    subcontractorId: 's1',
    date: '2026-06-10',
    status: 'pending_approval',
    notes: 'Culvert base prep and backfill as directed.',
    labourHours: 48,
    plantHours: 16,
    totalLabourSubmitted: 48,
    totalLabourApproved: 0,
    totalPlantSubmitted: 16,
    totalPlantApproved: 0,
    submittedAt: '2026-06-10T08:00:00Z',
    approvedAt: null,
    foremanNotes: null,
    ...over,
  };
}

function makeData(dockets: Docket[]): DocketsShellData {
  return {
    projectId: 'proj-1',
    dockets,
    projectName: 'Demo Project',
    loading: false,
    loadError: null,
    pendingCount: dockets.filter((d) => d.status === 'pending_approval').length,
    refetch: vi.fn(),
  };
}

function renderScreen(docketId = 'd1') {
  return render(
    <MemoryRouter initialEntries={[`/m/dockets/${docketId}`]}>
      <Routes>
        <Route path="/m/dockets" element={<div>dockets list</div>} />
        <Route path="/m/dockets/:docketId" element={<DocketDetailScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  _online = true;
  _detailLoading = false;
  _detailError = false;
  _entries = {
    labourEntries: [
      {
        id: 'l1',
        employee: { name: 'Sam Carter', role: 'Labourer' },
        startTime: null,
        finishTime: null,
        submittedHours: 8,
        approvedHours: 0,
        hourlyRate: 50,
        submittedCost: 400,
        approvedCost: 0,
      },
    ],
    plantEntries: [
      {
        id: 'p1',
        plant: { type: 'excavator', description: '20t excavator', idRego: 'EX-01' },
        hoursOperated: 8,
        wetOrDry: 'wet',
        hourlyRate: 120,
        submittedCost: 960,
        approvedCost: 0,
      },
    ],
  };
});

describe('DocketDetailScreen', () => {
  it('renders Labour/Plant/Notes cards with mono figures', () => {
    _data = makeData([makeDocket({})]);
    renderScreen();
    expect(screen.getByText(/Labour —/)).toBeInTheDocument();
    expect(screen.getByText(/Plant —/)).toBeInTheDocument();
    expect(screen.getByText('Notes')).toBeInTheDocument();
    expect(screen.getByText(/Culvert base prep/)).toBeInTheDocument();
  });

  it('renders the labour and plant entry breakdowns', () => {
    _data = makeData([makeDocket({})]);
    renderScreen();
    expect(screen.getByText(/Sam Carter/)).toBeInTheDocument();
    expect(screen.getByText(/20t excavator/)).toBeInTheDocument();
  });

  it('approve fires the reused mutation with the approve action', async () => {
    _data = makeData([makeDocket({})]);
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: 'Approve — 48 labour + 16 plant' }));
    await waitFor(() =>
      expect(runAction).toHaveBeenCalledWith(
        expect.objectContaining({ docketId: 'd1', actionType: 'approve' }),
      ),
    );
  });

  it('disables Approve offline with the honest copy', () => {
    _online = false;
    _data = makeData([makeDocket({})]);
    renderScreen();
    const approve = screen.getByRole('button', { name: 'Approve — 48 labour + 16 plant' });
    expect(approve).toBeDisabled();
    expect(screen.getByText(/Approvals need signal/i)).toBeInTheDocument();
  });

  it('shows a load error and disables approval when entries cannot be fetched', () => {
    _detailError = true;
    _data = makeData([makeDocket({})]);
    renderScreen();

    expect(screen.getByText('Docket entries could not be loaded.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve — 48 labour + 16 plant' })).toBeDisabled();
  });

  it('exposes quiet Query / Reject / Adjust affordances while pending', () => {
    _data = makeData([makeDocket({})]);
    renderScreen();
    expect(screen.getByRole('button', { name: 'Query' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Adjust hours' })).toBeInTheDocument();
  });

  it('shows no Approve action for an already-approved docket', () => {
    _data = makeData([makeDocket({ status: 'approved' })]);
    renderScreen();
    expect(screen.queryByRole('button', { name: /^Approve/ })).toBeNull();
    expect(screen.getByText('APPROVED')).toBeInTheDocument();
  });

  it('has NO create-docket affordance anywhere', () => {
    _data = makeData([makeDocket({})]);
    renderScreen();
    expect(screen.queryByRole('button', { name: /create|add docket|new docket/i })).toBeNull();
  });
});
