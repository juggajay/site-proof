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
import type { ITPCompletion, ITPInstance } from '@/pages/lots/types';
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
let _instance: ITPInstance | null;
vi.mock('../useShellItpRun', () => ({
  useShellItpRun: () => ({
    instance: _instance,
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

function makeInstance(completions: ITPCompletion[]): ITPInstance {
  const items = ['a', 'b', 'c'].map((id, index) => ({
    id,
    description: `Item ${id}`,
    category: 'General',
    responsibleParty: 'contractor' as const,
    isHoldPoint: false,
    pointType: 'standard' as const,
    evidenceRequired: 'none' as const,
    order: index,
  }));
  return {
    id: 'inst-1',
    template: { id: 'template-1', name: 'ITP', checklistItems: items },
    completions,
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
    _instance = null;
  });

  it('carries project and lot context to the Drawings & Docs surface', () => {
    renderScreen();

    fireEvent.click(screen.getByRole('button', { name: 'Drawings for this lot' }));

    expect(screen.getByTestId('location')).toHaveTextContent(
      '/m/docs?projectId=proj-1&lotId=lot-1',
    );
  });

  it('shows failed inspections instead of a green done chip', () => {
    _instance = makeInstance([
      {
        id: 'c-a',
        checklistItemId: 'a',
        isCompleted: true,
        notes: null,
        completedAt: null,
        completedBy: null,
        isVerified: false,
        verifiedAt: null,
        verifiedBy: null,
        attachments: [],
      },
      {
        id: 'c-b',
        checklistItemId: 'b',
        isCompleted: true,
        notes: null,
        completedAt: null,
        completedBy: null,
        isVerified: false,
        verifiedAt: null,
        verifiedBy: null,
        attachments: [],
      },
      {
        id: 'c-c',
        checklistItemId: 'c',
        isCompleted: false,
        isFailed: true,
        notes: 'Failed density',
        completedAt: null,
        completedBy: null,
        isVerified: false,
        verifiedAt: null,
        verifiedBy: null,
        attachments: [],
      },
    ]);

    renderScreen();

    expect(screen.getByRole('button', { name: /2 passed checks/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /1 failed check/i })).toBeInTheDocument();
    expect(screen.getByText('1 failed')).toBeInTheDocument();
    expect(screen.queryByText('Done')).not.toBeInTheDocument();
  });
});
