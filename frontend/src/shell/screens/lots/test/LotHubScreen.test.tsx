/**
 * Tests for LotHubScreen — the foreman mobile lot hub navigation contracts.
 *
 * The data hooks are mocked at the shell boundary so this test pins what the
 * user can do from the hub without coupling to the register fetch machinery.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { Lot } from '@/pages/lots/lotsPageTypes';
import type { LotsShellData } from '../useLotsShellData';

vi.mock('@/lib/useOfflineStatus', () => ({
  useOfflineStatus: () => ({ isOnline: true, pendingSyncCount: 0, isSyncing: false }),
}));
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: { fullName: 'Jay', roleInCompany: 'foreman' } }),
}));
vi.mock('@/hooks/useEffectiveProjectId', () => ({
  useEffectiveProjectId: () => ({ projectId: 'proj-1', isResolving: false }),
}));

let _data: LotsShellData;
vi.mock('../lotsShellContext', () => ({
  useLotsShellContext: () => _data,
}));
vi.mock('../useShellItpRun', () => ({
  useShellItpRun: () => ({
    instance: null,
    loading: false,
    loadError: null,
    isOfflineData: false,
    pendingCount: 0,
    updatingItemId: null,
    completionFor: vi.fn(),
    pass: vi.fn(),
    markNA: vi.fn(),
    markFailed: vi.fn(),
    addPhoto: vi.fn(),
    refetch: vi.fn(),
  }),
}));

import { LotHubScreen } from '../LotHubScreen';

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

function makeData(): LotsShellData {
  return {
    projectId: 'proj-1',
    lots: [makeLot({ id: 'lot-1' })],
    loading: false,
    error: false,
    checksDue: {},
    refetch: vi.fn(),
  };
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/m/lots/lot-1']}>
      <Routes>
        <Route path="/m/lots/:lotId" element={<LotHubScreen />} />
        <Route path="/m/docs" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('LotHubScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _data = makeData();
  });

  it('carries project and lot context to the Drawings & Docs surface', () => {
    renderScreen();

    fireEvent.click(screen.getByRole('button', { name: 'Drawings for this lot' }));

    expect(screen.getByTestId('location')).toHaveTextContent(
      '/m/docs?projectId=proj-1&lotId=lot-1',
    );
  });
});
