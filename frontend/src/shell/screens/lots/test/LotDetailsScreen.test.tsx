/**
 * Tests for LotDetailsScreen — read-only details + honest derived readiness.
 * Asserts there are NO edit affordances (foreman read-only) and that the
 * readiness line is derived (never the gated commercial endpoint).
 *
 * MOCKS @/lib/useOfflineStatus for CI coverage parity (ShellScreen → SyncChip).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { Lot } from '@/pages/lots/lotsPageTypes';
import type { ITPInstance } from '@/pages/lots/types';

vi.mock('@/lib/useOfflineStatus', () => ({
  useOfflineStatus: () => ({ isOnline: true, pendingSyncCount: 0, isSyncing: false }),
}));
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: { fullName: 'Jay', roleInCompany: 'foreman' } }),
}));
vi.mock('@/hooks/useEffectiveProjectId', () => ({
  useEffectiveProjectId: () => ({ projectId: 'proj-1', isResolving: false }),
}));

let _lots: Lot[];
let _checksDue: Record<string, number>;
vi.mock('../lotsShellContext', () => ({
  useLotsShellContext: () => ({
    projectId: 'proj-1',
    lots: _lots,
    loading: false,
    error: false,
    checksDue: _checksDue,
    refetch: vi.fn(),
  }),
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
    completionFor: () => undefined,
    pass: vi.fn(),
    markNA: vi.fn(),
    markFailed: vi.fn(),
    addPhoto: vi.fn(),
    refetch: vi.fn(),
  }),
}));

import { LotDetailsScreen } from '../LotDetailsScreen';

function makeLot(over: Partial<Lot>): Lot {
  return {
    id: 'lot-1',
    lotNumber: 'LOT-001',
    description: 'Embankment Ch 100-200',
    status: 'in_progress',
    chainageStart: 100,
    chainageEnd: 200,
    offset: null,
    layer: null,
    areaZone: null,
    ...over,
  };
}

function instanceWith(total: number, resolved: number): ITPInstance {
  const items = Array.from({ length: total }, (_, i) => ({
    id: `i${i}`,
    description: `Item ${i}`,
    category: 'General',
    responsibleParty: 'contractor' as const,
    isHoldPoint: false,
    pointType: 'standard' as const,
    evidenceRequired: 'none' as const,
    order: i,
  }));
  const completions = items.slice(0, resolved).map((it) => ({
    id: `c${it.id}`,
    checklistItemId: it.id,
    isCompleted: true,
    notes: null,
    completedAt: '2026-06-11',
    completedBy: null,
    isVerified: false,
    verifiedAt: null,
    verifiedBy: null,
    attachments: [],
  }));
  return { id: 'inst-1', template: { id: 't1', name: 'ITP', checklistItems: items }, completions };
}

function instanceWithFailedCheck(): ITPInstance {
  const items = Array.from({ length: 3 }, (_, i) => ({
    id: `i${i}`,
    description: `Item ${i}`,
    category: 'General',
    responsibleParty: 'contractor' as const,
    isHoldPoint: false,
    pointType: 'standard' as const,
    evidenceRequired: 'none' as const,
    order: i,
  }));
  return {
    id: 'inst-1',
    template: { id: 't1', name: 'ITP', checklistItems: items },
    completions: [
      {
        id: 'c0',
        checklistItemId: 'i0',
        isCompleted: true,
        notes: null,
        completedAt: '2026-06-11',
        completedBy: null,
        isVerified: false,
        verifiedAt: null,
        verifiedBy: null,
        attachments: [],
      },
      {
        id: 'c1',
        checklistItemId: 'i1',
        isCompleted: true,
        notes: null,
        completedAt: '2026-06-11',
        completedBy: null,
        isVerified: false,
        verifiedAt: null,
        verifiedBy: null,
        attachments: [],
      },
      {
        id: 'c2',
        checklistItemId: 'i2',
        isCompleted: false,
        isFailed: true,
        notes: 'Failed density',
        completedAt: '2026-06-11',
        completedBy: null,
        isVerified: false,
        verifiedAt: null,
        verifiedBy: null,
        attachments: [],
      },
    ],
  };
}

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/m/lots/lot-1/details']}>
      <Routes>
        <Route path="/m/lots/:lotId/details" element={<LotDetailsScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('LotDetailsScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _lots = [makeLot({})];
    _checksDue = {};
    _instance = instanceWith(5, 3);
  });

  it('renders read-only lot fields and status', () => {
    renderScreen();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('100–200')).toBeInTheDocument();
    expect(screen.getByText('3 passed checks · 2 checks not started')).toBeInTheDocument();
  });

  it('derives a "what\'s left" readiness line (not the gated endpoint)', () => {
    renderScreen();
    expect(screen.getByText(/What’s left/)).toBeInTheDocument();
    expect(screen.getByText(/2 checks left/i)).toBeInTheDocument();
  });

  it('shows conformable copy when all done and no issues', () => {
    _instance = instanceWith(5, 5);
    _lots = [makeLot({ ncrCount: 0 })];
    renderScreen();
    expect(screen.getByText(/ready for the office/i)).toBeInTheDocument();
  });

  it('open issues block the readiness line', () => {
    _instance = instanceWith(5, 5);
    _lots = [makeLot({ ncrCount: 2 })];
    renderScreen();
    expect(screen.getByText(/2 open issues/i)).toBeInTheDocument();
  });

  it('shows failed ITP checks as blockers, not completed work', () => {
    _instance = instanceWithFailedCheck();
    _lots = [makeLot({ ncrCount: 1 })];
    renderScreen();
    expect(screen.getByText(/2 passed checks/i)).toBeInTheDocument();
    expect(screen.getAllByText(/1 failed check/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/1 failed check to resolve/i)).toBeInTheDocument();
    expect(screen.getByText(/1 open issue/i)).toBeInTheDocument();
  });

  it('has NO edit affordances (read-only)', () => {
    renderScreen();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: /edit|save|conform|change status/i })).toBeNull();
    // The "conformance is the office's call" copy is present.
    expect(screen.getByText(/conformance is set by the office/i)).toBeInTheDocument();
  });
});
