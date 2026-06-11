/**
 * Tests for DocketsListScreen — renders pending-first cards, filter chips, the
 * loading / error / empty states, and asserts there is NO create-docket
 * affordance (foreman approves/rejects/queries; never creates — research doc 14).
 *
 * MOCKS @/lib/useOfflineStatus (Dexie/IndexedDB) for CI coverage parity, since
 * ShellScreen mounts SyncChip → useOfflineStatus.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { Docket } from '@/pages/dockets/docketApprovalsData';
import type { DocketsShellData } from '../useDocketsShellData';

vi.mock('@/lib/useOfflineStatus', () => ({
  useOfflineStatus: () => ({ isOnline: true, pendingSyncCount: 0, isSyncing: false }),
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

import { DocketsListScreen } from '../DocketsListScreen';
import { pendingDocketCount } from '../docketsShellState';

function makeDocket(over: Partial<Docket>): Docket {
  return {
    id: 'd1',
    docketNumber: 'DKT-0142',
    subcontractor: 'CivilWorx Pty Ltd',
    subcontractorId: 's1',
    date: '2026-06-10',
    status: 'pending_approval',
    notes: null,
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

function makeData(dockets: Docket[], over: Partial<DocketsShellData> = {}): DocketsShellData {
  return {
    projectId: 'proj-1',
    dockets,
    projectName: 'Demo Project',
    loading: false,
    loadError: null,
    pendingCount: pendingDocketCount(dockets),
    refetch: vi.fn(),
    ...over,
  };
}

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/m/dockets']}>
      <Routes>
        <Route path="/m/dockets" element={<DocketsListScreen />} />
        <Route path="/m/dockets/:docketId" element={<div>docket detail</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('DocketsListScreen', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the mono docket number, subbie name and mono hours summary', () => {
    _data = makeData([makeDocket({})]);
    renderScreen();
    expect(screen.getByText('DKT-0142')).toBeInTheDocument();
    expect(screen.getByText(/CivilWorx Pty Ltd/)).toBeInTheDocument();
    // Mono labour + plant figures appear in the summary line.
    expect(screen.getByText('48')).toBeInTheDocument();
    expect(screen.getByText('16')).toBeInTheDocument();
  });

  it('defaults to the pending filter and shows pending-first', () => {
    _data = makeData([
      makeDocket({ id: 'p', docketNumber: 'DKT-0142', status: 'pending_approval' }),
      makeDocket({ id: 'a', docketNumber: 'DKT-0100', status: 'approved' }),
    ]);
    renderScreen();
    // Approved docket is hidden under the default pending filter.
    expect(screen.queryByText('DKT-0100')).toBeNull();
    expect(screen.getByText('DKT-0142')).toBeInTheDocument();
  });

  it('switches filters and shows approved dockets', () => {
    _data = makeData([
      makeDocket({ id: 'p', docketNumber: 'DKT-0142', status: 'pending_approval' }),
      makeDocket({ id: 'a', docketNumber: 'DKT-0100', status: 'approved' }),
    ]);
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: /^Approved$/ }));
    expect(screen.getByText('DKT-0100')).toBeInTheDocument();
    expect(screen.queryByText('DKT-0142')).toBeNull();
  });

  it('shows a loading skeleton', () => {
    _data = makeData([], { loading: true });
    const { container } = renderScreen();
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('shows the load-error message', () => {
    _data = makeData([], { loadError: 'Failed to fetch dockets' });
    renderScreen();
    expect(screen.getByText('Failed to fetch dockets')).toBeInTheDocument();
  });

  it('shows an all-caught-up empty state when no pending dockets', () => {
    _data = makeData([]);
    renderScreen();
    expect(screen.getByText(/No dockets waiting for your approval/i)).toBeInTheDocument();
  });

  it('has NO create/add docket affordance (foreman never creates)', () => {
    _data = makeData([makeDocket({})]);
    renderScreen();
    expect(screen.queryByRole('button', { name: /create|add docket|new docket/i })).toBeNull();
  });
});
