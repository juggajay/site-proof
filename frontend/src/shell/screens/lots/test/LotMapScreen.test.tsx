/**
 * Tests for LotMapScreen — mounts the shell's map surface and proves the props it
 * resolves for the (heavy, lazy) LotMapView.
 *
 * LotMapView is mocked as a whole so react-leaflet never mounts; the mock captures
 * the props it receives. Foreman-truth: canManageSettings must be false so foremen
 * never get "Draw lot".
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Lot } from '@/pages/lots/lotsPageTypes';

vi.mock('@/lib/useOfflineStatus', () => ({
  useOfflineStatus: () => ({ isOnline: true, pendingSyncCount: 0, isSyncing: false }),
}));

let _role = 'foreman';
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: { fullName: 'Jay', roleInCompany: _role } }),
}));

// Projects query → resolves the snapshot-caption name from shared cache.
vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: { projects: [{ id: 'proj-1', name: 'Northern Bypass' }] } }),
}));

let _data: ReturnType<typeof makeData>;
vi.mock('../lotsShellContext', () => ({
  useLotsShellContext: () => _data,
}));

let capturedProps: Record<string, unknown> | undefined;
vi.mock('@/pages/lots/map/LotMapView', () => ({
  LotMapView: (props: Record<string, unknown>) => {
    capturedProps = props;
    return <div data-testid="lot-map-view">map</div>;
  },
}));

import { LotMapScreen } from '../LotMapScreen';

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

function makeData(
  lots: Lot[],
  over: { projectId?: string | null; loading?: boolean; error?: boolean } = {},
) {
  return {
    projectId: 'proj-1' as string | null,
    lots,
    loading: false,
    error: false,
    checksDue: {} as Record<string, number>,
    refetch: vi.fn(),
    ...over,
  };
}

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/m/lots/map']}>
      <LotMapScreen />
    </MemoryRouter>,
  );
}

describe('LotMapScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _role = 'foreman';
    capturedProps = undefined;
  });

  it('renders the map with the project id, all lot ids, project name and lots', async () => {
    _data = makeData([
      makeLot({ id: 'a', lotNumber: 'LOT-001' }),
      makeLot({ id: 'b', lotNumber: 'LOT-002' }),
    ]);
    renderScreen();

    expect(await screen.findByTestId('lot-map-view')).toBeInTheDocument();
    expect(capturedProps?.projectId).toBe('proj-1');
    expect(capturedProps?.projectName).toBe('Northern Bypass');
    expect(capturedProps?.filteredLotIds).toEqual(new Set(['a', 'b']));
    expect(capturedProps?.lots).toHaveLength(2);
  });

  it('passes canManageSettings=false for a foreman (no Draw lot)', async () => {
    _role = 'foreman';
    _data = makeData([makeLot({ id: 'a' })]);
    renderScreen();

    await screen.findByTestId('lot-map-view');
    expect(capturedProps?.canManageSettings).toBe(false);
  });

  it('passes canManageSettings=true for a project manager', async () => {
    _role = 'project_manager';
    _data = makeData([makeLot({ id: 'a' })]);
    renderScreen();

    await screen.findByTestId('lot-map-view');
    expect(capturedProps?.canManageSettings).toBe(true);
  });

  it('shows a no-project state and never mounts the map without an id', () => {
    _data = makeData([], { projectId: null });
    renderScreen();

    expect(screen.getByText(/No project selected/i)).toBeInTheDocument();
    expect(screen.queryByTestId('lot-map-view')).toBeNull();
  });
});
