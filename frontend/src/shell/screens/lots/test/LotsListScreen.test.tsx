/**
 * Tests for LotsListScreen — renders lot cards with statuses, pills, and the
 * checks-due chip, and orders actionable lots first.
 *
 * MOCKS @/lib/useOfflineStatus (Dexie/IndexedDB) for CI coverage parity, since
 * ShellScreen mounts SyncChip → useOfflineStatus.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { Lot } from '@/pages/lots/lotsPageTypes';

vi.mock('@/lib/useOfflineStatus', () => ({
  useOfflineStatus: () => ({ isOnline: true, pendingSyncCount: 0, isSyncing: false }),
}));
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: { fullName: 'Jay', roleInCompany: 'foreman' } }),
}));
vi.mock('@/hooks/useEffectiveProjectId', () => ({
  useEffectiveProjectId: () => ({ projectId: 'proj-1', isResolving: false }),
}));

let _data: ReturnType<typeof makeData>;
vi.mock('../lotsShellContext', () => ({
  useLotsShellContext: () => _data,
}));

import { LotsListScreen } from '../LotsListScreen';

function makeLot(over: Partial<Lot>): Lot {
  return {
    id: 'lot-1',
    lotNumber: 'LOT-001',
    description: 'Embankment',
    status: 'in_progress',
    chainageStart: null,
    chainageEnd: null,
    offset: null,
    layer: null,
    areaZone: null,
    ...over,
  };
}

function makeData(lots: Lot[], checksDue: Record<string, number> = {}) {
  return {
    projectId: 'proj-1',
    lots,
    loading: false,
    error: false,
    checksDue,
    refetch: vi.fn(),
  };
}

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/m/lots']}>
      <Routes>
        <Route path="/m/lots" element={<LotsListScreen />} />
        <Route path="/m/lots/:lotId" element={<div>lot hub</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('LotsListScreen', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders lot number, description and status pill', () => {
    _data = makeData([
      makeLot({ id: 'a', lotNumber: 'LOT-001', description: 'Embankment', status: 'in_progress' }),
    ]);
    renderScreen();
    expect(screen.getByText('LOT-001')).toBeInTheDocument();
    expect(screen.getByText(/Embankment/)).toBeInTheDocument();
    expect(screen.getByText('IN PROGRESS')).toBeInTheDocument();
  });

  it('shows the checks-due chip and totals in the sub-line', () => {
    _data = makeData([makeLot({ id: 'a', lotNumber: 'LOT-001' })], { a: 3 });
    renderScreen();
    expect(screen.getByText('3 DUE')).toBeInTheDocument();
    expect(screen.getByText('3 CHECKS DUE')).toBeInTheDocument();
  });

  it('renders hold-point and conformed statuses with the right labels', () => {
    _data = makeData([
      makeLot({ id: 'a', lotNumber: 'LOT-002', status: 'hold_point' }),
      makeLot({ id: 'b', lotNumber: 'LOT-003', status: 'conformed' }),
    ]);
    renderScreen();
    expect(screen.getByText('HOLD POINT')).toBeInTheDocument();
    expect(screen.getByText('CONFORMED')).toBeInTheDocument();
  });

  it('orders actionable lots (checks due) before benign ones', () => {
    _data = makeData(
      [
        makeLot({ id: 'plain', lotNumber: 'LOT-A', status: 'in_progress' }),
        makeLot({ id: 'busy', lotNumber: 'LOT-B', status: 'in_progress' }),
      ],
      { busy: 5 },
    );
    renderScreen();
    // Lot cards have accessible names beginning "Lot LOT-…"; the back chevron is
    // excluded. The busy lot (5 due) must render before the plain one.
    const cards = screen.getAllByRole('button', { name: /^Lot LOT-/ });
    expect(cards[0]).toHaveAccessibleName(/LOT-B/);
  });

  it('shows an empty state when there are no lots', () => {
    _data = makeData([]);
    renderScreen();
    expect(screen.getByText(/No lots on this project yet/i)).toBeInTheDocument();
  });

  it('shows an error state', () => {
    _data = { ...makeData([]), error: true };
    renderScreen();
    expect(screen.getByText(/Couldn’t load lots/i)).toBeInTheDocument();
  });

  it('has NO create/edit affordances (foreman read-only)', () => {
    _data = makeData([makeLot({ id: 'a', lotNumber: 'LOT-001' })]);
    renderScreen();
    expect(screen.queryByRole('button', { name: /create|add|new lot|edit/i })).toBeNull();
  });
});
