/**
 * Tests for ItpRunScreen — the foreman ITP run.
 *
 * The run's data + mutations come from useShellItpRun; we mock it at that hook
 * boundary so PASS fires the reused completion mutation (incl. the offline path,
 * which lives behind the mocked hook), the N/A-with-reason path is exercised, and
 * a hold-point item surfaces "Awaiting hold point release" with NO Pass button.
 *
 * MOCKS @/lib/useOfflineStatus for CI coverage parity (ShellScreen → SyncChip).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { ITPChecklistItem, ITPCompletion, ITPInstance } from '@/pages/lots/types';

vi.mock('@/lib/useOfflineStatus', () => ({
  useOfflineStatus: () => ({ isOnline: true, pendingSyncCount: 0, isSyncing: false }),
}));
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: { fullName: 'Jay', roleInCompany: 'foreman' } }),
}));
vi.mock('@/hooks/useEffectiveProjectId', () => ({
  useEffectiveProjectId: () => ({ projectId: 'proj-1', isResolving: false }),
}));
vi.mock('../lotsShellContext', () => ({
  useLotsShellContext: () => ({
    projectId: 'proj-1',
    lots: [],
    loading: false,
    error: false,
    checksDue: {},
    refetch: vi.fn(),
  }),
}));

// The run hook, mutable per test.
const pass = vi.fn().mockResolvedValue(true);
const markNA = vi.fn().mockResolvedValue(true);
const markFailed = vi.fn().mockResolvedValue(true);
const addPhoto = vi.fn().mockResolvedValue(undefined);
let _run: ReturnType<typeof makeRun>;
vi.mock('../useShellItpRun', () => ({
  useShellItpRun: () => _run,
}));

import { ItpRunScreen } from '../ItpRunScreen';

function makeItem(over: Partial<ITPChecklistItem>): ITPChecklistItem {
  return {
    id: 'item-1',
    description: 'Classify fill material',
    category: 'Earthworks',
    responsibleParty: 'contractor',
    isHoldPoint: false,
    pointType: 'standard',
    evidenceRequired: 'photo',
    order: 0,
    ...over,
  };
}

function makeInstance(items: ITPChecklistItem[], completions: ITPCompletion[] = []): ITPInstance {
  return {
    id: 'inst-1',
    template: { id: 't1', name: 'Earthworks ITP', checklistItems: items },
    completions,
  };
}

function makeRun(instance: ITPInstance | null) {
  return {
    instance,
    loading: false,
    loadError: null as string | null,
    isOfflineData: false,
    pendingCount: 0,
    updatingItemId: null as string | null,
    completionFor: (id: string) => instance?.completions.find((c) => c.checklistItemId === id),
    pass,
    markNA,
    markFailed,
    addPhoto,
    refetch: vi.fn(),
  };
}

function renderRun() {
  return render(
    <MemoryRouter initialEntries={['/m/lots/lot-1/itp']}>
      <Routes>
        <Route path="/m/lots/:lotId/itp" element={<ItpRunScreen />} />
        <Route path="/m/lots/:lotId" element={<div>lot hub</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ItpRunScreen — active item', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders category pill, the big question, subline and CHECK n/m', () => {
    _run = makeRun(makeInstance([makeItem({})]));
    renderRun();
    expect(screen.getByText('EARTHWORKS')).toBeInTheDocument();
    expect(screen.getByText('Classify fill material')).toBeInTheDocument();
    expect(screen.getByText(/Responsible: Contractor/)).toBeInTheDocument();
    expect(screen.getByText('CHECK 1/1')).toBeInTheDocument();
  });

  it('PASS fires the reused completion mutation and shows a pass-flash', async () => {
    _run = makeRun(
      makeInstance([makeItem({ id: 'a' }), makeItem({ id: 'b', description: 'Second' })]),
    );
    renderRun();
    fireEvent.click(screen.getByRole('button', { name: /Pass this check/i }));
    await waitFor(() => expect(pass).toHaveBeenCalledWith('a', null));
  });

  it('N/A opens reason capture and submits with the reason', async () => {
    _run = makeRun(makeInstance([makeItem({ id: 'a' })]));
    renderRun();
    fireEvent.click(screen.getByRole('button', { name: /Mark not applicable/i }));
    const textarea = screen.getByPlaceholderText(/not applicable/i);
    fireEvent.change(textarea, { target: { value: 'Not in this lot' } });
    fireEvent.click(screen.getByRole('button', { name: /^Mark N\/A$/i }));
    await waitFor(() => expect(markNA).toHaveBeenCalledWith('a', 'Not in this lot'));
  });

  it('N/A without a reason shows a validation error and does not submit', () => {
    _run = makeRun(makeInstance([makeItem({ id: 'a' })]));
    renderRun();
    fireEvent.click(screen.getByRole('button', { name: /Mark not applicable/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Mark N\/A$/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/reason/i);
    expect(markNA).not.toHaveBeenCalled();
  });

  it('FAIL opens reason capture and reuses the existing fail flow', async () => {
    _run = makeRun(makeInstance([makeItem({ id: 'a' })]));
    renderRun();
    fireEvent.click(screen.getByRole('button', { name: /Fail this check/i }));
    const textarea = screen.getByPlaceholderText(/Describe the issue/i);
    fireEvent.change(textarea, { target: { value: 'Out of spec' } });
    fireEvent.click(screen.getByRole('button', { name: /^Mark failed$/i }));
    await waitFor(() => expect(markFailed).toHaveBeenCalledWith('a', 'Out of spec'));
  });

  it('adds an evidence photo via the reused upload', () => {
    _run = makeRun(makeInstance([makeItem({ id: 'a' })]));
    const { container } = renderRun();
    const file = new File(['x'], 'p.jpg', { type: 'image/jpeg' });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    expect(addPhoto).toHaveBeenCalledWith('a', file);
  });
});

describe('ItpRunScreen — hold-point gating', () => {
  beforeEach(() => vi.clearAllMocks());

  it('an un-released hold point shows awaiting-release and NO Pass button', () => {
    _run = makeRun(
      makeInstance([
        makeItem({ id: 'hp', pointType: 'hold_point', isHoldPoint: true, description: 'HP check' }),
      ]),
    );
    renderRun();
    expect(screen.getByText(/Awaiting hold point release/i)).toBeInTheDocument();
    // The tri-state Pass affordance must NOT be offered for an un-released HP.
    expect(screen.queryByRole('button', { name: /Pass this check/i })).toBeNull();
    // N/A + Fail remain available on the hold point.
    expect(screen.getByRole('button', { name: /N\/A/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Fail/i })).toBeInTheDocument();
  });

  it('a released hold point CAN be passed', async () => {
    const released: ITPCompletion = {
      id: 'c-hp',
      checklistItemId: 'hp',
      isCompleted: false,
      notes: null,
      completedAt: null,
      completedBy: null,
      isVerified: false,
      verifiedAt: null,
      verifiedBy: null,
      attachments: [],
      holdPointRelease: {
        releasedByName: 'Super',
        releasedByOrg: 'Council',
        releaseMethod: 'email',
        releasedAt: '2026-06-11',
      },
    };
    _run = makeRun(
      makeInstance(
        [makeItem({ id: 'hp', pointType: 'hold_point', isHoldPoint: true })],
        [released],
      ),
    );
    renderRun();
    expect(screen.queryByText(/Awaiting hold point release/i)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Pass this check/i }));
    await waitFor(() => expect(pass).toHaveBeenCalledWith('hp', null));
  });
});

describe('ItpRunScreen — finished + empty', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows the finished ceremony when every item is resolved', () => {
    _run = makeRun(
      makeInstance(
        [makeItem({ id: 'a' })],
        [
          {
            id: 'c-a',
            checklistItemId: 'a',
            isCompleted: true,
            notes: null,
            completedAt: '2026-06-11',
            completedBy: null,
            isVerified: false,
            verifiedAt: null,
            verifiedBy: null,
            attachments: [],
          },
        ],
      ),
    );
    renderRun();
    expect(screen.getByText('All checks complete')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Back to lot/i })).toBeInTheDocument();
  });

  it('shows a no-checklist state when there is no instance', () => {
    _run = makeRun(null);
    renderRun();
    expect(screen.getByText(/No ITP is assigned/i)).toBeInTheDocument();
  });
});
